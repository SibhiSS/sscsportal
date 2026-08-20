-- ==============================================================================
-- RECRUITMENT WINDOW — scheduled open/close, enforced in the database
-- Run this in the Supabase SQL Editor AFTER migration_security_hardening_live.sql.
-- ------------------------------------------------------------------------------
-- Before this migration the only thing standing between a closed portal and a new
-- application was a React render branch in Apply.tsx. The anon key ships in the
-- public JS bundle, so anyone could POST straight to /rest/v1/applications while
-- "closed" and the insert succeeded. This moves the decision into Postgres and
-- leaves the UI as a mirror of it, not the enforcement.
--
-- Config lives in the existing app_settings row (key = 'recruitment_status'):
--
--   {
--     "isOpen":       true,                        -- manual master switch
--     "opensAt":      "2026-08-20T04:30:00.000Z",  -- optional, ISO-8601, nullable
--     "closesAt":     "2026-09-01T18:30:00.000Z",  -- optional, ISO-8601, nullable
--     "message":      "...",                       -- shown on the closed screen
--     "currentPhase": "APPLICATIONS_OPEN"
--   }
--
-- Effective state = isOpen AND now() >= opensAt (if set) AND now() < closesAt (if set).
-- closesAt is an exclusive bound: at exactly closesAt the form is shut.
-- ==============================================================================


-- ==============================================================================
-- 1. Seed the new keys (nullable = "no schedule, manual switch only")
-- ==============================================================================

INSERT INTO public.app_settings (key, value)
VALUES ('recruitment_status', '{"isOpen": false, "message": "", "currentPhase": "APPLICATIONS_OPEN", "opensAt": null, "closesAt": null}'::jsonb)
-- Adds the two keys as JSON null when absent and leaves every existing key —
-- isOpen, message, currentPhase — exactly as it was. Safe to re-run.
ON CONFLICT (key) DO UPDATE
SET value = app_settings.value
          || jsonb_build_object(
               'opensAt',  app_settings.value -> 'opensAt',
               'closesAt', app_settings.value -> 'closesAt'
             );


-- ==============================================================================
-- 2. The single source of truth
-- ------------------------------------------------------------------------------
-- SECURITY DEFINER so it can read app_settings from inside an RLS policy without
-- depending on the caller's own read grants. STABLE, not IMMUTABLE: it reads a
-- table and calls now().
--
-- Every failure path returns FALSE. A missing config row, a NULL value, or a
-- hand-edited timestamp that will not parse all mean "closed" — never "open".
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_recruitment_open()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cfg         jsonb;
  manual_open boolean;
  opens_at    timestamptz;
  closes_at   timestamptz;
BEGIN
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'recruitment_status';

  IF cfg IS NULL THEN
    RETURN false;
  END IF;

  manual_open := COALESCE((cfg ->> 'isOpen')::boolean, false);
  IF NOT manual_open THEN
    RETURN false;
  END IF;

  opens_at  := NULLIF(TRIM(COALESCE(cfg ->> 'opensAt',  '')), '')::timestamptz;
  closes_at := NULLIF(TRIM(COALESCE(cfg ->> 'closesAt', '')), '')::timestamptz;

  IF opens_at IS NOT NULL AND now() < opens_at THEN
    RETURN false;
  END IF;

  IF closes_at IS NOT NULL AND now() >= closes_at THEN
    RETURN false;
  END IF;

  RETURN true;
EXCEPTION WHEN others THEN
  -- Malformed config must never read as open.
  RETURN false;
END;
$$;


