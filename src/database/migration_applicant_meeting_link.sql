-- ==============================================================================
-- Let a booked applicant actually see their meeting link in the portal
-- Run this in the Supabase SQL Editor. It is idempotent — re-running is safe.
-- ==============================================================================
--
-- /apply and /status both render a "Join Interview" button from
-- panel_assignments.meeting_link, and neither has ever been able to show it.
--
-- migration_complete_rls_fix.sql (STEP 10) left panel_assignments with exactly one
-- policy — panels_manage, USING (is_any_admin()) — and RLS enabled. An applicant
-- SELECTing that table therefore gets zero rows, so meetingLink stays null and the
-- candidate is told "Your meeting link will appear here" forever. The link has only
-- ever reached them through the T-10 reminder mail, which the Apps Script cron sends
-- with the service_role key and so bypasses RLS entirely.
--
-- The fix is NOT a SELECT policy on panel_assignments: those rows also carry
-- interviewer_email, and applicants have no business reading the interviewer roster.
-- Instead this exposes one SECURITY DEFINER function that returns the caller's own
-- slot and nothing else — no panel number, no interviewer address — matching how
-- available_slot_times() and book_interview_slot() already work in this schema.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.my_interview_details()
RETURNS TABLE (
  start_time   TIMESTAMPTZ,
  end_time     TIMESTAMPTZ,
  meeting_link TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_id UUID;
  v_slot   public.interview_slots%ROWTYPE;
  v_link   TEXT;
BEGIN
  IF auth.email() IS NULL THEN
    RETURN;
  END IF;

  SELECT a.id INTO v_app_id
    FROM public.applications a
   WHERE a.email = auth.email()
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF v_app_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_slot
    FROM public.interview_slots s
   WHERE s.booked_by = v_app_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Some deployments carry a per-slot override; schema.sql does not define one, so
  -- it is read through to_jsonb rather than as a column that may not exist.
  v_link := NULLIF(btrim(COALESCE(to_jsonb(v_slot) ->> 'meeting_link', '')), '');

  IF v_link IS NULL THEN
    -- panel_assignments.date is written by the admin's browser as a LOCAL yyyy-MM-dd,
    -- so the slot's date has to be read in the same zone to match. The UTC date is
    -- accepted as a fallback (that is what the Apps Script cron compares), but the
    -- local one wins when both exist.
    SELECT NULLIF(btrim(pa.meeting_link), '') INTO v_link
      FROM public.panel_assignments pa
     WHERE pa.panel_id = v_slot.panel_id
       AND pa.date IN (
             (v_slot.start_time AT TIME ZONE 'Asia/Kolkata')::date,
             (v_slot.start_time AT TIME ZONE 'UTC')::date
           )
       AND NULLIF(btrim(COALESCE(pa.meeting_link, '')), '') IS NOT NULL
     ORDER BY (pa.date = (v_slot.start_time AT TIME ZONE 'Asia/Kolkata')::date) DESC
     LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_slot.start_time, v_slot.end_time, v_link;
END;
$$;

REVOKE ALL     ON FUNCTION public.my_interview_details() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_interview_details() TO authenticated;
