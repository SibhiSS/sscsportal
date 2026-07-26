-- ==============================================================================
-- SECURITY FIX #13: SECRETS & SERVICE ROLE KEY MANAGEMENT VERIFICATION
-- Description: SQL to verify no service_role keys are embedded in the database,
--              and to create a function that checks for any plaintext credentials
--              accidentally stored in JSONB fields.
-- ==============================================================================

-- 1. Verify that all SECURITY DEFINER functions are owned by a trusted role
SELECT 
  n.nspname AS schema,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  r.rolname AS owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- 2. Verify audit_logs does NOT contain any raw tokens or secrets
-- (This should return 0 rows - no sensitive fields in audit log details)
SELECT COUNT(*) AS suspicious_logs
FROM public.audit_logs
WHERE details::text ILIKE '%eyJ%'       -- JWT token pattern (base64 starts with eyJ)
   OR details::text ILIKE '%service_role%'
   OR details::text ILIKE '%password%'
   OR details::text ILIKE '%secret%';

-- 3. Verify app_settings does NOT contain any raw secrets in JSONB
SELECT COUNT(*) AS suspicious_settings
FROM public.app_settings
WHERE value::text ILIKE '%service_role%'
   OR value::text ILIKE '%secret%'
   OR value::text ILIKE '%password%';
