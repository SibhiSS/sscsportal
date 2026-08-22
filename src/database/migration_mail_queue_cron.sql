-- ==============================================================================
-- The backstop that makes a mail blast survive the admin closing their laptop
-- Run this AFTER migration_mail_queue.sql AND after deploying the send-email
-- Edge Function. Idempotent — re-running is safe.
-- ==============================================================================
--
-- The Edge Function drains mail_queue in the background immediately after
-- enqueueing a batch (via EdgeRuntime.waitUntil — see supabase/functions/
-- send-email/index.ts). That covers the common case with no extra setup, but
-- background execution after an HTTP response has a bounded lifetime: a batch
-- large enough to outlast it would stall with rows still 'pending' and nothing
-- left running to finish them.
--
-- This is the fix: a pg_cron job that invokes the same Edge Function's
-- `process` action every minute, over HTTP, from inside Postgres itself —
-- independent of the admin's browser, independent of whether the background
-- task that started the batch is still alive. A stalled batch resumes on the
-- next tick and finishes unattended.
--
-- Requires the `pg_cron` and `pg_net` extensions, enabled once from the
-- Supabase dashboard: Database → Extensions → search "pg_cron" and "pg_net" →
-- Enable. Both are available on every plan including Free.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ==============================================================================
-- 1. Where to call, and with what credentials
-- ------------------------------------------------------------------------------
-- The Edge Function URL and a service-role-equivalent secret live in Postgres
-- config rather than hardcoded here, so rotating either is an ALTER DATABASE,
-- not a migration. Set both once, replacing the placeholders:
--
--   ALTER DATABASE postgres SET app.settings.edge_function_base_url =
--     'https://<your-project-ref>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.settings.mail_cron_secret =
--     '<a long random string, ALSO set as the MAIL_CRON_SECRET secret on the
--       send-email Edge Function via `supabase secrets set`>';
--
-- MAIL_CRON_SECRET is deliberately a separate value from anything already
-- used elsewhere (not the Supabase anon key, not a JWT) — pg_net calls the
-- function with no user session attached, so the function needs a way to
-- tell "this is the scheduled sweep" apart from an unauthenticated stranger
-- that found the URL. Comparing this one shared secret is the entire check;
-- it grants access to nothing but "process whatever is already queued".
-- ==============================================================================


-- ==============================================================================
-- 2. The scheduled sweep
-- ==============================================================================

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'mail-queue-drain';

SELECT cron.schedule(
  'mail-queue-drain',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.edge_function_base_url', true) || '/send-email',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-mail-cron-secret', current_setting('app.settings.mail_cron_secret', true)
               ),
    body    := jsonb_build_object('action', 'process', 'limit', 25),
    timeout_milliseconds := 20000
  );
  $$
);

-- Should show one row, schedule '* * * * *', active = true.
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'mail-queue-drain';
