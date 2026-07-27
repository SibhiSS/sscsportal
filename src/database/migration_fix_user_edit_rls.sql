-- ==============================================================================
-- FIX: Allow users to update their own application (required for Edit flow)
-- ==============================================================================
-- The existing "applications_update" policy (from migration_final_rls_fix.sql)
-- only allows is_admin_or_above(). This means when isEditing=true and a user
-- calls supabase.from('applications').update(...).eq('id', existingApp.id),
-- Supabase rejects it with a 42501 RLS policy violation.
--
-- This migration adds a second UPDATE policy that allows a user to update
-- their OWN application row (identified by matching email).
-- ==============================================================================

-- Drop the old overly-restrictive single update policy
DROP POLICY IF EXISTS "applications_update" ON public.applications;

-- Re-create: admins can update any application
CREATE POLICY "applications_update_admin"
ON public.applications FOR UPDATE
USING (
  is_admin_or_above()
);

-- NEW: Authenticated users can update their own application
CREATE POLICY "applications_update_own"
ON public.applications FOR UPDATE
USING (
  auth.role() = 'authenticated' AND auth.email() = email
)
WITH CHECK (
  auth.role() = 'authenticated' AND auth.email() = email
);
