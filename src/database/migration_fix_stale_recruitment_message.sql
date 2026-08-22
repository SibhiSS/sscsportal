-- ==============================================================================
-- Clear the stale "Recruitment is currently open." closed-screen message
-- Run this in the Supabase SQL Editor. It is idempotent — re-running is safe.
-- ==============================================================================
--
-- app_settings.recruitment_status.message is closed-screen copy: recruitment_window()
-- returns it, and /apply renders it under the "Recruitments are closed" heading.
--
-- Databases built from schema.sql or migration_complete_rls_fix.sql were seeded with
-- '{"isOpen": true, "message": "Recruitment is currently open."}'. migration_recruitment_window.sql
-- only supplies its own '"message": ""' on a fresh INSERT, so on any existing database
-- that placeholder survived — and once the window actually closed the screen read:
--
--     Recruitments are closed
--     Recruitment is currently open.
--
-- This clears the placeholder so the UI falls back to its own closed-screen copy.
-- An admin-authored message is left alone: only the two known seed strings are
-- matched, not any message that happens to contain the word "open".
-- ==============================================================================

UPDATE public.app_settings
   SET value = jsonb_set(value, '{message}', '""'::jsonb)
 WHERE key = 'recruitment_status'
   AND btrim(COALESCE(value ->> 'message', '')) IN (
     'Recruitment is currently open.',
     'Recruitment is currently open'
   );

-- Should return one row with an empty message.
SELECT key,
       value ->> 'isOpen'  AS is_open,
       value ->> 'message' AS message
  FROM public.app_settings
 WHERE key = 'recruitment_status';
