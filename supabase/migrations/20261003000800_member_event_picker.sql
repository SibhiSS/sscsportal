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

BEGIN;

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

COMMIT;
