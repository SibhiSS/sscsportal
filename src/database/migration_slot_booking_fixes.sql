-- ==============================================================================
-- Slot booking: capacity, eligibility, and race-condition fixes
-- Run this in the Supabase SQL Editor. It is idempotent — re-running is safe.
-- ==============================================================================
--
-- What this fixes:
--
--   1. panel_id was capped at 3 by a CHECK constraint, so generating 4+ panels
--      failed the insert outright.
--   2. Nothing stopped the same applicant booking two slots — the "already
--      booked?" test lived in the browser as a SELECT followed by an UPDATE.
--   3. Nothing stopped a non-shortlisted (or not-yet-emailed) applicant from
--      calling the booking UPDATE directly: the RLS policy only checked that
--      the caller was authenticated.
--   4. Re-running the slot generator silently duplicated every slot row, which
--      inflated a time's real panel capacity.
--   5. Booking was two separate writes from the browser (claim the slot, then
--      move the application to interview_scheduled). If the second one failed
--      the slot was consumed with nobody scheduled against it.
--
-- ==============================================================================


-- ==============================================================================
-- 1. Schema: lift the 3-panel cap, guarantee end_time exists
-- ------------------------------------------------------------------------------
-- migration_interview_slots.sql declared `CHECK (panel_id IN (1, 2, 3))`, which
-- Postgres auto-named. The name is found dynamically so this works regardless of
-- which of the two historical table definitions the live database was built from.
-- ==============================================================================

DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'interview_slots'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%panel_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.interview_slots DROP CONSTRAINT %I', con_name);
    RAISE NOTICE 'Dropped panel_id check constraint: %', con_name;
  END LOOP;
END $$;

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

-- Both are relied on by the policy and the function below. They are normally
-- created by migration_notify_shortlist.sql / migration_phase*.sql, but this
-- migration should not fail on a database where those were skipped.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS shortlist_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS shortlisted_at TIMESTAMP WITH TIME ZONE;

-- Any positive panel number is now allowed.
ALTER TABLE public.interview_slots
  DROP CONSTRAINT IF EXISTS interview_slots_panel_id_positive;
ALTER TABLE public.interview_slots
  ADD CONSTRAINT interview_slots_panel_id_positive CHECK (panel_id >= 1);


-- ==============================================================================
-- 2. Pre-flight: refuse to continue on data that the new indexes would reject
-- ------------------------------------------------------------------------------
-- Both indexes below are UNIQUE. If existing rows already violate them the
-- CREATE would fail with a generic "could not create unique index" that does not
-- say which rows are at fault. These checks fail early with something actionable
-- instead. Nothing is deleted automatically — duplicated bookings are a decision
-- for a human.
-- ==============================================================================

DO $$
DECLARE
  dupe_count INTEGER;
  detail     TEXT;
BEGIN
  SELECT count(*), string_agg(booked_by::TEXT, ', ')
    INTO dupe_count, detail
    FROM (
      SELECT booked_by
        FROM public.interview_slots
       WHERE booked_by IS NOT NULL
       GROUP BY booked_by
      HAVING count(*) > 1
    ) d;

  IF COALESCE(dupe_count, 0) > 0 THEN
    RAISE EXCEPTION
      'Cannot add the one-slot-per-applicant index: % application(s) already hold more than one slot (application ids: %). Free the extra slots in the admin Scheduler tab, then re-run this migration.',
      dupe_count, detail;
  END IF;
END $$;

DO $$
DECLARE
  dupe_count INTEGER;
BEGIN
  SELECT count(*)
    INTO dupe_count
    FROM (
      SELECT panel_id, start_time
        FROM public.interview_slots
       GROUP BY panel_id, start_time
      HAVING count(*) > 1
    ) d;

  IF COALESCE(dupe_count, 0) > 0 THEN
    RAISE EXCEPTION
      'Cannot add the (panel_id, start_time) index: % duplicated slot(s) exist, almost certainly from running the slot generator twice for the same date. These inflate a time''s real capacity. Use "Clear All Slots" in the Scheduler tab (or delete the duplicates by hand) and re-run this migration.',
      dupe_count;
  END IF;
END $$;


-- ==============================================================================
-- 3. Constraints that make the booking rules real rather than advisory
-- ==============================================================================

-- One applicant may hold at most one slot. Freed slots set booked_by = NULL, and
-- a partial index lets any number of rows sit at NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_slots_booked_by
  ON public.interview_slots (booked_by)
  WHERE booked_by IS NOT NULL;

-- One row per panel per start time. This is what makes the generator idempotent:
-- re-running it for a date it already covers now conflicts instead of doubling
-- that time's capacity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_slots_panel_start
  ON public.interview_slots (panel_id, start_time);

-- Supports the capacity lookup in book_interview_slot() below.
CREATE INDEX IF NOT EXISTS idx_interview_slots_start_free
  ON public.interview_slots (start_time)
  WHERE is_booked = false;


