-- ==============================================================================
-- Let an applicant change their booked interview slot — exactly once
-- Run this in the Supabase SQL Editor. It is idempotent — re-running is safe.
-- Requires migration_slot_booking_fixes.sql to have been run first.
-- ==============================================================================
--
-- Until now a booking was final: book_interview_slot() refused a second call and
-- the applicant had no way to release the slot they held. This migration adds a
-- single, quota'd reschedule:
--
--   * applications.slot_changes_used counts changes an applicant has spent.
--     slot_change_limit() is the cap (1), shared by the RLS policy, the guard
--     triggers, and the reschedule function so the three cannot drift apart.
--   * reschedule_interview_slot() frees the old slot and claims a new one in a
--     single transaction, with the same SKIP LOCKED panel-claim as booking.
--   * A change is refused once the current slot is close (SLOT_CHANGE_LEAD_TIME
--     below, 1 hour), so panels are not reshuffled minutes before an interview.
--
-- Everything an applicant can reach still goes through SECURITY DEFINER functions:
-- interview_slots has no applicant UPDATE policy at all. The guard triggers are
-- widened below anyway, since they also fire inside those functions and are the
-- last line of defence if a direct UPDATE path is ever re-opened.
-- ==============================================================================


-- ==============================================================================
-- 1. Schema: the change counter and the shared limit
-- ==============================================================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS slot_changes_used INTEGER NOT NULL DEFAULT 0;

-- Existing rows predate the column; DEFAULT 0 covers them, but a NULL could still
-- arrive from a hand-written UPDATE, and NULL < 1 is NULL rather than true — which
-- would silently deny the change instead of allowing it.
UPDATE public.applications SET slot_changes_used = 0 WHERE slot_changes_used IS NULL;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_slot_changes_used_non_negative;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_slot_changes_used_non_negative
  CHECK (slot_changes_used >= 0);

-- How many times an applicant may move their slot. One place to change it: the
-- RLS policy, both guard triggers and reschedule_interview_slot() all read this.
CREATE OR REPLACE FUNCTION public.slot_change_limit()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 1 $$;

REVOKE ALL     ON FUNCTION public.slot_change_limit() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.slot_change_limit() TO authenticated;


-- ==============================================================================
-- 2. RLS: a rescheduling applicant must be able to see free slots again
-- ------------------------------------------------------------------------------
-- slots_select (migration_slot_booking_fixes.sql section 4) only showed free slots
-- to someone still 'shortlisted'. Once they book, their status is
-- 'interview_scheduled' and the free rows vanish — which is right for everyone who
-- has used up their change, and wrong for everyone who has not.
--
-- available_slot_times() is SECURITY INVOKER, so this policy is what decides
-- whether the calendar has anything in it.
-- ==============================================================================

DROP POLICY IF EXISTS "slots_select" ON public.interview_slots;

CREATE POLICY "slots_select"
ON public.interview_slots FOR SELECT
USING (
  is_any_admin()
  -- Their own booked slot, so the status page can show date/time/meeting link.
  OR EXISTS (
    SELECT 1 FROM public.applications a
     WHERE a.id = interview_slots.booked_by
       AND a.email = auth.email()
  )
  -- Free slots, for someone who has been sent the booking mail and not yet booked…
  OR (
    is_booked = false
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.email = auth.email()
         AND a.status = 'shortlisted'
         AND COALESCE(a.shortlist_notified, false) = true
    )
  )
  -- …or for someone already booked who still has a change left.
  OR (
    is_booked = false
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.email = auth.email()
         AND a.status = 'interview_scheduled'
         AND COALESCE(a.slot_changes_used, 0) < public.slot_change_limit()
    )
  )
);


-- ==============================================================================
-- 3. Guard triggers: allow releasing your own slot, and spending a change
-- ==============================================================================

