-- ==============================================================================
-- SECURITY HARDENING — derived from the LIVE policy state (pg_policies dump)
-- Run this in the Supabase SQL Editor.
--
-- Covers four issues found against the live database:
--   1. "Students can update their own application" grants applicants write access
--      to every column of their own row, including status / scores / assigned_position.
--   2. Two permissive INSERT policies OR together, so the weaker one wins and the
--      user_id binding is unenforced.
--   3. app_settings is world-readable (USING true) and holds the AI provider API key.
--   4. SECURITY DEFINER helpers have a mutable search_path.
--
-- NOTE: this file assumes candidate_notes / application_status_history / interviews
-- do NOT exist (confirmed absent from pg_tables). Nothing here touches them.
-- ==============================================================================


-- ==============================================================================
-- 1. Stop applicants from writing evaluation columns
-- ------------------------------------------------------------------------------
-- The policy cannot simply be dropped: it is load-bearing for Apply.tsx (editing a
-- submission) and ScheduleInterview.tsx (booking a slot). Postgres RLS has no
-- column-level granularity, so we enforce the column whitelist in a trigger.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.guard_applicant_update_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Columns an applicant is allowed to edit on their own row.
  -- Everything not listed here (status, rating, task_score, interview_score,
  -- final_score, resume_score, rank_in_dept, assigned_position, shortlist_notified,
  -- reminder_sent, decided_at, interviewed_at, email, user_id, created_at, ...)
  -- is admin-only.
  allowed_cols TEXT[] := ARRAY[
    'full_name', 'phone', 'roll_number',
    'primary_dept', 'domains', 'skills', 'reason',
    'secondary_dept', 'secondary_domains', 'secondary_skills', 'secondary_reason',
    'department', 'year',
    'admission_year', 'program_code', 'program_name', 'batch', 'program_category',
    'notes',
    'github_url', 'linkedin_url', 'portfolio_url',
    'resume_url', 'resume_filename', 'resume_uploaded_at', 'parsed_skills',
    'updated_at'
  ];
  changed_col TEXT;
BEGIN
  -- Only browser sessions carry an 'authenticated' role. The service_role key used by
  -- the Apps Script crons reports 'service_role', and a direct SQL/dashboard connection
  -- reports NULL. Neither represents an applicant, and RLS already blocks 'anon'.
  --
  -- This check is NOT optional: triggers still fire for service_role even though RLS
  -- does not apply to it, so without it checkShortlistedExpiry() (shortlisted ->
  -- waitlisted) would raise an exception and the nightly automation would break.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Admins bypass entirely.
  IF is_any_admin() THEN
    RETURN NEW;
  END IF;

  -- Status is locked, with one narrow carve-out: booking an interview slot.
  -- ScheduleInterview.tsx performs: status -> 'interview_scheduled' (+ shortlisted_at).
  -- If your real pipeline enters booking from a status other than 'shortlisted',
  -- widen the OLD.status test below to match.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'shortlisted' AND NEW.status = 'interview_scheduled') THEN
    RAISE EXCEPTION 'Applicants may not change application status (% -> %).',
      OLD.status, NEW.status;
  END IF;

  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    -- Already validated above.
    CONTINUE WHEN changed_col = 'status';
    -- Written alongside the permitted booking transition.
    CONTINUE WHEN changed_col = 'shortlisted_at'
                  AND NEW.status = 'interview_scheduled';

    IF NOT (changed_col = ANY (allowed_cols)) THEN
      RAISE EXCEPTION 'Applicants may not modify column "%".', changed_col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_applicant_update ON public.applications;
CREATE TRIGGER tr_guard_applicant_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_applicant_update_fn();


-- ==============================================================================
-- 2. Collapse the two INSERT policies into one correct policy
-- ------------------------------------------------------------------------------
-- Permissive policies OR together, so "applications_insert" (the weaker of the two)
-- was overriding both the user_id binding AND the domain check in
-- "Students can insert their own application".
--
-- The domain check is KEPT here, not dropped. It is not redundant with
-- restrict_user_email_domain() on auth.users, because that trigger is BEFORE INSERT
-- only: a user who signs up with a VIT address and later changes their email goes
-- through UPDATE, which never fires it. It is also widened from the original, which
-- allowed only @vitstudent.ac.in and so locked out @vit.ac.in staff.
-- ==============================================================================

DROP POLICY IF EXISTS "Students can insert their own application" ON public.applications;
DROP POLICY IF EXISTS "applications_insert" ON public.applications;

CREATE POLICY "applications_insert"
ON public.applications FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.email() = email
  AND (auth.uid())::text = user_id
  AND (
    email LIKE '%@vitstudent.ac.in'
    OR email LIKE '%@vit.ac.in'
    -- Super-admin exception, mirrors AuthContext.tsx. Remove if that account
    -- should never submit an application.
    OR email = 'sibhis5223@gmail.com'
  )
);


