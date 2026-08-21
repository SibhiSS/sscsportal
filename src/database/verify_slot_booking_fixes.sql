-- ==============================================================================
-- Verification for migration_slot_booking_fixes.sql
-- Paste into the Supabase SQL Editor. Every row must read PASS.
-- Read-only — this changes nothing.
-- ==============================================================================

WITH checks AS (
  SELECT '1. panel cap replaced with panel_id >= 1' AS check_name,
         EXISTS (
           SELECT 1 FROM pg_constraint c
             JOIN pg_class t     ON t.oid = c.conrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'interview_slots'
              AND c.conname = 'interview_slots_panel_id_positive'
         ) AS ok

  UNION ALL
  SELECT '2. old 3-panel CHECK is gone',
         NOT EXISTS (
           SELECT 1 FROM pg_constraint c
             JOIN pg_class t     ON t.oid = c.conrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'interview_slots'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) ILIKE '%ARRAY[1, 2, 3]%'
         )

  UNION ALL
  SELECT '3. one-slot-per-applicant unique index',
         EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public'
                    AND indexname  = 'uq_interview_slots_booked_by')

  UNION ALL
  SELECT '4. (panel_id, start_time) unique index — makes generation idempotent',
         EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public'
                    AND indexname  = 'uq_interview_slots_panel_start')

  UNION ALL
  SELECT '5. no blanket USING(true) policy survives on interview_slots',
         NOT EXISTS (SELECT 1 FROM pg_policies
                      WHERE schemaname = 'public'
                        AND tablename  = 'interview_slots'
                        AND qual       = 'true')

  UNION ALL
  SELECT '6. slots_book dropped — applicants cannot UPDATE slots directly',
         NOT EXISTS (SELECT 1 FROM pg_policies
                      WHERE schemaname = 'public'
                        AND tablename  = 'interview_slots'
                        AND policyname = 'slots_book')

  UNION ALL
  SELECT '7. slots_select gates free slots on shortlist_notified',
         EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public'
                    AND tablename  = 'interview_slots'
                    AND policyname = 'slots_select'
                    AND qual ILIKE '%shortlist_notified%')

  UNION ALL
  SELECT '8. book_interview_slot is SECURITY DEFINER',
         EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public'
                    AND p.proname = 'book_interview_slot'
                    AND p.prosecdef)

  UNION ALL
  SELECT '9. available_slot_times is SECURITY INVOKER (so RLS still applies)',
         EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public'
                    AND p.proname = 'available_slot_times'
                    AND NOT p.prosecdef)

  UNION ALL
  SELECT '10. applications.shortlist_notified exists',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name   = 'applications'
                    AND column_name  = 'shortlist_notified')

  UNION ALL
  SELECT '11. booking triggers still attached',
         (SELECT count(*) FROM pg_trigger
           WHERE NOT tgisinternal
             AND tgname IN ('tr_guard_slot_booking', 'tr_guard_applicant_update')) = 2
)
SELECT CASE WHEN ok THEN 'PASS' ELSE '>>> FAIL <<<' END AS status,
       check_name
  FROM checks
 ORDER BY check_name;


-- ==============================================================================
-- Current slot capacity, the way the applicant page computes it.
-- seats_remaining is the panel countdown (4 -> 3 -> 2 -> 1); a time that hits 0
-- stops appearing here at all, which is what closes it on the booking page.
-- ==============================================================================

SELECT s.start_time,
       count(*) FILTER (WHERE NOT s.is_booked) AS seats_remaining,
       count(*)                                AS panels_total
  FROM public.interview_slots s
 WHERE s.start_time > now()
 GROUP BY s.start_time
 ORDER BY s.start_time
 LIMIT 30;
