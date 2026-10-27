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

BEGIN;

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

COMMIT;

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
