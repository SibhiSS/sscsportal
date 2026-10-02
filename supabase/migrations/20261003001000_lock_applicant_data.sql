-- =============================================================================
-- LOCK THE OLD APPLICANT DATA
--
-- Run after 20261003000900_settings_super_admin.sql. Safe to re-run.
--
-- public.applications is the roster, but it still holds every recruitment
-- applicant with their interview scores, interviewer remarks, resume links and
-- so on. From here on:
--
--   * through the API, signed-in users can only read and write the roster
--     columns (name, email, reg no, phone, team, position, lead/active flags).
--     Interview scores, remarks, resumes and the rest are not readable through
--     the API by anyone, super admins included; the Supabase dashboard still
--     shows everything.
--   * admins only see rows that are on the roster; super admins also see the
--     former applicants (to add one back to the roster)
--   * admins can add new people, edit roster details and take someone off the
--     roster; only super admins can bring a former applicant back or delete rows
-- =============================================================================

BEGIN;

-- Column access: roster columns only. (PostgREST requests for "*" or for any
-- other column now fail with "permission denied".)
REVOKE SELECT, INSERT, UPDATE ON public.applications FROM authenticated;
GRANT SELECT (
  id, email, full_name, roll_number, phone, primary_dept,
  member_department, member_position, is_member, is_lead, member_status, created_at
) ON public.applications TO authenticated;
GRANT INSERT (
  email, full_name, roll_number, phone, primary_dept,
  member_department, member_position, is_member, is_lead, member_status
) ON public.applications TO authenticated;
GRANT UPDATE (
  full_name, roll_number, phone, member_department, member_position, is_member, is_lead, member_status
) ON public.applications TO authenticated;
GRANT DELETE ON public.applications TO authenticated;

-- Row access.
DROP POLICY IF EXISTS applications_admin_all ON public.applications;
DROP POLICY IF EXISTS applications_read ON public.applications;
DROP POLICY IF EXISTS applications_insert ON public.applications;
DROP POLICY IF EXISTS applications_update ON public.applications;
DROP POLICY IF EXISTS applications_delete ON public.applications;

CREATE POLICY applications_read ON public.applications
  FOR SELECT TO authenticated
  USING (public.is_club_super_admin() OR (public.is_club_admin() AND is_member));

-- Admins may only add people straight onto the roster.
CREATE POLICY applications_insert ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_club_super_admin() OR (public.is_club_admin() AND is_member));

-- Admins edit roster rows; bringing a former applicant back needs a super
-- admin, since admins can't see those rows.
CREATE POLICY applications_update ON public.applications
  FOR UPDATE TO authenticated
  USING (public.is_club_super_admin() OR (public.is_club_admin() AND is_member))
  WITH CHECK (public.is_club_super_admin() OR (public.is_club_admin() AND is_member));

CREATE POLICY applications_delete ON public.applications
  FOR DELETE TO authenticated
  USING (public.is_club_super_admin());

-- Taking someone off the roster makes their row invisible to an admin, which
-- row security won't allow as a plain update; this function does it instead.
CREATE OR REPLACE FUNCTION public.remove_from_roster(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_club_admin() THEN
    RAISE EXCEPTION 'Only admins can change the roster' USING ERRCODE = '42501';
  END IF;
  UPDATE public.applications SET is_member = false WHERE id = p_id AND is_member;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not on the roster' USING ERRCODE = 'P0002';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.remove_from_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_from_roster(uuid) TO authenticated;

COMMIT;
