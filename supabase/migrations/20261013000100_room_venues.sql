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

BEGIN;

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

COMMIT;
