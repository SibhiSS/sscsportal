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
