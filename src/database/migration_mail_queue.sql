-- ==============================================================================
-- A real mail queue, backed by a real ESP behind a Supabase Edge Function
-- Run this in the Supabase SQL Editor. It is idempotent — re-running is safe.
-- ==============================================================================
--
-- What this replaces:
--
-- Every email in this app has gone through a Google Apps Script Web App with
-- `mode: 'no-cors'` on the browser side. That means `sendEmail()` returning
-- `true` never meant "delivered" — only "the browser didn't throw before the
-- request left" — and every write that was gated on it (`shortlist_notified`,
-- publish results, committee offers, position offers) could be, and was, set
-- for candidates who were never actually mailed. It also capped the club at
-- Gmail's ~100/day quota and required the admin's tab to stay open for the
-- full length of a bulk send.
--
-- What this adds:
--
--   1. mail_queue — one durable row per email, ever. A single transactional
--      send (booking confirmation, reschedule notice) is inserted and resolved
--      in the same Edge Function call. A bulk send (notify shortlisted, publish
--      results, committee/position offers) is inserted in bulk and drained in
--      the background — by the Edge Function's own post-response execution
--      first, and by a scheduled pg_cron sweep as the backstop that survives
--      the admin's laptop closing (see migration_mail_queue_cron.sql).
--
--   2. A BOUNDED set of "on send, do this" actions (`purpose`), applied by a
--      trigger only once a row's status actually becomes 'sent' — never
--      before. This is deliberately NOT a generic "patch any table" mechanism:
--      a generic dynamic-SQL patch driven by client-supplied table/column
--      names, run as SECURITY DEFINER, would let anything that can enqueue
--      mail bypass every column whitelist in guard_applicant_update_fn and
--      write arbitrary columns on arbitrary tables. Every purpose below does
--      exactly the one UPDATE its call site already did by hand — same
--      columns, same WHERE guard against double-processing — just moved from
--      "after the browser trusts a lying no-cors response" to "after the
--      Edge Function has a real answer from the ESP".
--
-- Nothing in this migration talks to an email provider. That lives in the
-- Edge Function (supabase/functions/send-email/), which is provider-agnostic —
-- swapping providers later needs a secrets change, not a redeploy of this SQL.
-- ==============================================================================


-- ==============================================================================
-- 1. The queue itself
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.mail_queue (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- One row per logical email, forever. Deterministic for anything tied to an
  -- application + purpose (see mail_queue_dedupe_id() below), so re-clicking
  -- "Notify Shortlisted" before the first blast finishes is a harmless
  -- ON CONFLICT DO NOTHING rather than a second email.
  dedupe_id             TEXT NOT NULL UNIQUE,

  to_email              TEXT NOT NULL,
  subject               TEXT NOT NULL,
  html_body             TEXT NOT NULL,

  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts              INTEGER NOT NULL DEFAULT 0,
  max_attempts          INTEGER NOT NULL DEFAULT 5,
  last_error            TEXT,
  provider_message_id   TEXT,

  -- The bounded side effect to apply once (and only once) this row reaches
  -- 'sent'. NULL purpose = log-only, no side effect — used for mail that has
  -- nothing to flip (e.g. the urgent "no interviewer assigned" staff alert).
  purpose               TEXT
                          CHECK (purpose IS NULL OR purpose IN (
                            'shortlist_notify',
                            'publish_selected',
                            'publish_rejected',
                            'committee_offer',
                            'position_offer'
                          )),
  target_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  -- Only read for purpose = 'committee_offer' (CommitteeDraftBoard assigns a
  -- department at send time, distinct from a Position Manager position).
  assigned_position     TEXT,

  batch_label           TEXT,
  created_by            TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at               TIMESTAMPTZ
);

