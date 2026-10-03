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
  venue_id       uuid REFERENCES public.venues(id) ON DELETE SET NULL,
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
RETURNS TABLE (id uuid, name text)
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
