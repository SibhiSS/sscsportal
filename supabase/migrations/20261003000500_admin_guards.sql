-- =============================================================================
-- ADMIN GUARDS
--
-- Run after 20261003000400_seed_calendar.sql. Safe to re-run.
--
--   * the last super_admin can't be demoted or removed, so the club can never
--     lock itself out of Settings
--   * contribution types that contributions or attendance already use can't be
--     deleted (hide them instead); the foreign keys already enforce this, the
--     trigger below just says so in plain words
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.club_keep_a_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'super_admin'
     AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'super_admin')
     AND NOT EXISTS (SELECT 1 FROM public.admins WHERE role = 'super_admin' AND id <> OLD.id)
  THEN
    RAISE EXCEPTION 'There must always be at least one super admin' USING ERRCODE = '55000';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS tr_admins_keep_super ON public.admins;
CREATE TRIGGER tr_admins_keep_super
  BEFORE UPDATE OR DELETE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.club_keep_a_super_admin();

-- A type that is in use can't be deleted, and can't switch between
-- "submission" and "attendance" (that would break the rule that members only
-- submit submission types and attendance only uses attendance types).
CREATE OR REPLACE FUNCTION public.club_type_in_use()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  in_use boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.source IS NOT DISTINCT FROM OLD.source THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.contributions WHERE type_id = OLD.id)
      OR EXISTS (SELECT 1 FROM public.event_attendance WHERE type_id = OLD.id)
    INTO in_use;
  IF in_use AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'This contribution type is already in use; hide it instead of deleting it' USING ERRCODE = '23503';
  END IF;
  IF in_use THEN
    RAISE EXCEPTION 'This contribution type is already in use, so it can''t switch between submission and attendance' USING ERRCODE = '55000';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS tr_contribution_types_in_use ON public.contribution_types;
CREATE TRIGGER tr_contribution_types_in_use
  BEFORE UPDATE OR DELETE ON public.contribution_types
  FOR EACH ROW EXECUTE FUNCTION public.club_type_in_use();

COMMIT;