-- purpose implies target_application_id: every bounded action above updates a
-- specific application, so a purpose with no target is a caller bug, not a
-- valid "do nothing" state (that's what NULL purpose is for).
ALTER TABLE public.mail_queue
  DROP CONSTRAINT IF EXISTS mail_queue_purpose_needs_target;
ALTER TABLE public.mail_queue
  ADD CONSTRAINT mail_queue_purpose_needs_target
  CHECK (purpose IS NULL OR target_application_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_mail_queue_pending
  ON public.mail_queue (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mail_queue_batch
  ON public.mail_queue (batch_label)
  WHERE batch_label IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mail_queue_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_mail_queue_touch ON public.mail_queue;
CREATE TRIGGER tr_mail_queue_touch
  BEFORE UPDATE ON public.mail_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.mail_queue_touch_updated_at();


-- ==============================================================================
-- 2. Deterministic dedupe ids
-- ------------------------------------------------------------------------------
-- purpose + target -> the same dedupe_id every time, so ON CONFLICT DO NOTHING
-- on insert is real idempotency, not just a UNIQUE constraint waiting to throw.
-- Anything without a target (a one-off transactional send) gets a random one,
-- matching newDedupeId() on the client — dedupe there is about not double-
-- sending on a browser retry, not about "only one of this kind, ever".
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.mail_queue_dedupe_id(
  p_purpose TEXT,
  p_target  UUID,
  p_fallback TEXT
) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_purpose IS NOT NULL AND p_target IS NOT NULL
      THEN p_purpose || ':' || p_target::TEXT
    ELSE COALESCE(p_fallback, uuid_generate_v4()::TEXT)
  END;
$$;


-- ==============================================================================
-- 3. The bounded side-effect trigger
-- ------------------------------------------------------------------------------
-- Fires only on the transition INTO 'sent' — never on insert, never on a
-- retry that fails, never twice for the same row (a row can only become
-- 'sent' once; there is no path back to 'pending' after that).
--
-- Each branch is the exact UPDATE its call site used to run by hand after
-- trusting a no-cors response, with the same WHERE guard against
-- double-processing a candidate whose status already moved on.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.mail_queue_apply_side_effect_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'sent' OR OLD.status = 'sent' THEN
    RETURN NEW;
  END IF;

  IF NEW.purpose = 'shortlist_notify' THEN
    UPDATE public.applications
       SET shortlist_notified = true
     WHERE id = NEW.target_application_id;

  ELSIF NEW.purpose = 'publish_selected' THEN
    UPDATE public.applications
       SET status = 'active_member', decided_at = now()
     WHERE id = NEW.target_application_id
       AND status IN ('selected_pending', 'selected');

  ELSIF NEW.purpose = 'publish_rejected' THEN
    UPDATE public.applications
       SET status = 'rejected', decided_at = now()
     WHERE id = NEW.target_application_id
       AND status IN ('rejected_pending', 'waitlisted');

  ELSIF NEW.purpose = 'committee_offer' THEN
    UPDATE public.applications
       SET status = 'active_member', assigned_position = NEW.assigned_position
     WHERE id = NEW.target_application_id;

  ELSIF NEW.purpose = 'position_offer' THEN
    UPDATE public.applications
       SET status = 'active_member'
     WHERE id = NEW.target_application_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_mail_queue_side_effect ON public.mail_queue;
CREATE TRIGGER tr_mail_queue_side_effect
  AFTER UPDATE ON public.mail_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.mail_queue_apply_side_effect_fn();


-- ==============================================================================
-- 4. Claiming a batch to process
-- ------------------------------------------------------------------------------
-- FOR UPDATE SKIP LOCKED, same pattern as book_interview_slot(): if the
-- Edge Function's background drain and a pg_cron sweep ever overlap, each
-- claims a disjoint set of rows instead of racing to send the same email
-- twice. Rows move straight to 'sending' as part of the claim, so a crash
-- between claiming and finishing shows up as a stuck 'sending' row rather
-- than a silently repeated send.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.claim_pending_mail(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.mail_queue
LANGUAGE sql
AS $$
  UPDATE public.mail_queue
     SET status = 'sending'
   WHERE id IN (
           SELECT id FROM public.mail_queue
            WHERE status = 'pending'
              AND attempts < max_attempts
            ORDER BY created_at
            LIMIT p_limit
              FOR UPDATE SKIP LOCKED
         )
   RETURNING *;
$$;

-- Only the Edge Function calls this, using the service_role key, which
-- bypasses RLS and grants entirely. This GRANT is a no-op for that key but
-- keeps the function unusable if the anon/authenticated roles are ever
-- pointed at this file's objects by mistake.
REVOKE ALL ON FUNCTION public.claim_pending_mail(INTEGER) FROM PUBLIC, anon, authenticated;


-- ==============================================================================
-- 5. RLS
-- ------------------------------------------------------------------------------
-- Nobody inserts into this table from the browser — the Edge Function does
-- every insert and every status update using the service_role key, which
-- bypasses RLS entirely. What RLS needs to cover is read access: an admin
-- watching "Notify Shortlisted" progress from the Scheduler tab.
-- ==============================================================================

ALTER TABLE public.mail_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mail_queue_admin_read" ON public.mail_queue;
CREATE POLICY "mail_queue_admin_read"
ON public.mail_queue FOR SELECT
USING (is_any_admin());


-- ==============================================================================
-- 6. Batch progress, for the admin UI
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.mail_queue_batch_status(p_batch_label TEXT)
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT q.status, count(*)
    FROM public.mail_queue q
   WHERE q.batch_label = p_batch_label
     AND is_any_admin()
   GROUP BY q.status;
$$;

REVOKE ALL     ON FUNCTION public.mail_queue_batch_status(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mail_queue_batch_status(TEXT) TO authenticated;
