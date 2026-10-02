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

BEGIN;

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

COMMIT;

-- =============================================================================
-- AFTER RUNNING, sanity checks:
--
--   SELECT count(*) FILTER (WHERE is_member) AS roster, count(*) AS all_rows
--   FROM public.applications;
--   SELECT * FROM public.leaderboard ORDER BY rank LIMIT 10;
-- =============================================================================
