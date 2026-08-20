-- Migration: per-slot notification flags for the Apps Script automations.
--
-- `automationCheck` runs on a 10-minute timer and decides what to send purely from a
-- time window (e.g. "0 to 10 minutes before the slot"). Trigger drift, a manual run, or
-- a retried execution can land the same slot inside the same window twice, and every
-- such repeat is a duplicate email in a candidate's inbox. These flags make each
-- notification send-once.
--
-- reminder_sent guards the single T-10 candidate reminder. The old T-15 cron
-- (src/backend/interview_15min_reminder_cron.js) and the separate T-0 "join now" mail
-- are gone: a candidate gets one email per booked slot.
--
-- reminder_sent is also declared in migration_reminder_sent.sql, which was never
-- applied to the live database — hence the T-15 cron silently did nothing, since
-- PostgREST rejected its `reminder_sent=is.false` filter. It is repeated here with
-- IF NOT EXISTS so this file stands on its own and is safe to re-run.

ALTER TABLE public.interview_slots
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

ALTER TABLE public.interview_slots
ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.interview_slots.reminder_sent IS
  'Set once the candidate has been sent their T-10 interview reminder, by automationCheck or by the manual "Send Mail" button in the interviewer dashboard.';
COMMENT ON COLUMN public.interview_slots.alert_sent IS
  'Set by automationCheck LOGIC 1 once the T-60 unassigned-panel / missing-link alert has gone out.';

-- Backfill: slots that already started must never trigger a retroactive notification
-- the first time the guarded code runs.
UPDATE public.interview_slots
SET alert_sent = true, reminder_sent = true
WHERE start_time < now();
