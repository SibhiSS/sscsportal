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

BEGIN;

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

COMMIT;
