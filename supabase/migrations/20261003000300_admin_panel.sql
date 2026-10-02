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

BEGIN;

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

COMMIT;