-- ==============================================================================
-- 3. Read model for the browser
-- ------------------------------------------------------------------------------
-- The client must not compute "is it past the deadline?" from the device clock —
-- a wrong clock (or a deliberately wound-back one) would disagree with the server.
-- This returns the verdict AND the server's own now(), so the UI renders a
-- countdown against server time and flips at the same instant the database does.
--
-- Deliberately scoped to the 'recruitment_status' row: it must never become a
-- back door around app_settings_select_public, which hides the 'ai_settings' row.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.recruitment_window()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cfg jsonb;
BEGIN
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'recruitment_status';

  RETURN jsonb_build_object(
    'isOpen',     public.is_recruitment_open(),
    'manualOpen', COALESCE((cfg ->> 'isOpen')::boolean, false),
    'opensAt',    cfg -> 'opensAt',
    'closesAt',   cfg -> 'closesAt',
    'message',    COALESCE(cfg ->> 'message', ''),
    'phase',      COALESCE(cfg ->> 'currentPhase', 'APPLICATIONS_OPEN'),
    -- Strict ISO-8601 with exactly 3 fractional digits. to_jsonb(now()) would emit
    -- microseconds and a +00:00 offset, which is outside what Date.parse() promises.
    'serverTime', to_jsonb(to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'isOpen',     false,
    'manualOpen', false,
    'opensAt',    NULL,
    'closesAt',   NULL,
    'message',    '',
    'phase',      'APPLICATIONS_OPEN',
    -- Strict ISO-8601 with exactly 3 fractional digits. to_jsonb(now()) would emit
    -- microseconds and a +00:00 offset, which is outside what Date.parse() promises.
    'serverTime', to_jsonb(to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_recruitment_open() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recruitment_window()  TO anon, authenticated;


-- ==============================================================================
-- 4. Enforcement A — RLS on INSERT
-- ------------------------------------------------------------------------------
-- Reproduces the policy from migration_security_hardening_live.sql section 2
-- verbatim and adds the window clause. Admins keep an escape hatch so the bulk
-- importer is not blocked by the deadline it is backfilling past.
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
    OR email = 'sibhis5223@gmail.com'
  )
  AND (
    public.is_recruitment_open()
    OR public.is_any_admin()
  )
);


-- ==============================================================================
-- 5. Enforcement B — INSERT trigger
-- ------------------------------------------------------------------------------
-- Not redundant with the policy. An RLS refusal surfaces as a bare 42501 that the
-- form reports as "blocked by a security policy" — useless to an applicant who is
-- simply late. This raises a message the UI can recognise and explain.
--
-- The role check mirrors guard_applicant_update_fn(): triggers fire for
-- service_role even though RLS does not apply to it, so the Apps Script crons and
-- any SQL-console insert must pass straight through.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_recruitment_window_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF is_any_admin() THEN
    RETURN NEW;
  END IF;

  IF public.is_recruitment_open() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'RECRUITMENT_CLOSED: applications are not being accepted right now.';
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_recruitment_window ON public.applications;
CREATE TRIGGER tr_enforce_recruitment_window
  BEFORE INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recruitment_window_fn();


-- ==============================================================================
-- 6. Enforcement C — close the edit path too
-- ------------------------------------------------------------------------------
-- "applications_update USING (auth.role() = 'authenticated')" is still live and
-- load-bearing for slot booking, so an applicant can PATCH their own row. Without
-- this, closing the form would still leave every submitted answer editable
-- afterwards — a deadline that only applies to people who had not started.
--
-- This is section 1 of migration_security_hardening_live.sql with one added gate;
-- the column whitelist below is unchanged. Booking an interview slot is exempt:
-- interviews run after the form shuts, by design.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.guard_applicant_update_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
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
  changed_col     TEXT;
  is_slot_booking BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF is_any_admin() THEN
    RETURN NEW;
  END IF;

  -- COALESCE, not a bare comparison: a NULL status would make this NULL, and
  -- "IF NOT NULL" is not true — the closed check below would silently not fire.
  is_slot_booking := COALESCE(OLD.status = 'shortlisted' AND NEW.status = 'interview_scheduled', false);

  -- Once the window has shut, the only applicant-side write left is booking a slot.
  IF NOT is_slot_booking AND NOT public.is_recruitment_open() THEN
    RAISE EXCEPTION 'RECRUITMENT_CLOSED: applications are closed and can no longer be edited.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_slot_booking THEN
    RAISE EXCEPTION 'Applicants may not change application status (% -> %).',
      OLD.status, NEW.status;
  END IF;

  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    CONTINUE WHEN changed_col = 'status';
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
-- 7. Only a super admin may move the deadline
-- ------------------------------------------------------------------------------
-- app_settings_manage grants FOR ALL to is_admin_or_super(), and RLS has no
-- column-level granularity — let alone JSON-key-level. Same trigger pattern as
-- everywhere else in this codebase: plain admins keep the manual switch and the
-- phase selector, but the schedule itself is super-admin-only.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.guard_recruitment_schedule_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  schedule_changed BOOLEAN;
BEGIN
  IF NEW.key <> 'recruitment_status' THEN
    RETURN NEW;
  END IF;

  -- service_role (crons) and direct SQL connections are not admins in the UI sense.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Re-creating the row is another way to set a schedule; treat it the same.
    schedule_changed := COALESCE(NEW.value -> 'opensAt',  'null'::jsonb) <> 'null'::jsonb
                     OR COALESCE(NEW.value -> 'closesAt', 'null'::jsonb) <> 'null'::jsonb;
  ELSE
    schedule_changed := (NEW.value -> 'opensAt')  IS DISTINCT FROM (OLD.value -> 'opensAt')
                     OR (NEW.value -> 'closesAt') IS DISTINCT FROM (OLD.value -> 'closesAt');
  END IF;

  IF schedule_changed THEN
    RAISE EXCEPTION 'Only a super admin may change the recruitment schedule.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_recruitment_schedule ON public.app_settings;
CREATE TRIGGER tr_guard_recruitment_schedule
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_recruitment_schedule_fn();


-- ==============================================================================
-- VERIFY
-- ==============================================================================
-- 1. Current verdict and the config behind it:
--      SELECT public.recruitment_window();
--
-- 2. The window clause is actually on the policy (expect one INSERT policy whose
--    with_check mentions is_recruitment_open):
--      SELECT policyname, cmd, with_check FROM pg_policies
--       WHERE schemaname = 'public' AND tablename = 'applications' AND cmd = 'INSERT';
--
-- 3. All three triggers are installed:
--      SELECT tgname, tgrelid::regclass FROM pg_trigger
--       WHERE tgname IN ('tr_enforce_recruitment_window', 'tr_guard_recruitment_schedule',
--                        'tr_guard_applicant_update');
--
-- 4. End-to-end, as a real applicant session (not the SQL editor — service_role
--    bypasses both RLS and the role checks above): set closesAt to a past instant,
--    then submit the form. Expect the insert to fail with RECRUITMENT_CLOSED.