-- ==============================================================================
-- 3. Stop app_settings from leaking the AI provider API key
-- ------------------------------------------------------------------------------
-- "app_settings_select USING (true)" makes every row readable by ANY caller holding
-- the anon key — which ships in the public JS bundle. The AI key currently lives in
-- the 'recruitment_status' row, so it is world-readable today.
--
-- This splits reads: the public may read everything EXCEPT the 'ai_settings' row.
-- REQUIRES a matching code change (see notes at the bottom of this file).
-- ==============================================================================

DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;

CREATE POLICY "app_settings_select_public"
ON public.app_settings FOR SELECT
USING (key <> 'ai_settings');

CREATE POLICY "app_settings_select_admin"
ON public.app_settings FOR SELECT
USING (is_admin_or_super());

-- Move any existing AI settings out of the public row into the protected one.
INSERT INTO public.app_settings (key, value)
SELECT 'ai_settings', value -> 'aiSettings'
FROM public.app_settings
WHERE key = 'recruitment_status'
  AND value ? 'aiSettings'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

UPDATE public.app_settings
SET value = value - 'aiSettings'
WHERE key = 'recruitment_status'
  AND value ? 'aiSettings';


-- ==============================================================================
-- 4. Pin search_path on every SECURITY DEFINER function
-- ------------------------------------------------------------------------------
-- Without this, a mutable search_path lets an attacker who can create objects in a
-- schema on the path shadow the tables these functions resolve. Standard Supabase lint.
-- ==============================================================================

ALTER FUNCTION public.is_any_admin()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.is_super_admin()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_super()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_role()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_applications_trigger_fn()     SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_admins_trigger_fn()           SET search_path = public, pg_temp;
ALTER FUNCTION public.sanitize_application_input_fn()     SET search_path = public, pg_temp;
ALTER FUNCTION public.restrict_user_email_domain()        SET search_path = public, pg_temp;
-- These two may not exist depending on which migrations you ran; ignore "does not exist".
ALTER FUNCTION public.is_admin()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_above()                 SET search_path = public, pg_temp;


-- ==============================================================================
-- 5. Extend input sanitisation to the fields rendered as raw HTML
-- ------------------------------------------------------------------------------
-- AICopilotPanel.tsx renders AI summary bullets through dangerouslySetInnerHTML, and
-- those bullets interpolate program_name / department / batch / primary_dept /
-- secondary_dept. The existing sanitiser only stripped reason / skills / notes, and a
-- direct PostgREST insert bypasses the form entirely.
-- This is defence in depth — still fix the React side.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sanitize_application_input_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.roll_number := UPPER(TRIM(NEW.roll_number));
  NEW.email       := LOWER(TRIM(NEW.email));
  NEW.full_name   := TRIM(NEW.full_name);
  NEW.phone       := REGEXP_REPLACE(NEW.phone, '\D', '', 'g');

  -- Strip anything tag-like from every free-text field that reaches the admin UI.
  -- No COALESCE: REGEXP_REPLACE(NULL, ...) is NULL, so empty fields stay NULL rather
  -- than silently becoming ''.
  NEW.full_name        := REGEXP_REPLACE(NEW.full_name,        '[<>]', '', 'g');
  NEW.reason           := REGEXP_REPLACE(NEW.reason,           '[<>]', '', 'g');
  NEW.skills           := REGEXP_REPLACE(NEW.skills,           '[<>]', '', 'g');
  NEW.notes            := REGEXP_REPLACE(NEW.notes,            '[<>]', '', 'g');
  NEW.secondary_skills := REGEXP_REPLACE(NEW.secondary_skills, '[<>]', '', 'g');
  NEW.secondary_reason := REGEXP_REPLACE(NEW.secondary_reason, '[<>]', '', 'g');
  NEW.primary_dept     := REGEXP_REPLACE(NEW.primary_dept,     '[<>]', '', 'g');
  NEW.secondary_dept   := REGEXP_REPLACE(NEW.secondary_dept,   '[<>]', '', 'g');
  NEW.program_name     := REGEXP_REPLACE(NEW.program_name,     '[<>]', '', 'g');
  NEW.program_code     := REGEXP_REPLACE(NEW.program_code,     '[<>]', '', 'g');
  NEW.program_category := REGEXP_REPLACE(NEW.program_category, '[<>]', '', 'g');
  NEW.department       := REGEXP_REPLACE(NEW.department,       '[<>]', '', 'g');
  NEW.batch            := REGEXP_REPLACE(NEW.batch,            '[<>]', '', 'g');
  NEW.year             := REGEXP_REPLACE(NEW.year,             '[<>]', '', 'g');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sanitize_application_input ON public.applications;
CREATE TRIGGER tr_sanitize_application_input
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_application_input_fn();


