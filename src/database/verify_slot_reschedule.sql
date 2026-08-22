-- ==============================================================================
-- Verification for migration_slot_reschedule.sql
-- Paste into the Supabase SQL Editor. Every row must read PASS.
-- Read-only — this changes nothing.
-- ==============================================================================

WITH checks AS (
  SELECT '1. applications.slot_changes_used exists' AS check_name,
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name   = 'applications'
                    AND column_name  = 'slot_changes_used') AS ok

  UNION ALL
  SELECT '2. slot_changes_used cannot go negative',
         EXISTS (SELECT 1 FROM pg_constraint c
                   JOIN pg_class t     ON t.oid = c.conrelid
                   JOIN pg_namespace n ON n.oid = t.relnamespace
                  WHERE n.nspname = 'public'
                    AND t.relname = 'applications'
                    AND c.conname = 'applications_slot_changes_used_non_negative')

  UNION ALL
  SELECT '3. slot_change_limit() exists and is 1',
         COALESCE((SELECT public.slot_change_limit()), 0) = 1

  UNION ALL
  SELECT '4. reschedule_interview_slot() exists',
         EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public'
                    AND p.proname = 'reschedule_interview_slot')

  UNION ALL
  SELECT '5. reschedule_interview_slot() is SECURITY DEFINER',
         (SELECT bool_and(p.prosecdef) FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
             AND p.proname = 'reschedule_interview_slot')

  UNION ALL
  SELECT '6. anon cannot call reschedule_interview_slot()',
         NOT has_function_privilege('anon',
           'public.reschedule_interview_slot(timestamptz)', 'EXECUTE')

  UNION ALL
  SELECT '7. authenticated can call reschedule_interview_slot()',
         has_function_privilege('authenticated',
           'public.reschedule_interview_slot(timestamptz)', 'EXECUTE')

  UNION ALL
  SELECT '8. slots_select lets a rescheduling applicant see free slots',
         EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public'
                    AND tablename  = 'interview_slots'
                    AND policyname = 'slots_select'
                    AND qual ILIKE '%slot_changes_used%')

  UNION ALL
  SELECT '9. booking still has no direct applicant UPDATE policy',
         NOT EXISTS (SELECT 1 FROM pg_policies
                      WHERE schemaname = 'public'
                        AND tablename  = 'interview_slots'
                        AND policyname = 'slots_book')

  UNION ALL
  SELECT '10. guard triggers still attached',
         (SELECT count(*) FROM pg_trigger
           WHERE NOT tgisinternal
             AND tgname IN ('tr_guard_slot_booking', 'tr_guard_applicant_update')) = 2

  UNION ALL
  SELECT '11. slot guard allows a release, not just a claim',
         (SELECT prosrc ILIKE '%release your own slot%'
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'guard_slot_booking_fn')

  UNION ALL
  SELECT '12. no applicant holds more than one slot',
         NOT EXISTS (SELECT 1 FROM public.interview_slots
                      WHERE booked_by IS NOT NULL
                      GROUP BY booked_by HAVING count(*) > 1)

  UNION ALL
  SELECT '13. nobody has spent more changes than the limit',
         NOT EXISTS (SELECT 1 FROM public.applications
                      WHERE COALESCE(slot_changes_used, 0) > public.slot_change_limit())
)
SELECT CASE WHEN ok THEN 'PASS' ELSE '>>> FAIL <<<' END AS status,
       check_name
  FROM checks
 ORDER BY check_name;


-- ==============================================================================
-- Who has moved their slot, and who still can.
-- ==============================================================================

SELECT a.full_name,
       a.email,
       COALESCE(a.slot_changes_used, 0) AS changes_used,
       public.slot_change_limit() - COALESCE(a.slot_changes_used, 0) AS changes_left,
       s.start_time AS current_slot
  FROM public.applications a
  LEFT JOIN public.interview_slots s ON s.booked_by = a.id
 WHERE a.status = 'interview_scheduled'
 ORDER BY s.start_time NULLS LAST
 LIMIT 50;