-- ==============================================================================
-- 4. RLS: only a shortlisted AND emailed applicant may browse free slots
-- ------------------------------------------------------------------------------
-- Shortlisting is meant to be invisible to the applicant until the booking email
-- goes out — `shortlist_notified` is the flag that email sets. Gating SELECT on
-- it means an applicant who has been shortlisted but not yet emailed cannot see
-- the slot list even by calling the API directly.
--
-- The legacy blanket policies are dropped first. Permissive policies OR together,
-- so a single surviving `USING (true)` would defeat everything below it.
-- ==============================================================================

DROP POLICY IF EXISTS "Allow All Access"        ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_all"     ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_update"  ON public.interview_slots;
DROP POLICY IF EXISTS "slots_select"            ON public.interview_slots;

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
  -- Free slots, but only for someone who has actually been sent the booking mail.
  OR (
    is_booked = false
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.email = auth.email()
         AND a.status = 'shortlisted'
         AND COALESCE(a.shortlist_notified, false) = true
    )
  )
);

-- Booking now goes through book_interview_slot() (section 5), which is
-- SECURITY DEFINER and therefore does not need a direct UPDATE policy for
-- applicants. Dropping "slots_book" closes the direct-UPDATE path entirely;
-- "slots_manage" (admins) is left alone so the Scheduler tab keeps working.
DROP POLICY IF EXISTS "slots_book" ON public.interview_slots;

DROP POLICY IF EXISTS "slots_manage" ON public.interview_slots;
CREATE POLICY "slots_manage" ON public.interview_slots FOR ALL USING (is_any_admin());

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 5. Atomic booking
-- ------------------------------------------------------------------------------
-- The applicant sends a TIME, never a slot id or a panel number. The server picks
-- a free panel for that time, claims it, and moves the application to
-- interview_scheduled — all in one transaction.
--
-- Why this shape:
--
--   * The panel is chosen server-side, so the panel number never has to reach the
--     browser for the booking to work. Applicants see times only.
--   * FOR UPDATE SKIP LOCKED is the standard queue-claim pattern. Two applicants
--     booking the same time concurrently each lock a different row rather than
--     colliding on one and having the loser retry.
--   * Slot claim and status change commit together. Previously they were two
--     round-trips from the browser and a failure between them left a slot booked
--     against an applicant still marked 'shortlisted'.
--
-- The existing tr_guard_slot_booking / tr_guard_applicant_update triggers still
-- fire on the writes below and still pass: is_booked goes false -> true, only
-- is_booked/booked_by change on the slot, and shortlisted -> interview_scheduled
-- is the exact carve-out those triggers already allow.
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

  -- Applications are inserted with `auth.email() = email` enforced by
  -- applications_insert, so an exact match is safe here — and it is the same
  -- comparison tr_guard_slot_booking makes, so the two cannot disagree.
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

  -- Same eligibility test as slots_select: shortlisted *and* actually emailed.
  IF v_app.status <> 'shortlisted'
     OR COALESCE(v_app.shortlist_notified, false) = false THEN
    RAISE EXCEPTION 'You are not eligible to book an interview slot yet.'
      USING ERRCODE = '42501';
  END IF;

  IF p_start_time IS NULL OR p_start_time <= now() THEN
    RAISE EXCEPTION 'That slot time has already passed. Pick an upcoming one.'
      USING ERRCODE = '22007';
  END IF;

  -- Claim the lowest-numbered panel still free at this time. SKIP LOCKED steps
  -- over rows a concurrent booking is mid-way through claiming.
  -- LIMIT before FOR UPDATE: that is the order the SELECT grammar documents. With
  -- SKIP LOCKED the skip happens before the limit is applied, so this returns the
  -- lowest-numbered panel that no concurrent booking is already holding.
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
     SET is_booked = true,
         booked_by = v_app.id
   WHERE s.id = v_slot.id;

  -- shortlisted_at records when they were shortlisted, not when they booked, so
  -- it is only filled in if it was never set.
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
-- 6. Remaining capacity per time, without exposing panels
-- ------------------------------------------------------------------------------
-- Collapses the per-panel rows into one row per start time, so panel_id never
-- reaches the browser at all — not in the UI and not in the network payload.
-- A time with no free panels produces no group, so it disappears on its own.
--
-- Deliberately SECURITY INVOKER (the default): it reads interview_slots as the
-- caller, so the slots_select policy from section 4 still applies. An applicant
-- who has not been sent the booking email sees no free rows and therefore gets an
-- empty result — the same answer the policy gives on a direct query.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.available_slot_times()
RETURNS TABLE (
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  seats_remaining BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT s.start_time,
         min(s.end_time) AS end_time,
         count(*)        AS seats_remaining
    FROM public.interview_slots s
   WHERE s.is_booked = false
     AND s.start_time > now()
   GROUP BY s.start_time
   ORDER BY s.start_time;
$$;

REVOKE ALL     ON FUNCTION public.available_slot_times() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.available_slot_times() TO authenticated;
