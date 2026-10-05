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

BEGIN;

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

COMMIT;