-- ==============================================================================
-- 6. interview_slots: stop leaking other candidates' meeting links, and un-break booking
-- ------------------------------------------------------------------------------
-- Two problems with the live policies:
--
--   a) "slots_select USING (auth.role() = 'authenticated' OR is_any_admin())" lets any
--      logged-in student read EVERY slot, including meeting_link — so anyone could sit
--      in on someone else's interview.
--
--   b) "slots_manage FOR ALL USING (is_any_admin())" is the only write policy, so an
--      applicant's booking UPDATE in ScheduleInterview.tsx is silently blocked by RLS.
--      It returns zero rows rather than an error and the code checks
--      `bookingResult.length > 0`, so booking fails with no message. This is a live bug.
--
-- The narrowed SELECT below matches what ScheduleInterview.tsx actually queries
-- (is_booked = false, plus its own row via booked_by), so no UI behaviour changes.
-- ==============================================================================

DROP POLICY IF EXISTS "slots_select" ON public.interview_slots;

CREATE POLICY "slots_select"
ON public.interview_slots FOR SELECT
USING (
  is_any_admin()
  OR is_booked = false
  OR EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = booked_by AND a.email = auth.email()
  )
);

-- Allow an applicant to claim a free slot — and only that.
CREATE POLICY "slots_book"
ON public.interview_slots FOR UPDATE
USING (auth.role() = 'authenticated' AND is_booked = false)
WITH CHECK (is_booked = true);

-- RLS cannot restrict WHICH columns an UPDATE touches, so the same whitelist pattern
-- as section 1 applies here: without this, "slots_book" would also let an applicant
-- rewrite start_time or meeting_link on any free slot.
CREATE OR REPLACE FUNCTION public.guard_slot_booking_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changed_col TEXT;
BEGIN
  -- Same bypass as tr_guard_applicant_update. Required here too: the 15-minute
  -- reminder cron writes reminder_sent on this table using the service_role key.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF is_any_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.is_booked IS DISTINCT FROM false OR NEW.is_booked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Applicants may only book a free slot.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = NEW.booked_by AND a.email = auth.email()
  ) THEN
    RAISE EXCEPTION 'You may only book a slot for your own application.';
  END IF;

  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    IF changed_col NOT IN ('is_booked', 'booked_by') THEN
      RAISE EXCEPTION 'Applicants may not modify interview_slots.%', changed_col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_slot_booking ON public.interview_slots;
CREATE TRIGGER tr_guard_slot_booking
  BEFORE UPDATE ON public.interview_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_slot_booking_fn();


-- ==============================================================================
-- 7. Drop redundant duplicate policies on applications
-- ------------------------------------------------------------------------------
-- These are semantically identical to applications_select_admin / applications_update,
-- but inline the EXISTS(...) lookup instead of calling the helper functions — so they
-- do not benefit from the search_path pinning in section 4. Pure noise, and one more
-- place to forget when auditing.
-- ==============================================================================

DROP POLICY IF EXISTS "Admins can view all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.applications;

-- "Students can view their own application" (matches on user_id) is intentionally
-- KEPT alongside applications_select_own (matches on email): the two cover each other
-- if a user's auth email ever diverges from the email stored on the row.


-- ==============================================================================
-- VERIFY
-- ==============================================================================
-- SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- Expect: exactly ONE INSERT policy on applications, and two SELECT policies on
-- app_settings (neither of them USING (true)).
--
-- Separately, confirm the signup-time domain trigger is actually installed --- it is
-- in the repo but may never have been run. Zero rows means only the policy above is
-- guarding the domain, and non-VIT accounts can be created (they just cannot apply):
--
--   SELECT tgname, tgrelid::regclass, tgenabled
--     FROM pg_trigger
--    WHERE tgname = 'tr_restrict_user_email_domain';
--
-- And check whether any non-VIT account already exists from before it was added:
--
--   SELECT email, created_at FROM auth.users
--    WHERE email NOT LIKE '%@vitstudent.ac.in'
--      AND email NOT LIKE '%@vit.ac.in';


-- ==============================================================================
-- REQUIRED CODE CHANGES (not done by this file)
-- ==============================================================================
-- a) src/services/aiService.ts:231 and src/components/admin/AdminSettings.tsx:135/211
--    read+write aiSettings inside the 'recruitment_status' row. Repoint both at the
--    new 'ai_settings' row, or step 3 above will silently disable AI analysis.
--
-- b) src/components/admin/AICopilotPanel.tsx:130 — drop dangerouslySetInnerHTML and
--    render **bold** as a React <strong> element. Step 5 is a mitigation, not a fix.
--
-- c) The AI provider key is still fetched into an admin browser, so any admin-side
--    XSS re-exposes it. The durable fix is proxying AI calls through a Supabase Edge
--    Function that holds the key server-side.
