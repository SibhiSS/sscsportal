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

BEGIN;

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

COMMIT;
