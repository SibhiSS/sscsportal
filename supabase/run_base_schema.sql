-- =============================================================================
-- BASE SCHEMA: what the club-panel migrations expect to find already there
--
-- Run this on an EMPTY Supabase project before supabase/migrations/. It is the
-- part of the old recruitment database (src/database/schema.sql plus the
-- migration_*.sql files, as they stood at e114e29^) that the club migrations
-- rely on:
--   * public.admins               (schema.sql, migration_rbac_update, normalize_admin_email_case)
--   * public.applications         (schema.sql, reg_system, phase1/4/6, notify_shortlist,
--                                  add_selected_pending_status, slot_reschedule,
--                                  update_schema, security_fix_3)
--   * public.audit_logs and the audit triggers (security_fix_2)
--   * restrict_user_email_domain on auth.users (security_fix_1)
--
-- Deliberately NOT here: app_settings, interview_slots, panel_assignments,
-- interview_feedback, mail_queue and the rest of the recruitment tables. They are
-- restored by migrations/20261101000000_recruitment_restore.sql, which runs last.
-- The bootstrap super admin is NOT seeded: insert your own address into
-- public.admins as the club-panel file asks.
--
-- Idempotent: safe to re-run. It never drops or truncates anything.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. admins
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  role       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  added_by   TEXT,
  CONSTRAINT admins_email_key UNIQUE (email)
);

-- Role set after migration_rbac_update.sql. The club panel replaces this check.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check') THEN
    ALTER TABLE public.admins
      ADD CONSTRAINT admins_role_check
      CHECK (role IN ('super_admin', 'admin', 'interviewer', 'viewer'));
  END IF;
END
$$;

-- migration_normalize_admin_email_case.sql: one row per address, whatever the casing.
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_lower_idx ON public.admins (lower(trim(email)));

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. applications (applicant table; the club panel repurposes it as the roster)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  email            TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  roll_number      TEXT NOT NULL,
  phone            TEXT NOT NULL,
  department       TEXT,
  year             TEXT,
  primary_dept     TEXT NOT NULL,
  domains          TEXT[] DEFAULT '{}',
  skills           TEXT,
  reason           TEXT,
  secondary_dept   TEXT,
  secondary_domains TEXT[] DEFAULT '{}',
  secondary_skills TEXT,
  secondary_reason TEXT,
  admission_year   INTEGER,
  program_code     TEXT,
  program_name     TEXT,
  batch            TEXT,
  program_category TEXT,
  status           TEXT DEFAULT 'pending',
  rating           INTEGER DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Columns added by the later old migrations, in their order. Each is guarded, so a
-- database that already has them is left alone.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS assigned_position   TEXT,                        -- update_schema
  ADD COLUMN IF NOT EXISTS interview_score     NUMERIC(4,2) DEFAULT 0,      -- update_schema
  ADD COLUMN IF NOT EXISTS task_score          NUMERIC(4,1) DEFAULT 0,      -- phase4
  ADD COLUMN IF NOT EXISTS resume_score        NUMERIC(4,1) DEFAULT 0,      -- phase4
  ADD COLUMN IF NOT EXISTS final_score         NUMERIC(5,2) DEFAULT 0,      -- phase4
  ADD COLUMN IF NOT EXISTS rank_in_dept        INTEGER,                     -- phase4
  ADD COLUMN IF NOT EXISTS resume_url          TEXT,                        -- phase6
  ADD COLUMN IF NOT EXISTS resume_filename     TEXT,                        -- phase6
  ADD COLUMN IF NOT EXISTS resume_uploaded_at  TIMESTAMP WITH TIME ZONE,    -- phase6
  ADD COLUMN IF NOT EXISTS github_url          TEXT,                        -- phase6
  ADD COLUMN IF NOT EXISTS linkedin_url        TEXT,                        -- phase6
  ADD COLUMN IF NOT EXISTS portfolio_url       TEXT,                        -- phase6
  ADD COLUMN IF NOT EXISTS portfolio_website   TEXT,                        -- used by Apply.tsx
  ADD COLUMN IF NOT EXISTS parsed_skills       TEXT[] DEFAULT '{}',         -- phase6
  ADD COLUMN IF NOT EXISTS shortlisted_at      TIMESTAMP WITH TIME ZONE,    -- phase6
  ADD COLUMN IF NOT EXISTS interviewed_at      TIMESTAMP WITH TIME ZONE,    -- phase6
  ADD COLUMN IF NOT EXISTS decided_at          TIMESTAMP WITH TIME ZONE,    -- phase6
  ADD COLUMN IF NOT EXISTS shortlist_notified  BOOLEAN DEFAULT FALSE,       -- notify_shortlist
  ADD COLUMN IF NOT EXISTS ai_analysis         JSONB,                       -- ai_copilot_cache
  ADD COLUMN IF NOT EXISTS ai_analyzed_at      TIMESTAMP WITH TIME ZONE,    -- ai_copilot_cache
  ADD COLUMN IF NOT EXISTS slot_changes_used   INTEGER NOT NULL DEFAULT 0;  -- slot_reschedule

