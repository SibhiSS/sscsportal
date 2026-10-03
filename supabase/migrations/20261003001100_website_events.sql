-- =============================================================================
-- WEBSITE EVENTS: PUBLISH CLUB EVENTS TO THE PUBLIC SITE
--
-- Run after 20261003001000_lock_applicant_data.sql. Safe to re-run.
--
--   * events get website_* columns: published, featured, blurb, details,
--     tags, cover image, gallery, link
--   * only super admins can change those columns (plain admins still manage
--     the rest of the event)
--   * public.website_events: published events with public-safe columns only,
--     readable by anyone, signed in or not. Budgets, reports, checklists stay
--     private.
--   * "site-media" public bucket for covers and gallery photos; super admins
--     upload, anyone can view
--   * seeds the two events the home page used to hard-code
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS website_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_featured  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_blurb     text,
  ADD COLUMN IF NOT EXISTS website_details   text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_tags      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_cover     text,
  ADD COLUMN IF NOT EXISTS website_gallery   text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_link      text;

-- A featured event must be published.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_featured_published;
ALTER TABLE public.events ADD CONSTRAINT events_featured_published
  CHECK (NOT website_featured OR website_published);

CREATE INDEX IF NOT EXISTS idx_events_website ON public.events (website_published, start_date DESC);

-- -----------------------------------------------------------------------------
-- 2. Only super admins change what the website shows
--    Statements with no signed-in user (SQL editor, seeds) are allowed.
-- -----------------------------------------------------------------------------

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
      OR cardinality(NEW.website_details) > 0 OR cardinality(NEW.website_tags) > 0
      OR cardinality(NEW.website_gallery) > 0;
  ELSE
    changed := (NEW.website_published, NEW.website_featured, NEW.website_blurb, NEW.website_details,
                NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link)
      IS DISTINCT FROM
               (OLD.website_published, OLD.website_featured, OLD.website_blurb, OLD.website_details,
                OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link);
  END IF;

  IF changed THEN
    RAISE EXCEPTION 'Only super admins can change what the website shows' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_events_website_guard ON public.events;
CREATE TRIGGER tr_events_website_guard
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_website_guard();

-- -----------------------------------------------------------------------------
-- 3. Public view
--    Runs with the view owner's rights (like public.leaderboard), so signed-out
--    visitors can read it without any access to public.events itself.
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.website_events;
CREATE VIEW public.website_events AS
SELECT
  e.id,
  e.title,
  e.start_date,
  e.end_date,
  e.is_online,
  CASE WHEN e.is_online THEN NULL ELSE v.name END AS venue,
  e.website_featured  AS featured,
  e.website_blurb     AS blurb,
  e.website_details   AS details,
  e.website_tags      AS tags,
  e.website_cover     AS cover,
  e.website_gallery   AS gallery,
  e.website_link      AS link
FROM public.events e
LEFT JOIN public.venues v ON v.id = e.venue_id
WHERE e.website_published;

REVOKE ALL ON public.website_events FROM PUBLIC;
GRANT SELECT ON public.website_events TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Public bucket for website images (covers, galleries). 8 MB, images only.
--    Paths: <event id>/<random>.<ext>
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS site_media_super_insert ON storage.objects;
CREATE POLICY site_media_super_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.is_club_super_admin());

DROP POLICY IF EXISTS site_media_super_update ON storage.objects;
CREATE POLICY site_media_super_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_club_super_admin())
  WITH CHECK (bucket_id = 'site-media' AND public.is_club_super_admin());

DROP POLICY IF EXISTS site_media_super_delete ON storage.objects;
CREATE POLICY site_media_super_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_club_super_admin());

-- -----------------------------------------------------------------------------
-- 5. The two events the home page used to hard-code, published.
--    Only the month is known for each, so they're dated the 1st; fix the day
--    in the admin panel. Images point at files already in /public.
-- -----------------------------------------------------------------------------

INSERT INTO public.events (
  title, start_date, end_date, created_by,
  website_published, website_featured, website_blurb, website_details, website_tags, website_cover, website_gallery
)
SELECT v.title, v.d::date, v.d::date, 'website seed', true, true, v.blurb, v.details, v.tags, v.cover, v.gallery
FROM (VALUES
  (
    'Ice Breaker Session', '2025-08-01',
    'An introductory session for newly selected members to connect, form cross-functional teams, and brainstorm innovative event concepts to execute during the tenure.',
    ARRAY[
      'Welcomed newly recruited members and introduced the chapter''s core mission.',
      'Facilitated structured networking to help members form effective working teams.',
      'Conducted a collaborative brainstorming session where teams developed and pitched technical event ideas.'
    ],
    ARRAY['Networking', 'Team Building', 'Brainstorming'],
    '/event1.jpg',
    ARRAY['/event1.jpg']
  ),
  (
    'Capture the Signal', '2026-04-01',
    'A high-stakes, multi-round electronics competition that challenged participants across circuit design, signal analysis, and engineering strategy.',
    ARRAY[
      'Designed complex resistor networks and solved intricate Boolean logic puzzles under time pressure.',
      'Deciphered cryptic electronics clues and conducted deep black-box circuit analysis.',
      'Constructed physical analog circuits using real lab equipment to validate theoretical designs.',
      'Progressed through a tiered competition structure focused on hands-on hardware mastery.'
    ],
    ARRAY['Competition', 'Circuit Design', 'Analog Electronics'],
    '/event2-1.jpg',
    ARRAY['/event2-1.jpg', '/event2-2.jpg']
  )
) AS v(title, d, blurb, details, tags, cover, gallery)
WHERE NOT EXISTS (
  SELECT 1 FROM public.events x WHERE x.title = v.title
);

COMMIT;

-- =============================================================================
-- AFTER RUNNING, sanity checks:
--
--   SELECT title, start_date, featured FROM public.website_events ORDER BY start_date DESC;
--   SELECT id, public FROM storage.buckets WHERE id = 'site-media';
-- =============================================================================
