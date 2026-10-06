-- =============================================================================
-- ROLE TIERS: SUPER ADMIN / BOARD / LEAD / COLLABORATOR
--
-- Run after 20261006000100_team_photos_webp.sql. Safe to re-run.
--
-- The old "admin" role is gone. Panel roles are now:
--
--   super_admin   everything, including Settings, Venues, Website, Team,
--                 Broadcasts
--   board         the core panel (events, members, approvals, proposals,
--                 drive, meets) PLUS read-only venue availability
--   lead          the core panel, WITHOUT venue availability
--   collaborator  someone from another club helping us out. Sees ONLY which
--                 venues are free or booked, and when. No events, members,
--                 bookings' owners/phones, our own bookings, broadcasts or
--                 anything else about the club.
--   member        no panel access (unchanged)
--
-- Every existing "admin" becomes a "lead" (the least privileged core role).
-- Promote the right people to "board" in Settings afterwards.
--
-- is_club_admin() keeps its name so every existing policy keeps working; it now
-- means "core team" (super_admin, board, lead) and never includes
-- collaborators, so they inherit none of the core team's access.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Roles
-- -----------------------------------------------------------------------------

ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;

UPDATE public.admins SET role = 'lead' WHERE role = 'admin';

ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'board', 'lead', 'collaborator', 'member'));

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admins
  WHERE lower(trim(email)) = public.club_jwt_email()
  LIMIT 1;
$$;

-- Core team: super admins, board and leads. Collaborators are NOT included.
CREATE OR REPLACE FUNCTION public.is_club_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.club_role() IN ('super_admin', 'board', 'lead'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_club_board()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.club_role() IN ('super_admin', 'board'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_club_collaborator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.club_role() = 'collaborator', false);
$$;

REVOKE ALL ON FUNCTION public.club_role(), public.is_club_board(), public.is_club_collaborator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_role(), public.is_club_board(), public.is_club_collaborator() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Venues
--
-- The venue list stays readable by the whole core team (leads still pick an
-- event's venue). Bookings (who booked what, phones, which are ours): super
-- admins and board only. Writes stay super admin only. Collaborators read
-- neither table; they go through the two functions below.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS venues_read ON public.venues;
CREATE POLICY venues_read ON public.venues
  FOR SELECT TO authenticated
  USING (public.is_club_admin());

DROP POLICY IF EXISTS venue_bookings_read ON public.venue_bookings;
CREATE POLICY venue_bookings_read ON public.venue_bookings
  FOR SELECT TO authenticated
  USING (public.is_club_board());

-- Collaborators get free/busy slots only: no event names, bookers, phones, and
-- no hint of which bookings are ours.
CREATE OR REPLACE FUNCTION public.venue_busy_slots(p_from date, p_to date)
RETURNS TABLE (venue_id text, booking_date date, from_time time, to_time time)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_club_board() OR public.is_club_collaborator()) THEN
    RAISE EXCEPTION 'Not allowed to view venue availability' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT b.venue_id, b.booking_date, b.from_time, b.to_time
    FROM public.venue_bookings b
    JOIN public.venues v ON v.id = b.venue_id AND v.is_active
    WHERE b.booking_date BETWEEN p_from AND p_to
    ORDER BY b.booking_date, b.from_time;
END
$$;

-- Active venue names for the availability view (no internal notes).
CREATE OR REPLACE FUNCTION public.availability_venues()
RETURNS TABLE (id text, name text, short_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name, v.short_name FROM public.venues v
  WHERE v.is_active AND (public.is_club_board() OR public.is_club_collaborator())
  ORDER BY v.sort_order, v.name;
$$;

REVOKE ALL ON FUNCTION public.availability_venues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.availability_venues() TO authenticated;

REVOKE ALL ON FUNCTION public.venue_busy_slots(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venue_busy_slots(date, date) TO authenticated;

-- When the venue data was last imported (club_settings itself stays core-team only).
CREATE OR REPLACE FUNCTION public.venue_data_as_of()
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (value #>> '{}')::date FROM public.club_settings
  WHERE key = 'venue_data_as_of'
    AND (public.is_club_board() OR public.is_club_collaborator());
$$;

REVOKE ALL ON FUNCTION public.venue_data_as_of() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venue_data_as_of() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Broadcasts: collaborators are outsiders and get none of them.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.broadcast_is_for_me(p_audience text, p_starts timestamptz, p_expires timestamptz)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.club_jwt_email() <> ''
     AND NOT public.is_club_collaborator()
     AND p_starts <= now()
     AND (p_expires IS NULL OR p_expires > now())
     AND CASE p_audience
           WHEN 'everyone' THEN true
           WHEN 'admins'   THEN public.is_club_admin()
           WHEN 'members'  THEN NOT public.is_club_admin()
           ELSE false
         END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_people()
RETURNS TABLE (email text, name text, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT lower(trim(a.email)) AS email, a.full_name AS name
    FROM public.applications a
    WHERE a.is_member AND a.member_status = 'active'
    UNION ALL
    SELECT lower(trim(ad.email)), NULL
    FROM public.admins ad
    WHERE ad.role IN ('super_admin', 'board', 'lead')
  )
  SELECT p.email,
         coalesce(max(p.name), p.email),
         EXISTS (SELECT 1 FROM public.admins ad
                 WHERE lower(trim(ad.email)) = p.email AND ad.role IN ('super_admin', 'board', 'lead'))
  FROM people p
  WHERE public.is_club_super_admin() AND p.email <> ''
    AND NOT EXISTS (SELECT 1 FROM public.admins ad
                    WHERE lower(trim(ad.email)) = p.email AND ad.role = 'collaborator')
  GROUP BY p.email
  ORDER BY 2;
$$;

COMMIT;

-- =============================================================================
-- AFTER RUNNING:
--
--   SELECT email, role FROM public.admins WHERE role <> 'member' ORDER BY role, email;
--
-- Then promote board members in Settings (or:
--   UPDATE public.admins SET role = 'board' WHERE lower(email) IN ('...');)
-- =============================================================================
