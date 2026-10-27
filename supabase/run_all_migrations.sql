-- =============================================================================
-- ALL MIGRATIONS, IN ORDER, AS ONE SCRIPT
--
-- Paste into the Supabase SQL editor on an EMPTY project and run once.
--
-- Order:
--   1. supabase/run_base_schema.sql     the old recruitment tables the club
--                                       migrations expect (admins, applications,
--                                       audit_logs, their triggers)
--   2. supabase/migrations/*.sql        the same files, in the same order, with
--                                       each file's own BEGIN/COMMIT removed
--
-- Deliberately SKIPPED: 20261003000100_drop_recruitment.sql. It deletes the old
-- applicant, interview, slot and mail tables. The recruitment restore needs them.
--
-- Generated. If you change a file in supabase/migrations/ or run_base_schema.sql,
-- regenerate this script or run that file on its own. This script is a snapshot,
-- not the source of truth.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- FILE: run_base_schema.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- FILE: 20261003000000_club_panel.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- CLUB PANEL SCHEMA
--
-- Turns the old recruitment database into the club panel database:
--   * public.applications is REPURPOSED as the member roster. Nothing in it is
--     deleted: every applicant row and every old column (status, scores, notes,
--     resume links...) stays. Roster membership is a new flag, is_member.
--   * new tables: contribution_types, events, event_attendance, contributions
--   * public.leaderboard: all-time points, readable by anyone, no private data
--   * review_contribution(): the only way a contribution gets approved/rejected
--   * admins: roles become super_admin / admin / member
--
-- Rules agreed for the club:
--   * only active roster members can submit contributions, and only as pending
--   * leads (is_lead) earn no points and never appear on the leaderboard
--   * marking attendance awards points automatically, one role per person per
--     event (Student coordinator / Volunteer / Attendee)
--   * no yearly reset, a single all-time leaderboard
--
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- CHECK BEFORE RUNNING: your own account must be a super_admin, or the admin
-- panel will deny you once these policies are live. Run this first:
--
--   SELECT email, role FROM public.admins WHERE role IN ('super_admin', 'admin');
--
-- If your address is missing, add it before running this file:
--
--   INSERT INTO public.admins (email, role) VALUES ('<your email>', 'super_admin');
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Helper functions
--
-- Self-contained on purpose: the old recruitment helpers (is_any_admin,
-- is_admin_or_above, ...) were redefined by several migrations and their live
-- definitions are not trustworthy. SECURITY DEFINER lets policies call these
-- without tripping over RLS on admins/applications.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_jwt_email()
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE lower(trim(email)) = public.club_jwt_email()
      AND role IN ('super_admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE lower(trim(email)) = public.club_jwt_email()
      AND role = 'super_admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Repurpose public.applications as the roster (additive only)
-- -----------------------------------------------------------------------------

-- Recruitment triggers (window enforcement, applicant-update guard, input
-- sanitiser, ...) would block every roster edit now that recruitment is closed,
-- including the backfill below, so they go first. Drop them all except the
-- audit trail. Their functions stay until
-- 20261003000100_drop_recruitment.sql is run.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.applications'::regclass
      AND NOT tgisinternal
      AND tgname <> 'tr_audit_applications'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.applications', r.tgname);
  END LOOP;
END
$$;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS is_member         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lead           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_status     text    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS member_department text,
  ADD COLUMN IF NOT EXISTS member_position   text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.applications'::regclass
      AND conname = 'applications_member_status_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_member_status_check
      CHECK (member_status IN ('active', 'inactive'));
  END IF;
END
$$;

-- Seed the roster from the people recruitment selected. Runs only while nobody
-- is on the roster yet, so a re-run never re-adds someone an admin removed.
DO $$
DECLARE
  has_assigned_position boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.applications WHERE is_member) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications'
        AND column_name = 'assigned_position'
    ) INTO has_assigned_position;

    IF has_assigned_position THEN
      UPDATE public.applications
         SET is_member = true,
             member_department = coalesce(nullif(trim(assigned_position), ''), primary_dept)
       WHERE status IN ('selected', 'active_member');
    ELSE
      UPDATE public.applications
         SET is_member = true,
             member_department = primary_dept
       WHERE status IN ('selected', 'active_member');
    END IF;
  END IF;
END
$$;

-- Admins must be able to add people who never applied. Existing values are kept;
-- only the requirement goes. email and full_name stay required.
DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['user_id', 'phone', 'roll_number', 'primary_dept'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = col
    ) THEN
      EXECUTE format('ALTER TABLE public.applications ALTER COLUMN %I DROP NOT NULL', col);
    END IF;
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_applications_lower_email ON public.applications (lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_applications_is_member ON public.applications (is_member) WHERE is_member;

-- Roster lookups for the signed-in user. Defined after the roster columns exist.
-- current_member_id: the caller's roster row, active or not (for reading own data).
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.applications
  WHERE is_member AND lower(trim(email)) = public.club_jwt_email()
  ORDER BY created_at
  LIMIT 1;
$$;

-- current_earner_id: the caller's roster row only if they can earn points
-- (active and not a lead). NULL otherwise, which makes inserts fail.
CREATE OR REPLACE FUNCTION public.current_earner_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.applications
  WHERE is_member AND NOT is_lead AND member_status = 'active'
    AND lower(trim(email)) = public.club_jwt_email()
  ORDER BY created_at
  LIMIT 1;
$$;

-- Replace every old applications policy (applicant self-service, interviewer
-- access, ...) with: admins manage everything, nobody else reads the table.
-- Applicant rows still hold interview scores and remarks, so members get their
-- own roster details through my_member() below instead of a row-level policy.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'applications'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.applications', r.policyname);
  END LOOP;
END
$$;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY applications_admin_all ON public.applications
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

REVOKE ALL ON public.applications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;

-- The signed-in user's roster entry, roster fields only. Empty when the caller
-- is not on the roster.
DROP FUNCTION IF EXISTS public.my_member();
CREATE FUNCTION public.my_member()
RETURNS TABLE (
  id                uuid,
  email             text,
  full_name         text,
  member_department text,
  member_position   text,
  is_lead           boolean,
  member_status     text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.email, a.full_name, a.member_department, a.member_position,
         a.is_lead, a.member_status
  FROM public.applications a
  WHERE a.id = public.current_member_id();
$$;

REVOKE ALL ON FUNCTION public.my_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_member() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. New tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contribution_types (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category       text NOT NULL,
  name           text NOT NULL,
  default_points integer NOT NULL CHECK (default_points >= 0),
  source         text NOT NULL DEFAULT 'submission' CHECK (source IN ('submission', 'attendance')),
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  location    text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- One row per person per event: the unique key is what makes "only the highest
-- role counts" hold. Changing someone's role is an UPDATE of type_id.
CREATE TABLE IF NOT EXISTS public.event_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  type_id    uuid NOT NULL REFERENCES public.contribution_types(id),
  marked_by  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.contributions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  type_id        uuid NOT NULL REFERENCES public.contribution_types(id),
  event_id       uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title          text NOT NULL CHECK (length(trim(title)) > 0),
  description    text,
  proof_url      text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded integer CHECK (points_awarded IS NULL OR points_awarded >= 0),
  reviewed_by    text,
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'approved' OR points_awarded IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_member ON public.event_attendance (member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_member ON public.contributions (member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_pending ON public.contributions (created_at) WHERE status = 'pending';

-- Attendance rows may only use attendance types, contributions only submission
-- types. TG_ARGV[0] is the source the table expects.
CREATE OR REPLACE FUNCTION public.club_check_type_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contribution_types
    WHERE id = NEW.type_id AND source = TG_ARGV[0]
  ) THEN
    RAISE EXCEPTION 'Only % contribution types can be used here', TG_ARGV[0]
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_event_attendance_type ON public.event_attendance;
CREATE TRIGGER tr_event_attendance_type
  BEFORE INSERT OR UPDATE OF type_id ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.club_check_type_source('attendance');

DROP TRIGGER IF EXISTS tr_contributions_type ON public.contributions;
CREATE TRIGGER tr_contributions_type
  BEFORE INSERT OR UPDATE OF type_id ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.club_check_type_source('submission');

-- -----------------------------------------------------------------------------
-- 4. Seed contribution types (placeholder points, editable later)
--    ON CONFLICT DO NOTHING: a re-run never overwrites points an admin changed.
-- -----------------------------------------------------------------------------

INSERT INTO public.contribution_types (category, name, default_points, source, sort_order) VALUES
  -- Events
  ('Events', 'Student coordinator for an event',                    30, 'attendance', 100),
  ('Events', 'Hosting / anchoring an event',                        15, 'submission', 110),
  ('Events', 'Event idea proposed and accepted',                    12, 'submission', 120),
  ('Events', 'Setting questions or problems for a competition',     12, 'submission', 130),
  ('Events', 'Volunteering at an event',                             8, 'attendance', 140),
  ('Events', 'Event idea proposed (not taken up)',                   2, 'submission', 150),
  ('Events', 'Attending an event',                                   2, 'attendance', 160),
  -- Technical
  ('Technical', 'Conducting a workshop',                            30, 'submission', 200),
  ('Technical', 'Technical project work',                           25, 'submission', 210),
  ('Technical', 'Website: new feature or page',                     20, 'submission', 220),
  ('Technical', 'Preparing workshop material (slides, labs)',       12, 'submission', 230),
  ('Technical', 'Assisting at a workshop or hands-on session',       6, 'submission', 240),
  ('Technical', 'Website: bug fix or small update',                  5, 'submission', 250),
  -- Sponsorship and partnerships
  ('Sponsorship', 'Sponsorship finalised (cash)',                   35, 'submission', 300),
  ('Sponsorship', 'Partnership or collaboration finalised',         25, 'submission', 310),
  ('Sponsorship', 'In-kind sponsorship finalised (goodies, venue, prizes)', 20, 'submission', 320),
  ('Sponsorship', 'Bringing in a speaker or judge',                 15, 'submission', 330),
  ('Sponsorship', 'Pitching or meeting a sponsor',                   8, 'submission', 340),
  ('Sponsorship', 'Finding and contacting a potential sponsor',      2, 'submission', 350),
  -- Design
  ('Design', 'Logo or branding work',                               10, 'submission', 400),
  ('Design', 'Instagram grid / carousel',                            6, 'submission', 410),
  ('Design', 'Poster',                                               4, 'submission', 420),
  ('Design', 'Banner or standee',                                    4, 'submission', 430),
  ('Design', 'Certificate design',                                   2, 'submission', 440),
  -- Reels and video
  ('Reels and video', 'Event aftermovie or recap video',            12, 'submission', 500),
  ('Reels and video', 'Editing a reel',                              6, 'submission', 510),
  ('Reels and video', 'Shooting a reel',                             4, 'submission', 520),
  ('Reels and video', 'Acting in a reel',                            4, 'submission', 530),
  ('Reels and video', 'Reel concept or script',                      3, 'submission', 540),
  -- Content writing
  ('Content writing', 'Newsletter editing / compiling the issue',   15, 'submission', 600),
  ('Content writing', 'Technical blog or article',                  12, 'submission', 610),
  ('Content writing', 'Event report',                               10, 'submission', 620),
  ('Content writing', 'Newsletter article',                          8, 'submission', 630),
  ('Content writing', 'Social media caption',                        1, 'submission', 640),
  -- Photography and social media
  ('Photography and social media', 'Social media management for a week', 6, 'submission', 700),
  ('Photography and social media', 'Event photography',              5, 'submission', 710),
  ('Photography and social media', 'Photo editing / selection',      2, 'submission', 720),
  ('Photography and social media', 'Story coverage during an event', 2, 'submission', 730),
  -- Documentation
  ('Documentation', 'Event documentation (budget, attendance, proofs)', 6, 'submission', 800),
  ('Documentation', 'Minutes of a meeting',                          2, 'submission', 810),
  -- Other
  ('Other', 'Other (admin sets the points)',                         1, 'submission', 900)
ON CONFLICT (category, name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Row level security on the new tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.contribution_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions      ENABLE ROW LEVEL SECURITY;

-- contribution_types: any signed-in user reads, admins write
DROP POLICY IF EXISTS contribution_types_read ON public.contribution_types;
CREATE POLICY contribution_types_read ON public.contribution_types
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS contribution_types_admin ON public.contribution_types;
CREATE POLICY contribution_types_admin ON public.contribution_types
  FOR ALL TO authenticated
  USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

-- events: any signed-in user reads, admins write
DROP POLICY IF EXISTS events_read ON public.events;
CREATE POLICY events_read ON public.events
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS events_admin ON public.events;
CREATE POLICY events_admin ON public.events
  FOR ALL TO authenticated
  USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

-- event_attendance: members read their own, admins manage
DROP POLICY IF EXISTS event_attendance_read_own ON public.event_attendance;
CREATE POLICY event_attendance_read_own ON public.event_attendance
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());
DROP POLICY IF EXISTS event_attendance_admin ON public.event_attendance;
CREATE POLICY event_attendance_admin ON public.event_attendance
  FOR ALL TO authenticated
  USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

-- contributions: members read their own, submit their own as pending, and
-- withdraw their own while still pending. Admins manage everything; approval
-- goes through review_contribution().
DROP POLICY IF EXISTS contributions_read_own ON public.contributions;
CREATE POLICY contributions_read_own ON public.contributions
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());

DROP POLICY IF EXISTS contributions_submit_own ON public.contributions;
CREATE POLICY contributions_submit_own ON public.contributions
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = public.current_earner_id()
    AND status = 'pending'
    AND points_awarded IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_note IS NULL
  );

DROP POLICY IF EXISTS contributions_withdraw_own ON public.contributions;
CREATE POLICY contributions_withdraw_own ON public.contributions
  FOR DELETE TO authenticated
  USING (member_id = public.current_member_id() AND status = 'pending');

DROP POLICY IF EXISTS contributions_admin ON public.contributions;
CREATE POLICY contributions_admin ON public.contributions
  FOR ALL TO authenticated
  USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

REVOKE ALL ON public.contribution_types, public.events, public.event_attendance, public.contributions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.contribution_types, public.events, public.event_attendance, public.contributions
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Approval
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_contribution(
  p_id     uuid,
  p_status text,
  p_points integer DEFAULT NULL,
  p_note   text    DEFAULT NULL
)
RETURNS public.contributions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        public.contributions;
  v_points integer;
BEGIN
  IF NOT public.is_club_admin() THEN
    RAISE EXCEPTION 'Only admins can review contributions' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Status must be approved or rejected' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO c FROM public.contributions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status <> 'pending' THEN
    RAISE EXCEPTION 'This contribution has already been reviewed' USING ERRCODE = '55000';
  END IF;

  IF p_status = 'approved' THEN
    v_points := coalesce(
      p_points,
      (SELECT default_points FROM public.contribution_types WHERE id = c.type_id)
    );
    IF v_points < 0 THEN
      RAISE EXCEPTION 'Points cannot be negative' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.contributions
     SET status         = p_status,
         points_awarded = v_points,
         reviewed_by    = public.club_jwt_email(),
         reviewed_at    = now(),
         review_note    = p_note
   WHERE id = p_id
  RETURNING * INTO c;

  RETURN c;
END
$$;

REVOKE ALL ON FUNCTION public.review_contribution(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_contribution(uuid, text, integer, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Public leaderboard
--
-- Runs with the view owner's rights so anyone (even signed out) can read the
-- totals without any read access to the underlying tables. It deliberately
-- exposes nothing beyond name, department and points.
-- Attendance uses the type's CURRENT points, so repricing a role reprices it
-- everywhere; approved contributions keep the points they were approved with.
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
WITH points AS (
  SELECT c.member_id, c.points_awarded AS points, 1 AS is_contribution
  FROM public.contributions c
  WHERE c.status = 'approved'
  UNION ALL
  SELECT ea.member_id, ct.default_points, 0
  FROM public.event_attendance ea
  JOIN public.contribution_types ct ON ct.id = ea.type_id
)
SELECT
  rank() OVER (ORDER BY coalesce(sum(p.points), 0) DESC)::integer AS rank,
  a.id                                                         AS member_id,
  a.full_name,
  a.member_department                                          AS department,
  coalesce(sum(p.points), 0)::integer                          AS total_points,
  coalesce(sum(p.is_contribution), 0)::integer                 AS contribution_count
FROM public.applications a
LEFT JOIN points p ON p.member_id = a.id
WHERE a.is_member AND NOT a.is_lead AND a.member_status = 'active'
GROUP BY a.id, a.full_name, a.member_department;

REVOKE ALL ON public.leaderboard FROM PUBLIC;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. admins: roles become super_admin / admin / member
-- -----------------------------------------------------------------------------

-- The old role CHECK has had more than one name over time; drop whichever exists.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.admins'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.admins DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

-- Legacy interviewer/viewer rows become plain members. Nobody is deleted.
UPDATE public.admins SET role = 'member'
WHERE role NOT IN ('super_admin', 'admin', 'member');

ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check CHECK (role IN ('super_admin', 'admin', 'member'));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admins'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.admins', r.policyname);
  END LOOP;
END
$$;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own row: the app's sign-in role lookup depends on it.
CREATE POLICY admins_read ON public.admins
  FOR SELECT TO authenticated
  USING (lower(trim(email)) = public.club_jwt_email() OR public.is_club_admin());

CREATE POLICY admins_super_admin_write ON public.admins
  FOR ALL TO authenticated
  USING (public.is_club_super_admin())
  WITH CHECK (public.is_club_super_admin());

REVOKE ALL ON public.admins FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;


-- =============================================================================
-- AFTER RUNNING, sanity checks:
--
--   SELECT count(*) FILTER (WHERE is_member) AS roster, count(*) AS all_rows
--   FROM public.applications;
--   SELECT * FROM public.leaderboard ORDER BY rank LIMIT 10;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FILE: 20261003000200_contribution_codes_and_images.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- CONTRIBUTION CODES AND PROOF IMAGES
--
-- Run after 20261003000000_club_panel.sql. Safe to re-run.
--
--   * every contribution gets a 4-character code (e.g. K7Q2) for quick lookup.
--     The database picks it; members cannot choose or change it. Look-alike
--     characters (0/O, 1/I/L) are left out so codes are easy to read aloud.
--   * up to 3 proof images per contribution, stored in the private
--     "contribution-proofs" bucket under <member id>/<file>. Only the member
--     who uploaded them and admins can see them.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS code         text,
  ADD COLUMN IF NOT EXISTS proof_images text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_proof_images_max;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_proof_images_max CHECK (cardinality(proof_images) <= 3);

-- -----------------------------------------------------------------------------
-- 2. Codes
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_new_contribution_code()
RETURNS text
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars, no 0/O/1/I/L
  candidate text;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..4 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.contributions WHERE code = candidate);
  END LOOP;
  RETURN candidate;
END
$$;

-- Backfill anything submitted before this migration.
UPDATE public.contributions SET code = public.club_new_contribution_code() WHERE code IS NULL;

ALTER TABLE public.contributions ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contributions_code_key ON public.contributions (code);

-- On insert the database always assigns the code and checks the image paths;
-- on update the code can never change.
CREATE OR REPLACE FUNCTION public.club_contribution_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  path text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.code := public.club_new_contribution_code();
  ELSIF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'A contribution code cannot be changed' USING ERRCODE = '55000';
  END IF;

  -- Images must live in the submitting member's own folder.
  FOREACH path IN ARRAY coalesce(NEW.proof_images, '{}') LOOP
    IF path IS NULL OR path NOT LIKE NEW.member_id::text || '/%' OR path LIKE '%..%' THEN
      RAISE EXCEPTION 'Proof images must be uploaded to your own folder' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_contributions_guard ON public.contributions;
CREATE TRIGGER tr_contributions_guard
  BEFORE INSERT OR UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.club_contribution_guard();

-- -----------------------------------------------------------------------------
-- 3. Storage bucket for proof images (private, 5 MB per image, images only)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contribution-proofs',
  'contribution-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Members upload into, read and delete from their own folder (<member id>/...).
-- Uploading needs the caller to be able to earn points (active, not a lead).
-- Admins can read and delete everything in the bucket.
DROP POLICY IF EXISTS contribution_proofs_upload_own ON storage.objects;
CREATE POLICY contribution_proofs_upload_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contribution-proofs'
    AND (storage.foldername(name))[1] = public.current_earner_id()::text
  );

DROP POLICY IF EXISTS contribution_proofs_read ON storage.objects;
CREATE POLICY contribution_proofs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contribution-proofs'
    AND (
      (storage.foldername(name))[1] = public.current_member_id()::text
      OR public.is_club_admin()
    )
  );

DROP POLICY IF EXISTS contribution_proofs_delete ON storage.objects;
CREATE POLICY contribution_proofs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contribution-proofs'
    AND (
      (storage.foldername(name))[1] = public.current_member_id()::text
      OR public.is_club_admin()
    )
  );


-- ---------------------------------------------------------------------------
-- FILE: 20261003000300_admin_panel.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- ADMIN PANEL: CALENDAR, VENUES, EVENT CHECKLIST
--
-- Run after 20261003000200_contribution_codes_and_images.sql. Safe to re-run.
--
-- Brings the club calendar (club_calendar.html) into the database:
--   * venues            the halls IEEE SSCS uses (Nethaji, Kamaraj, ...)
--   * venue_bookings    VTOP bookings, ours and other clubs'
--   * calendar_entries  holidays, exams, exam prep, vacations, no-class days
--   * events            club events, now with the planning checklist
--   * club_settings     small admin settings (e.g. names that mean "our club")
--   * event-files       private bucket for posters, reports, budget sheets
--
-- Everything here is admin-only. Members only get event titles and dates (for
-- the "related event" picker) and their own attendance, through functions.
-- The leaderboard stays the only public data.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Venues and bookings
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.venues (
  id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),
  name       text NOT NULL,
  short_name text NOT NULL,
  notes      text,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     text NOT NULL REFERENCES public.venues(id) ON UPDATE CASCADE,
  booking_date date NOT NULL,
  from_time    time NOT NULL,
  to_time      time NOT NULL,
  event_name   text NOT NULL,
  booked_by    text,
  phone        text,
  is_ours      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (to_time > from_time)
);

CREATE INDEX IF NOT EXISTS idx_venue_bookings_day ON public.venue_bookings (venue_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_ours ON public.venue_bookings (booking_date) WHERE is_ours;

-- -----------------------------------------------------------------------------
-- 2. Non-event calendar entries
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('holiday', 'blocked', 'exam', 'buffer', 'noclass', 'vacation')),
  title      text NOT NULL CHECK (length(trim(title)) > 0),
  start_date date NOT NULL,
  end_date   date NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_entries_dates ON public.calendar_entries (start_date, end_date);

-- -----------------------------------------------------------------------------
-- 3. Events: dates as calendar days, plus the planning checklist
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_date        date,
  ADD COLUMN IF NOT EXISTS end_date          date,
  ADD COLUMN IF NOT EXISTS is_online         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_id          text REFERENCES public.venues(id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_booked      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poster_path       text,
  ADD COLUMN IF NOT EXISTS report_path       text,
  ADD COLUMN IF NOT EXISTS budget_sheet_path text,
  ADD COLUMN IF NOT EXISTS budget_planned    numeric(12, 2) CHECK (budget_planned IS NULL OR budget_planned >= 0),
  ADD COLUMN IF NOT EXISTS budget_actual     numeric(12, 2) CHECK (budget_actual IS NULL OR budget_actual >= 0),
  ADD COLUMN IF NOT EXISTS attendance_posted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS od_posted         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- Events created before this migration carried a timestamp; derive the day (IST).
UPDATE public.events
   SET start_date = (starts_at AT TIME ZONE 'Asia/Kolkata')::date
 WHERE start_date IS NULL AND starts_at IS NOT NULL;
UPDATE public.events
   SET end_date = coalesce((ends_at AT TIME ZONE 'Asia/Kolkata')::date, start_date)
 WHERE end_date IS NULL;

ALTER TABLE public.events ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE public.events ALTER COLUMN end_date SET NOT NULL;
ALTER TABLE public.events ALTER COLUMN starts_at DROP NOT NULL;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_date_order;
ALTER TABLE public.events ADD CONSTRAINT events_date_order CHECK (end_date >= start_date);

CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events (start_date, end_date);

-- An online event needs no venue, so it can't hold one either.
CREATE OR REPLACE FUNCTION public.club_events_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_online THEN
    NEW.venue_id := NULL;
    NEW.venue_booked := false;
    NEW.od_posted := false;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_normalize ON public.events;
CREATE TRIGGER tr_events_normalize
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_normalize();

-- -----------------------------------------------------------------------------
-- 4. Settings
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. Bulk import of venue bookings
--
-- Same rule as the calendar file: for every venue + date present in the import,
-- the bookings already stored for that venue + date are replaced, so a fresh
-- VTOP snapshot also clears cancellations. All-or-nothing.
-- rows: [{"venue_id","booking_date","from_time","to_time","event_name",
--         "booked_by","phone","is_ours"}, ...]
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.import_venue_bookings(rows jsonb)
RETURNS TABLE (imported integer, replaced integer, venue_days integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_replaced integer;
  v_imported integer;
  v_days     integer;
BEGIN
  IF NOT public.is_club_admin() THEN
    RAISE EXCEPTION 'Only admins can import bookings' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(rows) <> 'array' OR jsonb_array_length(rows) = 0 THEN
    RAISE EXCEPTION 'Nothing to import' USING ERRCODE = '22023';
  END IF;

  DROP TABLE IF EXISTS pg_temp._incoming;
  CREATE TEMP TABLE _incoming ON COMMIT DROP AS
  SELECT r.venue_id,
         r.booking_date,
         r.from_time,
         r.to_time,
         trim(r.event_name)                       AS event_name,
         nullif(upper(trim(coalesce(r.booked_by, ''))), '') AS booked_by,
         nullif(regexp_replace(coalesce(r.phone, ''), '\s', '', 'g'), '') AS phone,
         coalesce(r.is_ours, false)               AS is_ours
  FROM jsonb_to_recordset(rows) AS r(
    venue_id text, booking_date date, from_time time, to_time time,
    event_name text, booked_by text, phone text, is_ours boolean
  );

  SELECT count(*) INTO v_days FROM (SELECT DISTINCT venue_id, booking_date FROM _incoming) d;

  DELETE FROM public.venue_bookings b
   USING (SELECT DISTINCT venue_id, booking_date FROM _incoming) d
   WHERE b.venue_id = d.venue_id AND b.booking_date = d.booking_date;
  GET DIAGNOSTICS v_replaced = ROW_COUNT;

  INSERT INTO public.venue_bookings (venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours)
  SELECT venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours FROM _incoming;
  GET DIAGNOSTICS v_imported = ROW_COUNT;

  INSERT INTO public.club_settings (key, value, updated_at)
  VALUES ('venue_data_as_of', to_jsonb(current_date), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN QUERY SELECT v_imported, v_replaced, v_days;
END
$$;

REVOKE ALL ON FUNCTION public.import_venue_bookings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_venue_bookings(jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. What members may still see, through functions only
-- -----------------------------------------------------------------------------

-- Titles and dates of events, for the "related event" picker on /me.
CREATE OR REPLACE FUNCTION public.member_event_options()
RETURNS TABLE (id uuid, title text, start_date date)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.start_date
  FROM public.events e
  WHERE public.current_member_id() IS NOT NULL OR public.is_club_admin()
  ORDER BY e.start_date DESC;
$$;

-- The caller's own attendance, with the event title and points.
CREATE OR REPLACE FUNCTION public.my_attendance()
RETURNS TABLE (id uuid, event_id uuid, event_title text, start_date date, role text, points integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ea.id, e.id, e.title, e.start_date, ct.name, ct.default_points
  FROM public.event_attendance ea
  JOIN public.events e ON e.id = ea.event_id
  JOIN public.contribution_types ct ON ct.id = ea.type_id
  WHERE ea.member_id = public.current_member_id()
  ORDER BY e.start_date DESC;
$$;

REVOKE ALL ON FUNCTION public.member_event_options() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_event_options() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_attendance() TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Row level security: admins only
-- -----------------------------------------------------------------------------

ALTER TABLE public.venues           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_settings    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venues_admin ON public.venues;
CREATE POLICY venues_admin ON public.venues
  FOR ALL TO authenticated USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

DROP POLICY IF EXISTS venue_bookings_admin ON public.venue_bookings;
CREATE POLICY venue_bookings_admin ON public.venue_bookings
  FOR ALL TO authenticated USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

DROP POLICY IF EXISTS calendar_entries_admin ON public.calendar_entries;
CREATE POLICY calendar_entries_admin ON public.calendar_entries
  FOR ALL TO authenticated USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

DROP POLICY IF EXISTS club_settings_admin ON public.club_settings;
CREATE POLICY club_settings_admin ON public.club_settings
  FOR ALL TO authenticated USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

-- Events now carry budgets and documents: drop the "any signed-in user reads"
-- policy from the club panel migration. events_admin stays.
DROP POLICY IF EXISTS events_read ON public.events;

REVOKE ALL ON public.venues, public.venue_bookings, public.calendar_entries, public.club_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.venues, public.venue_bookings, public.calendar_entries, public.club_settings
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Private bucket for event files (posters, reports, budget sheets)
--    Paths: <event id>/<kind>-<random>.<ext>. Admins only, 15 MB per file.
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-files',
  'event-files',
  false,
  15728640,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS event_files_admin ON storage.objects;
CREATE POLICY event_files_admin ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'event-files' AND public.is_club_admin())
  WITH CHECK (bucket_id = 'event-files' AND public.is_club_admin());

-- -----------------------------------------------------------------------------
-- 9. Default venues (the six from the club calendar). Re-runs keep edits.
-- -----------------------------------------------------------------------------

INSERT INTO public.venues (id, name, short_name, notes, sort_order) VALUES
  ('nethaji',  'Nethaji Auditorium',         'Nethaji',  'AB1 7th floor',      10),
  ('kamaraj',  'Kamaraj Auditorium',         'Kamaraj',  NULL,                 20),
  ('kasturba', 'Kasturba Gandhi Auditorium', 'Kasturba', NULL,                 30),
  ('voc',      'V.O.C Auditorium',           'VOC',      'ADB 5th floor',      40),
  ('ab1',      'AB1 Mini Conference Room',   'AB1',      'Room 101',           50),
  ('mg',       'MG Auditorium',              'MG',       NULL,                 60)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- FILE: 20261003000400_seed_calendar.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- SEED: data from club_calendar.html
--
-- Run after 20261003000300_admin_panel.sql. Safe to re-run: rows that already
-- exist (same values) are skipped, nothing is updated or deleted.
--
--   18 calendar entries (holidays, exams, exam prep, vacations, no-class days)
--   6 club events
--   380 VTOP venue bookings
--
-- Academic dates: circular VITCC/ACAD/2026-2027/10 (11-09-2026). Exam prep
-- weeks are club planning buffers, not official.
-- Booking phone numbers belong to whoever made each booking; the table is
-- admin-only.
-- =============================================================================


-- Calendar entries -------------------------------------------------------------
INSERT INTO public.calendar_entries (entry_type, title, start_date, end_date, note)
SELECT v.entry_type, v.title, v.start_date::date, v.end_date::date, v.note
FROM (VALUES
  ('vacation', 'Winter Vacation', '2026-12-20', '2027-01-03', NULL),
  ('holiday', 'Pongal', '2027-01-15', '2027-01-17', NULL),
  ('buffer', 'CAT-I prep', '2027-01-16', '2027-01-22', NULL),
  ('holiday', 'Thaipoosam', '2027-01-22', '2027-01-22', 'As per Government declaration'),
  ('exam', 'CAT-I', '2027-01-23', '2027-01-30', NULL),
  ('holiday', 'Republic Day', '2027-01-26', '2027-01-26', NULL),
  ('noclass', 'Vibrance', '2027-02-24', '2027-02-27', NULL),
  ('buffer', 'CAT-II prep', '2027-02-27', '2027-03-05', NULL),
  ('exam', 'CAT-II', '2027-03-06', '2027-03-13', NULL),
  ('holiday', 'Ramzan', '2027-03-10', '2027-03-10', 'As per Government declaration'),
  ('holiday', 'Holi', '2027-03-22', '2027-03-22', NULL),
  ('noclass', 'Good Friday', '2027-03-26', '2027-03-26', NULL),
  ('buffer', 'Lab FAT prep', '2027-04-03', '2027-04-09', NULL),
  ('noclass', 'Telugu New Year', '2027-04-08', '2027-04-08', NULL),
  ('exam', 'Lab FAT', '2027-04-10', '2027-04-16', NULL),
  ('buffer', 'FAT prep', '2027-04-12', '2027-04-18', NULL),
  ('holiday', 'Tamil New Year', '2027-04-14', '2027-04-14', NULL),
  ('exam', 'Theory FAT begins', '2027-04-19', '2027-04-19', 'End date not in the circular; CoE announces the FAT schedule later.')
) AS v(entry_type, title, start_date, end_date, note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_entries c
  WHERE c.entry_type = v.entry_type AND c.title = v.title
    AND c.start_date = v.start_date::date AND c.end_date = v.end_date::date
);

-- Club events --------------------------------------------------------------------
INSERT INTO public.events (title, description, start_date, end_date, venue_id, is_online, created_by)
SELECT v.title, v.description, v.start_date::date, v.end_date::date, v.venue_id, v.is_online, 'club_calendar.html'
FROM (VALUES
  (U&'SSCS \00D7 IEEE RAS Hackathon', NULL, '2026-12-18', '2026-12-19', NULL, false),
  ('IEEE Week', NULL, '2027-01-07', '2027-01-08', NULL, false),
  ('IEEE Week', '9 and 10 Jan excluded', '2027-01-11', '2027-01-14', NULL, false),
  ('Women Speaker Session', NULL, '2027-02-08', '2027-02-08', NULL, false),
  ('Women Hackathon', NULL, '2027-02-11', '2027-02-12', NULL, false),
  ('Tech Workshop', NULL, '2027-03-19', '2027-03-19', NULL, false)
) AS v(title, description, start_date, end_date, venue_id, is_online)
WHERE NOT EXISTS (
  SELECT 1 FROM public.events x
  WHERE x.title = v.title AND x.start_date = v.start_date::date AND x.end_date = v.end_date::date
);

-- Venue bookings -----------------------------------------------------------------
INSERT INTO public.venue_bookings (venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours)
SELECT v.venue_id, v.booking_date::date, v.from_time::time, v.to_time::time, v.event_name, v.booked_by, v.phone, v.is_ours
FROM (VALUES
  ('nethaji', '2026-09-19', '08:00', '20:00', 'Technical workshop', 'SHOLA USHA RANI', '8870313666', false),
  ('nethaji', '2026-09-21', '10:00', '14:00', 'Turnitin software training', 'JAMUNA K', '9445212692', false),
  ('nethaji', '2026-09-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-09-23', '11:30', '13:20', 'film screening', 'ASHUTOSH KUMAR TRIPATHI', '9334030420', false),
  ('nethaji', '2026-09-23', '13:20', '18:00', 'EnVITion 26', 'BHUVANESHWARI MOHAN', '9042349259', false),
  ('nethaji', '2026-09-24', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-09-28', '06:00', '19:00', 'Department of Atomic Energy - Workshop', 'NANDHIKA THARINI V', '8825587640', false),
  ('nethaji', '2026-09-29', '06:00', '19:00', 'Department of Atomic Energy - Workshop', 'NANDHIKA THARINI V', '8825587640', false),
  ('nethaji', '2026-09-30', '13:30', '17:00', 'GUEST LECTURE ON DIGITAL COMMUNICATION IN CIRCULAR ECONOMY AND SUSTAINABILITY SECTOR', 'B. NAGAJAYANTHI', '7708104821', false),
  ('nethaji', '2026-09-30', '09:00', '13:00', 'OBE WORKSHOP - TEST', 'POONGODI R', '9952922573', false),
  ('nethaji', '2026-10-01', '11:00', '13:00', 'Faculty Meeting', 'PARTHIBAN V', '9865754883', false),
  ('nethaji', '2026-10-04', '13:24', '22:25', U&'Folk Fiesta: Odia Nua Khai \2013 Celebrating the Harvest, Culture', 'SAROJ KUMAR DASH', '9962997895', false),
  ('nethaji', '2026-10-05', '10:00', '18:00', 'AI Product Management Summit', 'LOGESH R', '9486453607', false),
  ('nethaji', '2026-10-06', '08:00', '18:00', 'AIML Related WorkShop', 'JAYARAM B', '9486203960', false),
  ('nethaji', '2026-10-06', '18:30', '23:59', 'QISKIT FALLFEST 2026', 'N RAMESH BABU', '8778097050', false),
  ('nethaji', '2026-10-07', '11:00', '14:00', 'SENSE Faculty Meeting', 'DIVYA A', '9092541664', false),
  ('nethaji', '2026-10-07', '00:00', '11:00', 'QISKIT FALLFEST 2026 (Hackathon Event)', 'N RAMESH BABU', '8778097050', false),
  ('nethaji', '2026-10-07', '14:30', '21:59', U&'Folk Fiesta: Odia Nua Khai \2013 Celebrating the Harvest, Culture', 'SAROJ KUMAR DASH', '9962997895', false),
  ('nethaji', '2026-10-08', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-09', '07:00', '19:00', 'National Conference on Sustainable Fashion - 2026', 'RATHINAMOORTHY R', '9894989520', false),
  ('nethaji', '2026-10-10', '10:30', '17:30', 'Halloween', 'MALLIKA SINHA', '9004489863', false),
  ('nethaji', '2026-10-11', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-12', '10:00', '18:00', 'Flutter Wars', 'LOGESH R', '9486453607', false),
  ('nethaji', '2026-10-13', '15:30', '19:00', 'CHARACTER CHRONICLES - EVENT', 'SOFANA REKA S', '9585285991', false),
  ('nethaji', '2026-10-13', '11:31', '13:05', 'Guest lecture on cloud computing', 'MANIMARAN R', '9445737752', false),
  ('nethaji', '2026-10-14', '15:30', '19:00', 'DANCE EVENT', 'SOFANA REKA S', '9585285991', false),
  ('nethaji', '2026-10-14', '08:00', '20:00', 'Dasara', 'AYUB AHMED JANVEKAR', '9663820636', false),
  ('nethaji', '2026-10-14', '12:00', '13:30', U&'\0046rom Qubits to Careers: Your Roadmap \0069nto Quantum Computing', 'PARASURAMAN E', '9566984364', false),
  ('nethaji', '2026-10-15', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-16', '13:00', '17:31', U&'ANRF Sponsored 2nd National Workshop on \201CQuantum Mathematics and Biomedical Imaging for Intelligent Healthcare 5.0 (QMI 2026)\0022', 'N RAMESH BABU', '8778097050', false),
  ('nethaji', '2026-10-17', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-18', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-19', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-20', '10:00', '18:00', 'Algo Wars', 'LOGESH R', '9486453607', false),
  ('nethaji', '2026-10-21', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2026-10-23', '08:00', '18:00', '8th VLS MUN', 'AYUSHI SRIVASTAVA', '9005985264', false),
  ('nethaji', '2026-10-24', '08:00', '18:00', 'Model United Nations', 'PREMA E', '9840227050', false),
  ('nethaji', '2026-10-28', '11:00', '13:15', 'Faculty Meeting', 'SASIKALA R', '9003069285', false),
  ('nethaji', '2026-10-30', '08:00', '18:00', 'Marketing Conclave 2026', 'ANU C H', '8098056614', false),
  ('nethaji', '2026-11-04', '11:00', '14:00', 'SENSE Faculty Meeting', 'DIVYA A', '9092541664', false),
  ('nethaji', '2026-11-25', '07:00', '20:00', 'ICNCS - 2026', 'PARTHIBAN V', '9865754883', false),
  ('nethaji', '2026-11-26', '08:00', '20:00', 'ICNCS - 2026', 'PARTHIBAN V', '9865754883', false),
  ('nethaji', '2026-11-27', '08:00', '20:00', 'ICNCS - 2026', 'PARTHIBAN V', '9865754883', false),
  ('nethaji', '2026-12-01', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-02', '11:30', '14:00', 'SENSE Faculty meeting', 'DIVYA A', '9092541664', false),
  ('nethaji', '2026-12-03', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-04', '08:00', '19:00', 'Hackathon prelims', 'M. BRAVEEN', '9677745750', false),
  ('nethaji', '2026-12-05', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-06', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-07', '08:00', '17:00', 'ENERGY CONSERVATION WEEK', 'OM PRAKASH', '9940474214', false),
  ('nethaji', '2026-12-08', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-09', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-10', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-11', '08:00', '17:00', 'VALEDICTORY FUNCTION OF ENERGY CONSERVATION WEEK', 'OM PRAKASH', '9940474214', false),
  ('nethaji', '2026-12-12', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-13', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-14', '08:00', '17:00', 'ENERGY CONSERVATION WEEK', 'OM PRAKASH', '9940474214', false),
  ('nethaji', '2026-12-15', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-16', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-17', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('nethaji', '2026-12-18', '08:00', '17:00', 'VALEDICTORY FUNCTION OF ENERGY CONSERVATION WEEK', 'OM PRAKASH', '9940474214', false),
  ('nethaji', '2027-01-04', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2027-01-05', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714010', false),
  ('nethaji', '2027-01-06', '11:30', '14:00', 'SENSE faculty meeting', 'DIVYA A', '9092541664', false),
  ('nethaji', '2027-01-07', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2027-01-08', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2027-01-09', '06:00', '12:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2027-01-10', '06:00', '12:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('nethaji', '2027-01-11', '06:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('nethaji', '2027-01-12', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('nethaji', '2027-01-13', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('nethaji', '2027-01-14', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('nethaji', '2027-01-15', '09:00', '21:00', 'swc events', 'KESAVA PRASAD K', '7358782572', false),
  ('nethaji', '2027-01-16', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('nethaji', '2027-01-17', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-18', '06:00', '12:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-19', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-20', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-21', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-23', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('nethaji', '2027-01-27', '11:00', '17:00', 'Foreigner Talk', 'GOVINDARAJAN P', '9940261620', false),
  ('nethaji', '2027-02-03', '11:30', '14:00', 'SENSE faculty meeting', 'DIVYA A', '9092541664', false),
  ('nethaji', '2027-02-10', '09:00', '15:30', 'Make My Hero 2.0', 'DHAVAKUMAR P', '9840208319', false),
  ('nethaji', '2027-03-03', '11:30', '14:00', 'SENSE Faculty meeting', 'DIVYA A', '9092541664', false),
  ('nethaji', '2027-03-03', '08:00', '10:59', 'International Conference on Emerging Trends in Social, Business and Management Science Research (ICSBMR- 2027)', 'ASI VASU DEVA REDDY', '9959190069', false),
  ('nethaji', '2027-03-04', '14:00', '17:00', 'International Conference on Emerging Trends in Social, Business and Management Science Research (ICSBMR- 2027) - Valedictory function', 'ASI VASU DEVA REDDY', '9959190069', false),
  ('nethaji', '2027-04-07', '11:00', '14:00', 'SENSE Faculty meeting', 'DIVYA A', '9092541664', false),
  ('kamaraj', '2026-09-21', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-22', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-23', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-24', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-25', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-28', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-29', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-09-30', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-01', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-05', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-06', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-07', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-08', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-09', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-10', '09:00', '18:00', 'EnVITion 26', 'BHUVANESHWARI MOHAN', '9042349259', false),
  ('kamaraj', '2026-10-11', '06:00', '23:59', 'Hackathon', 'V. SAKTHIVEL', '9843677515', false),
  ('kamaraj', '2026-10-12', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-13', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-14', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-15', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-16', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-17', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2026-10-18', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2026-10-19', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2026-10-20', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-21', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-22', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-23', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-24', '08:00', '17:02', 'VLS MUN 2026', 'PREMA E', '9840227047', false),
  ('kamaraj', '2026-10-26', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-27', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-28', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-29', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-30', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-10-31', '07:00', '19:00', 'OPEN DAY', 'KARTHIK NARAYANAN S', '9840808093', false),
  ('kamaraj', '2026-11-02', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-03', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-04', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-05', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-06', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-09', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-10', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-11', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-12', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-13', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-16', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-17', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-18', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-19', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-20', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-23', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-24', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-25', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-26', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-27', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-11-30', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-01', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-02', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-03', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-04', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-04', '17:00', '23:59', 'Hackathon Prelims', 'M. BRAVEEN', '9677745750', false),
  ('kamaraj', '2026-12-05', '00:00', '13:00', 'Hackathon Prelims', 'M. BRAVEEN', '9677745750', false),
  ('kamaraj', '2026-12-06', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('kamaraj', '2026-12-07', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-08', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-09', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-10', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-11', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-12', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('kamaraj', '2026-12-13', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('kamaraj', '2026-12-14', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-15', '08:00', '17:00', 'Placement', 'SENTHIL KUMAAR A C', '9444912121', false),
  ('kamaraj', '2026-12-16', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('kamaraj', '2026-12-17', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('kamaraj', '2026-12-18', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('kamaraj', '2027-01-04', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-05', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-06', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-07', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-08', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-09', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-10', '06:00', '12:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('kamaraj', '2027-01-11', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('kamaraj', '2027-01-12', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('kamaraj', '2027-01-13', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('kamaraj', '2027-01-14', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('kamaraj', '2027-01-15', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('kamaraj', '2027-01-16', '09:00', '21:00', 'swc events', 'KESAVA PRASAD K', '7358782572', false),
  ('kamaraj', '2027-01-17', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-18', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-19', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-20', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-21', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-23', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('kamaraj', '2027-01-27', '08:00', '18:00', 'Hack Secure - cyber Security Workshop CTF', 'V. MUTHUMANIKANDAN', '9629574328', false),
  ('kamaraj', '2027-03-03', '07:01', '18:31', 'International conference - Inauguration', 'ASI VASU DEVA REDDY', '9959190069', false),
  ('kamaraj', '2027-03-25', '09:00', '16:30', 'AI Heist 2.0', 'DHAVAKUMAR P', '9840208319', false),
  ('kasturba', '2026-09-21', '09:00', '14:00', 'International Students'' Ice-Breaking Session', 'KAVYA SREE K', '8668159741', false),
  ('kasturba', '2026-09-22', '09:00', '14:00', 'Workshop on AI and Industry 5.0 Tools for Innovators and Entrepreneurs', 'SHEENA CHRISTABEL PRAVIN', '9840506176', false),
  ('kasturba', '2026-09-23', '11:00', '13:00', 'Curriculum-Based Guest Lecture on Ethics and Human Values', 'JANANI C', '7708201539', false),
  ('kasturba', '2026-09-23', '13:10', '17:00', U&'One day National Seminar on Unlocking Youth Potential: \0046rom Skill Building to Entrepreneurial Leadership', 'VIJAYALAKSHMI V', '9677789561', false),
  ('kasturba', '2026-09-23', '08:00', '11:00', 'DrapeScape - EnVITion 26', 'BHUVANESHWARI MOHAN', '9042349259', false),
  ('kasturba', '2026-09-28', '08:30', '17:30', 'FDP on AI tools for Teaching and Learning Process', 'MANJULA S', '9790768997', false),
  ('kasturba', '2026-09-29', '13:00', '17:00', U&'FDP on Sound Healing \2013 Relax', 'MANJULA S', '9790768997', false),
  ('kasturba', '2026-09-29', '11:00', '13:00', 'FDC - FDP - Workshop on SATORI AI Augmented Reality platform', 'DAVIDSON JEBASEELAN', '9790701475', false),
  ('kasturba', '2026-09-30', '11:00', '13:30', 'Clinical Training Programme on Securing Internships and Placements in Law', 'ZAKKARIYA T H', '9847600328', false),
  ('kasturba', '2026-10-05', '08:00', '18:30', 'Hackathon', 'SHOLA USHA RANI', '8870313666', false),
  ('kasturba', '2026-10-06', '08:00', '18:30', 'Hackathon', 'SHOLA USHA RANI', '8870313666', false),
  ('kasturba', '2026-10-07', '09:00', '17:30', 'Competitive Event with Dual Team Singing', 'V. MUTHUMANIKANDAN', '9629574328', false),
  ('kasturba', '2026-10-08', '09:35', '19:30', 'FYI wolf of D-street', 'MILIND SHRINIVAS DANGATE', '9895871417', false),
  ('kasturba', '2026-10-09', '09:32', '19:32', 'FYI Wolf of D-street', 'MILIND SHRINIVAS DANGATE', '9895871417', false),
  ('kasturba', '2026-10-10', '09:33', '19:33', 'FYI Wolf of D-Street', 'MILIND SHRINIVAS DANGATE', '9895871417', false),
  ('kasturba', '2026-10-12', '08:30', '23:59', 'Cygnix Hackathon', 'SARANYARAJ D', '9952045362', false),
  ('kasturba', '2026-10-13', '00:00', '12:30', 'Cygnix Hackathon- Round 2', 'SARANYARAJ D', '9952045362', false),
  ('kasturba', '2026-10-14', '08:00', '18:00', 'Hackathon', 'SHOLA USHA RANI', '8870313666', false),
  ('kasturba', '2026-10-15', '08:00', '18:30', 'Hackathon', 'SHOLA USHA RANI', '8870313666', false),
  ('kasturba', '2026-10-16', '08:00', '18:00', 'CODING AUCTION - A CP event with an auction-based twist. Participants will bid strategically to build their teams, resources, and advantages. Each round will test coding skills and problem-solving skills. The auction element adds strategy and competition', 'SHRIDEVI S', '7550105529', false),
  ('kasturba', '2026-10-21', '08:00', '17:00', 'NCSET', 'SARAVANAKUMAR R', '9095454447', false),
  ('kasturba', '2026-10-31', '07:00', '19:00', 'OPEN DAY 2027', 'KARTHIK NARAYANAN S', '9840808093', false),
  ('kasturba', '2026-11-13', '06:00', '19:00', 'SCHOOL PROMOTIONAL EVENT', 'OM PRAKASH', '9940474214', false),
  ('kasturba', '2026-11-14', '06:00', '19:00', 'SCHOOL PROMOTIONAL EVENT', 'OM PRAKASH', '9940474214', false),
  ('kasturba', '2026-12-04', '07:00', '23:59', 'Hackathon', 'BERLIN HENCY V', '9884317349', false),
  ('kasturba', '2026-12-05', '00:00', '10:00', 'Hackathon', 'BERLIN HENCY V', '9884317349', false),
  ('kasturba', '2026-12-07', '09:00', '18:00', 'Void v2 (Hackathon)', 'UMMITY SRINIVASA RAO', '7904714516', false),
  ('kasturba', '2026-12-08', '09:00', '18:00', 'Void v2( Hackathon)', 'UMMITY SRINIVASA RAO', '7904714516', false),
  ('kasturba', '2026-12-11', '00:00', '23:59', 'Hackathon', 'M. BRAVEEN', '9677745750', false),
  ('kasturba', '2026-12-14', '08:00', '18:00', 'RAGE CLICK', 'V. MUTHUMANIKANDAN', '9629574328', false),
  ('kasturba', '2026-12-15', '08:00', '23:59', 'Zyora Labs Hackathon', 'JAYARAM B', '9486203960', false),
  ('kasturba', '2026-12-16', '00:00', '23:00', 'Hackathon - Ecell', 'NACHIYAPPAN S', '9443268429', false),
  ('kasturba', '2026-12-17', '00:00', '23:00', 'Hackathon - Ecell', 'NACHIYAPPAN S', '9443268429', false),
  ('kasturba', '2026-12-18', '00:00', '23:00', 'Hackathon - Ecell', 'NACHIYAPPAN S', '9443268429', false),
  ('kasturba', '2027-01-11', '08:00', '23:59', 'Hackathon', 'SHOLA USHA RANI', '8870313666', false),
  ('kasturba', '2027-01-12', '00:01', '18:30', 'Hackathon', 'SHOLA USHA RANI', '8870313666', false),
  ('kasturba', '2027-01-13', '00:01', '23:59', 'Model Mayhem', 'V. MUTHUMANIKANDAN', '9629574328', false),
  ('kasturba', '2027-01-14', '00:01', '23:59', 'Model Mayhem', 'V. MUTHUMANIKANDAN', '9629574328', false),
  ('kasturba', '2027-01-29', '08:00', '18:00', 'Sparrow Conservation Workshop', 'UMAYAL C', '9003035785', false),
  ('voc', '2026-09-20', '14:00', '19:00', 'Research Paper Discussion on Physical AI', 'KRISHANU GANGULY', '7010329306', false),
  ('voc', '2026-09-21', '08:00', '17:30', 'Founder''s Day (MIC)', 'M. BRAVEEN', '9677745750', false),
  ('voc', '2026-09-22', '14:00', '18:00', 'Student Chapter Inauguration Event', 'RATHINAMOORTHY R', '9894989520', false),
  ('voc', '2026-09-22', '08:00', '13:00', 'EnVITion 26', 'RATHINAMOORTHY R', '9894989520', false),
  ('voc', '2026-09-23', '11:00', '14:00', 'Short film content creator interaction', 'ARUNKUMAR V', '9843437392', false),
  ('voc', '2026-09-24', '09:00', '12:00', 'Special lecture', 'P C ABIRAMI', '9940424790', false),
  ('voc', '2026-09-25', '08:30', '12:00', 'SAP', 'BANUMATHI S', '9941823519', false),
  ('voc', '2026-09-28', '10:00', '17:00', 'SDP', 'JAMUNA K', '9445212692', false),
  ('voc', '2026-09-29', '13:00', '17:00', 'Sound Healing', 'PRIYAADHARSHINI M', '7845721150', false),
  ('voc', '2026-09-30', '10:00', '17:00', 'SDP', 'JAMUNA K', '9445212692', false),
  ('voc', '2026-10-05', '08:00', '17:00', 'Tech Sprint', 'M. BRAVEEN', '9677745750', false),
  ('voc', '2026-10-06', '06:00', '19:00', 'Department of Atomic Energy', 'NANDHIKA THARINI V', '8825587640', false),
  ('voc', '2026-10-07', '06:00', '19:00', 'Department of Atomic Energy', 'NANDHIKA THARINI V', '8825587640', false),
  ('voc', '2026-10-08', '09:00', '18:00', 'FinQuest- finance-focused experiential event combining expert insights, interactive market challenges, and a stock market simulation. Participants will test their financial knowledge, investment strategies, risk management, and decision-making skills in a competitive, real-world-inspired environment.', 'RAJARAJESWARI S', '9790896652', false),
  ('voc', '2026-10-09', '07:30', '18:00', 'National Conference of Sustainability in Fashion (NCSF - 2026)', 'RATHINAMOORTHY R', '9894989520', false),
  ('voc', '2026-10-10', '07:00', '17:00', 'National Conference on Sustainability in Fashion (NCSF) - 2026', 'RATHINAMOORTHY R', '9894989520', false),
  ('voc', '2026-10-12', '08:30', '11:30', U&'ANRF Sponsored 2nd National Workshop on \201CQuantum Mathematics and Biomedical Imaging for Intelligent Healthcare 5.0 (QMI 2026)\0022', 'N RAMESH BABU', '8778097050', false),
  ('voc', '2026-10-13', '09:00', '16:00', 'Business seminar series', 'REKHAPRIYADHARSHINI A', '9790169221', false),
  ('voc', '2026-10-14', '09:30', '11:00', 'International E-Waste Day celebration In collaboration with IWMA and TESAMM Pvt Ltd', 'ANJALI GOPAKUMAR', '9994980838', false),
  ('voc', '2026-10-14', '11:10', '14:00', 'Innovations based seminar', 'MALLIKA SINHA', '9004489864', false),
  ('voc', '2026-10-15', '08:00', '18:00', 'IEEE WEEK', 'SUCHETHA M', '9841465127', false),
  ('voc', '2026-10-16', '08:00', '20:00', 'Pitchers show down - Ecell', 'NACHIYAPPAN S', '9443268429', false),
  ('voc', '2026-10-21', '11:00', '14:00', 'Learning', 'REKHAPRIYADHARSHINI A', '9790169221', false),
  ('voc', '2026-10-22', '09:05', '17:15', 'Farewell 2025 PG Batch', 'SANJIT DAS', '9498093769', false),
  ('voc', '2026-10-23', '08:00', '18:00', 'VLS MUN 2026', 'PREMA E', '9840227050', false),
  ('voc', '2026-10-24', '08:00', '17:00', 'VLS MUN 2026', 'PREMA E', '9840227050', false),
  ('voc', '2026-11-03', '10:00', '17:00', 'SDP', 'JAMUNA K', '9445212692', false),
  ('voc', '2026-11-05', '09:00', '13:30', 'Staff Development Programme', 'MANJULA S', '9790768997', false),
  ('voc', '2026-11-16', '13:30', '16:30', 'Five day International FDP on AI in Legal Research Inagural session', 'SAJI SIVAN S', '9847889900', false),
  ('voc', '2026-11-20', '14:00', '16:30', 'International FDP on AI in Legal Research, Validatory Session', 'SAJI SIVAN S', '9847889900', false),
  ('voc', '2026-12-06', '08:00', '13:30', 'VITREEE JANUARY SESSION - PARENT WAITING HALL', 'CHANDRIKA R', '9444074562', false),
  ('voc', '2026-12-08', '08:30', '17:30', 'BIZ BUILDERS 3rd Edition', 'NISHA R', '9841991530', false),
  ('voc', '2026-12-09', '08:00', '18:00', 'Workshop on Product Development and System Design', 'V. MUTHUMANIKANDAN', '9629574328', false),
  ('voc', '2026-12-10', '08:00', '19:30', 'ICRTAC 2026', 'SARANYARAJ D', '9952045362', false),
  ('voc', '2026-12-11', '08:00', '19:14', 'ICRTAC 2026', 'SARANYARAJ D', '9952045362', false),
  ('voc', '2026-12-15', '09:00', '17:17', U&'The 180-Second Pitch-a-Thon aims to give VIT Chennai students a fast-paced, hands-on startup simulation where teams build a 3-slide business model on the spot and pitch it live in under 3 minutes. Through screening, strict time-boxing, and a nominal registration fee, the event is designed to filter out passive attendees seeking only an OD and ensure genuine engagement. It''s expected to teach practical business concepts \2014 pricing, margins, and startup costs \2014 while helping VITFAM extend its reach to engineering and tech students beyond typical business majors.', 'BUVANESH C', '9789900174', false),
  ('voc', '2026-12-16', '09:00', '16:30', 'Crypto Clash is a fun and competitive crypto trading event where participants use virtual funds to trade cryptocurrencies, make smart decisions, and compete to achieve the highest returns. Test your strategy, manage your risks, and become the ultimate Crypto Clash champion!', 'BUVANESH C', '9789900174', false),
  ('voc', '2027-01-08', '09:00', '18:00', 'AI/ML workshop', 'UMMITY SRINIVASA RAO', '7904714516', false),
  ('voc', '2027-01-28', '08:00', '18:00', 'International Conference on Protection of Environment Under International Law', 'RAJAVENKATESAN P R L', '9840582063', false),
  ('voc', '2028-01-21', '09:00', '16:00', 'Brainware 2.0', 'DHAVAKUMAR P', '9840208319', false),
  ('ab1', '2026-09-21', '08:00', '17:30', 'How to Start-up (MIC)', 'M. BRAVEEN', '9677745750', false),
  ('ab1', '2026-09-22', '09:00', '16:30', 'Every fintech company runs anomaly detection under the hood; it''s how a bank catches a fraudulent transaction in milliseconds. But the underlying technique (spotting what doesn''t fit a pattern) isn''t a finance concept; it''s a data concept. This workshop teaches the exact methods fintech uses for fraud detection, then hands participants the tools to apply it to whatever domain they care about: bot accounts, network intrusions, fake reviews, sensor failures, and plagiarism.', 'BUVANESH C', '9789900174', false),
  ('ab1', '2026-09-23', '08:00', '17:30', 'One-day symposium on Advanced Functional Material-Based Sensors for Healthcare Diagnostics', 'SARAVANAKUMAR R', '8667267652', false),
  ('ab1', '2026-09-29', '10:00', '14:00', 'Seminar for Research Scholars', 'OM PRAKASH', '9940474214', false),
  ('ab1', '2026-09-30', '08:00', '17:00', 'OPEN HOUSE EVENT', 'OM PRAKASH', '9940474214', false),
  ('ab1', '2026-10-01', '10:00', '14:00', 'Seminar for SELECT School Faculty Members', 'OM PRAKASH', '9940474214', false),
  ('ab1', '2026-10-06', '09:00', '13:00', 'IEEE Day Event. Discuss on latest technology and opportunity for students', 'BISWAJIT JENA', '7978101478', false),
  ('ab1', '2026-10-07', '10:00', '14:00', 'SELECT SCHOOL FACULTY MEETING', 'OM PRAKASH', '9940474214', false),
  ('ab1', '2026-10-10', '10:00', '13:00', 'seminar', 'ARIVARASI A', '9884790401', false),
  ('ab1', '2026-10-21', '11:00', '13:15', 'enfuse student chapter inauguration with Guest lecture', 'PEER FATHIMA A', '9444022777', false),
  ('ab1', '2026-10-23', '08:00', '17:30', 'VLS MUN 2026 8th edition', 'PREMA E', '9840227050', false),
  ('ab1', '2026-10-24', '08:00', '17:00', 'VLS MUN 2026', 'PREMA E', '9840227050', false),
  ('ab1', '2026-11-01', '10:00', '16:00', 'NBA review meeting', 'POONGODI R', '9952922573', false),
  ('ab1', '2026-11-04', '10:00', '14:00', 'SELECT SCHOOL FACULTY MEETING', 'OM PRAKASH', '9940474214', false),
  ('ab1', '2026-12-02', '10:00', '14:00', 'SELECT SCHOOL FACULTY MEETING', 'OM PRAKASH', '9940474214', false),
  ('ab1', '2026-12-05', '06:00', '22:00', 'VITREE JAN 2027 SESSION -EXAM CONTROL ROOM', 'MARY JOSEPH', '9840300478', false),
  ('ab1', '2026-12-06', '06:00', '22:59', 'VITREE JAN 2027 SESSION -EXAM CONTROL ROOM', 'MARY JOSEPH', '9840300478', false),
  ('ab1', '2026-12-18', '08:00', '17:00', 'Workshop', 'M. BRAVEEN', '9677745750', false),
  ('mg', '2026-09-19', '08:00', '21:00', 'Swarajya - MLA Event', 'GANESH NAGARAO CHILKE', '9701047330', false),
  ('mg', '2026-09-20', '08:00', '18:00', 'V-Nest Event - Bootcamp - SSV', 'NACHIYAPPAN S', '9443268429', false),
  ('mg', '2026-09-21', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-09-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-09-23', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-09-24', '06:00', '23:00', 'National Taekwondo Championship for Sub Junior and Cadet - 2026', 'SELVAGANESH G T', '9789123630', false),
  ('mg', '2026-09-25', '06:00', '23:00', 'National Teakwondo Championship for Sub Junior', 'SELVAGANESH G T', '9894832742', false),
  ('mg', '2026-09-27', '06:00', '23:00', 'National Taekwondo Championship for Sub Junior and Cadet - 2026', 'SELVAGANESH G T', '9894832742', false),
  ('mg', '2026-09-28', '08:00', '17:00', 'BCE - Open Day / Tech,. Talk./Alumni talk', 'ANUSOOYA G', '9176313600', false),
  ('mg', '2026-09-29', '08:00', '17:00', 'BCE - Open Day / Tech,. Talk./Alumni talk', 'ANUSOOYA G', '9176313600', false),
  ('mg', '2026-09-30', '11:00', '15:00', 'Elevator Pitch Competition', 'PRIYA S', '9500329935', false),
  ('mg', '2026-10-03', '00:00', '23:00', 'Hackathon', 'NACHIYAPPAN S', '9443268429', false),
  ('mg', '2026-10-04', '08:00', '23:00', 'Hackathon', 'NACHIYAPPAN S', '9443268429', false),
  ('mg', '2026-10-05', '08:00', '20:00', 'makeathon', 'POONKODI', '9840250563', false),
  ('mg', '2026-10-06', '08:00', '22:00', 'makeathon', 'POONKODI', '9840250563', false),
  ('mg', '2026-10-07', '00:00', '23:00', 'DataQuest 3', 'NACHIYAPPAN S', '9443268428', false),
  ('mg', '2026-10-08', '00:00', '23:00', 'DataQuest 3.0', 'NACHIYAPPAN S', '9443268429', false),
  ('mg', '2026-10-09', '06:00', '19:00', 'Dinamalar Chess tournament for School Students', 'ARUN KUMAR N', '9840927469', false),
  ('mg', '2026-10-10', '07:00', '14:59', 'Hack the Horizon 3.0 - AIC x Zuntra - 24 Hours', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2026-10-10', '15:30', '18:30', 'Stage rehearsal for Bodhon- Cultural Event for Bengali Literary Society', 'NILANJAN TEWARI', '9094641340', false),
  ('mg', '2026-10-10', '18:35', '23:57', 'Hack The Horizon 3.0 x Zuntra', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2026-10-11', '11:00', '19:30', 'Bodhon- Cultural Event for Bengali Literary Society', 'NILANJAN TEWARI', '9094641340', false),
  ('mg', '2026-10-11', '00:01', '10:30', 'Hack The Horizon x Zuntra', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2026-10-12', '08:00', '21:00', 'Int MTech - MIS/MID/MIA - Event', 'M. PREMALATHA', '9884326554', false),
  ('mg', '2026-10-13', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-14', '09:00', '20:00', 'Arignar Anna Tamil Mandram organizing on the eve of diwali festival, multi-faceted events like groupdance, singing, mimicry, poetry verses etc on stage performance for the students to perform cultural events', 'S SIVAKUMAR', '9865013204', false),
  ('mg', '2026-10-15', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-16', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-17', '07:00', '21:00', 'HACKATHON 12 HOURS', 'KARTHIYAINI S', '7092019008', false),
  ('mg', '2026-10-18', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-19', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-20', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-21', '06:00', '21:00', 'swc event', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-23', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2026-10-24', '08:00', '20:00', 'VLS MUN VALEDECTORY', 'PREMA E', '9840227050', false),
  ('mg', '2026-10-31', '07:00', '19:00', 'OPEN DAY 2027', 'KARTHIK NARAYANAN S', '9840808093', false),
  ('mg', '2026-11-13', '06:00', '19:00', 'SCHOOL PROMOTIONAL EVENT', 'OM PRAKASH', '9940474214', false),
  ('mg', '2026-11-14', '06:00', '19:00', 'SCHOOL PROMOTIONAL EVENT', 'OM PRAKASH', '9940474214', false),
  ('mg', '2026-12-01', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-02', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-03', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-04', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-05', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-06', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-07', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-08', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-09', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2026-12-10', '07:00', '23:59', 'MIC annual hackathon', 'M. BRAVEEN', '9677745750', false),
  ('mg', '2026-12-11', '00:00', '23:59', 'MIC annual hackathon', 'M. BRAVEEN', '9677745750', false),
  ('mg', '2026-12-12', '00:00', '23:59', 'MIC Annual Hackathon', 'M. BRAVEEN', '9677745750', false),
  ('mg', '2026-12-13', '07:00', '20:00', 'International conference on Pseudomonas 2026, Dec 13-17, 2026', 'JAYARAMAN G', '9944796904', false),
  ('mg', '2026-12-14', '07:00', '20:00', 'International conference on Pseudomonas 2026, Dec 13-17, 2026', 'JAYARAMAN G', '9944796904', false),
  ('mg', '2026-12-15', '07:00', '20:00', 'International conference on Pseudomonas 2026, Dec 13-17, 2026', 'JAYARAMAN G', '9944796904', false),
  ('mg', '2026-12-16', '07:00', '20:00', 'International conference on Pseudomonas 2026, Dec 13-17, 2026', 'JAYARAMAN G', '9944796904', false),
  ('mg', '2026-12-17', '07:00', '20:00', 'International conference on Pseudomonas 2026, Dec 13-17, 2026', 'JAYARAMAN G', '9944796904', false),
  ('mg', '2026-12-18', '06:00', '21:00', 'SWC EVENT', 'NAVANEETHAM G', '9790714810', false),
  ('mg', '2027-01-04', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-05', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-06', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-07', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-08', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-09', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-10', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '9790714810', false),
  ('mg', '2027-01-11', '06:00', '21:00', 'SWC Events', 'NAVANEETHAM G', '9944226963', false),
  ('mg', '2027-01-12', '06:00', '21:00', 'SWC Event', 'NAVANEETHAM G', '9944226963', false),
  ('mg', '2027-01-13', '06:00', '21:00', 'SWC Event', 'NAVANEETHAM G', '9944226963', false),
  ('mg', '2027-01-14', '06:00', '21:00', 'SWC Event', 'NAVANEETHAM G', '9944226963', false),
  ('mg', '2027-01-15', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('mg', '2027-01-16', '09:00', '21:00', 'swc event', 'KESAVA PRASAD K', '7358782572', false),
  ('mg', '2027-01-17', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-01-18', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-01-19', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-01-20', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-01-21', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-01-22', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-01-23', '06:00', '21:00', 'SWC EVENT', 'GOMATHI R', '7358782572', false),
  ('mg', '2027-02-04', '00:01', '23:59', 'Hack the Horizon 3.0', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-02-05', '00:01', '12:01', 'Hack the Horizon 3.0', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-02-08', '08:00', '23:59', 'Hackathon', 'RAJKUMAR MURUGESAN', '9840396952', false),
  ('mg', '2027-02-09', '00:01', '19:00', 'Makeathon', 'RAJKUMAR MURUGESAN', '9840396952', false),
  ('mg', '2027-02-10', '08:00', '17:00', 'BCE - Open Day / Tech,. Talk./Alumni talk', 'ANUSOOYA G', '9176313600', false),
  ('mg', '2027-02-11', '00:01', '23:59', 'AIC x Zuntra Hackathon', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-02-12', '00:01', '11:30', 'AIC x Zuntra Hackathon', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-02-15', '00:00', '23:00', 'Hackathon - Ecell', 'NACHIYAPPAN S', '9443268429', false),
  ('mg', '2027-02-16', '00:00', '23:00', 'Hackathon - Ecell', 'NACHIYAPPAN S', '9443268429', false),
  ('mg', '2027-02-17', '00:00', '23:00', 'Hackathon - Ecell', 'NACHIYAPPAN S', '9443267429', false),
  ('mg', '2027-02-18', '08:00', '18:00', 'AI War - Clash of LLMs event', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-02-19', '08:00', '16:00', 'AI War - Clash of LLMs event - Day 2', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-03-18', '00:01', '18:00', 'Sustain-AI-thon 2.0', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-03-19', '08:00', '17:00', 'Day 2 of Sustain-AI-thon 2.0', 'DHAVAKUMAR P', '9840208319', false),
  ('mg', '2027-03-25', '06:00', '08:00', 'Hypen''27 - Graduate Show', 'MAANVIZHI M', '9790237756', false),
  ('mg', '2027-03-31', '08:00', '17:00', 'BCE - Open Day / Tech,. Talk./Alumni talk', 'ANUSOOYA G', '9176313600', false),
  ('mg', '2027-04-02', '06:00', '20:00', 'Hypen''27', 'JESICA ROSHIMA A', '9789512312', false),
  ('mg', '2027-04-06', '06:00', '20:00', U&'Hypen\002227', 'JESICA ROSHIMA A', '9789512312', false),
  ('mg', '2027-04-09', '06:00', '20:00', 'Hypen''27', 'MAANVIZHI M', '9790237776', false)
) AS v(venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours)
WHERE NOT EXISTS (
  SELECT 1 FROM public.venue_bookings x
  WHERE x.venue_id = v.venue_id AND x.booking_date = v.booking_date::date
    AND x.from_time = v.from_time::time AND x.to_time = v.to_time::time AND x.event_name = v.event_name
);

INSERT INTO public.club_settings (key, value)
VALUES ('venue_data_as_of', to_jsonb('2026-09-19'::text))
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------------
-- FILE: 20261003000500_admin_guards.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- ADMIN GUARDS
--
-- Run after 20261003000400_seed_calendar.sql. Safe to re-run.
--
--   * the last super_admin can't be demoted or removed, so the club can never
--     lock itself out of Settings
--   * contribution types that contributions or attendance already use can't be
--     deleted (hide them instead); the foreign keys already enforce this, the
--     trigger below just says so in plain words
-- =============================================================================


CREATE OR REPLACE FUNCTION public.club_keep_a_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'super_admin'
     AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'super_admin')
     AND NOT EXISTS (SELECT 1 FROM public.admins WHERE role = 'super_admin' AND id <> OLD.id)
  THEN
    RAISE EXCEPTION 'There must always be at least one super admin' USING ERRCODE = '55000';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS tr_admins_keep_super ON public.admins;
CREATE TRIGGER tr_admins_keep_super
  BEFORE UPDATE OR DELETE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.club_keep_a_super_admin();

-- A type that is in use can't be deleted, and can't switch between
-- "submission" and "attendance" (that would break the rule that members only
-- submit submission types and attendance only uses attendance types).
CREATE OR REPLACE FUNCTION public.club_type_in_use()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  in_use boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.source IS NOT DISTINCT FROM OLD.source THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.contributions WHERE type_id = OLD.id)
      OR EXISTS (SELECT 1 FROM public.event_attendance WHERE type_id = OLD.id)
    INTO in_use;
  IF in_use AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'This contribution type is already in use; hide it instead of deleting it' USING ERRCODE = '23503';
  END IF;
  IF in_use THEN
    RAISE EXCEPTION 'This contribution type is already in use, so it can''t switch between submission and attendance' USING ERRCODE = '55000';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS tr_contribution_types_in_use ON public.contribution_types;
CREATE TRIGGER tr_contribution_types_in_use
  BEFORE UPDATE OR DELETE ON public.contribution_types
  FOR EACH ROW EXECUTE FUNCTION public.club_type_in_use();


-- ---------------------------------------------------------------------------
-- FILE: 20261003000600_venues_super_admin.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- VENUES: SUPER ADMINS ONLY
--
-- Run after 20261003000500_admin_guards.sql. Safe to re-run.
--
-- The Venues section (venue list, VTOP bookings, bulk import) is for super
-- admins only. Admins can still READ venues and bookings, because the calendar's
-- venue availability and each event's venue picker need them, but only super
-- admins can add, change, import or remove them.
-- =============================================================================


DROP POLICY IF EXISTS venues_admin ON public.venues;
DROP POLICY IF EXISTS venues_read ON public.venues;
DROP POLICY IF EXISTS venues_super_write ON public.venues;
CREATE POLICY venues_read ON public.venues
  FOR SELECT TO authenticated USING (public.is_club_admin());
CREATE POLICY venues_super_write ON public.venues
  FOR ALL TO authenticated USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());

DROP POLICY IF EXISTS venue_bookings_admin ON public.venue_bookings;
DROP POLICY IF EXISTS venue_bookings_read ON public.venue_bookings;
DROP POLICY IF EXISTS venue_bookings_super_write ON public.venue_bookings;
CREATE POLICY venue_bookings_read ON public.venue_bookings
  FOR SELECT TO authenticated USING (public.is_club_admin());
CREATE POLICY venue_bookings_super_write ON public.venue_bookings
  FOR ALL TO authenticated USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());

-- The bulk import runs with elevated rights, so it checks the role itself.
CREATE OR REPLACE FUNCTION public.import_venue_bookings(rows jsonb)
RETURNS TABLE (imported integer, replaced integer, venue_days integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_replaced integer;
  v_imported integer;
  v_days     integer;
BEGIN
  IF NOT public.is_club_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can import bookings' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(rows) <> 'array' OR jsonb_array_length(rows) = 0 THEN
    RAISE EXCEPTION 'Nothing to import' USING ERRCODE = '22023';
  END IF;

  DROP TABLE IF EXISTS pg_temp._incoming;
  CREATE TEMP TABLE _incoming ON COMMIT DROP AS
  SELECT r.venue_id,
         r.booking_date,
         r.from_time,
         r.to_time,
         trim(r.event_name)                       AS event_name,
         nullif(upper(trim(coalesce(r.booked_by, ''))), '') AS booked_by,
         nullif(regexp_replace(coalesce(r.phone, ''), '\s', '', 'g'), '') AS phone,
         coalesce(r.is_ours, false)               AS is_ours
  FROM jsonb_to_recordset(rows) AS r(
    venue_id text, booking_date date, from_time time, to_time time,
    event_name text, booked_by text, phone text, is_ours boolean
  );

  SELECT count(*) INTO v_days FROM (SELECT DISTINCT venue_id, booking_date FROM _incoming) d;

  DELETE FROM public.venue_bookings b
   USING (SELECT DISTINCT venue_id, booking_date FROM _incoming) d
   WHERE b.venue_id = d.venue_id AND b.booking_date = d.booking_date;
  GET DIAGNOSTICS v_replaced = ROW_COUNT;

  INSERT INTO public.venue_bookings (venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours)
  SELECT venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours FROM _incoming;
  GET DIAGNOSTICS v_imported = ROW_COUNT;

  INSERT INTO public.club_settings (key, value, updated_at)
  VALUES ('venue_data_as_of', to_jsonb(current_date), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN QUERY SELECT v_imported, v_replaced, v_days;
END
$$;


-- ---------------------------------------------------------------------------
-- FILE: 20261003000700_reopen_contribution.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- UNDO A REVIEW
--
-- Run after 20261003000600_venues_super_admin.sql. Safe to re-run.
--
-- reopen_contribution() puts an approved or rejected contribution back to
-- "pending": its points come off the leaderboard and the review (reviewer, date,
-- note) is cleared, so it can be reviewed again from the Approvals queue.
-- Deleting a contribution needs nothing new: admins could already delete.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.reopen_contribution(p_id uuid)
RETURNS public.contributions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.contributions;
BEGIN
  IF NOT public.is_club_admin() THEN
    RAISE EXCEPTION 'Only admins can undo a review' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.contributions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status = 'pending' THEN
    RAISE EXCEPTION 'This contribution is already waiting for review' USING ERRCODE = '55000';
  END IF;

  UPDATE public.contributions
     SET status = 'pending', points_awarded = NULL, reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
   WHERE id = p_id
  RETURNING * INTO c;

  RETURN c;
END
$$;

REVOKE ALL ON FUNCTION public.reopen_contribution(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_contribution(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261003000800_member_event_picker.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- WHICH EVENT WAS IT FOR? + PAST EVENTS
--
-- Run after 20261003000700_reopen_contribution.sql. Safe to re-run.
--
--   * members may tag a contribution with the event it was for
--   * they can pick any PAST event, and an upcoming event only once a super
--     admin has switched it on ("shown_to_members", Approvals page)
--   * only super admins can change that switch
--   * adds the club's earlier 2026 events
-- =============================================================================


ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS shown_to_members boolean NOT NULL DEFAULT false;

-- "Today" in India, which is where the club's dates live.
CREATE OR REPLACE FUNCTION public.club_today()
RETURNS date
LANGUAGE sql STABLE
AS $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date $$;

-- Whether members may pick this event: it's over, or a super admin opened it up.
CREATE OR REPLACE FUNCTION public.club_event_pickable(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND (end_date < public.club_today() OR shown_to_members)
  );
$$;

-- Only super admins change the switch. Statements with no signed-in user (the
-- SQL editor, seeds) are allowed; a plain admin trying it gets an error.
CREATE OR REPLACE FUNCTION public.club_events_shown_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.club_jwt_email() <> '' AND NOT public.is_club_super_admin()
     AND NEW.shown_to_members IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN false ELSE OLD.shown_to_members END)
  THEN
    RAISE EXCEPTION 'Only super admins can choose which events members can pick' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_shown_guard ON public.events;
CREATE TRIGGER tr_events_shown_guard
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_shown_guard();

-- The picker on /me: past events and opened-up upcoming ones, newest first.
CREATE OR REPLACE FUNCTION public.member_event_options()
RETURNS TABLE (id uuid, title text, start_date date)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.start_date
  FROM public.events e
  WHERE (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND (e.end_date < public.club_today() OR e.shown_to_members)
  ORDER BY e.start_date DESC;
$$;

-- Members can only tag an event they are allowed to pick.
DROP POLICY IF EXISTS contributions_submit_own ON public.contributions;
CREATE POLICY contributions_submit_own ON public.contributions
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = public.current_earner_id()
    AND status = 'pending'
    AND points_awarded IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_note IS NULL
    AND (event_id IS NULL OR public.club_event_pickable(event_id))
  );

-- Earlier 2026 events.
INSERT INTO public.events (title, start_date, end_date, created_by)
SELECT v.title, v.d::date, v.d::date, 'past events'
FROM (VALUES
  (U&'Fresher\0027s Club Expo', '2026-07-22'),
  ('Simulink Workshop',         '2026-08-01'),
  ('LABVIEW Workshop',          '2026-08-20'),
  ('TechnoVIT Club Expo',       '2026-08-25'),
  ('Hacktronics 2.0',           '2026-09-01'),
  ('SignalForge',               '2026-09-03'),
  ('Concept to Circuits',       '2026-09-04'),
  ('HelloESP',                  '2026-09-11')
) AS v(title, d)
WHERE NOT EXISTS (
  SELECT 1 FROM public.events x WHERE x.title = v.title AND x.start_date = v.d::date
);


-- ---------------------------------------------------------------------------
-- FILE: 20261003000900_settings_super_admin.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- SETTINGS: SUPER ADMINS ONLY
--
-- Run after 20261003000800_member_event_picker.sql. Safe to re-run.
--
-- Settings (admins, contribution types and points) is a super-admin section.
-- Managing admins already was; this makes contribution types and their points
-- super-admin only too. Everyone signed in can still READ the types: members
-- need them to log work, admins to mark attendance.
-- =============================================================================


DROP POLICY IF EXISTS contribution_types_admin ON public.contribution_types;
DROP POLICY IF EXISTS contribution_types_super_write ON public.contribution_types;
CREATE POLICY contribution_types_super_write ON public.contribution_types
  FOR ALL TO authenticated
  USING (public.is_club_super_admin())
  WITH CHECK (public.is_club_super_admin());


-- ---------------------------------------------------------------------------
-- FILE: 20261003001000_lock_applicant_data.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- LOCK THE OLD APPLICANT DATA
--
-- Run after 20261003000900_settings_super_admin.sql. Safe to re-run.
--
-- public.applications is the roster, but it still holds every recruitment
-- applicant with their interview scores, interviewer remarks, resume links and
-- so on. From here on:
--
--   * through the API, signed-in users can only read and write the roster
--     columns (name, email, reg no, phone, team, position, lead/active flags).
--     Interview scores, remarks, resumes and the rest are not readable through
--     the API by anyone, super admins included; the Supabase dashboard still
--     shows everything.
--   * admins only see rows that are on the roster; super admins also see the
--     former applicants (to add one back to the roster)
--   * admins can add new people, edit roster details and take someone off the
--     roster; only super admins can bring a former applicant back or delete rows
-- =============================================================================


-- Column access: roster columns only. (PostgREST requests for "*" or for any
-- other column now fail with "permission denied".)
REVOKE SELECT, INSERT, UPDATE ON public.applications FROM authenticated;
GRANT SELECT (
  id, email, full_name, roll_number, phone, primary_dept,
  member_department, member_position, is_member, is_lead, member_status, created_at
) ON public.applications TO authenticated;
GRANT INSERT (
  email, full_name, roll_number, phone, primary_dept,
  member_department, member_position, is_member, is_lead, member_status
) ON public.applications TO authenticated;
GRANT UPDATE (
  full_name, roll_number, phone, member_department, member_position, is_member, is_lead, member_status
) ON public.applications TO authenticated;
GRANT DELETE ON public.applications TO authenticated;

-- Row access.
DROP POLICY IF EXISTS applications_admin_all ON public.applications;
DROP POLICY IF EXISTS applications_read ON public.applications;
DROP POLICY IF EXISTS applications_insert ON public.applications;
DROP POLICY IF EXISTS applications_update ON public.applications;
DROP POLICY IF EXISTS applications_delete ON public.applications;

CREATE POLICY applications_read ON public.applications
  FOR SELECT TO authenticated
  USING (public.is_club_super_admin() OR (public.is_club_admin() AND is_member));

-- Admins may only add people straight onto the roster.
CREATE POLICY applications_insert ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_club_super_admin() OR (public.is_club_admin() AND is_member));

-- Admins edit roster rows; bringing a former applicant back needs a super
-- admin, since admins can't see those rows.
CREATE POLICY applications_update ON public.applications
  FOR UPDATE TO authenticated
  USING (public.is_club_super_admin() OR (public.is_club_admin() AND is_member))
  WITH CHECK (public.is_club_super_admin() OR (public.is_club_admin() AND is_member));

CREATE POLICY applications_delete ON public.applications
  FOR DELETE TO authenticated
  USING (public.is_club_super_admin());

-- Taking someone off the roster makes their row invisible to an admin, which
-- row security won't allow as a plain update; this function does it instead.
CREATE OR REPLACE FUNCTION public.remove_from_roster(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_club_admin() THEN
    RAISE EXCEPTION 'Only admins can change the roster' USING ERRCODE = '42501';
  END IF;
  UPDATE public.applications SET is_member = false WHERE id = p_id AND is_member;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not on the roster' USING ERRCODE = 'P0002';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.remove_from_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_from_roster(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261003001100_website_events.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- WEBSITE EVENTS: PUBLISH CLUB EVENTS TO THE PUBLIC SITE
--
-- Run after 20261003001000_lock_applicant_data.sql. Safe to re-run.
--
--   * events get website_* columns: published, featured, blurb, details,
--     tags, cover image, gallery, link
--   * only super admins can change those columns (plain admins still manage
--     the rest of the event)
--   * public.website_events: published events with public-safe columns only,
--     readable by anyone, signed in or not. Budgets, reports, checklists stay
--     private.
--   * "site-media" public bucket for covers and gallery photos; super admins
--     upload, anyone can view
--   * seeds the two events the home page used to hard-code
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS website_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_featured  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_blurb     text,
  ADD COLUMN IF NOT EXISTS website_details   text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_tags      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_cover     text,
  ADD COLUMN IF NOT EXISTS website_gallery   text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_link      text;

-- A featured event must be published.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_featured_published;
ALTER TABLE public.events ADD CONSTRAINT events_featured_published
  CHECK (NOT website_featured OR website_published);

CREATE INDEX IF NOT EXISTS idx_events_website ON public.events (website_published, start_date DESC);

-- -----------------------------------------------------------------------------
-- 2. Only super admins change what the website shows
--    Statements with no signed-in user (SQL editor, seeds) are allowed.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_events_website_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  changed boolean;
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    changed := NEW.website_published OR NEW.website_featured
      OR NEW.website_blurb IS NOT NULL OR NEW.website_cover IS NOT NULL OR NEW.website_link IS NOT NULL
      OR cardinality(NEW.website_details) > 0 OR cardinality(NEW.website_tags) > 0
      OR cardinality(NEW.website_gallery) > 0;
  ELSE
    changed := (NEW.website_published, NEW.website_featured, NEW.website_blurb, NEW.website_details,
                NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link)
      IS DISTINCT FROM
               (OLD.website_published, OLD.website_featured, OLD.website_blurb, OLD.website_details,
                OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link);
  END IF;

  IF changed THEN
    RAISE EXCEPTION 'Only super admins can change what the website shows' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_website_guard ON public.events;
CREATE TRIGGER tr_events_website_guard
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_website_guard();

-- -----------------------------------------------------------------------------
-- 3. Public view
--    Runs with the view owner's rights (like public.leaderboard), so signed-out
--    visitors can read it without any access to public.events itself.
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.website_events;
CREATE VIEW public.website_events AS
SELECT
  e.id,
  e.title,
  e.start_date,
  e.end_date,
  e.is_online,
  CASE WHEN e.is_online THEN NULL ELSE v.name END AS venue,
  e.website_featured  AS featured,
  e.website_blurb     AS blurb,
  e.website_details   AS details,
  e.website_tags      AS tags,
  e.website_cover     AS cover,
  e.website_gallery   AS gallery,
  e.website_link      AS link
FROM public.events e
LEFT JOIN public.venues v ON v.id = e.venue_id
WHERE e.website_published;

REVOKE ALL ON public.website_events FROM PUBLIC;
GRANT SELECT ON public.website_events TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Public bucket for website images (covers, galleries). 8 MB, images only.
--    Paths: <event id>/<random>.<ext>
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS site_media_super_insert ON storage.objects;
CREATE POLICY site_media_super_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.is_club_super_admin());

DROP POLICY IF EXISTS site_media_super_update ON storage.objects;
CREATE POLICY site_media_super_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_club_super_admin())
  WITH CHECK (bucket_id = 'site-media' AND public.is_club_super_admin());

DROP POLICY IF EXISTS site_media_super_delete ON storage.objects;
CREATE POLICY site_media_super_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_club_super_admin());

-- -----------------------------------------------------------------------------
-- 5. The two events the home page used to hard-code, published.
--    Only the month is known for each, so they're dated the 1st; fix the day
--    in the admin panel. Images point at files already in /public.
-- -----------------------------------------------------------------------------

INSERT INTO public.events (
  title, start_date, end_date, created_by,
  website_published, website_featured, website_blurb, website_details, website_tags, website_cover, website_gallery
)
SELECT v.title, v.d::date, v.d::date, 'website seed', true, true, v.blurb, v.details, v.tags, v.cover, v.gallery
FROM (VALUES
  (
    'Ice Breaker Session', '2025-08-01',
    'An introductory session for newly selected members to connect, form cross-functional teams, and brainstorm innovative event concepts to execute during the tenure.',
    ARRAY[
      'Welcomed newly recruited members and introduced the chapter''s core mission.',
      'Facilitated structured networking to help members form effective working teams.',
      'Conducted a collaborative brainstorming session where teams developed and pitched technical event ideas.'
    ],
    ARRAY['Networking', 'Team Building', 'Brainstorming'],
    '/event1.jpg',
    ARRAY['/event1.jpg']
  ),
  (
    'Capture the Signal', '2026-04-01',
    'A high-stakes, multi-round electronics competition that challenged participants across circuit design, signal analysis, and engineering strategy.',
    ARRAY[
      'Designed complex resistor networks and solved intricate Boolean logic puzzles under time pressure.',
      'Deciphered cryptic electronics clues and conducted deep black-box circuit analysis.',
      'Constructed physical analog circuits using real lab equipment to validate theoretical designs.',
      'Progressed through a tiered competition structure focused on hands-on hardware mastery.'
    ],
    ARRAY['Competition', 'Circuit Design', 'Analog Electronics'],
    '/event2-1.jpg',
    ARRAY['/event2-1.jpg', '/event2-2.jpg']
  )
) AS v(title, d, blurb, details, tags, cover, gallery)
WHERE NOT EXISTS (
  SELECT 1 FROM public.events x WHERE x.title = v.title
);


-- =============================================================================
-- AFTER RUNNING, sanity checks:
--
--   SELECT title, start_date, featured FROM public.website_events ORDER BY start_date DESC;
--   SELECT id, public FROM storage.buckets WHERE id = 'site-media';
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FILE: 20261003001200_website_team.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- WEBSITE TEAM: THE /team PAGE COMES FROM THE DATABASE
--
-- Run after 20261003001100_website_events.sql. Safe to re-run.
--
--   * public.website_team: faculty coordinators, core team and leads, one row
--     per person per tenure ("2026-27"). Faculty rows have no tenure and are
--     shown for every tenure.
--   * anyone (signed in or not) can read it; only super admins change it
--   * face photos go in the existing public "site-media" bucket under team/
--   * seeds the people /team used to hard-code
-- =============================================================================


CREATE TABLE IF NOT EXISTS public.website_team (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL CHECK (section IN ('faculty', 'core', 'lead')),
  tenure      text CHECK (tenure ~ '^\d{4}-\d{2}$'),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  role        text NOT NULL CHECK (length(trim(role)) BETWEEN 1 AND 80),
  quote       text CHECK (quote IS NULL OR length(quote) <= 200),
  image       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Faculty belong to every tenure; everyone else to exactly one.
  CONSTRAINT website_team_tenure CHECK ((section = 'faculty') = (tenure IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_website_team_order ON public.website_team (tenure, section, sort_order);

ALTER TABLE public.website_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_team_read ON public.website_team;
CREATE POLICY website_team_read ON public.website_team
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS website_team_super_write ON public.website_team;
CREATE POLICY website_team_super_write ON public.website_team
  FOR ALL TO authenticated
  USING (public.is_club_super_admin())
  WITH CHECK (public.is_club_super_admin());

REVOKE ALL ON public.website_team FROM PUBLIC;
GRANT SELECT ON public.website_team TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.website_team TO authenticated;

-- -----------------------------------------------------------------------------
-- Seed (only into an empty table, so re-running never duplicates or undoes edits)
-- -----------------------------------------------------------------------------

INSERT INTO public.website_team (section, tenure, name, role, quote, image, sort_order)
SELECT v.section, v.tenure, v.name, v.role, NULLIF(v.quote, ''), v.image, v.ord
FROM (VALUES
  ('faculty', NULL,      'Sangeetha R G',     'Faculty Coordinator', 'Expert mentorship in technical direction and academic excellence for IEEE SSCS.', '/sangeetha.png', 0),
  ('faculty', NULL,      'Hemanth C',         'Faculty Coordinator', 'Guiding innovation and student engagement within the solid-state circuits domain.', '/hemanth.png', 1),

  ('core', '2025-26', 'E Abijay',        'Chairperson',       'Never Settle!', '/abijay.png', 0),
  ('core', '2025-26', 'Kiran Kumar',     'Vice Chairperson',  'I create systems that redefine the best.', '/kiran.png', 1),
  ('core', '2025-26', 'Manasa Grandhi',  'General Secretary', 'Troubles are just passing clouds.', '/manasa.png', 2),
  ('core', '2025-26', 'Mrithubashini',   'General Secretary', 'Let''s see what happens.', '/mrithubashini.png', 3),
  ('core', '2025-26', 'Arushi',          'Treasurer',         'Who wishes to fight must first count the cost.', '/arushi.png', 4),

  ('lead', '2025-26', 'Shivaranjani',   'Technical Lead',        'Life''s a circuit—I''m still meeting setup and hold.', '/shivaranjani.png', 0),
  ('lead', '2025-26', 'Harshan',        'Technical Lead',        'Observe. Plan. Execute.', '/harshan.png', 1),
  ('lead', '2025-26', 'Ilangkumaran',   'Operations Lead',       'Big ideas don''t need noise, they need action.', '/ilangkumaran.png', 2),
  ('lead', '2025-26', 'Sibhi S',        'Operations Lead',       'Click Me!!!', '/sibhi.png', 3),
  ('lead', '2025-26', 'Neyalakshmi',    'Editorial Lead',        'PEACE!', '/neya.png', 4),
  ('lead', '2025-26', 'Goutham P',      'Editorial Lead',        'SKY IS THE LIMIT', '/goutham.png', 5),
  ('lead', '2025-26', 'Priyadarshini',  'Design Lead',           'LOST IN A PASTEL SKY', '/priyadharshini.png', 6),
  ('lead', '2025-26', 'Midhun P',       'Associate Design Lead', 'COOL TONE WARM CORE', '/midhun.png', 7),

  ('core', '2026-27', 'Sibhi',          'Chairperson',                     'Click Me!!!', '/sibhi.png', 0),
  ('core', '2026-27', 'Goutham P',      'Vice Chairperson',                'SKY IS THE LIMIT', '/goutham.png', 1),
  ('core', '2026-27', 'Ilangkumaran',   'General Secretary',               'Big ideas don''t need noise, they need action.', '/ilangkumaran.png', 2),
  ('core', '2026-27', 'Neyalakshmi',    'Treasurer',                       'PEACE!', '/neya.png', 3),
  ('core', '2026-27', 'Sarweshwari',    'Women in SSCS (Chairperson)',     'Empowering women in circuits.', '/sarweshwari.png', 4),
  ('core', '2026-27', 'Shree Devi',     'Women in SSCS (Vice-Chairperson)', 'Breaking barriers.', '/shreedevi.png', 5),

  ('lead', '2026-27', 'S Jai Akaash',      'Technical Lead',                         '', '/jai.png', 0),
  ('lead', '2026-27', 'Pranav J',          'Associate Technical Lead',               '', '/pranav.png', 1),
  ('lead', '2026-27', 'Hitesh V S',        'Associate Technical Lead',               '', '/hitesh.png', 2),
  ('lead', '2026-27', 'M Varshinee',       'Management Lead',                        '', '/varshinee.png', 3),
  ('lead', '2026-27', 'Adriza Banerji',    'Associate Management Lead',              '', '/adriza.png', 4),
  ('lead', '2026-27', 'C S Tejasvini',     'Event Operations Lead',                  '', '/tejasvini.png', 5),
  ('lead', '2026-27', 'Aariya Manikandan', 'Associate Event Operations Lead',        '', '/aariya.png', 6),
  ('lead', '2026-27', 'Rohith M',          'Creative Lead',                          '', '/rohith.png', 7),
  ('lead', '2026-27', 'Tharun S',          'Associate Creative Lead',                '', '/tharun.png', 8),
  ('lead', '2026-27', 'Anjana Varma',      'Outreach & Partnerships Lead',           '', '/anjana.png', 9),
  ('lead', '2026-27', 'Karthikeyan D',     'Associate Outreach & Partnerships Lead', '', '/karthikeyan.png', 10),
  ('lead', '2026-27', 'P Midhun',          'Human Resource Lead',                    'COOL TONE WARM CORE', '/midhun.png', 11),
  ('lead', '2026-27', 'K Srishtithaa',     'Associate Human Resource Lead',          '', '/srishtithaa.png', 12)
) AS v(section, tenure, name, role, quote, image, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.website_team);


-- =============================================================================
-- AFTER RUNNING, sanity check:
--
--   SELECT tenure, section, count(*) FROM public.website_team GROUP BY 1, 2 ORDER BY 1, 2;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FILE: 20261003001300_website_feature_order.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- WEBSITE EVENTS: SPOTLIGHT ORDER
--
-- Run after 20261003001200_website_team.sql. Safe to re-run.
--
--   * events.website_feature_order: position among featured (spotlight)
--     events on the home page, lowest first. NULL falls back to newest first.
--   * only super admins change it (added to the website guard)
--   * website_events exposes it as feature_order
-- =============================================================================


ALTER TABLE public.events ADD COLUMN IF NOT EXISTS website_feature_order integer;

-- Start from the current order (newest first) so nothing jumps around.
UPDATE public.events e
SET website_feature_order = r.n
FROM (
  SELECT id, row_number() OVER (ORDER BY start_date DESC) - 1 AS n
  FROM public.events WHERE website_featured
) r
WHERE e.id = r.id AND e.website_feature_order IS NULL;

CREATE OR REPLACE FUNCTION public.club_events_website_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  changed boolean;
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    changed := NEW.website_published OR NEW.website_featured
      OR NEW.website_blurb IS NOT NULL OR NEW.website_cover IS NOT NULL OR NEW.website_link IS NOT NULL
      OR NEW.website_feature_order IS NOT NULL
      OR cardinality(NEW.website_details) > 0 OR cardinality(NEW.website_tags) > 0
      OR cardinality(NEW.website_gallery) > 0;
  ELSE
    changed := (NEW.website_published, NEW.website_featured, NEW.website_blurb, NEW.website_details,
                NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link, NEW.website_feature_order)
      IS DISTINCT FROM
               (OLD.website_published, OLD.website_featured, OLD.website_blurb, OLD.website_details,
                OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link, OLD.website_feature_order);
  END IF;

  IF changed THEN
    RAISE EXCEPTION 'Only super admins can change what the website shows' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP VIEW IF EXISTS public.website_events;
CREATE VIEW public.website_events AS
SELECT
  e.id,
  e.title,
  e.start_date,
  e.end_date,
  e.is_online,
  CASE WHEN e.is_online THEN NULL ELSE v.name END AS venue,
  e.website_featured      AS featured,
  e.website_feature_order AS feature_order,
  e.website_blurb         AS blurb,
  e.website_details       AS details,
  e.website_tags          AS tags,
  e.website_cover         AS cover,
  e.website_gallery       AS gallery,
  e.website_link          AS link
FROM public.events e
LEFT JOIN public.venues v ON v.id = e.venue_id
WHERE e.website_published;

REVOKE ALL ON public.website_events FROM PUBLIC;
GRANT SELECT ON public.website_events TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261003001400_member_calendar.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- MEMBERS' CALENDAR
--
-- Run after 20261003001300_website_feature_order.sql. Safe to re-run.
--
--   * events.calendar_confirmed: a super admin confirms an event before
--     members see it on /calendar
--   * only super admins change that switch
--   * member_calendar(from, to): what a signed-in member sees. Every
--     calendar entry (holidays, exams, exam prep, vacations, blocked and
--     no-class days) by type, title and dates, plus confirmed events by
--     title, dates and student coordinator names. Nothing else: no venues,
--     notes, budgets, files or anything from the admin checklist.
-- =============================================================================


ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS calendar_confirmed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.club_events_confirmed_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.club_jwt_email() <> '' AND NOT public.is_club_super_admin()
     AND NEW.calendar_confirmed IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN false ELSE OLD.calendar_confirmed END)
  THEN
    RAISE EXCEPTION 'Only super admins can confirm events for the members'' calendar' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_confirmed_guard ON public.events;
CREATE TRIGGER tr_events_confirmed_guard
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_confirmed_guard();

-- Runs with the owner's rights so members never need access to the tables
-- themselves; returns nothing to anyone who isn't on the roster or an admin.
CREATE OR REPLACE FUNCTION public.member_calendar(p_from date, p_to date)
RETURNS TABLE (kind text, title text, start_date date, end_date date, coordinators text[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'event', e.title, e.start_date, e.end_date,
    COALESCE((
      SELECT array_agg(a.full_name ORDER BY a.full_name)
      FROM public.event_attendance ea
      JOIN public.contribution_types ct ON ct.id = ea.type_id
      JOIN public.applications a ON a.id = ea.member_id
      WHERE ea.event_id = e.id AND ct.source = 'attendance' AND ct.name ILIKE '%coordinator%'
    ), '{}')
  FROM public.events e
  WHERE (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND e.calendar_confirmed
    AND e.end_date >= p_from AND e.start_date <= p_to
  UNION ALL
  SELECT c.entry_type, c.title, c.start_date, c.end_date, '{}'::text[]
  FROM public.calendar_entries c
  WHERE (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND c.end_date >= p_from AND c.start_date <= p_to
  ORDER BY 3, 2;
$$;

REVOKE ALL ON FUNCTION public.member_calendar(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_calendar(date, date) TO authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261003001500_event_proposals.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- EVENT PROPOSALS + ADMINS WORK THE CHECKLIST ONLY
--
-- Run after 20261003001400_member_calendar.sql. Safe to re-run.
--
--   * Only super admins create or delete events, or change an event's title,
--     dates, description, online/venue. Plain admins keep the checklist:
--     venue booked, coordinators/attendance, poster/report/budget, posted ticks.
--   * public.event_proposals: any member or admin proposes an event (what,
--     requirements, expected dates, preferred venue). They see their own;
--     admins see all. Only a super admin accepts (creates the event) or
--     rejects, through accept_event_proposal / reject_event_proposal.
--   * proposal_venues(): venue names for the proposal form (members can't
--     read the venues table).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Event details are super-admin only
--    Statements with no signed-in user (SQL editor, seeds) are allowed.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_events_details_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only super admins can create events. Propose it instead.' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Only super admins can delete events' USING ERRCODE = '42501';
  ELSIF (NEW.title, NEW.start_date, NEW.end_date, NEW.description, NEW.is_online, NEW.venue_id)
        IS DISTINCT FROM (OLD.title, OLD.start_date, OLD.end_date, OLD.description, OLD.is_online, OLD.venue_id) THEN
    RAISE EXCEPTION 'Only super admins can change an event''s details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_details_guard ON public.events;
CREATE TRIGGER tr_events_details_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_details_guard();

-- -----------------------------------------------------------------------------
-- 2. Proposals
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  description    text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 4000),
  requirements   text CHECK (requirements IS NULL OR length(requirements) <= 2000),
  expected_start date NOT NULL,
  expected_end   date NOT NULL,
  is_online      boolean NOT NULL DEFAULT false,
  venue_id       text REFERENCES public.venues(id) ON UPDATE CASCADE ON DELETE SET NULL,
  proposer_email text NOT NULL,
  proposer_name  text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  review_note    text CHECK (review_note IS NULL OR length(review_note) <= 1000),
  reviewed_by    text,
  reviewed_at    timestamptz,
  event_id       uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (expected_end >= expected_start)
);

CREATE INDEX IF NOT EXISTS idx_event_proposals_status ON public.event_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_proposals_proposer ON public.event_proposals (lower(proposer_email));

ALTER TABLE public.event_proposals ENABLE ROW LEVEL SECURITY;

-- Members and admins propose, as themselves, a pending proposal.
DROP POLICY IF EXISTS event_proposals_insert ON public.event_proposals;
CREATE POLICY event_proposals_insert ON public.event_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND lower(trim(proposer_email)) = public.club_jwt_email()
    AND status = 'pending'
    AND review_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND event_id IS NULL
    AND expected_start >= public.club_today()
  );

-- Everyone reads their own; admins read all.
DROP POLICY IF EXISTS event_proposals_read ON public.event_proposals;
CREATE POLICY event_proposals_read ON public.event_proposals
  FOR SELECT TO authenticated
  USING (lower(trim(proposer_email)) = public.club_jwt_email() OR public.is_club_admin());

-- A proposer can withdraw their own while it's still pending.
DROP POLICY IF EXISTS event_proposals_withdraw ON public.event_proposals;
CREATE POLICY event_proposals_withdraw ON public.event_proposals
  FOR DELETE TO authenticated
  USING (lower(trim(proposer_email)) = public.club_jwt_email() AND status = 'pending');

-- No UPDATE policy: decisions go through the functions below.

REVOKE ALL ON public.event_proposals FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.event_proposals TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Decisions (super admins only)
-- -----------------------------------------------------------------------------

-- Accept: creates the event (dates may be adjusted) and links it.
CREATE OR REPLACE FUNCTION public.accept_event_proposal(p_id uuid, p_start date, p_end date, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.event_proposals;
  new_id uuid;
BEGIN
  IF NOT public.is_club_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can accept proposals' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.event_proposals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  IF p.status <> 'pending' THEN RAISE EXCEPTION 'This proposal has already been decided'; END IF;
  IF p_end < p_start THEN RAISE EXCEPTION 'The end date is before the start date'; END IF;

  INSERT INTO public.events (title, description, start_date, end_date, is_online, venue_id, created_by)
  VALUES (
    p.title,
    p.description || CASE WHEN coalesce(trim(p.requirements), '') <> '' THEN E'\n\nRequirements:\n' || p.requirements ELSE '' END
      || E'\n\nProposed by ' || coalesce(p.proposer_name, p.proposer_email) || '.',
    p_start, p_end, p.is_online, CASE WHEN p.is_online THEN NULL ELSE p.venue_id END,
    'proposal: ' || p.proposer_email
  )
  RETURNING id INTO new_id;

  UPDATE public.event_proposals
  SET status = 'accepted', event_id = new_id, review_note = NULLIF(trim(p_note), ''),
      reviewed_by = public.club_jwt_email(), reviewed_at = now()
  WHERE id = p_id;
  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.reject_event_proposal(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_club_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can reject proposals' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_proposals
  SET status = 'rejected', review_note = NULLIF(trim(p_note), ''),
      reviewed_by = public.club_jwt_email(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found or already decided'; END IF;
END
$$;

REVOKE ALL ON FUNCTION public.accept_event_proposal(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_event_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_event_proposal(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_event_proposal(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Venue names for the form
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proposal_venues()
RETURNS TABLE (id text, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name FROM public.venues v
  WHERE v.is_active AND (public.current_member_id() IS NOT NULL OR public.is_club_admin())
  ORDER BY v.name;
$$;

REVOKE ALL ON FUNCTION public.proposal_venues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proposal_venues() TO authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261003001600_admin_drive.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- ADMIN DRIVE
--
-- Run after 20261003001500_event_proposals.sql. Safe to re-run.
--
--   * "admin-drive": private bucket, 5 MB per file, documents and images
--   * public.drive_folders: named folders under "General" (flat)
--   * public.drive_files: one row per file. A file sits in General
--     (no folder, no event), in a folder, or in an event's folder.
--   * admins and super admins only. Anyone of them uploads and downloads;
--     the uploader or a super admin renames, moves or deletes.
--   * the drive holds at most 400 MB in total (checked against the real
--     object sizes in storage, not what the browser claims)
--   * storage_usage(): bytes per bucket, for the usage bar
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Bucket
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-drive', 'admin-drive', false, 5242880, ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/zip', 'application/x-zip-compressed'
])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS admin_drive_read ON storage.objects;
CREATE POLICY admin_drive_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admin-drive' AND public.is_club_admin());

DROP POLICY IF EXISTS admin_drive_upload ON storage.objects;
CREATE POLICY admin_drive_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-drive' AND public.is_club_admin());

-- Removing a file: its uploader, or a super admin.
DROP POLICY IF EXISTS admin_drive_delete ON storage.objects;
CREATE POLICY admin_drive_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-drive' AND public.is_club_admin()
         AND (owner = auth.uid() OR public.is_club_super_admin()));

-- -----------------------------------------------------------------------------
-- 2. Folders and files
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.drive_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_drive_folders_name ON public.drive_folders (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.drive_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid REFERENCES public.drive_folders(id) ON DELETE RESTRICT,
  event_id    uuid REFERENCES public.events(id) ON DELETE SET NULL,
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  path        text NOT NULL UNIQUE,
  size        bigint NOT NULL CHECK (size > 0 AND size <= 5242880),
  mime        text,
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (folder_id IS NULL OR event_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON public.drive_files (folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_files_event ON public.drive_files (event_id, created_at DESC);

-- Trust storage for the size, and keep the drive under 400 MB in total.
CREATE OR REPLACE FUNCTION public.drive_files_check()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_size bigint;
  used bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT (o.metadata->>'size')::bigint INTO real_size
    FROM storage.objects o WHERE o.bucket_id = 'admin-drive' AND o.name = NEW.path;
    IF real_size IS NULL THEN
      RAISE EXCEPTION 'Upload the file before registering it';
    END IF;
    NEW.size := real_size;
    NEW.uploaded_by := public.club_jwt_email();
    SELECT coalesce(sum(size), 0) INTO used FROM public.drive_files;
    IF used + NEW.size > 400 * 1024 * 1024 THEN
      RAISE EXCEPTION 'The drive is full (400 MB). Delete old files first.' USING ERRCODE = '53100';
    END IF;
  ELSE
    -- Renames and moves only; the stored file and its owner never change.
    NEW.path := OLD.path; NEW.size := OLD.size; NEW.mime := OLD.mime;
    NEW.uploaded_by := OLD.uploaded_by; NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_drive_files_check ON public.drive_files;
CREATE TRIGGER tr_drive_files_check
  BEFORE INSERT OR UPDATE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.drive_files_check();

ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drive_folders_read ON public.drive_folders;
CREATE POLICY drive_folders_read ON public.drive_folders
  FOR SELECT TO authenticated USING (public.is_club_admin());
DROP POLICY IF EXISTS drive_folders_create ON public.drive_folders;
CREATE POLICY drive_folders_create ON public.drive_folders
  FOR INSERT TO authenticated WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_folders_super ON public.drive_folders;
CREATE POLICY drive_folders_super ON public.drive_folders
  FOR UPDATE TO authenticated USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());
DROP POLICY IF EXISTS drive_folders_super_delete ON public.drive_folders;
CREATE POLICY drive_folders_super_delete ON public.drive_folders
  FOR DELETE TO authenticated USING (public.is_club_super_admin());

DROP POLICY IF EXISTS drive_files_read ON public.drive_files;
CREATE POLICY drive_files_read ON public.drive_files
  FOR SELECT TO authenticated USING (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_create ON public.drive_files;
CREATE POLICY drive_files_create ON public.drive_files
  FOR INSERT TO authenticated WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_change ON public.drive_files;
CREATE POLICY drive_files_change ON public.drive_files
  FOR UPDATE TO authenticated
  USING (public.is_club_admin() AND (lower(uploaded_by) = public.club_jwt_email() OR public.is_club_super_admin()))
  WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_delete ON public.drive_files;
CREATE POLICY drive_files_delete ON public.drive_files
  FOR DELETE TO authenticated
  USING (public.is_club_admin() AND (lower(uploaded_by) = public.club_jwt_email() OR public.is_club_super_admin()));

REVOKE ALL ON public.drive_folders, public.drive_files FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_folders, public.drive_files TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage usage per bucket (admins), for the usage bar
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (bucket_id text, bytes bigint, files bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint, count(*)
  FROM storage.objects o
  WHERE public.is_club_admin()
  GROUP BY o.bucket_id
  ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage() TO authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261003001700_wis_role_names.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Women in SSCS roles read "Women in SSCS (Chairperson)" and
-- "Women in SSCS (Vice-Chairperson)". Run after 20261003001600_admin_drive.sql.
-- Safe to re-run.
-- =============================================================================

UPDATE public.website_team SET role = 'Women in SSCS (Chairperson)'
WHERE role = 'Chairperson (Women in SSCS)';

UPDATE public.website_team SET role = 'Women in SSCS (Vice-Chairperson)'
WHERE role = 'Vice-Chairperson (Women in SSCS)';

-- ---------------------------------------------------------------------------
-- FILE: 20261003001800_storage_usage_super.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Storage figures are for super admins only. Run after
-- 20261003001700_wis_role_names.sql. Safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (bucket_id text, bytes bigint, files bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint, count(*)
  FROM storage.objects o
  WHERE public.is_club_super_admin()
  GROUP BY o.bucket_id
  ORDER BY 2 DESC;
$$;

-- ---------------------------------------------------------------------------
-- FILE: 20261003001900_more_venues.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Two more venues for proposals and events. Run after
-- 20261003001800_storage_usage_super.sql. Safe to re-run (keeps any edits).
-- =============================================================================

INSERT INTO public.venues (id, name, short_name, notes, sort_order) VALUES
  ('ab3-gallery', 'AB3 Gallery Classrooms', 'AB3 Gallery', NULL, 70),
  ('classroom',   'Normal Classroom',       'Classroom',   NULL, 80)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- FILE: 20261003002000_proposal_board_date.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- PROPOSALS: "LEAVE THE DATE TO THE BOARD"
--
-- Run after 20261003001900_more_venues.sql. Safe to re-run.
--
--   * a proposal may come without dates (both empty): the board picks them
--     when a super admin accepts it
--   * a proposal with dates still can't start in the past
-- =============================================================================


ALTER TABLE public.event_proposals ALTER COLUMN expected_start DROP NOT NULL;
ALTER TABLE public.event_proposals ALTER COLUMN expected_end DROP NOT NULL;

-- Either both dates or neither.
ALTER TABLE public.event_proposals DROP CONSTRAINT IF EXISTS event_proposals_dates_together;
ALTER TABLE public.event_proposals ADD CONSTRAINT event_proposals_dates_together
  CHECK ((expected_start IS NULL) = (expected_end IS NULL));

DROP POLICY IF EXISTS event_proposals_insert ON public.event_proposals;
CREATE POLICY event_proposals_insert ON public.event_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND lower(trim(proposer_email)) = public.club_jwt_email()
    AND status = 'pending'
    AND review_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND event_id IS NULL
    AND (expected_start IS NULL OR expected_start >= public.club_today())
  );


-- ---------------------------------------------------------------------------
-- FILE: 20261003002100_budgets_activity_completion.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- ITEMISED BUDGETS, ACTIVITY LOG, "EVENT COMPLETED", ADMIN EDIT RIGHTS
--
-- Run after 20261003002000_proposal_board_date.sql. Safe to re-run.
--
--   * plain admins may now change an event's description, online switch and
--     venue; only super admins create/delete events or change title and dates
--   * public.event_budget_items: expense and income lines per event
--     (category, quantity, unit cost, actual amount, status, who paid,
--     receipt in the drive). Admins manage them.
--   * events.budget_planned / budget_actual follow the expense lines, so the
--     checklist and reports keep working
--   * public.event_activity: who did what on each event, written by
--     triggers; only super admins read it
--   * events.completed_at / completed_by: a super admin marks an event
--     completed; only then do its volunteers, coordinators and attendees get
--     their points. Events that have already ended count as completed.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Completion
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by text;

-- Nobody loses points they already have: past events are completed.
UPDATE public.events SET completed_at = now(), completed_by = 'already ended'
WHERE completed_at IS NULL AND end_date < public.club_today();

-- -----------------------------------------------------------------------------
-- 1. Only the name and dates are super-admin only now
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_events_details_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only super admins can create events. Propose it instead.' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Only super admins can delete events' USING ERRCODE = '42501';
  ELSIF (NEW.title, NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.title, OLD.start_date, OLD.end_date) THEN
    RAISE EXCEPTION 'Only super admins can change an event''s name or dates' USING ERRCODE = '42501';
  ELSIF (NEW.completed_at, NEW.completed_by) IS DISTINCT FROM (OLD.completed_at, OLD.completed_by) THEN
    RAISE EXCEPTION 'Only super admins can mark an event completed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Budget lines
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_budget_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income')),
  category        text NOT NULL DEFAULT 'Miscellaneous' CHECK (length(trim(category)) BETWEEN 1 AND 60),
  item            text NOT NULL DEFAULT '' CHECK (length(item) <= 160),
  quantity        numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost       numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  actual          numeric(12, 2) CHECK (actual IS NULL OR actual >= 0),
  status          text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid', 'reimbursed', 'received')),
  paid_by         text CHECK (paid_by IS NULL OR length(paid_by) <= 80),
  notes           text CHECK (notes IS NULL OR length(notes) <= 500),
  receipt_file_id uuid REFERENCES public.drive_files(id) ON DELETE SET NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event ON public.event_budget_items (event_id, kind, sort_order);

ALTER TABLE public.event_budget_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_budget_items_admin ON public.event_budget_items;
CREATE POLICY event_budget_items_admin ON public.event_budget_items
  FOR ALL TO authenticated
  USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

REVOKE ALL ON public.event_budget_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_budget_items TO authenticated;

-- Keep the event's planned/actual spend in step with its expense lines.
-- Planned = sum of quantity × unit cost; actual = sum of the actual amounts
-- filled in so far (empty until at least one is). No lines left = both empty.
CREATE OR REPLACE FUNCTION public.event_budget_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ev uuid;
  n int; planned numeric; spent numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN ev := OLD.event_id; ELSE ev := NEW.event_id; END IF;
  SELECT count(*), sum(quantity * unit_cost), sum(actual)
    INTO n, planned, spent
  FROM public.event_budget_items WHERE event_id = ev AND kind = 'expense';

  UPDATE public.events
  SET budget_planned = CASE WHEN n = 0 THEN NULL ELSE round(planned, 2) END,
      budget_actual  = CASE WHEN n = 0 THEN NULL ELSE round(spent, 2) END
  WHERE id = ev
    AND (budget_planned, budget_actual) IS DISTINCT FROM
        (CASE WHEN n = 0 THEN NULL ELSE round(planned, 2) END, CASE WHEN n = 0 THEN NULL ELSE round(spent, 2) END);
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_budget_sync ON public.event_budget_items;
CREATE TRIGGER tr_event_budget_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.event_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.event_budget_sync();

-- -----------------------------------------------------------------------------
-- 3. Activity log: who did what on each event (super admins read it)
--    Written only by the triggers below, never directly by users.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_activity (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  actor      text NOT NULL,
  action     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_activity_event ON public.event_activity (event_id, created_at DESC);

ALTER TABLE public.event_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_activity_super_read ON public.event_activity;
CREATE POLICY event_activity_super_read ON public.event_activity
  FOR SELECT TO authenticated USING (public.is_club_super_admin());
REVOKE ALL ON public.event_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_activity TO authenticated;

-- Skips events that are being deleted (their log goes with them).
CREATE OR REPLACE FUNCTION public.log_event_activity(p_event uuid, p_action text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.event_activity (event_id, actor, action)
  SELECT p_event, COALESCE(NULLIF(public.club_jwt_email(), ''), 'system'), p_action
  WHERE p_action IS NOT NULL AND p_action <> ''
    AND EXISTS (SELECT 1 FROM public.events WHERE id = p_event);
$$;
REVOKE ALL ON FUNCTION public.log_event_activity(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.money_txt(n numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN n IS NULL THEN '—' ELSE '₹' || trim(to_char(n, 'FM999G999G990D00')) END $$;

-- Events: creation and every field that matters, in plain words.
CREATE OR REPLACE FUNCTION public.event_activity_events()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[] := '{}';
  onoff text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.id,
      CASE WHEN NEW.created_by LIKE 'proposal:%' THEN 'Created the event from a proposal' ELSE 'Created the event' END);
    RETURN NULL;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN parts := parts || format('renamed it from "%s" to "%s"', OLD.title, NEW.title); END IF;
  IF (NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.start_date, OLD.end_date) THEN
    parts := parts || format('moved the dates to %s – %s', to_char(NEW.start_date, 'DD Mon YYYY'), to_char(NEW.end_date, 'DD Mon YYYY'));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN parts := parts || 'edited the description'::text; END IF;
  IF NEW.is_online IS DISTINCT FROM OLD.is_online THEN parts := parts || CASE WHEN NEW.is_online THEN 'made it online' ELSE 'made it in person' END; END IF;
  IF NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
    parts := parts || COALESCE('set the venue to ' || (SELECT name FROM public.venues WHERE id = NEW.venue_id), 'cleared the venue');
  END IF;
  IF NEW.venue_booked IS DISTINCT FROM OLD.venue_booked THEN parts := parts || CASE WHEN NEW.venue_booked THEN 'ticked "venue booked"' ELSE 'unticked "venue booked"' END; END IF;
  IF NEW.poster_path IS DISTINCT FROM OLD.poster_path THEN parts := parts || CASE WHEN NEW.poster_path IS NULL THEN 'removed the poster' ELSE 'uploaded the poster' END; END IF;
  IF NEW.report_path IS DISTINCT FROM OLD.report_path THEN parts := parts || CASE WHEN NEW.report_path IS NULL THEN 'removed the report' ELSE 'uploaded the report' END; END IF;
  IF NEW.budget_sheet_path IS DISTINCT FROM OLD.budget_sheet_path THEN parts := parts || CASE WHEN NEW.budget_sheet_path IS NULL THEN 'removed the budget sheet' ELSE 'uploaded the budget sheet' END; END IF;
  IF NEW.attendance_posted IS DISTINCT FROM OLD.attendance_posted THEN parts := parts || CASE WHEN NEW.attendance_posted THEN 'ticked "attendance posted"' ELSE 'unticked "attendance posted"' END; END IF;
  IF NEW.od_posted IS DISTINCT FROM OLD.od_posted THEN parts := parts || CASE WHEN NEW.od_posted THEN 'ticked "OD posted"' ELSE 'unticked "OD posted"' END; END IF;
  IF NEW.calendar_confirmed IS DISTINCT FROM OLD.calendar_confirmed THEN parts := parts || CASE WHEN NEW.calendar_confirmed THEN 'confirmed it for the members'' calendar' ELSE 'took it off the members'' calendar' END; END IF;
  IF (NEW.completed_at IS NULL) IS DISTINCT FROM (OLD.completed_at IS NULL) THEN
    parts := parts || CASE WHEN NEW.completed_at IS NOT NULL THEN 'marked it completed successfully (points credited)' ELSE 'reopened it (points withdrawn)' END;
  END IF;
  IF NEW.website_published IS DISTINCT FROM OLD.website_published THEN parts := parts || CASE WHEN NEW.website_published THEN 'published it on the website' ELSE 'took it off the website' END; END IF;
  IF NEW.website_featured IS DISTINCT FROM OLD.website_featured THEN parts := parts || CASE WHEN NEW.website_featured THEN 'featured it on the home page' ELSE 'unfeatured it' END; END IF;
  IF (NEW.website_blurb, NEW.website_details, NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link)
     IS DISTINCT FROM (OLD.website_blurb, OLD.website_details, OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link) THEN
    parts := parts || 'edited the website details'::text;
  END IF;
  -- Budget totals change through budget lines (logged there); only log hand edits.
  IF (NEW.budget_planned, NEW.budget_actual) IS DISTINCT FROM (OLD.budget_planned, OLD.budget_actual)
     AND NOT EXISTS (SELECT 1 FROM public.event_budget_items WHERE event_id = NEW.id) THEN
    parts := parts || format('set the budget to %s planned, %s spent', public.money_txt(NEW.budget_planned), public.money_txt(NEW.budget_actual));
  END IF;

  IF cardinality(parts) > 0 THEN
    onoff := array_to_string(parts, '; ');
    PERFORM public.log_event_activity(NEW.id, upper(left(onoff, 1)) || substr(onoff, 2));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_events ON public.events;
CREATE TRIGGER tr_event_activity_events
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_events();

-- Coordinators, volunteers and attendees.
CREATE OR REPLACE FUNCTION public.event_activity_attendance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who text;
  role_new text;
  role_old text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    who := (SELECT full_name FROM public.applications WHERE id = OLD.member_id);
  ELSE
    who := (SELECT full_name FROM public.applications WHERE id = NEW.member_id);
    role_new := (SELECT name FROM public.contribution_types WHERE id = NEW.type_id);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    role_old := (SELECT name FROM public.contribution_types WHERE id = OLD.type_id);
  END IF;
  role_new := lower(regexp_replace(coalesce(role_new, 'attendee'), ' (at|for) an event$', '', 'i'));
  role_old := lower(regexp_replace(coalesce(role_old, 'attendee'), ' (at|for) an event$', '', 'i'));
  who := coalesce(who, 'a member');

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Added %s as %s', who, role_new));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Removed %s (%s)', who, role_old));
  ELSIF NEW.type_id IS DISTINCT FROM OLD.type_id THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Changed %s from %s to %s', who, role_old, role_new));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_attendance ON public.event_attendance;
CREATE TRIGGER tr_event_activity_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_attendance();

-- Budget lines.
CREATE OR REPLACE FUNCTION public.event_activity_budget()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  label text;
  parts text[] := '{}';
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Removed %s "%s" from the budget', OLD.kind, coalesce(nullif(OLD.item, ''), OLD.category)));
    RETURN NULL;
  END IF;
  label := format('%s "%s"', NEW.kind, coalesce(nullif(NEW.item, ''), NEW.category));
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Added %s to the budget', label));
    RETURN NULL;
  END IF;
  IF (NEW.item, NEW.category) IS DISTINCT FROM (OLD.item, OLD.category) THEN parts := parts || 'renamed it'::text; END IF;
  IF (NEW.quantity, NEW.unit_cost) IS DISTINCT FROM (OLD.quantity, OLD.unit_cost) THEN
    parts := parts || format('planned %s', public.money_txt(NEW.quantity * NEW.unit_cost));
  END IF;
  IF NEW.actual IS DISTINCT FROM OLD.actual THEN parts := parts || format('actual %s', public.money_txt(NEW.actual)); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN parts := parts || format('marked %s', NEW.status); END IF;
  IF NEW.paid_by IS DISTINCT FROM OLD.paid_by THEN parts := parts || format('paid by %s', coalesce(NEW.paid_by, '—')); END IF;
  IF NEW.receipt_file_id IS DISTINCT FROM OLD.receipt_file_id THEN
    parts := parts || CASE WHEN NEW.receipt_file_id IS NULL THEN 'removed the receipt' ELSE 'attached a receipt' END;
  END IF;
  IF cardinality(parts) > 0 THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Budget %s: %s', label, array_to_string(parts, ', ')));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_budget ON public.event_budget_items;
CREATE TRIGGER tr_event_activity_budget
  AFTER INSERT OR UPDATE OR DELETE ON public.event_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_budget();

-- Files in the event's drive folder.
CREATE OR REPLACE FUNCTION public.event_activity_drive()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.event_id IS NOT NULL THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Uploaded "%s" to the event''s files', NEW.name));
  ELSIF TG_OP = 'DELETE' AND OLD.event_id IS NOT NULL THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Deleted "%s" from the event''s files', OLD.name));
  ELSIF TG_OP = 'UPDATE' AND NEW.event_id IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Renamed file "%s" to "%s"', OLD.name, NEW.name));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_drive ON public.drive_files;
CREATE TRIGGER tr_event_activity_drive
  AFTER INSERT OR UPDATE OR DELETE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_drive();

-- -----------------------------------------------------------------------------
-- 4. Points from events count once the event is completed
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
WITH points AS (
  SELECT c.member_id, c.points_awarded AS points, 1 AS is_contribution
  FROM public.contributions c
  WHERE c.status = 'approved'
  UNION ALL
  SELECT ea.member_id, ct.default_points, 0
  FROM public.event_attendance ea
  JOIN public.contribution_types ct ON ct.id = ea.type_id
  JOIN public.events e ON e.id = ea.event_id
  WHERE e.completed_at IS NOT NULL
)
SELECT
  rank() OVER (ORDER BY coalesce(sum(p.points), 0) DESC)::integer AS rank,
  a.id                                                         AS member_id,
  a.full_name,
  a.member_department                                          AS department,
  coalesce(sum(p.points), 0)::integer                          AS total_points,
  coalesce(sum(p.is_contribution), 0)::integer                 AS contribution_count
FROM public.applications a
LEFT JOIN points p ON p.member_id = a.id
WHERE a.is_member AND NOT a.is_lead AND a.member_status = 'active'
GROUP BY a.id, a.full_name, a.member_department;

REVOKE ALL ON public.leaderboard FROM PUBLIC;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- A member's own attendance: points show once the event is completed.
CREATE OR REPLACE FUNCTION public.my_attendance()
RETURNS TABLE (id uuid, event_id uuid, event_title text, start_date date, role text, points integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ea.id, e.id, e.title, e.start_date, ct.name,
         CASE WHEN e.completed_at IS NOT NULL THEN ct.default_points ELSE 0 END
  FROM public.event_attendance ea
  JOIN public.events e ON e.id = ea.event_id
  JOIN public.contribution_types ct ON ct.id = ea.type_id
  WHERE ea.member_id = public.current_member_id()
  ORDER BY e.start_date DESC;
$$;


-- ---------------------------------------------------------------------------
-- FILE: 20261003002200_club_meets.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- CLUB MEETS: CREDITS FOR ATTENDING
--
-- Run after 20261003002100_budgets_activity_completion.sql. Safe to re-run.
--
--   * public.club_meets: a club meet on a date, online or offline
--   * public.meet_attendance: who attended; admins mark it
--   * attending earns 1 point for an online meet, 2 for an offline one,
--     counted on the leaderboard straight away (leads excepted, as always).
--     Switching a meet between online and offline re-prices it.
--   * members see their meets on /me alongside events (my_attendance)
-- =============================================================================


CREATE TABLE IF NOT EXISTS public.club_meets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL DEFAULT 'Club meet' CHECK (length(trim(title)) BETWEEN 1 AND 120),
  meet_date  date NOT NULL,
  is_online  boolean NOT NULL DEFAULT false,
  notes      text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_meets_date ON public.club_meets (meet_date DESC);

CREATE TABLE IF NOT EXISTS public.meet_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id    uuid NOT NULL REFERENCES public.club_meets(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  marked_by  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meet_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_meet_attendance_member ON public.meet_attendance (member_id);

-- The one place the prices live.
CREATE OR REPLACE FUNCTION public.club_meet_points(p_online boolean)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_online THEN 1 ELSE 2 END $$;

-- Who marked someone is recorded from the session, not trusted from the browser.
CREATE OR REPLACE FUNCTION public.meet_attendance_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.marked_by := COALESCE(NULLIF(public.club_jwt_email(), ''), NEW.marked_by);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS tr_meet_attendance_stamp ON public.meet_attendance;
CREATE TRIGGER tr_meet_attendance_stamp
  BEFORE INSERT ON public.meet_attendance
  FOR EACH ROW EXECUTE FUNCTION public.meet_attendance_stamp();

ALTER TABLE public.club_meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meet_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_meets_admin ON public.club_meets;
CREATE POLICY club_meets_admin ON public.club_meets
  FOR ALL TO authenticated USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS meet_attendance_admin ON public.meet_attendance;
CREATE POLICY meet_attendance_admin ON public.meet_attendance
  FOR ALL TO authenticated USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

REVOKE ALL ON public.club_meets, public.meet_attendance FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_meets, public.meet_attendance TO authenticated;

-- -----------------------------------------------------------------------------
-- Leaderboard: approved contributions + completed events + club meets
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
WITH points AS (
  SELECT c.member_id, c.points_awarded AS points, 1 AS is_contribution
  FROM public.contributions c
  WHERE c.status = 'approved'
  UNION ALL
  SELECT ea.member_id, ct.default_points, 0
  FROM public.event_attendance ea
  JOIN public.contribution_types ct ON ct.id = ea.type_id
  JOIN public.events e ON e.id = ea.event_id
  WHERE e.completed_at IS NOT NULL
  UNION ALL
  SELECT ma.member_id, public.club_meet_points(m.is_online), 0
  FROM public.meet_attendance ma
  JOIN public.club_meets m ON m.id = ma.meet_id
)
SELECT
  rank() OVER (ORDER BY coalesce(sum(p.points), 0) DESC)::integer AS rank,
  a.id                                                         AS member_id,
  a.full_name,
  a.member_department                                          AS department,
  coalesce(sum(p.points), 0)::integer                          AS total_points,
  coalesce(sum(p.is_contribution), 0)::integer                 AS contribution_count
FROM public.applications a
LEFT JOIN points p ON p.member_id = a.id
WHERE a.is_member AND NOT a.is_lead AND a.member_status = 'active'
GROUP BY a.id, a.full_name, a.member_department;

REVOKE ALL ON public.leaderboard FROM PUBLIC;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- A member's own events and meets, newest first.
CREATE OR REPLACE FUNCTION public.my_attendance()
RETURNS TABLE (id uuid, event_id uuid, event_title text, start_date date, role text, points integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM (
    SELECT ea.id, e.id, e.title, e.start_date, ct.name,
           CASE WHEN e.completed_at IS NOT NULL THEN ct.default_points ELSE 0 END
    FROM public.event_attendance ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.contribution_types ct ON ct.id = ea.type_id
    WHERE ea.member_id = public.current_member_id()
    UNION ALL
    SELECT ma.id, m.id, m.title, m.meet_date,
           CASE WHEN m.is_online THEN 'Club meet (online)' ELSE 'Club meet (offline)' END,
           public.club_meet_points(m.is_online)
    FROM public.meet_attendance ma
    JOIN public.club_meets m ON m.id = ma.meet_id
    WHERE ma.member_id = public.current_member_id()
  ) x
  ORDER BY 4 DESC;
$$;


-- ---------------------------------------------------------------------------
-- FILE: 20261006000000_broadcasts.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- BROADCASTS: MESSAGES FROM SUPER ADMINS TO SIGNED-IN USERS
--
-- Run after 20261003002200_club_meets.sql. Safe to re-run.
--
--   * public.broadcasts: a message, its priority and who it is for.
--       priority  critical  -> full-screen card on sign-in; must be acknowledged
--                 important -> banner until dismissed
--                 info      -> toast once, then in the inbox
--       audience  everyone (signed in) | members (non-admins) | admins
--       starts_at / expires_at schedule it; only super admins write.
--   * public.broadcast_reads: who has seen / acknowledged what. Written only
--     through broadcast_mark(), which takes the email from the session.
--   * my_broadcasts(): what the caller should see right now, with read state.
--   * broadcast_people(): everyone a broadcast can reach, for read receipts.
--   * broadcasts is added to supabase_realtime so open tabs get new ones live.
-- =============================================================================


CREATE TABLE IF NOT EXISTS public.broadcasts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  body       text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  priority   text NOT NULL DEFAULT 'info' CHECK (priority IN ('critical', 'important', 'info')),
  audience   text NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'members', 'admins')),
  starts_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz CHECK (expires_at IS NULL OR expires_at > starts_at),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_starts ON public.broadcasts (starts_at DESC);

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  email        text NOT NULL,
  seen_at      timestamptz NOT NULL DEFAULT now(),
  acked_at     timestamptz,
  PRIMARY KEY (broadcast_id, email)
);

-- The author is recorded from the session, not trusted from the browser.
CREATE OR REPLACE FUNCTION public.broadcasts_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := COALESCE(NULLIF(public.club_jwt_email(), ''), NEW.created_by);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS tr_broadcasts_stamp ON public.broadcasts;
CREATE TRIGGER tr_broadcasts_stamp
  BEFORE INSERT ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.broadcasts_stamp();

-- Is a broadcast live and addressed to the caller? The one place this is decided.
CREATE OR REPLACE FUNCTION public.broadcast_is_for_me(p_audience text, p_starts timestamptz, p_expires timestamptz)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.club_jwt_email() <> ''
     AND p_starts <= now()
     AND (p_expires IS NULL OR p_expires > now())
     AND CASE p_audience
           WHEN 'everyone' THEN true
           WHEN 'admins'   THEN public.is_club_admin()
           WHEN 'members'  THEN NOT public.is_club_admin()
           ELSE false
         END;
$$;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- Super admins manage everything; everyone else reads only what is live and theirs.
-- (Realtime checks this policy too, so a tab only hears about its own broadcasts.)
DROP POLICY IF EXISTS broadcasts_read ON public.broadcasts;
CREATE POLICY broadcasts_read ON public.broadcasts
  FOR SELECT TO authenticated
  USING (public.is_club_super_admin() OR public.broadcast_is_for_me(audience, starts_at, expires_at));
DROP POLICY IF EXISTS broadcasts_write ON public.broadcasts;
CREATE POLICY broadcasts_write ON public.broadcasts
  FOR ALL TO authenticated
  USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());

DROP POLICY IF EXISTS broadcast_reads_read ON public.broadcast_reads;
CREATE POLICY broadcast_reads_read ON public.broadcast_reads
  FOR SELECT TO authenticated
  USING (public.is_club_super_admin() OR email = public.club_jwt_email());

REVOKE ALL ON public.broadcasts, public.broadcast_reads FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT SELECT ON public.broadcast_reads TO authenticated;

-- What the caller should see now, newest first. Super admins get only what is
-- addressed to them here, like anyone else; the admin page reads the table.
CREATE OR REPLACE FUNCTION public.my_broadcasts()
RETURNS TABLE (
  id uuid, title text, body text, priority text, audience text,
  starts_at timestamptz, expires_at timestamptz, created_by text,
  seen_at timestamptz, acked_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.title, b.body, b.priority, b.audience, b.starts_at, b.expires_at, b.created_by,
         r.seen_at, r.acked_at
  FROM public.broadcasts b
  LEFT JOIN public.broadcast_reads r
    ON r.broadcast_id = b.id AND r.email = public.club_jwt_email()
  WHERE public.broadcast_is_for_me(b.audience, b.starts_at, b.expires_at)
  ORDER BY b.starts_at DESC
  LIMIT 50;
$$;

-- Record that the caller saw a broadcast, and optionally acknowledged it.
-- Seeing never clears an earlier acknowledgement.
CREATE OR REPLACE FUNCTION public.broadcast_mark(p_id uuid, p_ack boolean DEFAULT false)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.broadcast_reads (broadcast_id, email, seen_at, acked_at)
  SELECT b.id, public.club_jwt_email(), now(), CASE WHEN p_ack THEN now() END
  FROM public.broadcasts b
  WHERE b.id = p_id AND public.broadcast_is_for_me(b.audience, b.starts_at, b.expires_at)
  ON CONFLICT (broadcast_id, email) DO UPDATE
    SET acked_at = COALESCE(public.broadcast_reads.acked_at, EXCLUDED.acked_at);
$$;

-- Everyone a broadcast can reach: active roster members and admins, by email.
-- Super admins only (it lists the roster).
CREATE OR REPLACE FUNCTION public.broadcast_people()
RETURNS TABLE (email text, name text, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT lower(trim(a.email)) AS email, a.full_name AS name
    FROM public.applications a
    WHERE a.is_member AND a.member_status = 'active'
    UNION ALL
    SELECT lower(trim(ad.email)), NULL
    FROM public.admins ad
    WHERE ad.role IN ('super_admin', 'admin')
  )
  SELECT p.email,
         coalesce(max(p.name), p.email),
         EXISTS (SELECT 1 FROM public.admins ad
                 WHERE lower(trim(ad.email)) = p.email AND ad.role IN ('super_admin', 'admin'))
  FROM people p
  WHERE public.is_club_super_admin() AND p.email <> ''
  GROUP BY p.email
  ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.my_broadcasts(), public.broadcast_mark(uuid, boolean), public.broadcast_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_broadcasts(), public.broadcast_mark(uuid, boolean), public.broadcast_people() TO authenticated;

-- Live delivery to open tabs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcasts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
  END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- FILE: 20261006000100_team_photos_webp.sql
-- ---------------------------------------------------------------------------
-- Team photos moved from large PNGs to resized WebP copies (same names, ~6 MB -> 250 KB).
-- Points the seeded rows at the new files. Photos uploaded through the admin panel
-- (site-media bucket) and rows without a WebP copy are left alone.
UPDATE public.website_team
SET image = regexp_replace(image, '\.png$', '.webp')
WHERE image IN (
  '/abijay.png', '/arushi.png', '/goutham.png', '/harshan.png', '/hemanth.png',
  '/ilangkumaran.png', '/kiran.png', '/manasa.png', '/midhun.png', '/mrithubashini.png',
  '/neya.png', '/priyadharshini.png', '/sangeetha.png', '/shivaranjani.png', '/sibhi.png'
);

-- ---------------------------------------------------------------------------
-- FILE: 20261012000000_guest_coordinators.sql
-- ---------------------------------------------------------------------------
-- Student coordinators who aren't on the roster yet.
--
--   * event_attendance.member_id may be NULL when guest_name holds the person's
--     name instead; exactly one of the two is set
--   * only coordinator roles can be given to a guest
--   * a guest row earns nothing (the leaderboard and my_attendance key on
--     member_id); once the person joins the roster an admin links the row to
--     them (UPDATE member_id, guest_name = NULL) and the points follow
--   * the members' calendar and the event activity log show guest names

ALTER TABLE public.event_attendance ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.event_attendance ADD COLUMN IF NOT EXISTS guest_name text;

ALTER TABLE public.event_attendance DROP CONSTRAINT IF EXISTS event_attendance_member_or_guest;
ALTER TABLE public.event_attendance ADD CONSTRAINT event_attendance_member_or_guest CHECK (
  (member_id IS NULL) <> (guest_name IS NULL)
  AND (guest_name IS NULL OR length(trim(guest_name)) BETWEEN 1 AND 100)
);

-- The same guest can't be added to one event twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_attendance_guest
  ON public.event_attendance (event_id, lower(trim(guest_name))) WHERE guest_name IS NOT NULL;

CREATE OR REPLACE FUNCTION public.event_attendance_guest_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.guest_name IS NOT NULL THEN
    NEW.guest_name := trim(regexp_replace(NEW.guest_name, '\s+', ' ', 'g'));
    IF NOT EXISTS (SELECT 1 FROM public.contribution_types WHERE id = NEW.type_id AND name ILIKE '%coordinator%') THEN
      RAISE EXCEPTION 'Only student coordinators can be added without being on the roster' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_event_attendance_guest ON public.event_attendance;
CREATE TRIGGER tr_event_attendance_guest
  BEFORE INSERT OR UPDATE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.event_attendance_guest_guard();

-- Activity log: guest names, and linking a guest to a roster member.
CREATE OR REPLACE FUNCTION public.event_activity_attendance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who text;
  who_old text;
  role_new text;
  role_old text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    who := coalesce((SELECT full_name FROM public.applications WHERE id = OLD.member_id), OLD.guest_name);
  ELSE
    who := coalesce((SELECT full_name FROM public.applications WHERE id = NEW.member_id), NEW.guest_name);
    role_new := (SELECT name FROM public.contribution_types WHERE id = NEW.type_id);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    role_old := (SELECT name FROM public.contribution_types WHERE id = OLD.type_id);
  END IF;
  role_new := lower(regexp_replace(coalesce(role_new, 'attendee'), ' (at|for) an event$', '', 'i'));
  role_old := lower(regexp_replace(coalesce(role_old, 'attendee'), ' (at|for) an event$', '', 'i'));
  who := coalesce(who, 'a member');

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Added %s as %s%s', who, role_new,
      CASE WHEN NEW.member_id IS NULL THEN ' (not on the roster)' ELSE '' END));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Removed %s (%s)', who, role_old));
  ELSE
    IF NEW.member_id IS DISTINCT FROM OLD.member_id THEN
      who_old := coalesce((SELECT full_name FROM public.applications WHERE id = OLD.member_id), OLD.guest_name, 'a member');
      PERFORM public.log_event_activity(NEW.event_id, format('Credited %s (%s) to roster member %s', who_old, role_new, who));
    END IF;
    IF NEW.type_id IS DISTINCT FROM OLD.type_id THEN
      PERFORM public.log_event_activity(NEW.event_id, format('Changed %s from %s to %s', who, role_old, role_new));
    END IF;
  END IF;
  RETURN NULL;
END
$$;

-- Members' calendar: coordinators not on the roster show by name too.
CREATE OR REPLACE FUNCTION public.member_calendar(p_from date, p_to date)
RETURNS TABLE (kind text, title text, start_date date, end_date date, coordinators text[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'event', e.title, e.start_date, e.end_date,
    COALESCE((
      SELECT array_agg(coalesce(a.full_name, ea.guest_name) ORDER BY coalesce(a.full_name, ea.guest_name))
      FROM public.event_attendance ea
      JOIN public.contribution_types ct ON ct.id = ea.type_id
      LEFT JOIN public.applications a ON a.id = ea.member_id
      WHERE ea.event_id = e.id AND ct.source = 'attendance' AND ct.name ILIKE '%coordinator%'
        AND coalesce(a.full_name, ea.guest_name) IS NOT NULL
    ), '{}')
  FROM public.events e
  WHERE (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND e.calendar_confirmed
    AND e.end_date >= p_from AND e.start_date <= p_to
  UNION ALL
  SELECT c.entry_type, c.title, c.start_date, c.end_date, '{}'::text[]
  FROM public.calendar_entries c
  WHERE (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND c.end_date >= p_from AND c.start_date <= p_to
  ORDER BY 3, 2;
$$;


-- ---------------------------------------------------------------------------
-- FILE: 20261013000000_external_access.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- EXTERNAL ACCESS
--
-- Run after 20261012000000_guest_coordinators.sql. Safe to re-run.
--
-- A third panel role, 'external', for people outside the committee who only
-- need the calendar. Super admins add them in Settings, like admins. They can:
--   * see the admin calendar: academic dates, venue bookings, and club events
--     by title, dates and venue (through club_calendar_events(), never the
--     events table itself, which holds budgets and documents)
--   * bulk-import VTOP venue bookings (import_venue_bookings)
-- Nothing else: no roster, contributions, drive, proposals or settings, and
-- they can't add, edit or delete anything on the calendar.
-- =============================================================================


ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check CHECK (role IN ('super_admin', 'admin', 'external', 'member'));

CREATE OR REPLACE FUNCTION public.is_club_external()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE lower(trim(email)) = public.club_jwt_email()
      AND role = 'external'
  );
$$;

-- Read-only access to what the calendar draws. These sit beside the admin
-- policies; Postgres allows a row when any policy does.
DROP POLICY IF EXISTS venues_external_read ON public.venues;
CREATE POLICY venues_external_read ON public.venues
  FOR SELECT TO authenticated USING (public.is_club_external());

DROP POLICY IF EXISTS venue_bookings_external_read ON public.venue_bookings;
CREATE POLICY venue_bookings_external_read ON public.venue_bookings
  FOR SELECT TO authenticated USING (public.is_club_external());

DROP POLICY IF EXISTS calendar_entries_external_read ON public.calendar_entries;
CREATE POLICY calendar_entries_external_read ON public.calendar_entries
  FOR SELECT TO authenticated USING (public.is_club_external());

-- Only the two settings the calendar and the import use.
DROP POLICY IF EXISTS club_settings_external_read ON public.club_settings;
CREATE POLICY club_settings_external_read ON public.club_settings
  FOR SELECT TO authenticated
  USING (public.is_club_external() AND key IN ('our_names', 'venue_data_as_of'));

-- Club events for the calendar, without budgets, notes, files or checklists.
CREATE OR REPLACE FUNCTION public.club_calendar_events()
RETURNS TABLE (id uuid, title text, start_date date, end_date date, venue_id text, is_online boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.start_date, e.end_date, e.venue_id, e.is_online
  FROM public.events e
  WHERE public.is_club_external() OR public.is_club_admin()
  ORDER BY e.start_date, e.title;
$$;

REVOKE ALL ON FUNCTION public.club_calendar_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_calendar_events() TO authenticated;

-- The bulk import: super admins and external users.
CREATE OR REPLACE FUNCTION public.import_venue_bookings(rows jsonb)
RETURNS TABLE (imported integer, replaced integer, venue_days integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_replaced integer;
  v_imported integer;
  v_days     integer;
BEGIN
  IF NOT (public.is_club_super_admin() OR public.is_club_external()) THEN
    RAISE EXCEPTION 'Only super admins and external users can import bookings' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(rows) <> 'array' OR jsonb_array_length(rows) = 0 THEN
    RAISE EXCEPTION 'Nothing to import' USING ERRCODE = '22023';
  END IF;

  DROP TABLE IF EXISTS pg_temp._incoming;
  CREATE TEMP TABLE _incoming ON COMMIT DROP AS
  SELECT r.venue_id,
         r.booking_date,
         r.from_time,
         r.to_time,
         trim(r.event_name)                       AS event_name,
         nullif(upper(trim(coalesce(r.booked_by, ''))), '') AS booked_by,
         nullif(regexp_replace(coalesce(r.phone, ''), '\s', '', 'g'), '') AS phone,
         coalesce(r.is_ours, false)               AS is_ours
  FROM jsonb_to_recordset(rows) AS r(
    venue_id text, booking_date date, from_time time, to_time time,
    event_name text, booked_by text, phone text, is_ours boolean
  );

  SELECT count(*) INTO v_days FROM (SELECT DISTINCT venue_id, booking_date FROM _incoming) d;

  DELETE FROM public.venue_bookings b
   USING (SELECT DISTINCT venue_id, booking_date FROM _incoming) d
   WHERE b.venue_id = d.venue_id AND b.booking_date = d.booking_date;
  GET DIAGNOSTICS v_replaced = ROW_COUNT;

  INSERT INTO public.venue_bookings (venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours)
  SELECT venue_id, booking_date, from_time, to_time, event_name, booked_by, phone, is_ours FROM _incoming;
  GET DIAGNOSTICS v_imported = ROW_COUNT;

  INSERT INTO public.club_settings (key, value, updated_at)
  VALUES ('venue_data_as_of', to_jsonb(current_date), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN QUERY SELECT v_imported, v_replaced, v_days;
END
$$;


-- ---------------------------------------------------------------------------
-- FILE: 20261013000100_room_venues.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- ROOMS: CLASSROOMS, GALLERY AND LABS
--
-- Run after 20261013000000_external_access.sql. Safe to re-run.
--
--   * venues.is_room: a kind of space rather than one hall (Classroom, AB3
--     Gallery, Lab). Rooms can still be picked for an event, but the calendar's
--     venue availability leaves them out: VTOP bookings don't track them.
--   * a Lab venue
--   * events.venue_room: the classroom or lab number, typed in, e.g. "AB1-204"
-- =============================================================================


ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS is_room boolean NOT NULL DEFAULT false;

INSERT INTO public.venues (id, name, short_name, notes, sort_order, is_room) VALUES
  ('lab', 'Lab', 'Lab', NULL, 90, true)
ON CONFLICT (id) DO NOTHING;

UPDATE public.venues SET is_room = true WHERE id IN ('ab3-gallery', 'classroom', 'lab');

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_room text;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_venue_room_len;
ALTER TABLE public.events ADD CONSTRAINT events_venue_room_len CHECK (venue_room IS NULL OR length(venue_room) <= 40);

-- An online event, or one with no venue, has no room either.
CREATE OR REPLACE FUNCTION public.club_events_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_online THEN
    NEW.venue_id := NULL;
    NEW.venue_booked := false;
    NEW.od_posted := false;
  END IF;
  IF NEW.venue_id IS NULL THEN
    NEW.venue_room := NULL;
  END IF;
  NEW.venue_room := nullif(trim(NEW.venue_room), '');
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- External users' calendar now shows the room number too. The return type
-- changes, so the function is dropped and made again.
DROP FUNCTION IF EXISTS public.club_calendar_events();
CREATE FUNCTION public.club_calendar_events()
RETURNS TABLE (id uuid, title text, start_date date, end_date date, venue_id text, venue_room text, is_online boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.start_date, e.end_date, e.venue_id, e.venue_room, e.is_online
  FROM public.events e
  WHERE public.is_club_external() OR public.is_club_admin()
  ORDER BY e.start_date, e.title;
$$;

REVOKE ALL ON FUNCTION public.club_calendar_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_calendar_events() TO authenticated;


-- ---------------------------------------------------------------------------
-- FILE: 20261018000000_team_second_photo.sql
-- ---------------------------------------------------------------------------
-- Optional second photo per team member; clicking the photo on /team flips between the two.
ALTER TABLE public.website_team ADD COLUMN IF NOT EXISTS image2 text;

-- ---------------------------------------------------------------------------
-- FILE: 20261101000000_recruitment_restore.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- RECRUITMENT RESTORE (ATS database layer, back beside the club panel)
--
-- Run after every file in this folder up to 20261018000000_team_second_photo.sql.
-- Additive and idempotent: safe whether or not 20261003000100_drop_recruitment.sql
-- was run, and safe to re-run. Nothing is dropped, truncated or deleted. Existing
-- club data is untouched. What changes is policies and triggers on the tables
-- below, plus the bodies of the recruitment functions.
--
-- The DO NOT RUN warning in 20261003000100_drop_recruitment.sql no longer applies
-- to the objects restored here. Do not run that file now: it would drop them.
--
-- Single table for both people: public.applications is still the roster AND the
-- applicant table. Applicant columns and the status pipeline live on it; is_member,
-- member_status and the roster columns stay as the club panel left them.
--
-- Restored, and where each part came from (old files at e114e29^ under src/database/):
--   admins.role CHECK ........... schema.sql, migration_rbac_update.sql (+ interviewer)
--   applications columns ........ schema.sql, migration_reg_system, migration_phase1/4/6,
--                                 migration_notify_shortlist, migration_ai_copilot_cache,
--                                 migration_add_notes, migration_slot_reschedule,
--                                 migration_security_hardening_live
--   applications status list .... migration_add_selected_pending_status.sql (latest)
--   applications constraints .... migration_security_fix_3, _4_5, _8 (portfolio_url, not
--                                 the old portfolio_website, which never existed)
--   app_settings ................ schema.sql, migration_recruitment_window.sql,
--                                 migration_security_hardening_live.sql (ai_settings split)
--   recruitment_window() etc. ... migration_recruitment_window.sql
--   interview_slots ............. migration_interview_slots, migration_slot_booking_fixes,
--                                 migration_slot_reschedule, migration_reminder_sent,
--                                 migration_notification_idempotency
--   book / reschedule / slots ... migration_slot_booking_fixes, migration_slot_reschedule
--   my_interview_details() ...... migration_applicant_meeting_link.sql
--   panel_assignments ........... schema.sql, migration_panel_links.sql
--   panel_metadata .............. InterviewScheduler.tsx upsert + migration_complete_rls_fix
--   interview_feedback .......... schema.sql, migration_phase2, migration_interviewer_upgrades
--   interviews, candidate_notes . schema.sql (interviews), migration_candidate_notes.sql
--   application_status_history .. migration_fsm.sql (no writer; kept for parity)
--   department_weights .......... migration_phase4.sql
--   committee_quotas ............ migration_committee_quotas.sql
--   mail_queue + side effects ... migration_mail_queue.sql (cron: migration_mail_queue_cron.sql)
--   admin helpers ............... migration_complete_rls_fix, migration_normalize_admin_email_case
--   domain + audit ............... migration_security_fix_1, _2 (audit trigger is kept by the club)
--
-- Deliberately NOT restored:
--   * recruitment_phase_enum and app_settings.current_phase (migration_fsm.sql): the phase
--     lives in app_settings.recruitment_status.currentPhase (JSON), read by recruitment_window().
--   * the old "Allow All Access" policies and the old is_admin()/is_admin_or_above()/
--     get_my_role()/is_admin_or_super() helpers: superseded by is_club_admin() and friends.
--
-- Access model after this file:
--   admin / super_admin  full access to applicants, slots, feedback, notes, quotas, mail log.
--                        super_admin alone deletes applications and changes the schedule.
--   interviewer          reads and writes its OWN feedback, and reads applicants and
--                        feedback ONLY for applicants booked into a panel assigned to it.
--   applicant (signed in) inserts its own application while the window is open, reads and
--                        edits its own row (column whitelist enforced by trigger), books
--                        and reschedules through RPCs, and reads its own slot.
--   everyone else        nothing on these tables.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

-- The role check below uses 'interviewer', which the club panel's helpers do not know.
CREATE OR REPLACE FUNCTION public.is_club_interviewer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE lower(trim(email)) = public.club_jwt_email()
      AND role = 'interviewer'
  );
$$;

-- Staff: super_admin, admin, interviewer. Used by the send-email Edge Function
-- (rpc('is_any_admin')) and by the kept audit_logs policies.
-- The old definition (any admins row) would also have admitted 'member' and
-- 'external' rows, so it is replaced rather than left in place.
CREATE OR REPLACE FUNCTION public.is_any_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE lower(trim(email)) = public.club_jwt_email()
      AND role IN ('super_admin', 'admin', 'interviewer')
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. admins: allow 'interviewer' again
-- -----------------------------------------------------------------------------

ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'admin', 'interviewer', 'external', 'member'));

-- -----------------------------------------------------------------------------
-- 3. applications: applicant columns, status pipeline, constraints
-- -----------------------------------------------------------------------------

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS status               TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS domains              TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills               TEXT,
  ADD COLUMN IF NOT EXISTS reason               TEXT,
  ADD COLUMN IF NOT EXISTS secondary_dept       TEXT,
  ADD COLUMN IF NOT EXISTS secondary_domains    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_skills     TEXT,
  ADD COLUMN IF NOT EXISTS secondary_reason     TEXT,
  ADD COLUMN IF NOT EXISTS department           TEXT,
  ADD COLUMN IF NOT EXISTS year                 TEXT,
  ADD COLUMN IF NOT EXISTS admission_year       INTEGER,
  ADD COLUMN IF NOT EXISTS program_code         TEXT,
  ADD COLUMN IF NOT EXISTS program_name         TEXT,
  ADD COLUMN IF NOT EXISTS batch                TEXT,
  ADD COLUMN IF NOT EXISTS program_category     TEXT,
  ADD COLUMN IF NOT EXISTS rating               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS assigned_position    TEXT,
  ADD COLUMN IF NOT EXISTS shortlist_notified   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shortlisted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interviewed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_score      NUMERIC(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS task_score           NUMERIC(4,1) DEFAULT 0 CHECK (task_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS resume_score         NUMERIC(4,1) DEFAULT 0 CHECK (resume_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS final_score          NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_in_dept         INTEGER,
  ADD COLUMN IF NOT EXISTS resume_url           TEXT,
  ADD COLUMN IF NOT EXISTS resume_filename      TEXT,
  ADD COLUMN IF NOT EXISTS resume_uploaded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS github_url           TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url         TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url        TEXT,
  ADD COLUMN IF NOT EXISTS parsed_skills        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS slot_changes_used    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_analysis          JSONB,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at       TIMESTAMPTZ,
  -- Application-form fields the restored ATS code reads and writes (Apply.tsx,
  -- RecruitmentPanel.tsx). The old app code used them, but no tracked SQL creates
  -- them, so they were most likely added to the live database by hand.
  ADD COLUMN IF NOT EXISTS portfolio_website    TEXT,
  ADD COLUMN IF NOT EXISTS hp_website           TEXT,
  ADD COLUMN IF NOT EXISTS dept_answer          TEXT,
  ADD COLUMN IF NOT EXISTS secondary_dept_answer TEXT,
  ADD COLUMN IF NOT EXISTS why_join_sscs        TEXT,
  ADD COLUMN IF NOT EXISTS why_these_depts      TEXT,
  ADD COLUMN IF NOT EXISTS weekly_hours         TEXT,
  ADD COLUMN IF NOT EXISTS hostel_day           TEXT;

-- Only the latest pipeline list (migration_add_selected_pending_status.sql).
-- 'submitted' from migration_fsm.sql is not part of it.
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check CHECK (status IN (
    'applied', 'pending', 'under_review', 'neutral', 'shortlisted',
    'interview_scheduled', 'interviewed', 'selected_pending', 'selected',
    'active_member', 'waitlisted', 'rejected', 'rejected_pending',
    'alumni', 'inactive'
  ));

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_slot_changes_used_non_negative;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_slot_changes_used_non_negative CHECK (slot_changes_used >= 0);

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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_full_name_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_full_name_length CHECK (length(full_name) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_phone_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_phone_length CHECK (length(phone) <= 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_roll_number_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_roll_number_length CHECK (length(roll_number) <= 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_reason_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_reason_length CHECK (length(COALESCE(reason, '')) <= 4000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_skills_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_skills_length CHECK (length(COALESCE(skills, '')) <= 4000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_roll_number_format') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_roll_number_format CHECK (roll_number ~* '^\d{2}[A-Z]{3}\d{4}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_phone_format') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_phone_format CHECK (phone ~ '^\d{10,12}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_linkedin_url_format') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_linkedin_url_format
      CHECK (linkedin_url IS NULL OR linkedin_url = '' OR linkedin_url ~* '^https?://');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_github_url_format') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_github_url_format
      CHECK (github_url IS NULL OR github_url = '' OR github_url ~* '^https?://');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_portfolio_url_format') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_portfolio_url_format
      CHECK (portfolio_url IS NULL OR portfolio_url = '' OR portfolio_url ~* '^https?://');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_portfolio_website_format') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_portfolio_website_format
      CHECK (portfolio_website IS NULL OR portfolio_website = '' OR portfolio_website ~* '^https?://');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_apps_email        ON public.applications (email);
CREATE INDEX IF NOT EXISTS idx_apps_status       ON public.applications (status);
CREATE INDEX IF NOT EXISTS idx_apps_user_id      ON public.applications (user_id);
CREATE INDEX IF NOT EXISTS idx_apps_final_score  ON public.applications (final_score DESC);
CREATE INDEX IF NOT EXISTS idx_apps_dept_rank    ON public.applications (primary_dept, rank_in_dept);
CREATE INDEX IF NOT EXISTS idx_apps_program_code ON public.applications (program_code);
CREATE INDEX IF NOT EXISTS idx_apps_batch        ON public.applications (batch);

-- -----------------------------------------------------------------------------
-- 4. Tables
-- -----------------------------------------------------------------------------

-- 4a. app_settings: the recruitment window and the AI settings (split out of the
--     public row by migration_security_hardening_live.sql).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4b. Interview slots (one row per panel per start time).
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id      INTEGER NOT NULL,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ,
  is_booked     BOOLEAN NOT NULL DEFAULT false,
  booked_by     UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  reminder_sent BOOLEAN DEFAULT false,
  alert_sent    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS end_time      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_sent    BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_slots_panel_id_positive') THEN
    ALTER TABLE public.interview_slots ADD CONSTRAINT interview_slots_panel_id_positive CHECK (panel_id >= 1);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_slots_booked_by
  ON public.interview_slots (booked_by) WHERE booked_by IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_slots_panel_start
  ON public.interview_slots (panel_id, start_time);
CREATE INDEX IF NOT EXISTS idx_interview_slots_start_free
  ON public.interview_slots (start_time) WHERE is_booked = false;
CREATE INDEX IF NOT EXISTS idx_interview_slots_reminder
  ON public.interview_slots (start_time, is_booked, reminder_sent);

-- 4c. Panel assignments: which interviewer sits on which panel on which date.
CREATE TABLE IF NOT EXISTS public.panel_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id          INTEGER NOT NULL,
  date              DATE NOT NULL,
  interviewer_email TEXT NOT NULL,
  meeting_link      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panel_id, date, interviewer_email)
);
ALTER TABLE public.panel_assignments ADD COLUMN IF NOT EXISTS meeting_link TEXT;
CREATE INDEX IF NOT EXISTS idx_panel_assignments_date ON public.panel_assignments (date);

-- 4d. Panel names per panel per day (InterviewScheduler upserts on panel_id, date).
CREATE TABLE IF NOT EXISTS public.panel_metadata (
  panel_id   INTEGER NOT NULL,
  date       DATE NOT NULL,
  panel_name TEXT,
  PRIMARY KEY (panel_id, date)
);

-- 4e. Interview feedback: one evaluation per interviewer per applicant.
CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  interviewer_email    TEXT NOT NULL,
  score                INTEGER CHECK (score >= 0 AND score <= 10),
  comments             TEXT,
  recommends_committee BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, interviewer_email)
);
ALTER TABLE public.interview_feedback
  ADD COLUMN IF NOT EXISTS score_communication INTEGER DEFAULT 0 CHECK (score_communication BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_technical     INTEGER DEFAULT 0 CHECK (score_technical BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_enthusiasm    INTEGER DEFAULT 0 CHECK (score_enthusiasm BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_leadership    INTEGER DEFAULT 0 CHECK (score_leadership BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_team_fit      INTEGER DEFAULT 0 CHECK (score_team_fit BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS total_score         NUMERIC(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommendation      TEXT DEFAULT 'maybe',
  ADD COLUMN IF NOT EXISTS interviewer_remarks TEXT,
  ADD COLUMN IF NOT EXISTS recommended_dept    TEXT,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_feedback_app_id ON public.interview_feedback (application_id);

-- 4f. Interviews (scheduler). Absent in the live database per the old hardening
--     notes; restored because the old backup service still lists it.
CREATE TABLE IF NOT EXISTS public.interviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  interviewer_email TEXT NOT NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  meeting_link      TEXT,
  status            TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4g. Candidate notes (committee discussion).
CREATE TABLE IF NOT EXISTS public.candidate_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  author_email   TEXT NOT NULL,
  author_name    TEXT NOT NULL,
  content        TEXT NOT NULL,
  mentions       TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_application_id ON public.candidate_notes (application_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_created_at     ON public.candidate_notes (created_at);

-- 4h. Status history (migration_fsm.sql). Nothing writes it in the current code.
CREATE TABLE IF NOT EXISTS public.application_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status     TEXT NOT NULL,
  changed_by     TEXT NOT NULL,
  reason         TEXT,
  timestamp      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_status_history_app_id ON public.application_status_history (application_id);

-- 4i. Department scoring weights.
CREATE TABLE IF NOT EXISTS public.department_weights (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department                  TEXT NOT NULL UNIQUE,
  metric_weight_communication NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_technical     NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_enthusiasm    NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_leadership    NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_team_fit      NUMERIC(4,2) DEFAULT 0.20,
  weight_resume               NUMERIC(4,2) DEFAULT 0.20,
  weight_task                 NUMERIC(4,2) DEFAULT 0.35,
  weight_interview            NUMERIC(4,2) DEFAULT 0.45,
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  updated_by                  TEXT
);

-- 4j. Committee seat quotas.
CREATE TABLE IF NOT EXISTS public.committee_quotas (
  department TEXT PRIMARY KEY,
  seats      INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 99),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- 4k. Mail queue (drained by the send-email Edge Function, see migration_mail_queue.sql).
CREATE TABLE IF NOT EXISTS public.mail_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  purpose               TEXT
                          CHECK (purpose IS NULL OR purpose IN (
                            'shortlist_notify', 'publish_selected', 'publish_rejected',
                            'committee_offer', 'position_offer'
                          )),
  target_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  assigned_position     TEXT,
  batch_label           TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at               TIMESTAMPTZ
);
ALTER TABLE public.mail_queue DROP CONSTRAINT IF EXISTS mail_queue_purpose_needs_target;
ALTER TABLE public.mail_queue
  ADD CONSTRAINT mail_queue_purpose_needs_target
  CHECK (purpose IS NULL OR target_application_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_mail_queue_pending ON public.mail_queue (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mail_queue_batch   ON public.mail_queue (batch_label) WHERE batch_label IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Seeds (ON CONFLICT DO NOTHING: a re-run never overwrites what an admin changed)
-- -----------------------------------------------------------------------------

-- Recruitment starts CLOSED. The schedule is empty and the manual switch is off.
INSERT INTO public.app_settings (key, value)
VALUES ('recruitment_status',
        '{"isOpen": false, "message": "", "currentPhase": "APPLICATIONS_OPEN", "opensAt": null, "closesAt": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Make sure the two schedule keys exist on an older row, keeping every other key.
UPDATE public.app_settings
   SET value = jsonb_build_object('opensAt', 'null'::jsonb, 'closesAt', 'null'::jsonb) || value
 WHERE key = 'recruitment_status'
   AND NOT (value ? 'opensAt' AND value ? 'closesAt');

-- Move the AI settings out of the public row. Copies once; never overwrites.
INSERT INTO public.app_settings (key, value)
SELECT 'ai_settings', value -> 'aiSettings'
  FROM public.app_settings
 WHERE key = 'recruitment_status' AND value ? 'aiSettings'
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings
   SET value = value - 'aiSettings'
 WHERE key = 'recruitment_status' AND value ? 'aiSettings';

INSERT INTO public.committee_quotas (department, seats) VALUES
  ('Technical', 15),
  ('Management', 12),
  ('Event Operations', 12),
  ('Creative', 10),
  ('Outreach & Partnerships', 10),
  ('Human Resources', 10)
ON CONFLICT (department) DO NOTHING;

INSERT INTO public.department_weights
  (department, metric_weight_communication, metric_weight_technical, metric_weight_enthusiasm,
   metric_weight_leadership, metric_weight_team_fit)
VALUES
  ('Technical',  0.10, 0.40, 0.15, 0.15, 0.20),
  ('Operations', 0.30, 0.10, 0.20, 0.25, 0.15),
  ('Design',     0.20, 0.20, 0.20, 0.20, 0.20),
  ('Content',    0.20, 0.20, 0.20, 0.20, 0.20),
  ('Web Dev',    0.20, 0.20, 0.20, 0.20, 0.20),
  ('Media',      0.20, 0.20, 0.20, 0.20, 0.20),
  ('Finance',    0.20, 0.20, 0.20, 0.20, 0.20)
ON CONFLICT (department) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Functions
-- -----------------------------------------------------------------------------

-- 6a. Recruitment window: the one source of truth for "is the form open?"
CREATE OR REPLACE FUNCTION public.is_recruitment_open()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
  -- A malformed config must never read as open.
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.recruitment_window()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
    'serverTime', to_jsonb(to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  );
END;
$$;

-- 6b. Which applicants an interviewer may see: the ones booked into a panel that
--     is assigned to them on that day. Definer, so the policies that call it do
--     not recurse through the slot and panel policies.
CREATE OR REPLACE FUNCTION public.interviewer_assigned(p_application_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.interview_slots s
      JOIN public.panel_assignments pa
        ON pa.panel_id = s.panel_id
       AND pa.date IN (
             (s.start_time AT TIME ZONE 'Asia/Kolkata')::date,
             (s.start_time AT TIME ZONE 'UTC')::date
           )
     WHERE s.booked_by = p_application_id
       AND public.club_jwt_email() <> ''
       AND lower(trim(pa.interviewer_email)) = public.club_jwt_email()
  );
$$;

-- 6c. Slot change quota (one place to change it).
CREATE OR REPLACE FUNCTION public.slot_change_limit()
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$ SELECT 1 $$;

-- 6d. Applicant's own interview details (slot time, link). Never returns the
--     panel number or the interviewer's address.
CREATE OR REPLACE FUNCTION public.my_interview_details()
RETURNS TABLE (
  start_time   TIMESTAMPTZ,
  end_time     TIMESTAMPTZ,
  meeting_link TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_id UUID;
  v_slot   public.interview_slots%ROWTYPE;
  v_link   TEXT;
BEGIN
  IF auth.email() IS NULL THEN
    RETURN;
  END IF;

  SELECT a.id INTO v_app_id
    FROM public.applications a
   WHERE lower(trim(a.email)) = public.club_jwt_email()
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF v_app_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_slot
    FROM public.interview_slots s
   WHERE s.booked_by = v_app_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_link := NULLIF(btrim(COALESCE(to_jsonb(v_slot) ->> 'meeting_link', '')), '');

  IF v_link IS NULL THEN
    SELECT NULLIF(btrim(pa.meeting_link), '') INTO v_link
      FROM public.panel_assignments pa
     WHERE pa.panel_id = v_slot.panel_id
       AND pa.date IN (
             (v_slot.start_time AT TIME ZONE 'Asia/Kolkata')::date,
             (v_slot.start_time AT TIME ZONE 'UTC')::date
           )
       AND NULLIF(btrim(COALESCE(pa.meeting_link, '')), '') IS NOT NULL
     ORDER BY (pa.date = (v_slot.start_time AT TIME ZONE 'Asia/Kolkata')::date) DESC
     LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_slot.start_time, v_slot.end_time, v_link;
END;
$$;

-- 6e. Free times for the calendar, one row per start time (panel never exposed).
--     SECURITY INVOKER on purpose: the caller's slot policies decide what shows.
CREATE OR REPLACE FUNCTION public.available_slot_times()
RETURNS TABLE (
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  seats_remaining BIGINT
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT s.start_time,
         min(s.end_time) AS end_time,
         count(*)        AS seats_remaining
    FROM public.interview_slots s
   WHERE s.is_booked = false
     AND s.start_time > now()
   GROUP BY s.start_time
   ORDER BY s.start_time;
$$;

-- 6f. Atomic booking by time (latest version: migration_slot_reschedule.sql).
CREATE OR REPLACE FUNCTION public.book_interview_slot(p_start_time TIMESTAMPTZ)
RETURNS TABLE (
  slot_id    UUID,
  panel_id   INTEGER,
  start_time TIMESTAMPTZ,
  end_time   TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app  public.applications%ROWTYPE;
  v_slot public.interview_slots%ROWTYPE;
BEGIN
  IF auth.email() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a slot.'
      USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_app
    FROM public.applications a
   WHERE lower(trim(a.email)) = public.club_jwt_email()
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No application found for this account.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_app.status = 'interview_scheduled'
     OR EXISTS (SELECT 1 FROM public.interview_slots s WHERE s.booked_by = v_app.id) THEN
    RAISE EXCEPTION 'You have already booked an interview slot.'
      USING ERRCODE = '23505';
  END IF;

  IF v_app.status <> 'shortlisted'
     OR COALESCE(v_app.shortlist_notified, false) = false THEN
    RAISE EXCEPTION 'You are not eligible to book an interview slot yet.'
      USING ERRCODE = '42501';
  END IF;

  IF p_start_time IS NULL OR p_start_time <= now() THEN
    RAISE EXCEPTION 'That slot time has already passed. Pick an upcoming one.'
      USING ERRCODE = '22007';
  END IF;

  SELECT * INTO v_slot
    FROM public.interview_slots s
   WHERE s.start_time = p_start_time
     AND s.is_booked = false
   ORDER BY s.panel_id
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That time is now fully booked. Please choose another.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.interview_slots s
     SET is_booked     = true,
         booked_by     = v_app.id,
         reminder_sent = false
   WHERE s.id = v_slot.id;

  UPDATE public.applications a
     SET status         = 'interview_scheduled',
         shortlisted_at = COALESCE(a.shortlisted_at, now())
   WHERE a.id = v_app.id;

  RETURN QUERY
    SELECT v_slot.id, v_slot.panel_id, v_slot.start_time, v_slot.end_time;
END;
$$;

-- 6g. One allowed reschedule (latest version: migration_slot_reschedule.sql).
CREATE OR REPLACE FUNCTION public.reschedule_interview_slot(p_start_time TIMESTAMPTZ)
RETURNS TABLE (
  slot_id           UUID,
  panel_id          INTEGER,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  previous_start    TIMESTAMPTZ,
  changes_remaining INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_lead_time CONSTANT INTERVAL := INTERVAL '1 hour';
  v_app       public.applications%ROWTYPE;
  v_current   public.interview_slots%ROWTYPE;
  v_target    public.interview_slots%ROWTYPE;
  v_used      INTEGER;
BEGIN
  IF auth.email() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change your slot.'
      USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_app
    FROM public.applications a
   WHERE lower(trim(a.email)) = public.club_jwt_email()
   ORDER BY a.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No application found for this account.'
      USING ERRCODE = 'P0002';
  END IF;

  v_used := COALESCE(v_app.slot_changes_used, 0);

  IF v_used >= public.slot_change_limit() THEN
    RAISE EXCEPTION 'You have already changed your interview slot. Contact the SSCS team if you need another change.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
    FROM public.interview_slots s
   WHERE s.booked_by = v_app.id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not have an interview slot to change yet.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_current.start_time <= now() + c_lead_time THEN
    RAISE EXCEPTION 'Your interview is too close to be moved. Contact the SSCS team if you cannot attend.'
      USING ERRCODE = '22007';
  END IF;

  IF p_start_time IS NULL OR p_start_time <= now() THEN
    RAISE EXCEPTION 'That slot time has already passed. Pick an upcoming one.'
      USING ERRCODE = '22007';
  END IF;

  IF p_start_time = v_current.start_time THEN
    RAISE EXCEPTION 'That is already your interview time. Pick a different one.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_target
    FROM public.interview_slots s
   WHERE s.start_time = p_start_time
     AND s.is_booked = false
   ORDER BY s.panel_id
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That time is now fully booked. Please choose another.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.interview_slots s
     SET is_booked     = false,
         booked_by     = NULL,
         reminder_sent = false
   WHERE s.id = v_current.id;

  UPDATE public.interview_slots s
     SET is_booked     = true,
         booked_by     = v_app.id,
         reminder_sent = false
   WHERE s.id = v_target.id;

  UPDATE public.applications a
     SET slot_changes_used = v_used + 1
   WHERE a.id = v_app.id;

  RETURN QUERY
    SELECT v_target.id,
           v_target.panel_id,
           v_target.start_time,
           v_target.end_time,
           v_current.start_time,
           public.slot_change_limit() - (v_used + 1);
END;
$$;

-- 6h. Input sanitising on applications (migration_security_hardening_live.sql).
CREATE OR REPLACE FUNCTION public.sanitize_application_input_fn()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.roll_number := UPPER(TRIM(NEW.roll_number));
  NEW.email       := LOWER(TRIM(NEW.email));
  NEW.full_name   := TRIM(NEW.full_name);
  NEW.phone       := REGEXP_REPLACE(NEW.phone, '\D', '', 'g');

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

-- 6i. Applicant column whitelist, status lock, window close, and the one-time
--     slot change. Admins bypass. So does the feedback sync (see 6m), which sets
--     recruit.system_write for its own transaction only.
CREATE OR REPLACE FUNCTION public.guard_applicant_update_fn()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
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
  changed_col        TEXT;
  is_slot_booking    BOOLEAN;
  is_slot_reschedule BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF current_setting('recruit.system_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF public.is_club_admin() THEN
    RETURN NEW;
  END IF;

  is_slot_booking := COALESCE(OLD.status = 'shortlisted' AND NEW.status = 'interview_scheduled', false);

  is_slot_reschedule := COALESCE(
    OLD.status = 'interview_scheduled'
    AND NEW.status = 'interview_scheduled'
    AND NEW.slot_changes_used = COALESCE(OLD.slot_changes_used, 0) + 1
    AND NEW.slot_changes_used <= public.slot_change_limit(),
    false);

  IF NOT is_slot_booking AND NOT is_slot_reschedule AND NOT public.is_recruitment_open() THEN
    RAISE EXCEPTION 'RECRUITMENT_CLOSED: applications are closed and can no longer be edited.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_slot_booking THEN
    RAISE EXCEPTION 'Applicants may not change application status (% -> %).',
      OLD.status, NEW.status;
  END IF;

  IF NEW.slot_changes_used IS DISTINCT FROM OLD.slot_changes_used AND NOT is_slot_reschedule THEN
    RAISE EXCEPTION 'Applicants may not change how many slot changes they have used.';
  END IF;

  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    CONTINUE WHEN changed_col = 'status';
    CONTINUE WHEN changed_col = 'shortlisted_at' AND NEW.status = 'interview_scheduled';
    CONTINUE WHEN changed_col = 'slot_changes_used' AND is_slot_reschedule;

    IF NOT (changed_col = ANY (allowed_cols)) THEN
      RAISE EXCEPTION 'Applicants may not modify column "%".', changed_col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 6j. Window enforcement on insert (clear message for the form; RLS alone gives 42501).
CREATE OR REPLACE FUNCTION public.enforce_recruitment_window_fn()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.is_club_admin() THEN
    RETURN NEW;
  END IF;

  IF public.is_recruitment_open() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'RECRUITMENT_CLOSED: applications are not being accepted right now.';
END;
$$;

-- 6k. Only a super admin may move the schedule.
CREATE OR REPLACE FUNCTION public.guard_recruitment_schedule_fn()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  schedule_changed BOOLEAN;
BEGIN
  IF NEW.key <> 'recruitment_status' THEN
    RETURN NEW;
  END IF;

  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.is_club_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
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

-- 6l. Slot booking guard (latest version: migration_slot_reschedule.sql).
CREATE OR REPLACE FUNCTION public.guard_slot_booking_fn()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changed_col TEXT;
  was_booked  BOOLEAN;
  now_booked  BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.is_club_admin() THEN
    RETURN NEW;
  END IF;

  was_booked := COALESCE(OLD.is_booked, false);
  now_booked := COALESCE(NEW.is_booked, false);

  IF was_booked = false AND now_booked = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = NEW.booked_by AND lower(trim(a.email)) = public.club_jwt_email()
    ) THEN
      RAISE EXCEPTION 'You may only book a slot for your own application.';
    END IF;

  ELSIF was_booked = true AND now_booked = false THEN
    IF NEW.booked_by IS NOT NULL THEN
      RAISE EXCEPTION 'A released slot must not stay assigned to an application.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = OLD.booked_by AND lower(trim(a.email)) = public.club_jwt_email()
    ) THEN
      RAISE EXCEPTION 'You may only release your own slot.';
    END IF;

  ELSE
    RAISE EXCEPTION 'Applicants may only book a free slot or release their own.';
  END IF;

  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    IF changed_col NOT IN ('is_booked', 'booked_by', 'reminder_sent') THEN
      RAISE EXCEPTION 'Applicants may not modify interview_slots.%', changed_col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 6m. Feedback: normalise the interviewer address and keep the applicant's
--     score current. The score is the average of every panel member's total.
CREATE OR REPLACE FUNCTION public.compute_total_interview_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Normalised here, before RLS WITH CHECK, so the interviewer's own-row check matches.
  NEW.interviewer_email := lower(trim(NEW.interviewer_email));

  NEW.total_score := ROUND(
    (COALESCE(NEW.score_communication, 0) +
     COALESCE(NEW.score_technical, 0) +
     COALESCE(NEW.score_enthusiasm, 0) +
     COALESCE(NEW.score_leadership, 0) +
     COALESCE(NEW.score_team_fit, 0))::NUMERIC / 5.0, 1
  );
  NEW.score := NEW.total_score::INTEGER;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_application_interview_score()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app UUID;
  v_avg NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_app := OLD.application_id;
  ELSE
    v_app := NEW.application_id;
  END IF;

  IF v_app IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ROUND(AVG(f.total_score), 2) INTO v_avg
    FROM public.interview_feedback f
   WHERE f.application_id = v_app;

  -- Interviewers have no UPDATE right on applications. This transaction-local
  -- flag lets the guard trigger pass this one write. It is never set by a client.
  PERFORM set_config('recruit.system_write', 'on', true);

  UPDATE public.applications a
     SET interview_score = COALESCE(v_avg, 0),
         status          = CASE WHEN TG_OP <> 'DELETE' AND a.status IN ('interview_scheduled', 'shortlisted')
                                THEN 'interviewed' ELSE a.status END,
         interviewed_at  = CASE WHEN TG_OP <> 'DELETE' AND a.status IN ('interview_scheduled', 'shortlisted')
                                THEN now() ELSE a.interviewed_at END
   WHERE a.id = v_app;

  PERFORM set_config('recruit.system_write', 'off', true);
  RETURN NULL;
END;
$$;

-- 6n. Email domain gate on sign-up (migration_security_fix_1_auth_domain.sql).
CREATE OR REPLACE FUNCTION public.restrict_user_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email NOT LIKE '%@vitstudent.ac.in'
     AND NEW.email NOT LIKE '%@vit.ac.in'
     AND NEW.email <> 'sibhis5223@gmail.com' THEN
    RAISE EXCEPTION 'Access Restricted: Only VIT email addresses (@vitstudent.ac.in / @vit.ac.in) are permitted.';
  END IF;
  RETURN NEW;
END;
$$;

-- 6o. Mail queue (migration_mail_queue.sql). Logic unchanged except: the dedupe
--     fallback is volatile (it generates a random id), and batch progress is for
--     admins only, not any staff role.
CREATE OR REPLACE FUNCTION public.mail_queue_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mail_queue_dedupe_id(
  p_purpose  TEXT,
  p_target   UUID,
  p_fallback TEXT
) RETURNS TEXT
LANGUAGE sql VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_purpose IS NOT NULL AND p_target IS NOT NULL
      THEN p_purpose || ':' || p_target::TEXT
    ELSE COALESCE(p_fallback, gen_random_uuid()::TEXT)
  END;
$$;

CREATE OR REPLACE FUNCTION public.mail_queue_apply_side_effect_fn()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.claim_pending_mail(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.mail_queue
LANGUAGE sql
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.mail_queue_batch_status(p_batch_label TEXT)
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT q.status, count(*)
    FROM public.mail_queue q
   WHERE q.batch_label = p_batch_label
     AND public.is_club_admin()
   GROUP BY q.status;
$$;

-- -----------------------------------------------------------------------------
-- 7. Triggers
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_sanitize_application_input ON public.applications;
CREATE TRIGGER tr_sanitize_application_input
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_application_input_fn();

DROP TRIGGER IF EXISTS tr_enforce_recruitment_window ON public.applications;
CREATE TRIGGER tr_enforce_recruitment_window
  BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_recruitment_window_fn();

DROP TRIGGER IF EXISTS tr_guard_applicant_update ON public.applications;
CREATE TRIGGER tr_guard_applicant_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_applicant_update_fn();

DROP TRIGGER IF EXISTS tr_guard_recruitment_schedule ON public.app_settings;
CREATE TRIGGER tr_guard_recruitment_schedule
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_recruitment_schedule_fn();

DROP TRIGGER IF EXISTS tr_guard_slot_booking ON public.interview_slots;
CREATE TRIGGER tr_guard_slot_booking
  BEFORE UPDATE ON public.interview_slots
  FOR EACH ROW EXECUTE FUNCTION public.guard_slot_booking_fn();

DROP TRIGGER IF EXISTS trg_compute_interview_score ON public.interview_feedback;
CREATE TRIGGER trg_compute_interview_score
  BEFORE INSERT OR UPDATE ON public.interview_feedback
  FOR EACH ROW EXECUTE FUNCTION public.compute_total_interview_score();

DROP TRIGGER IF EXISTS tr_sync_application_interview_score ON public.interview_feedback;
CREATE TRIGGER tr_sync_application_interview_score
  AFTER INSERT OR UPDATE OR DELETE ON public.interview_feedback
  FOR EACH ROW EXECUTE FUNCTION public.sync_application_interview_score();

DROP TRIGGER IF EXISTS tr_mail_queue_touch ON public.mail_queue;
CREATE TRIGGER tr_mail_queue_touch
  BEFORE UPDATE ON public.mail_queue
  FOR EACH ROW EXECUTE FUNCTION public.mail_queue_touch_updated_at();

DROP TRIGGER IF EXISTS tr_mail_queue_side_effect ON public.mail_queue;
CREATE TRIGGER tr_mail_queue_side_effect
  AFTER UPDATE ON public.mail_queue
  FOR EACH ROW EXECUTE FUNCTION public.mail_queue_apply_side_effect_fn();

DROP TRIGGER IF EXISTS tr_restrict_user_email_domain ON auth.users;
CREATE TRIGGER tr_restrict_user_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.restrict_user_email_domain();

-- -----------------------------------------------------------------------------
-- 8. Row level security
--
-- Every existing policy on the restored tables goes first, including any old
-- "Allow All Access" left behind. Permissive policies OR together, so one stray
-- USING (true) would open the table.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'applications', 'app_settings', 'interview_slots', 'panel_assignments',
        'panel_metadata', 'interview_feedback', 'interviews', 'candidate_notes',
        'application_status_history', 'department_weights', 'committee_quotas', 'mail_queue'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$$;

ALTER TABLE public.applications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_metadata             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_weights         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_quotas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_queue                 ENABLE ROW LEVEL SECURITY;

-- applications: one row per person. Admins see and edit all; applicants see and
-- edit their own; interviewers see only applicants booked into their panels.
-- Deletion is super-admin only, as before.
-- Self match is by user_id OR email: Hero.tsx and Navigation.tsx query
-- .or(`user_id.eq.<uid>,email.eq.<email>`) and must keep working.
CREATE POLICY applications_read ON public.applications
  FOR SELECT TO authenticated
  USING (
    public.is_club_admin()
    OR (public.club_jwt_email() <> '' AND lower(trim(email)) = public.club_jwt_email())
    OR (user_id IS NOT NULL AND user_id = (auth.uid())::text)
    OR (public.is_club_interviewer() AND public.interviewer_assigned(id))
  );

CREATE POLICY applications_insert ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_club_admin()
    OR (
      auth.role() = 'authenticated'
      AND public.club_jwt_email() <> ''
      AND lower(trim(email)) = public.club_jwt_email()
      AND (auth.uid())::text = user_id
      AND (
        email LIKE '%@vitstudent.ac.in'
        OR email LIKE '%@vit.ac.in'
        OR email = 'sibhis5223@gmail.com'
      )
      AND public.is_recruitment_open()
    )
  );

CREATE POLICY applications_update ON public.applications
  FOR UPDATE TO authenticated
  USING (
    public.is_club_admin()
    OR (public.club_jwt_email() <> '' AND lower(trim(email)) = public.club_jwt_email())
    OR (user_id IS NOT NULL AND user_id = (auth.uid())::text)
  )
  WITH CHECK (
    public.is_club_admin()
    OR (public.club_jwt_email() <> '' AND lower(trim(email)) = public.club_jwt_email())
    OR (user_id IS NOT NULL AND user_id = (auth.uid())::text)
  );

CREATE POLICY applications_delete ON public.applications
  FOR DELETE TO authenticated
  USING (public.is_club_super_admin());

-- app_settings: everyone except the AI key row reads (the closed screen needs it);
-- admins read everything and write; the schedule itself is guarded by trigger.
CREATE POLICY app_settings_public_read ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (key <> 'ai_settings');

CREATE POLICY app_settings_admin_read ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_club_admin());

CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

-- interview_slots. Writes are admin-only; applicants book through RPCs.
CREATE POLICY slots_admin_all ON public.interview_slots
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY slots_read_own_booking ON public.interview_slots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = interview_slots.booked_by
         AND lower(trim(a.email)) = public.club_jwt_email()
    )
  );

CREATE POLICY slots_read_free_shortlisted ON public.interview_slots
  FOR SELECT TO authenticated
  USING (
    is_booked = false
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE lower(trim(a.email)) = public.club_jwt_email()
         AND a.status = 'shortlisted'
         AND COALESCE(a.shortlist_notified, false) = true
    )
  );

CREATE POLICY slots_read_free_reschedule ON public.interview_slots
  FOR SELECT TO authenticated
  USING (
    is_booked = false
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE lower(trim(a.email)) = public.club_jwt_email()
         AND a.status = 'interview_scheduled'
         AND COALESCE(a.slot_changes_used, 0) < public.slot_change_limit()
    )
  );

CREATE POLICY slots_read_interviewer ON public.interview_slots
  FOR SELECT TO authenticated
  USING (
    public.is_club_interviewer()
    AND EXISTS (
      SELECT 1 FROM public.panel_assignments pa
       WHERE pa.panel_id = interview_slots.panel_id
         AND pa.date IN (
               (interview_slots.start_time AT TIME ZONE 'Asia/Kolkata')::date,
               (interview_slots.start_time AT TIME ZONE 'UTC')::date
             )
         AND lower(trim(pa.interviewer_email)) = public.club_jwt_email()
    )
  );

-- panel_assignments: admins manage; an interviewer reads their own rows (the
-- dashboard needs the meeting link for their panels).
CREATE POLICY panel_assignments_admin_all ON public.panel_assignments
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY panel_assignments_read_own ON public.panel_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_club_interviewer()
    AND lower(trim(interviewer_email)) = public.club_jwt_email()
  );

CREATE POLICY panel_metadata_admin_all ON public.panel_metadata
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

-- interview_feedback: admins see and manage all. Interviewers read feedback for
-- applicants assigned to them, and write only their own evaluation of them.
CREATE POLICY feedback_admin_all ON public.interview_feedback
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY feedback_interviewer_read ON public.interview_feedback
  FOR SELECT TO authenticated
  USING (public.is_club_interviewer() AND public.interviewer_assigned(application_id));

CREATE POLICY feedback_interviewer_write ON public.interview_feedback
  FOR ALL TO authenticated
  USING (
    public.is_club_interviewer()
    AND lower(trim(interviewer_email)) = public.club_jwt_email()
    AND public.interviewer_assigned(application_id)
  )
  WITH CHECK (
    public.is_club_interviewer()
    AND lower(trim(interviewer_email)) = public.club_jwt_email()
    AND public.interviewer_assigned(application_id)
  );

-- Admin-only tables.
CREATE POLICY interviews_admin_all ON public.interviews
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY interviews_read_own ON public.interviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = interviews.application_id
         AND lower(trim(a.email)) = public.club_jwt_email()
    )
  );

CREATE POLICY candidate_notes_admin_all ON public.candidate_notes
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY status_history_admin_all ON public.application_status_history
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY department_weights_admin_all ON public.department_weights
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

CREATE POLICY committee_quotas_admin_all ON public.committee_quotas
  FOR ALL TO authenticated
  USING (public.is_club_admin())
  WITH CHECK (public.is_club_admin());

-- Only the Edge Function (service_role, bypasses RLS) writes the queue.
CREATE POLICY mail_queue_admin_read ON public.mail_queue
  FOR SELECT TO authenticated
  USING (public.is_club_admin());

-- -----------------------------------------------------------------------------
-- 9. Grants
--
-- Supabase's default privileges would grant these anyway, but the club panel
-- revoked anon on the tables it owns, so state the rules explicitly.
-- Column-level grants on applications from lock_applicant_data.sql are replaced
-- by table-level grants here: row policies now decide who sees which row.
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.app_settings, public.interview_slots, public.panel_assignments,
              public.panel_metadata, public.interview_feedback, public.interviews,
              public.candidate_notes, public.application_status_history,
              public.department_weights, public.committee_quotas, public.mail_queue
  FROM anon;

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.app_settings, public.interview_slots, public.panel_assignments,
  public.panel_metadata, public.interview_feedback, public.interviews,
  public.candidate_notes, public.application_status_history,
  public.department_weights, public.committee_quotas
  TO authenticated;
GRANT SELECT ON public.mail_queue TO authenticated;

GRANT ALL ON public.applications, public.app_settings, public.interview_slots,
             public.panel_assignments, public.panel_metadata, public.interview_feedback,
             public.interviews, public.candidate_notes, public.application_status_history,
             public.department_weights, public.committee_quotas, public.mail_queue
  TO service_role;

REVOKE ALL ON FUNCTION public.is_recruitment_open(), public.recruitment_window() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_recruitment_open(), public.recruitment_window() TO anon, authenticated;

REVOKE ALL ON FUNCTION
  public.book_interview_slot(TIMESTAMPTZ),
  public.reschedule_interview_slot(TIMESTAMPTZ),
  public.my_interview_details(),
  public.available_slot_times(),
  public.slot_change_limit(),
  public.interviewer_assigned(UUID),
  public.is_club_interviewer(),
  public.is_any_admin(),
  public.mail_queue_batch_status(TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.book_interview_slot(TIMESTAMPTZ),
  public.reschedule_interview_slot(TIMESTAMPTZ),
  public.my_interview_details(),
  public.available_slot_times(),
  public.slot_change_limit(),
  public.interviewer_assigned(UUID),
  public.is_club_interviewer(),
  public.is_any_admin(),
  public.mail_queue_batch_status(TEXT)
  TO authenticated;

REVOKE ALL ON FUNCTION public.claim_pending_mail(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_mail(INTEGER) TO service_role;


-- Tell PostgREST about the tables and functions above.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 10. Mail drain cron (pg_cron). Only when pg_cron and pg_net are installed AND
--     the two database settings are set. Otherwise it does nothing and says so.
--     The settings (see migration_mail_queue_cron.sql):
--       ALTER DATABASE postgres SET app.settings.edge_function_base_url = 'https://<ref>.supabase.co/functions/v1';
--       ALTER DATABASE postgres SET app.settings.mail_cron_secret = '<secret, also MAIL_CRON_SECRET on the function>';
-- =============================================================================

DO $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
  ) THEN
    RAISE NOTICE 'mail-queue-drain: pg_cron and pg_net are not both installed; cron job not scheduled.';
    RETURN;
  END IF;

  IF current_setting('app.settings.edge_function_base_url', true) IS NULL
     OR current_setting('app.settings.mail_cron_secret', true) IS NULL THEN
    RAISE NOTICE 'mail-queue-drain: app.settings.edge_function_base_url / mail_cron_secret not set; cron job not scheduled.';
    RETURN;
  END IF;

  EXECUTE $q$
    SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mail-queue-drain'
  $q$;

  EXECUTE $q$
    SELECT cron.schedule(
      'mail-queue-drain',
      '* * * * *',
      $job$
      SELECT net.http_post(
        url     := current_setting('app.settings.edge_function_base_url', true) || '/send-email',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-mail-cron-secret', current_setting('app.settings.mail_cron_secret', true)
                   ),
        body    := jsonb_build_object('action', 'process', 'limit', 25),
        timeout_milliseconds := 20000
      );
      $job$
    )
  $q$;
END
$$;

COMMIT;
