-- =============================================================================
-- SETTINGS: SUPER ADMINS ONLY
--
-- Run after 20261003000800_member_event_picker.sql. Safe to re-run.
--
-- Settings (admins, contribution types and points) is a super-admin section.
-- Managing admins already was; this makes contribution types and their points
-- super-admin only too. Everyone signed in can still READ the types: members
-- need them to log work, admins to mark attendance.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS contribution_types_admin ON public.contribution_types;
DROP POLICY IF EXISTS contribution_types_super_write ON public.contribution_types;
CREATE POLICY contribution_types_super_write ON public.contribution_types
  FOR ALL TO authenticated
  USING (public.is_club_super_admin())
  WITH CHECK (public.is_club_super_admin());

COMMIT;
