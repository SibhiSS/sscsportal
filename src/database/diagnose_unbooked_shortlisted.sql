-- ==============================================================================
-- Who was shortlisted but still has no interview slot — and why
-- Paste into the Supabase SQL Editor. Read-only: nothing below changes data.
-- ==============================================================================
--
-- Run this after the /apply sign-in fix went live. It separates the people the
-- fix already released from the people who are STILL blocked, because they are
-- blocked for different reasons and need different actions:
--
--   NEEDS BOOKING       — eligible right now. The lockout screen was the only
--                         thing stopping them; they just need to be told to
--                         come back. Some of these never saw the shortlist mail
--                         at all: Gmail's ~100/day cap kills a blast partway
--                         through, and sendEmail()'s no-cors call reports
--                         success regardless, so shortlist_notified was set for
--                         people who were never actually emailed.
--   BLOCKED: NOT NOTIFIED — shortlist_notified is false, so /schedule still
--                         shows them "Not Yet Eligible". These people CANNOT
--                         book today no matter what they do. Section 4 fixes it.
--   MISSED SLOT         — held a slot whose time has already passed. Needs a
--                         human decision, not a query.
--
-- ==============================================================================


-- ==============================================================================
-- 1. Headline counts
-- ==============================================================================

SELECT
  count(*) FILTER (WHERE a.status = 'shortlisted'
                     AND COALESCE(a.shortlist_notified, false) = true)   AS needs_booking,
  count(*) FILTER (WHERE a.status = 'shortlisted'
                     AND COALESCE(a.shortlist_notified, false) = false)  AS blocked_not_notified,
  count(*) FILTER (WHERE a.status = 'interview_scheduled'
                     AND s.start_time > now())                           AS booked_upcoming,
  count(*) FILTER (WHERE a.status = 'interview_scheduled'
                     AND s.start_time <= now())                          AS slot_already_passed,
  count(*) FILTER (WHERE a.status = 'interview_scheduled'
                     AND s.id IS NULL)                                   AS scheduled_but_no_slot_row
  FROM public.applications a
  LEFT JOIN public.interview_slots s ON s.booked_by = a.id;


-- ==============================================================================
-- 2. Is there even room for them? Compare before mailing anyone.
-- ------------------------------------------------------------------------------
-- seats_free counts PANELS, not times — one 10:00 backed by four panels is four
-- seats. If seats_free is below still_to_book, generate more slots in the
-- Scheduler tab first, or the nudge email sends people to an empty calendar.
-- ==============================================================================

SELECT
  (SELECT count(*) FROM public.interview_slots
    WHERE is_booked = false AND start_time > now())                      AS seats_free_upcoming,
  (SELECT count(DISTINCT start_time) FROM public.interview_slots
    WHERE is_booked = false AND start_time > now())                      AS distinct_times_free,
  (SELECT count(*) FROM public.applications
    WHERE status = 'shortlisted')                                        AS still_to_book,
  (SELECT min(start_time) FROM public.interview_slots
    WHERE is_booked = false AND start_time > now())                      AS earliest_free_slot;


-- ==============================================================================
-- 3. The name list, one row per person, most urgent first
-- ------------------------------------------------------------------------------
-- Export this and use it as the mailing list for the nudge.
-- ==============================================================================

SELECT
  CASE
    WHEN a.status = 'shortlisted' AND COALESCE(a.shortlist_notified, false) = false
      THEN 'BLOCKED: NOT NOTIFIED'
    WHEN a.status = 'shortlisted'
      THEN 'NEEDS BOOKING'
    WHEN a.status = 'interview_scheduled' AND s.id IS NULL
      THEN 'CHECK: scheduled, no slot row'
    WHEN a.status = 'interview_scheduled' AND s.start_time <= now()
      THEN 'MISSED SLOT'
    ELSE 'BOOKED'
  END                                    AS state,
  a.full_name,
  a.roll_number,
  a.email,
  a.primary_dept,
  COALESCE(a.shortlist_notified, false)  AS was_mailed_flag,
  a.shortlisted_at,
  s.start_time                           AS slot_time
  FROM public.applications a
  LEFT JOIN public.interview_slots s ON s.booked_by = a.id
 WHERE a.status IN ('shortlisted', 'interview_scheduled')
 ORDER BY
   CASE
     WHEN a.status = 'shortlisted' AND COALESCE(a.shortlist_notified, false) = false THEN 1
     WHEN a.status = 'shortlisted'                                                   THEN 2
     WHEN a.status = 'interview_scheduled' AND s.id IS NULL                          THEN 3
     WHEN a.status = 'interview_scheduled' AND s.start_time <= now()                 THEN 4
     ELSE 5
   END,
   a.full_name;


-- ==============================================================================
-- 4. REMEDIATION — release the "BLOCKED: NOT NOTIFIED" group
-- ------------------------------------------------------------------------------
-- COMMENTED OUT ON PURPOSE. Read section 3 first and satisfy yourself that every
-- name it labels BLOCKED really was meant to be shortlisted — this flag is the
-- single gate on booking, and setting it for someone shortlisted by mistake
-- hands them an interview.
--
-- Run this as an admin: is_any_admin() is what lets the write past
-- guard_applicant_update_fn's column whitelist.
--
-- It only unlocks the portal. It does NOT email anyone — send the booking links
-- from the Scheduler tab afterwards, which is also what stops a second copy
-- going to people who did get the first one.
-- ==============================================================================

-- UPDATE public.applications
--    SET shortlist_notified = true
--  WHERE status = 'shortlisted'
--    AND COALESCE(shortlist_notified, false) = false;
