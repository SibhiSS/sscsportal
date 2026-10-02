-- =============================================================================
-- UNDO A REVIEW
--
-- Run after 20261003000600_venues_super_admin.sql. Safe to re-run.
--
-- reopen_contribution() puts an approved or rejected contribution back to
-- "pending": its points come off the leaderboard and the review (reviewer, date,
-- note) is cleared, so it can be reviewed again from the Approvals queue.
-- Deleting a contribution needs nothing new: admins could already delete.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reopen_contribution(p_id uuid)
RETURNS public.contributions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.contributions;
BEGIN
  IF NOT public.is_club_admin() THEN
    RAISE EXCEPTION 'Only admins can undo a review' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.contributions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status = 'pending' THEN
    RAISE EXCEPTION 'This contribution is already waiting for review' USING ERRCODE = '55000';
  END IF;

  UPDATE public.contributions
     SET status = 'pending', points_awarded = NULL, reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
   WHERE id = p_id
  RETURNING * INTO c;

  RETURN c;
END
$$;

REVOKE ALL ON FUNCTION public.reopen_contribution(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_contribution(uuid) TO authenticated;

COMMIT;
