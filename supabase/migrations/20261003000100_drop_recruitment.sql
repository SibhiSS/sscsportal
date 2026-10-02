-- =============================================================================
-- DROP LEFTOVER RECRUITMENT OBJECTS
--
-- !! DO NOT RUN until you have decided you no longer need the data below. !!
-- Dropping these tables deletes their rows for good. Export anything you want
-- to keep first (Supabase → Table editor → Export to CSV).
--
-- Run 20261003000000_club_panel.sql first.
--
-- Removed:
--   tables     interview_slots, interviews, interview_feedback,
--              panel_assignments, candidate_notes, application_status_history,
--              mail_queue, committee_quotas, department_weights, app_settings
--   type       recruitment_phase_enum
--   functions  slot booking, recruitment window, mail queue, applicant guards
--   cron job   mail-queue-drain
--
-- Kept on purpose:
--   applications  (now the member roster)
--   admins, audit_logs and their audit triggers
--   restrict_user_email_domain (blocks non-VIT Google sign-ups)
--   the old is_* admin helpers (other policies may still reference them)
-- =============================================================================

BEGIN;

-- 1. Stop the mail-queue cron job, if pg_cron is installed and the job exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    EXECUTE $q$
      SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mail-queue-drain'
    $q$;
  END IF;
END
$$;

-- 2. Tables. CASCADE removes their own triggers, policies and any foreign keys
--    that point at them; it never deletes rows from other tables.
DROP TABLE IF EXISTS public.interview_feedback          CASCADE;
DROP TABLE IF EXISTS public.interviews                  CASCADE;
DROP TABLE IF EXISTS public.panel_assignments           CASCADE;
DROP TABLE IF EXISTS public.interview_slots             CASCADE;
DROP TABLE IF EXISTS public.candidate_notes             CASCADE;
DROP TABLE IF EXISTS public.application_status_history  CASCADE;
DROP TABLE IF EXISTS public.mail_queue                  CASCADE;
DROP TABLE IF EXISTS public.committee_quotas            CASCADE;
DROP TABLE IF EXISTS public.department_weights          CASCADE;
DROP TABLE IF EXISTS public.app_settings                CASCADE;

DROP TYPE IF EXISTS public.recruitment_phase_enum;

-- 3. Functions, whatever their argument lists turned out to be. No CASCADE: if
--    something unexpected still depends on one, this fails and rolls back
--    instead of silently taking that something with it.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'available_slot_times',
        'book_interview_slot',
        'reschedule_interview_slot',
        'slot_change_limit',
        'my_interview_details',
        'claim_pending_mail',
        'mail_queue_apply_side_effect_fn',
        'mail_queue_batch_status',
        'mail_queue_dedupe_id',
        'mail_queue_touch_updated_at',
        'compute_total_interview_score',
        'enforce_recruitment_window_fn',
        'guard_applicant_update_fn',
        'guard_recruitment_schedule_fn',
        'guard_slot_booking_fn',
        'is_recruitment_open',
        'recruitment_window',
        'sanitize_application_input_fn'
      )
  LOOP
    EXECUTE format('DROP FUNCTION public.%I(%s)', r.proname, r.args);
  END LOOP;
END
$$;

COMMIT;
