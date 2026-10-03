-- =============================================================================
-- ONE FILE FOR EVERYTHING ADDED ON 2026-10-03 (after website_events)
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run.
-- Requires the earlier migrations (up to 20261003001100_website_events.sql).
--
-- Contains, in order:
--   1. 20261003001200_website_team.sql          Team page managed in Admin > Team
--   2. 20261003001300_website_feature_order.sql Spotlight order for featured events
--   3. 20261003001400_member_calendar.sql       Members' calendar + "Confirmed" switch
--   4. 20261003001500_event_proposals.sql       Event proposals; admins work the checklist only
--   5. 20261003001600_admin_drive.sql           Admin drive (5 MB per file, 400 MB total)
--   6. 20261003001700_wis_role_names.sql        "Women in SSCS (Chairperson)" role names
--
-- Each part runs in its own transaction, so if one fails, the parts before it
-- stay applied. Fix the error and run the whole file again.
-- Generated from supabase/migrations/; edit those, not this file.
-- =============================================================================


-- #############################################################################
-- 20261003001200_website_team.sql


-- #############################################################################
-- 20261003001200_website_team.sql
-- #############################################################################

-- =============================================================================
-- WEBSITE TEAM: THE /team PAGE COMES FROM THE DATABASE
--
-- Run after 20261003001100_website_events.sql. Safe to re-run.
--
--   * public.website_team: faculty coordinators, core team and leads, one row
--     per person per tenure ("2026-27"). Faculty rows have no tenure and are
--     shown for every tenure.
--   * anyone (signed in or not) can read it; only super admins change it
--   * face photos go in the existing public "site-media" bucket under team/
--   * seeds the people /team used to hard-code
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.website_team (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL CHECK (section IN ('faculty', 'core', 'lead')),
  tenure      text CHECK (tenure ~ '^\d{4}-\d{2}$'),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  role        text NOT NULL CHECK (length(trim(role)) BETWEEN 1 AND 80),
  quote       text CHECK (quote IS NULL OR length(quote) <= 200),
  image       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Faculty belong to every tenure; everyone else to exactly one.
  CONSTRAINT website_team_tenure CHECK ((section = 'faculty') = (tenure IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_website_team_order ON public.website_team (tenure, section, sort_order);

ALTER TABLE public.website_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_team_read ON public.website_team;
CREATE POLICY website_team_read ON public.website_team
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS website_team_super_write ON public.website_team;
CREATE POLICY website_team_super_write ON public.website_team
  FOR ALL TO authenticated
  USING (public.is_club_super_admin())
  WITH CHECK (public.is_club_super_admin());

REVOKE ALL ON public.website_team FROM PUBLIC;
GRANT SELECT ON public.website_team TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.website_team TO authenticated;

-- -----------------------------------------------------------------------------
-- Seed (only into an empty table, so re-running never duplicates or undoes edits)
-- -----------------------------------------------------------------------------

INSERT INTO public.website_team (section, tenure, name, role, quote, image, sort_order)
SELECT v.section, v.tenure, v.name, v.role, NULLIF(v.quote, ''), v.image, v.ord
FROM (VALUES
  ('faculty', NULL,      'Sangeetha R G',     'Faculty Coordinator', 'Expert mentorship in technical direction and academic excellence for IEEE SSCS.', '/sangeetha.png', 0),
  ('faculty', NULL,      'Hemanth C',         'Faculty Coordinator', 'Guiding innovation and student engagement within the solid-state circuits domain.', '/hemanth.png', 1),

  ('core', '2025-26', 'E Abijay',        'Chairperson',       'Never Settle!', '/abijay.png', 0),
  ('core', '2025-26', 'Kiran Kumar',     'Vice Chairperson',  'I create systems that redefine the best.', '/kiran.png', 1),
  ('core', '2025-26', 'Manasa Grandhi',  'General Secretary', 'Troubles are just passing clouds.', '/manasa.png', 2),
  ('core', '2025-26', 'Mrithubashini',   'General Secretary', 'Let''s see what happens.', '/mrithubashini.png', 3),
  ('core', '2025-26', 'Arushi',          'Treasurer',         'Who wishes to fight must first count the cost.', '/arushi.png', 4),

  ('lead', '2025-26', 'Shivaranjani',   'Technical Lead',        'Life''s a circuit—I''m still meeting setup and hold.', '/shivaranjani.png', 0),
  ('lead', '2025-26', 'Harshan',        'Technical Lead',        'Observe. Plan. Execute.', '/harshan.png', 1),
  ('lead', '2025-26', 'Ilangkumaran',   'Operations Lead',       'Big ideas don''t need noise, they need action.', '/ilangkumaran.png', 2),
  ('lead', '2025-26', 'Sibhi S',        'Operations Lead',       'Click Me!!!', '/sibhi.png', 3),
  ('lead', '2025-26', 'Neyalakshmi',    'Editorial Lead',        'PEACE!', '/neya.png', 4),
  ('lead', '2025-26', 'Goutham P',      'Editorial Lead',        'SKY IS THE LIMIT', '/goutham.png', 5),
  ('lead', '2025-26', 'Priyadarshini',  'Design Lead',           'LOST IN A PASTEL SKY', '/priyadharshini.png', 6),
  ('lead', '2025-26', 'Midhun P',       'Associate Design Lead', 'COOL TONE WARM CORE', '/midhun.png', 7),

  ('core', '2026-27', 'Sibhi',          'Chairperson',                     'Click Me!!!', '/sibhi.png', 0),
  ('core', '2026-27', 'Goutham P',      'Vice Chairperson',                'SKY IS THE LIMIT', '/goutham.png', 1),
  ('core', '2026-27', 'Ilangkumaran',   'General Secretary',               'Big ideas don''t need noise, they need action.', '/ilangkumaran.png', 2),
  ('core', '2026-27', 'Neyalakshmi',    'Treasurer',                       'PEACE!', '/neya.png', 3),
  ('core', '2026-27', 'Sarweshwari',    'Women in SSCS (Chairperson)',     'Empowering women in circuits.', '/sarweshwari.png', 4),
  ('core', '2026-27', 'Shree Devi',     'Women in SSCS (Vice-Chairperson)', 'Breaking barriers.', '/shreedevi.png', 5),

  ('lead', '2026-27', 'S Jai Akaash',      'Technical Lead',                         '', '/jai.png', 0),
  ('lead', '2026-27', 'Pranav J',          'Associate Technical Lead',               '', '/pranav.png', 1),
  ('lead', '2026-27', 'Hitesh V S',        'Associate Technical Lead',               '', '/hitesh.png', 2),
  ('lead', '2026-27', 'M Varshinee',       'Management Lead',                        '', '/varshinee.png', 3),
  ('lead', '2026-27', 'Adriza Banerji',    'Associate Management Lead',              '', '/adriza.png', 4),
  ('lead', '2026-27', 'C S Tejasvini',     'Event Operations Lead',                  '', '/tejasvini.png', 5),
  ('lead', '2026-27', 'Aariya Manikandan', 'Associate Event Operations Lead',        '', '/aariya.png', 6),
  ('lead', '2026-27', 'Rohith M',          'Creative Lead',                          '', '/rohith.png', 7),
  ('lead', '2026-27', 'Tharun S',          'Associate Creative Lead',                '', '/tharun.png', 8),
  ('lead', '2026-27', 'Anjana Varma',      'Outreach & Partnerships Lead',           '', '/anjana.png', 9),
  ('lead', '2026-27', 'Karthikeyan D',     'Associate Outreach & Partnerships Lead', '', '/karthikeyan.png', 10),
  ('lead', '2026-27', 'P Midhun',          'Human Resource Lead',                    'COOL TONE WARM CORE', '/midhun.png', 11),
  ('lead', '2026-27', 'K Srishtithaa',     'Associate Human Resource Lead',          '', '/srishtithaa.png', 12)
) AS v(section, tenure, name, role, quote, image, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.website_team);

COMMIT;

-- =============================================================================
-- AFTER RUNNING, sanity check:
--
--   SELECT tenure, section, count(*) FROM public.website_team GROUP BY 1, 2 ORDER BY 1, 2;
-- =============================================================================


-- #############################################################################
-- 20261003001300_website_feature_order.sql
-- #############################################################################

-- =============================================================================
-- WEBSITE EVENTS: SPOTLIGHT ORDER
--
-- Run after 20261003001200_website_team.sql. Safe to re-run.
--
--   * events.website_feature_order: position among featured (spotlight)
--     events on the home page, lowest first. NULL falls back to newest first.
--   * only super admins change it (added to the website guard)
--   * website_events exposes it as feature_order
-- =============================================================================

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS website_feature_order integer;

-- Start from the current order (newest first) so nothing jumps around.
UPDATE public.events e
SET website_feature_order = r.n
FROM (
  SELECT id, row_number() OVER (ORDER BY start_date DESC) - 1 AS n
  FROM public.events WHERE website_featured
) r
WHERE e.id = r.id AND e.website_feature_order IS NULL;

CREATE OR REPLACE FUNCTION public.club_events_website_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  changed boolean;
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    changed := NEW.website_published OR NEW.website_featured
      OR NEW.website_blurb IS NOT NULL OR NEW.website_cover IS NOT NULL OR NEW.website_link IS NOT NULL
      OR NEW.website_feature_order IS NOT NULL
      OR cardinality(NEW.website_details) > 0 OR cardinality(NEW.website_tags) > 0
      OR cardinality(NEW.website_gallery) > 0;
  ELSE
    changed := (NEW.website_published, NEW.website_featured, NEW.website_blurb, NEW.website_details,
                NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link, NEW.website_feature_order)
      IS DISTINCT FROM
               (OLD.website_published, OLD.website_featured, OLD.website_blurb, OLD.website_details,
                OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link, OLD.website_feature_order);
  END IF;

  IF changed THEN
    RAISE EXCEPTION 'Only super admins can change what the website shows' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP VIEW IF EXISTS public.website_events;
CREATE VIEW public.website_events AS
SELECT
  e.id,
  e.title,
  e.start_date,
  e.end_date,
  e.is_online,
  CASE WHEN e.is_online THEN NULL ELSE v.name END AS venue,
  e.website_featured      AS featured,
  e.website_feature_order AS feature_order,
  e.website_blurb         AS blurb,
  e.website_details       AS details,
  e.website_tags          AS tags,
  e.website_cover         AS cover,
  e.website_gallery       AS gallery,
  e.website_link          AS link
FROM public.events e
LEFT JOIN public.venues v ON v.id = e.venue_id
WHERE e.website_published;

REVOKE ALL ON public.website_events FROM PUBLIC;
GRANT SELECT ON public.website_events TO anon, authenticated;

COMMIT;


-- #############################################################################
-- 20261003001400_member_calendar.sql
-- #############################################################################

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


-- #############################################################################
-- 20261003001500_event_proposals.sql
-- #############################################################################

-- =============================================================================
-- EVENT PROPOSALS + ADMINS WORK THE CHECKLIST ONLY
--
-- Run after 20261003001400_member_calendar.sql. Safe to re-run.
--
--   * Only super admins create or delete events, or change an event's title,
--     dates, description, online/venue. Plain admins keep the checklist:
--     venue booked, coordinators/attendance, poster/report/budget, posted ticks.
--   * public.event_proposals: any member or admin proposes an event (what,
--     requirements, expected dates, preferred venue). They see their own;
--     admins see all. Only a super admin accepts (creates the event) or
--     rejects, through accept_event_proposal / reject_event_proposal.
--   * proposal_venues(): venue names for the proposal form (members can't
--     read the venues table).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Event details are super-admin only
--    Statements with no signed-in user (SQL editor, seeds) are allowed.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_events_details_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only super admins can create events. Propose it instead.' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Only super admins can delete events' USING ERRCODE = '42501';
  ELSIF (NEW.title, NEW.start_date, NEW.end_date, NEW.description, NEW.is_online, NEW.venue_id)
        IS DISTINCT FROM (OLD.title, OLD.start_date, OLD.end_date, OLD.description, OLD.is_online, OLD.venue_id) THEN
    RAISE EXCEPTION 'Only super admins can change an event''s details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_details_guard ON public.events;
CREATE TRIGGER tr_events_details_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_details_guard();

-- -----------------------------------------------------------------------------
-- 2. Proposals
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  description    text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 4000),
  requirements   text CHECK (requirements IS NULL OR length(requirements) <= 2000),
  expected_start date NOT NULL,
  expected_end   date NOT NULL,
  is_online      boolean NOT NULL DEFAULT false,
  venue_id       text REFERENCES public.venues(id) ON UPDATE CASCADE ON DELETE SET NULL,
  proposer_email text NOT NULL,
  proposer_name  text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  review_note    text CHECK (review_note IS NULL OR length(review_note) <= 1000),
  reviewed_by    text,
  reviewed_at    timestamptz,
  event_id       uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (expected_end >= expected_start)
);

CREATE INDEX IF NOT EXISTS idx_event_proposals_status ON public.event_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_proposals_proposer ON public.event_proposals (lower(proposer_email));

ALTER TABLE public.event_proposals ENABLE ROW LEVEL SECURITY;

-- Members and admins propose, as themselves, a pending proposal.
DROP POLICY IF EXISTS event_proposals_insert ON public.event_proposals;
CREATE POLICY event_proposals_insert ON public.event_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND lower(trim(proposer_email)) = public.club_jwt_email()
    AND status = 'pending'
    AND review_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND event_id IS NULL
    AND expected_start >= public.club_today()
  );

