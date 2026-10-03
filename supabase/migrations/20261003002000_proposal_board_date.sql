-- =============================================================================
-- PROPOSALS: "LEAVE THE DATE TO THE BOARD"
--
-- Run after 20261003001900_more_venues.sql. Safe to re-run.
--
--   * a proposal may come without dates (both empty): the board picks them
--     when a super admin accepts it
--   * a proposal with dates still can't start in the past
-- =============================================================================

BEGIN;

ALTER TABLE public.event_proposals ALTER COLUMN expected_start DROP NOT NULL;
ALTER TABLE public.event_proposals ALTER COLUMN expected_end DROP NOT NULL;

-- Either both dates or neither.
ALTER TABLE public.event_proposals DROP CONSTRAINT IF EXISTS event_proposals_dates_together;
ALTER TABLE public.event_proposals ADD CONSTRAINT event_proposals_dates_together
  CHECK ((expected_start IS NULL) = (expected_end IS NULL));

DROP POLICY IF EXISTS event_proposals_insert ON public.event_proposals;
CREATE POLICY event_proposals_insert ON public.event_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.current_member_id() IS NOT NULL OR public.is_club_admin())
    AND lower(trim(proposer_email)) = public.club_jwt_email()
    AND status = 'pending'
    AND review_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND event_id IS NULL
    AND (expected_start IS NULL OR expected_start >= public.club_today())
  );

COMMIT;