-- Latest status list (migration_add_selected_pending_status.sql).
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check CHECK (status IN (
    'applied', 'pending', 'under_review', 'neutral', 'shortlisted',
    'interview_scheduled', 'interviewed', 'selected_pending', 'selected',
    'active_member', 'waitlisted', 'rejected', 'rejected_pending',
    'alumni', 'inactive'
  ));

-- security_fix_3: one row per email, roll number and user id.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_applications_email') THEN
    ALTER TABLE public.applications ADD CONSTRAINT unique_applications_email UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_applications_roll_number') THEN
    ALTER TABLE public.applications ADD CONSTRAINT unique_applications_roll_number UNIQUE (roll_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_applications_user_id') THEN
    ALTER TABLE public.applications ADD CONSTRAINT unique_applications_user_id UNIQUE (user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_apps_email   ON public.applications (email);
CREATE INDEX IF NOT EXISTS idx_apps_status  ON public.applications (status);
CREATE INDEX IF NOT EXISTS idx_apps_user_id ON public.applications (user_id);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. audit_logs and its triggers (security_fix_2)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_id   TEXT,
  details     JSONB,
  timestamp   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Staff can read and write the log. No UPDATE or DELETE policy: the log is immutable.
-- Written inline (not via is_any_admin()) because that helper is defined later.
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admins a
    WHERE lower(trim(a.email)) = lower(trim(coalesce(auth.email(), '')))
      AND a.role IN ('super_admin', 'admin', 'interviewer')
  ));

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admins a
    WHERE lower(trim(a.email)) = lower(trim(coalesce(auth.email(), '')))
      AND a.role IN ('super_admin', 'admin', 'interviewer')
  ));

CREATE OR REPLACE FUNCTION public.audit_applications_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  current_actor TEXT;
BEGIN
  current_actor := COALESCE(auth.email(), 'system@sscs');

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR
       OLD.rating IS DISTINCT FROM NEW.rating OR
       OLD.task_score IS DISTINCT FROM NEW.task_score OR
       OLD.interview_score IS DISTINCT FROM NEW.interview_score THEN
      INSERT INTO public.audit_logs (actor_email, action, target_id, details)
      VALUES (
        current_actor,
        'UPDATE_APPLICATION',
        NEW.id::text,
        jsonb_build_object(
          'applicant_email', NEW.email,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'old_rating', OLD.rating,
          'new_rating', NEW.rating,
          'old_task_score', OLD.task_score,
          'new_task_score', NEW.task_score
        )
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (
      current_actor,
      'DELETE_APPLICATION',
      OLD.id::text,
      jsonb_build_object('applicant_email', OLD.email, 'applicant_name', OLD.full_name)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_audit_applications ON public.applications;
CREATE TRIGGER tr_audit_applications
  AFTER UPDATE OR DELETE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_applications_trigger_fn();

CREATE OR REPLACE FUNCTION public.audit_admins_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  current_actor TEXT;
BEGIN
  current_actor := COALESCE(auth.email(), 'system@sscs');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (current_actor, 'ADD_ADMIN', NEW.id::text, jsonb_build_object('target_email', NEW.email, 'role', NEW.role));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (current_actor, 'UPDATE_ADMIN_ROLE', NEW.id::text, jsonb_build_object('target_email', NEW.email, 'old_role', OLD.role, 'new_role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (current_actor, 'REMOVE_ADMIN', OLD.id::text, jsonb_build_object('target_email', OLD.email, 'old_role', OLD.role));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_audit_admins ON public.admins;
CREATE TRIGGER tr_audit_admins
  AFTER INSERT OR UPDATE OR DELETE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admins_trigger_fn();

-- -----------------------------------------------------------------------------
-- 4. Sign-up domain gate (security_fix_1). Only VIT addresses may create accounts.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_user_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@vitstudent.ac.in'
     AND NEW.email NOT LIKE '%@vit.ac.in'
     AND NEW.email <> 'sibhis5223@gmail.com' THEN
    RAISE EXCEPTION 'Access Restricted: Only VIT email addresses (@vitstudent.ac.in / @vit.ac.in) are permitted.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_restrict_user_email_domain ON auth.users;
CREATE TRIGGER tr_restrict_user_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_user_email_domain();

COMMIT;
