-- FINAL FIX: Working RLS Policies
-- Run this in your Supabase SQL Editor
-- This completely fixes the recursive dependency issue

-- ============================================
-- STEP 1: Create a SECURITY DEFINER function
-- This function runs with elevated privileges 
-- and can check admin status without RLS blocking
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE email = auth.email()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE email = auth.email() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE email = auth.email() AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 2: Drop ALL existing policies on applications
-- ============================================
DROP POLICY IF EXISTS "Users can read own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can read own application" ON public.applications;
DROP POLICY IF EXISTS "Admins can read all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
DROP POLICY IF EXISTS "Super admins can delete applications" ON public.applications;
DROP POLICY IF EXISTS "Authenticated users can submit applications" ON public.applications;
DROP POLICY IF EXISTS "Allow All Access" ON public.applications;

-- ============================================
-- STEP 3: Create NEW working policies using the helper functions
-- ============================================

-- SELECT: Users see their own, Admins see all
CREATE POLICY "applications_select_own"
ON public.applications FOR SELECT
USING (
  auth.email() = email
);

CREATE POLICY "applications_select_admin"
ON public.applications FOR SELECT
USING (
  is_admin()
);

-- INSERT: Authenticated users can apply
CREATE POLICY "applications_insert"
ON public.applications FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND auth.email() = email
);

-- UPDATE: Only admin or higher can update
CREATE POLICY "applications_update"
ON public.applications FOR UPDATE
USING (
  is_admin_or_above()
);

-- DELETE: Only super_admin can delete
CREATE POLICY "applications_delete"
ON public.applications FOR DELETE
USING (
  is_super_admin()
);

-- ============================================
-- STEP 4: Make sure RLS is enabled
-- ============================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFY: Check if policies are created
-- ============================================
-- Run this to verify:
-- SELECT * FROM pg_policies WHERE tablename = 'applications';