-- guard_slot_booking_fn previously allowed exactly one transition: false -> true.
-- A reschedule also has to put a slot back, so true -> false is now allowed when
-- the row being freed is the caller's own booking and booked_by is cleared with it.
--
-- reminder_sent joins the writable column list: a freed slot must not carry the
-- previous occupant's "reminder already sent" flag into its next booking, or the
-- 15-minute cron would skip the new applicant.
CREATE OR REPLACE FUNCTION public.guard_slot_booking_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changed_col TEXT;
  was_booked  BOOLEAN;
  now_booked  BOOLEAN;
BEGIN
  -- Same bypass as tr_guard_applicant_update. Required here too: the 15-minute
  -- reminder cron writes reminder_sent on this table using the service_role key.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF is_any_admin() THEN
    RETURN NEW;
  END IF;

  -- is_booked is nullable, and NULL would fall through every branch below.
  was_booked := COALESCE(OLD.is_booked, false);
  now_booked := COALESCE(NEW.is_booked, false);

  IF was_booked = false AND now_booked = true THEN
    -- Claiming a free slot.
    IF NOT EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = NEW.booked_by AND a.email = auth.email()
    ) THEN
      RAISE EXCEPTION 'You may only book a slot for your own application.';
    END IF;

  ELSIF was_booked = true AND now_booked = false THEN
    -- Releasing a slot, which only happens as the first half of a reschedule.
    IF NEW.booked_by IS NOT NULL THEN
      RAISE EXCEPTION 'A released slot must not stay assigned to an application.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = OLD.booked_by AND a.email = auth.email()
    ) THEN
      RAISE EXCEPTION 'You may only release your own slot.';
    END IF;

  ELSE
    RAISE EXCEPTION 'Applicants may only book a free slot or release their own.';
  END IF;

  -- RLS cannot restrict WHICH columns an UPDATE touches, so without this whitelist
  -- the transitions above would also let an applicant rewrite start_time or
  -- meeting_link on the row they are booking.
  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    IF changed_col NOT IN ('is_booked', 'booked_by', 'reminder_sent') THEN
      RAISE EXCEPTION 'Applicants may not modify interview_slots.%', changed_col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_slot_booking ON public.interview_slots;
CREATE TRIGGER tr_guard_slot_booking
  BEFORE UPDATE ON public.interview_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_slot_booking_fn();


-- guard_applicant_update_fn gains one carve-out: spending a slot change. The
-- status does not move during a reschedule (interview_scheduled either side), so
-- the existing is_slot_booking exemptions do not cover it — neither the
-- recruitment-window check nor the column whitelist.
--
-- The counter may only ever go UP, by exactly one. That is what makes the
-- carve-out safe to expose through the plain applications UPDATE policy: a direct
-- call can spend an applicant's own quota but never restore it.
CREATE OR REPLACE FUNCTION public.guard_applicant_update_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  allowed_cols TEXT[] := ARRAY[
    'full_name', 'phone', 'roll_number',
    'primary_dept', 'domains', 'skills', 'reason',
    'secondary_dept', 'secondary_domains', 'secondary_skills', 'secondary_reason',
    'department', 'year',
    'admission_year', 'program_code', 'program_name', 'batch', 'program_category',
    'notes',
    'github_url', 'linkedin_url', 'portfolio_url',
    'resume_url', 'resume_filename', 'resume_uploaded_at', 'parsed_skills',
    'updated_at'
  ];
  changed_col        TEXT;
  is_slot_booking    BOOLEAN;
  is_slot_reschedule BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF is_any_admin() THEN
    RETURN NEW;
  END IF;

  -- COALESCE, not a bare comparison: a NULL status would make this NULL, and
  -- "IF NOT NULL" is not true — the closed check below would silently not fire.
  is_slot_booking := COALESCE(OLD.status = 'shortlisted' AND NEW.status = 'interview_scheduled', false);

  is_slot_reschedule := COALESCE(
    OLD.status = 'interview_scheduled'
    AND NEW.status = 'interview_scheduled'
    AND NEW.slot_changes_used = COALESCE(OLD.slot_changes_used, 0) + 1
    AND NEW.slot_changes_used <= public.slot_change_limit(),
    false);

  -- Once the window has shut, the only applicant-side writes left are booking a
  -- slot and moving that booking once.
  IF NOT is_slot_booking AND NOT is_slot_reschedule AND NOT public.is_recruitment_open() THEN
    RAISE EXCEPTION 'RECRUITMENT_CLOSED: applications are closed and can no longer be edited.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_slot_booking THEN
    RAISE EXCEPTION 'Applicants may not change application status (% -> %).',
      OLD.status, NEW.status;
  END IF;

  -- Outside a reschedule the counter is off limits entirely, in both directions.
  IF NEW.slot_changes_used IS DISTINCT FROM OLD.slot_changes_used AND NOT is_slot_reschedule THEN
    RAISE EXCEPTION 'Applicants may not change how many slot changes they have used.';
  END IF;

  FOR changed_col IN
    SELECT COALESCE(n.key, o.key)
    FROM jsonb_each(to_jsonb(NEW)) n
    FULL JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    CONTINUE WHEN changed_col = 'status';
    CONTINUE WHEN changed_col = 'shortlisted_at'
                  AND NEW.status = 'interview_scheduled';
    CONTINUE WHEN changed_col = 'slot_changes_used' AND is_slot_reschedule;

    IF NOT (changed_col = ANY (allowed_cols)) THEN
      RAISE EXCEPTION 'Applicants may not modify column "%".', changed_col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_applicant_update ON public.applications;