-- Everyone reads their own; admins read all.
DROP POLICY IF EXISTS event_proposals_read ON public.event_proposals;
CREATE POLICY event_proposals_read ON public.event_proposals
  FOR SELECT TO authenticated
  USING (lower(trim(proposer_email)) = public.club_jwt_email() OR public.is_club_admin());

-- A proposer can withdraw their own while it's still pending.
DROP POLICY IF EXISTS event_proposals_withdraw ON public.event_proposals;
CREATE POLICY event_proposals_withdraw ON public.event_proposals
  FOR DELETE TO authenticated
  USING (lower(trim(proposer_email)) = public.club_jwt_email() AND status = 'pending');

-- No UPDATE policy: decisions go through the functions below.

REVOKE ALL ON public.event_proposals FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.event_proposals TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Decisions (super admins only)
-- -----------------------------------------------------------------------------

-- Accept: creates the event (dates may be adjusted) and links it.
CREATE OR REPLACE FUNCTION public.accept_event_proposal(p_id uuid, p_start date, p_end date, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.event_proposals;
  new_id uuid;
BEGIN
  IF NOT public.is_club_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can accept proposals' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.event_proposals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  IF p.status <> 'pending' THEN RAISE EXCEPTION 'This proposal has already been decided'; END IF;
  IF p_end < p_start THEN RAISE EXCEPTION 'The end date is before the start date'; END IF;

  INSERT INTO public.events (title, description, start_date, end_date, is_online, venue_id, created_by)
  VALUES (
    p.title,
    p.description || CASE WHEN coalesce(trim(p.requirements), '') <> '' THEN E'\n\nRequirements:\n' || p.requirements ELSE '' END
      || E'\n\nProposed by ' || coalesce(p.proposer_name, p.proposer_email) || '.',
    p_start, p_end, p.is_online, CASE WHEN p.is_online THEN NULL ELSE p.venue_id END,
    'proposal: ' || p.proposer_email
  )
  RETURNING id INTO new_id;

  UPDATE public.event_proposals
  SET status = 'accepted', event_id = new_id, review_note = NULLIF(trim(p_note), ''),
      reviewed_by = public.club_jwt_email(), reviewed_at = now()
  WHERE id = p_id;
  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.reject_event_proposal(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_club_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can reject proposals' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_proposals
  SET status = 'rejected', review_note = NULLIF(trim(p_note), ''),
      reviewed_by = public.club_jwt_email(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found or already decided'; END IF;
END
$$;

REVOKE ALL ON FUNCTION public.accept_event_proposal(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_event_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_event_proposal(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_event_proposal(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Venue names for the form
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proposal_venues()
RETURNS TABLE (id text, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name FROM public.venues v
  WHERE v.is_active AND (public.current_member_id() IS NOT NULL OR public.is_club_admin())
  ORDER BY v.name;
$$;

REVOKE ALL ON FUNCTION public.proposal_venues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proposal_venues() TO authenticated;

COMMIT;


-- #############################################################################
-- 20261003001600_admin_drive.sql
-- #############################################################################

-- =============================================================================
-- ADMIN DRIVE
--
-- Run after 20261003001500_event_proposals.sql. Safe to re-run.
--
--   * "admin-drive": private bucket, 5 MB per file, documents and images
--   * public.drive_folders: named folders under "General" (flat)
--   * public.drive_files: one row per file. A file sits in General
--     (no folder, no event), in a folder, or in an event's folder.
--   * admins and super admins only. Anyone of them uploads and downloads;
--     the uploader or a super admin renames, moves or deletes.
--   * the drive holds at most 400 MB in total (checked against the real
--     object sizes in storage, not what the browser claims)
--   * storage_usage(): bytes per bucket, for the usage bar
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Bucket
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-drive', 'admin-drive', false, 5242880, ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/zip', 'application/x-zip-compressed'
])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS admin_drive_read ON storage.objects;
CREATE POLICY admin_drive_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admin-drive' AND public.is_club_admin());

DROP POLICY IF EXISTS admin_drive_upload ON storage.objects;
CREATE POLICY admin_drive_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-drive' AND public.is_club_admin());

-- Removing a file: its uploader, or a super admin.
DROP POLICY IF EXISTS admin_drive_delete ON storage.objects;
CREATE POLICY admin_drive_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-drive' AND public.is_club_admin()
         AND (owner = auth.uid() OR public.is_club_super_admin()));

-- -----------------------------------------------------------------------------
-- 2. Folders and files
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.drive_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_drive_folders_name ON public.drive_folders (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.drive_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid REFERENCES public.drive_folders(id) ON DELETE RESTRICT,
  event_id    uuid REFERENCES public.events(id) ON DELETE SET NULL,
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  path        text NOT NULL UNIQUE,
  size        bigint NOT NULL CHECK (size > 0 AND size <= 5242880),
  mime        text,
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (folder_id IS NULL OR event_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON public.drive_files (folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_files_event ON public.drive_files (event_id, created_at DESC);

-- Trust storage for the size, and keep the drive under 400 MB in total.
CREATE OR REPLACE FUNCTION public.drive_files_check()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_size bigint;
  used bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT (o.metadata->>'size')::bigint INTO real_size
    FROM storage.objects o WHERE o.bucket_id = 'admin-drive' AND o.name = NEW.path;
    IF real_size IS NULL THEN
      RAISE EXCEPTION 'Upload the file before registering it';
    END IF;
    NEW.size := real_size;
    NEW.uploaded_by := public.club_jwt_email();
    SELECT coalesce(sum(size), 0) INTO used FROM public.drive_files;
    IF used + NEW.size > 400 * 1024 * 1024 THEN
      RAISE EXCEPTION 'The drive is full (400 MB). Delete old files first.' USING ERRCODE = '53100';
    END IF;
  ELSE
    -- Renames and moves only; the stored file and its owner never change.
    NEW.path := OLD.path; NEW.size := OLD.size; NEW.mime := OLD.mime;
    NEW.uploaded_by := OLD.uploaded_by; NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_drive_files_check ON public.drive_files;
CREATE TRIGGER tr_drive_files_check
  BEFORE INSERT OR UPDATE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.drive_files_check();

ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drive_folders_read ON public.drive_folders;
CREATE POLICY drive_folders_read ON public.drive_folders
  FOR SELECT TO authenticated USING (public.is_club_admin());
DROP POLICY IF EXISTS drive_folders_create ON public.drive_folders;
CREATE POLICY drive_folders_create ON public.drive_folders
  FOR INSERT TO authenticated WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_folders_super ON public.drive_folders;
CREATE POLICY drive_folders_super ON public.drive_folders
  FOR UPDATE TO authenticated USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());
DROP POLICY IF EXISTS drive_folders_super_delete ON public.drive_folders;
CREATE POLICY drive_folders_super_delete ON public.drive_folders
  FOR DELETE TO authenticated USING (public.is_club_super_admin());

DROP POLICY IF EXISTS drive_files_read ON public.drive_files;
CREATE POLICY drive_files_read ON public.drive_files
  FOR SELECT TO authenticated USING (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_create ON public.drive_files;
CREATE POLICY drive_files_create ON public.drive_files
  FOR INSERT TO authenticated WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_change ON public.drive_files;
CREATE POLICY drive_files_change ON public.drive_files
  FOR UPDATE TO authenticated
  USING (public.is_club_admin() AND (lower(uploaded_by) = public.club_jwt_email() OR public.is_club_super_admin()))
  WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_delete ON public.drive_files;
CREATE POLICY drive_files_delete ON public.drive_files
  FOR DELETE TO authenticated
  USING (public.is_club_admin() AND (lower(uploaded_by) = public.club_jwt_email() OR public.is_club_super_admin()));

REVOKE ALL ON public.drive_folders, public.drive_files FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_folders, public.drive_files TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage usage per bucket (admins), for the usage bar
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (bucket_id text, bytes bigint, files bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint, count(*)
  FROM storage.objects o
  WHERE public.is_club_admin()
  GROUP BY o.bucket_id
  ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage() TO authenticated;

COMMIT;


-- #############################################################################
-- 20261003001700_wis_role_names.sql
-- #############################################################################

-- =============================================================================
-- Women in SSCS roles read "Women in SSCS (Chairperson)" and
-- "Women in SSCS (Vice-Chairperson)". Run after 20261003001600_admin_drive.sql.
-- Safe to re-run.
-- =============================================================================

UPDATE public.website_team SET role = 'Women in SSCS (Chairperson)'
WHERE role = 'Chairperson (Women in SSCS)';

UPDATE public.website_team SET role = 'Women in SSCS (Vice-Chairperson)'
WHERE role = 'Vice-Chairperson (Women in SSCS)';
