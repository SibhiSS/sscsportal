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

BEGIN;

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

COMMIT;
