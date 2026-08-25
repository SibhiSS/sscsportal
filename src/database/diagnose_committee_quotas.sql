-- DIAGNOSTIC: why does the Committee board say seat quotas could not be loaded?
--
-- Run this in the Supabase SQL Editor AFTER running migration_committee_quotas.sql.
-- Each block prints a verdict. Run them one at a time and read the verdict column.

-- 1. Does the table exist at all?
--    "MISSING" here means the migration rolled back — almost always because
--    CREATE POLICY referenced an is_any_admin() that does not exist. Re-run the
--    current migration_committee_quotas.sql, which defines it when absent.
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'committee_quotas'
) THEN 'OK — table exists' ELSE 'MISSING — migration did not commit' END AS verdict;

-- 2. Does the admin predicate exist?
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'is_any_admin' AND n.nspname = 'public'
) THEN 'OK — is_any_admin() exists' ELSE 'MISSING — policies referencing it will fail' END AS verdict;

-- 3. Are the rows seeded?
SELECT department, seats FROM public.committee_quotas ORDER BY department;

-- 4. Is RLS on, and is the policy attached?
SELECT c.relrowsecurity AS rls_enabled, p.polname AS policy_name
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname = 'committee_quotas';

-- 5. THE IMPORTANT ONE — does the signed-in admin actually pass the check?
--    Run this from the SQL Editor and it reports on the postgres role, which is
--    not what the browser uses. To test as your real user, open the portal while
--    signed in as an admin and run this in the browser console instead:
--
--      const { data, error } = await window.supabase
--        .from('committee_quotas').select('*');
--      console.log({ data, error });
--
--    error.code meanings:
--      PGRST205  → table not in PostgREST's schema cache. Run:
--                  NOTIFY pgrst, 'reload schema';   (or wait ~1 minute)
--      42501     → RLS denied you. Your email is not in public.admins,
--                  or it is stored with different casing. Check block 6.
--      42P01     → the table really does not exist. Go back to block 1.
SELECT auth.email() AS current_email, public.is_any_admin() AS passes_admin_check;

-- 6. Is your admin row present and lowercased? Google OAuth always returns a
--    lowercased email; a row typed as "John.Doe@..." will not match a byte-exact
--    comparison. migration_normalize_admin_email_case.sql fixes this permanently.
SELECT email, role, email = lower(trim(email)) AS is_normalized
FROM public.admins ORDER BY email;