CREATE TRIGGER tr_guard_applicant_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_applicant_update_fn();


-- ==============================================================================
-- 4. Booking: clear reminder_sent when a recycled slot is claimed
-- ------------------------------------------------------------------------------
-- Identical to the version in migration_slot_booking_fixes.sql apart from that one
-- column. Before reschedules existed a slot was only ever booked once, so a stale
-- reminder_sent was impossible; now a freed slot can be claimed by someone else.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.book_interview_slot(p_start_time TIMESTAMPTZ)
RETURNS TABLE (
  slot_id    UUID,
  panel_id   INTEGER,
  start_time TIMESTAMPTZ,
  end_time   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app  public.applications%ROWTYPE;
  v_slot public.interview_slots%ROWTYPE;
BEGIN
  IF auth.email() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a slot.'
      USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_app
    FROM public.applications a
   WHERE a.email = auth.email()
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No application found for this account.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_app.status = 'interview_scheduled'
     OR EXISTS (SELECT 1 FROM public.interview_slots s WHERE s.booked_by = v_app.id) THEN
    RAISE EXCEPTION 'You have already booked an interview slot.'
      USING ERRCODE = '23505';
  END IF;

  IF v_app.status <> 'shortlisted'
     OR COALESCE(v_app.shortlist_notified, false) = false THEN
    RAISE EXCEPTION 'You are not eligible to book an interview slot yet.'
      USING ERRCODE = '42501';
  END IF;

  IF p_start_time IS NULL OR p_start_time <= now() THEN
    RAISE EXCEPTION 'That slot time has already passed. Pick an upcoming one.'
      USING ERRCODE = '22007';
  END IF;

  SELECT * INTO v_slot
    FROM public.interview_slots s
   WHERE s.start_time = p_start_time
     AND s.is_booked = false
   ORDER BY s.panel_id
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That time is now fully booked. Please choose another.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.interview_slots s
     SET is_booked     = true,
         booked_by     = v_app.id,
         reminder_sent = false
   WHERE s.id = v_slot.id;

  UPDATE public.applications a
     SET status         = 'interview_scheduled',
         shortlisted_at = COALESCE(a.shortlisted_at, now())
   WHERE a.id = v_app.id;

  RETURN QUERY
    SELECT v_slot.id, v_slot.panel_id, v_slot.start_time, v_slot.end_time;
END;
$$;

REVOKE ALL     ON FUNCTION public.book_interview_slot(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.book_interview_slot(TIMESTAMPTZ) TO authenticated;


-- ==============================================================================
-- 5. The one allowed change
-- ------------------------------------------------------------------------------
-- Frees the applicant's current slot and claims one at the new time in a single
-- transaction. Ordering matters twice over:
--
--   * The new slot is located and locked BEFORE the old one is released, so a
--     "that time is full" failure never leaves the applicant slotless — the
--     exception rolls the whole transaction back and their old slot is untouched.
--   * The release UPDATE still runs before the claim UPDATE, because
--     uq_interview_slots_booked_by would otherwise see the same application id on
--     two rows within the statement.
--
-- The applicant sends a time, never a slot id or panel number, exactly as in
-- book_interview_slot() — which panel they land on is decided here.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reschedule_interview_slot(p_start_time TIMESTAMPTZ)
RETURNS TABLE (
  slot_id           UUID,
  panel_id          INTEGER,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  previous_start    TIMESTAMPTZ,
  changes_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- How close to their interview an applicant may still move it. Short enough to
  -- be useful, long enough that an interviewer is not re-assigned mid-briefing.
  c_lead_time CONSTANT INTERVAL := INTERVAL '1 hour';
  v_app       public.applications%ROWTYPE;
  v_current   public.interview_slots%ROWTYPE;
  v_target    public.interview_slots%ROWTYPE;
  v_used      INTEGER;
BEGIN
  IF auth.email() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change your slot.'
      USING ERRCODE = '28000';
  END IF;

  -- FOR UPDATE, unlike the read in book_interview_slot(): the application row is
  -- where the change quota lives, so locking it here is what stops two racing
  -- calls (a double-click, two tabs) from each spending the same single change.
  -- The second one blocks, then re-reads a counter that is already at the limit.
  SELECT * INTO v_app
    FROM public.applications a
   WHERE a.email = auth.email()
   ORDER BY a.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No application found for this account.'
      USING ERRCODE = 'P0002';
  END IF;

  v_used := COALESCE(v_app.slot_changes_used, 0);

  IF v_used >= public.slot_change_limit() THEN
    RAISE EXCEPTION 'You have already changed your interview slot. Contact the SSCS team if you need another change.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
    FROM public.interview_slots s
   WHERE s.booked_by = v_app.id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not have an interview slot to change yet.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_current.start_time <= now() + c_lead_time THEN
    RAISE EXCEPTION 'Your interview is too close to be moved. Contact the SSCS team if you cannot attend.'
      USING ERRCODE = '22007';
  END IF;

  IF p_start_time IS NULL OR p_start_time <= now() THEN
    RAISE EXCEPTION 'That slot time has already passed. Pick an upcoming one.'
      USING ERRCODE = '22007';
  END IF;

  IF p_start_time = v_current.start_time THEN
    RAISE EXCEPTION 'That is already your interview time. Pick a different one.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_target
    FROM public.interview_slots s
   WHERE s.start_time = p_start_time
     AND s.is_booked = false
   ORDER BY s.panel_id
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That time is now fully booked. Please choose another.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.interview_slots s
     SET is_booked     = false,
         booked_by     = NULL,
         reminder_sent = false
   WHERE s.id = v_current.id;

  UPDATE public.interview_slots s
     SET is_booked     = true,
         booked_by     = v_app.id,
         reminder_sent = false
   WHERE s.id = v_target.id;

  UPDATE public.applications a
     SET slot_changes_used = v_used + 1
   WHERE a.id = v_app.id;

  RETURN QUERY
    SELECT v_target.id,
           v_target.panel_id,
           v_target.start_time,
           v_target.end_time,
           v_current.start_time,
           public.slot_change_limit() - (v_used + 1);
END;
$$;

REVOKE ALL     ON FUNCTION public.reschedule_interview_slot(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reschedule_interview_slot(TIMESTAMPTZ) TO authenticated;
