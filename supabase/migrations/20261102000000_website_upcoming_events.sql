-- =============================================================================
-- WEBSITE EVENTS: UPCOMING EVENTS STRIP ON THE HOME PAGE
--
-- Run after 20261101000000_recruitment_restore.sql. Safe to re-run.
--
--   * events.website_upcoming: super admin switch. Only events with this on
--     appear in the "Upcoming events" strip on the home page; with none on,
--     the strip is hidden.
--   * events.website_poster: optional poster image (site-media bucket)
--   * events.website_register_url: optional "Register" button target
--   * events.website_time: free text shown on the card, e.g. "5:00 PM - 7:00 PM"
--   * only super admins change them (added to the website guard)
--   * website_events exposes them as upcoming, poster, register_url, time
-- =============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS website_upcoming     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_poster       text,
  ADD COLUMN IF NOT EXISTS website_register_url text,
  ADD COLUMN IF NOT EXISTS website_time         text;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_upcoming_published;
ALTER TABLE public.events ADD CONSTRAINT events_upcoming_published
  CHECK (NOT website_upcoming OR website_published);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_register_url_https;
ALTER TABLE public.events ADD CONSTRAINT events_register_url_https
  CHECK (website_register_url IS NULL OR website_register_url ~* '^https?://');

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
    changed := NEW.website_published OR NEW.website_featured OR NEW.website_upcoming
      OR NEW.website_blurb IS NOT NULL OR NEW.website_cover IS NOT NULL OR NEW.website_link IS NOT NULL
      OR NEW.website_poster IS NOT NULL OR NEW.website_register_url IS NOT NULL OR NEW.website_time IS NOT NULL
      OR NEW.website_feature_order IS NOT NULL
      OR cardinality(NEW.website_details) > 0 OR cardinality(NEW.website_tags) > 0
      OR cardinality(NEW.website_gallery) > 0;
  ELSE
    changed := (NEW.website_published, NEW.website_featured, NEW.website_blurb, NEW.website_details,
                NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link, NEW.website_feature_order,
                NEW.website_upcoming, NEW.website_poster, NEW.website_register_url, NEW.website_time)
      IS DISTINCT FROM
               (OLD.website_published, OLD.website_featured, OLD.website_blurb, OLD.website_details,
                OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link, OLD.website_feature_order,
                OLD.website_upcoming, OLD.website_poster, OLD.website_register_url, OLD.website_time);
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
  e.website_link          AS link,
  e.website_upcoming      AS upcoming,
  e.website_poster        AS poster,
  e.website_register_url  AS register_url,
  e.website_time          AS time
FROM public.events e
LEFT JOIN public.venues v ON v.id = e.venue_id
WHERE e.website_published;

REVOKE ALL ON public.website_events FROM PUBLIC;
GRANT SELECT ON public.website_events TO anon, authenticated;

COMMIT;
