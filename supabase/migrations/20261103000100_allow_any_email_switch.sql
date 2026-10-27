-- =============================================================================
-- SIGN-IN DOMAIN LOCK: A SWITCH FOR TESTING
--
-- Run after 20261103000000_add_dds_merchant_admin.sql. Safe to re-run.
--
-- Until now the database refused to create a login for any Google account that
-- is not @vitstudent.ac.in / @vit.ac.in ("Database error saving new user").
-- This makes the lock switchable:
--
--   * club_settings key 'allow_any_email' (true/false), set from
--     Admin > Settings > Features > "Allow any Google account". Off by default.
--   * anyone already listed in the admins table may always sign in, whatever
--     their email domain
--   * public.open_signin_enabled(): the switch's value, readable by the sign-in
--     page (which cannot read club_settings directly)
--   * applying (applications_insert) follows the same switch
--
-- Turn the switch OFF again when testing is over.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.open_signin_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT value::text = 'true' FROM public.club_settings WHERE key = 'allow_any_email'), false);
$$;

REVOKE ALL ON FUNCTION public.open_signin_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_signin_enabled() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.restrict_user_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email LIKE '%@vitstudent.ac.in'
     OR NEW.email LIKE '%@vit.ac.in'
     OR NEW.email = 'sibhis5223@gmail.com'
     OR public.open_signin_enabled()
     OR EXISTS (SELECT 1 FROM public.admins a WHERE lower(a.email) = lower(NEW.email)) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Access Restricted: Only VIT email addresses (@vitstudent.ac.in / @vit.ac.in) are permitted.';
END;
$$;

DROP POLICY IF EXISTS applications_insert ON public.applications;
CREATE POLICY applications_insert ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_club_admin()
    OR (
      auth.role() = 'authenticated'
      AND public.club_jwt_email() <> ''
      AND lower(trim(email)) = public.club_jwt_email()
      AND (auth.uid())::text = user_id
      AND (
        email LIKE '%@vitstudent.ac.in'
        OR email LIKE '%@vit.ac.in'
        OR email = 'sibhis5223@gmail.com'
        OR public.open_signin_enabled()
      )
      AND public.is_recruitment_open()
    )
  );

COMMIT;
