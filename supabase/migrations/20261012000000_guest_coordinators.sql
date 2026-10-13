-- Student coordinators who aren't on the roster yet.
--
--   * event_attendance.member_id may be NULL when guest_name holds the person's
--     name instead; exactly one of the two is set
--   * only coordinator roles can be given to a guest
--   * a guest row earns nothing (the leaderboard and my_attendance key on
--     member_id); once the person joins the roster an admin links the row to
--     them (UPDATE member_id, guest_name = NULL) and the points follow
--   * the members' calendar and the event activity log show guest names
BEGIN;

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

COMMIT;
