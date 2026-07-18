-- COMPLETE RLS FIX - Run this in Supabase SQL Editor
-- Fixes ALL tables with proper working policies

-- ============================================
-- STEP 1: Create helper functions (SECURITY DEFINER)
-- These bypass RLS to check user status
-- ============================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.admins WHERE email = auth.email();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_any_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE email = auth.email());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE email = auth.email() AND role = 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE email = auth.email() AND role IN ('super_admin', 'admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 2: Fix ADMINS table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admins;
DROP POLICY IF EXISTS "Admins can read all admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can read admins" ON public.admins;
DROP POLICY IF EXISTS "Super admins can insert admins" ON public.admins;
DROP POLICY IF EXISTS "Super admins can update admins" ON public.admins;
DROP POLICY IF EXISTS "Super admins can delete admins" ON public.admins;
DROP POLICY IF EXISTS "Allow All Access" ON public.admins;

-- Anyone authenticated can check their own admin entry
CREATE POLICY "admins_select_own"
ON public.admins FOR SELECT
USING (auth.email() = email);

-- Super admins can see all admins
CREATE POLICY "admins_select_all"
ON public.admins FOR SELECT
USING (is_super_admin());

-- Only super admins can manage other admins
CREATE POLICY "admins_insert"
ON public.admins FOR INSERT
WITH CHECK (is_super_admin());

CREATE POLICY "admins_update"
ON public.admins FOR UPDATE
USING (is_super_admin());

CREATE POLICY "admins_delete"
ON public.admins FOR DELETE
USING (is_super_admin());

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Fix APPLICATIONS table RLS
-- ============================================
DROP POLICY IF EXISTS "applications_select_own" ON public.applications;
DROP POLICY IF EXISTS "applications_select_admin" ON public.applications;
DROP POLICY IF EXISTS "applications_insert" ON public.applications;
DROP POLICY IF EXISTS "applications_update" ON public.applications;
DROP POLICY IF EXISTS "applications_delete" ON public.applications;
DROP POLICY IF EXISTS "Users can read own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can read own application" ON public.applications;
DROP POLICY IF EXISTS "Admins can read all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
DROP POLICY IF EXISTS "Super admins can delete applications" ON public.applications;
DROP POLICY IF EXISTS "Authenticated users can submit applications" ON public.applications;
DROP POLICY IF EXISTS "Allow All Access" ON public.applications;

-- Users can see their own application
CREATE POLICY "applications_select_own"
ON public.applications FOR SELECT
USING (auth.email() = email);

-- Any admin role can see all applications
CREATE POLICY "applications_select_admin"
ON public.applications FOR SELECT
USING (is_any_admin());

-- Authenticated users can submit applications (their own email only)
CREATE POLICY "applications_insert"
ON public.applications FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND auth.email() = email);

-- Admin, super_admin, or interviewer can update
CREATE POLICY "applications_update"
ON public.applications FOR UPDATE
USING (is_any_admin());

-- Only super_admin can delete
CREATE POLICY "applications_delete"
ON public.applications FOR DELETE
USING (is_super_admin());

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Fix APP_SETTINGS table RLS
-- ============================================
DROP POLICY IF EXISTS "Public can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Super admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Super admins can delete app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow All Access" ON public.app_settings;

CREATE POLICY "app_settings_select"
ON public.app_settings FOR SELECT
USING (true); -- Public can read settings

CREATE POLICY "app_settings_update"
ON public.app_settings FOR UPDATE
USING (is_admin_or_super());

CREATE POLICY "app_settings_insert"
ON public.app_settings FOR INSERT
WITH CHECK (is_super_admin());

CREATE POLICY "app_settings_delete"
ON public.app_settings FOR DELETE
USING (is_super_admin());

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Fix AUDIT_LOGS table RLS
-- ============================================
DROP POLICY IF EXISTS "Admins can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow All Access" ON public.audit_logs;

CREATE POLICY "audit_logs_select"
ON public.audit_logs FOR SELECT
USING (is_any_admin());

CREATE POLICY "audit_logs_insert"
ON public.audit_logs FOR INSERT
WITH CHECK (is_any_admin());

-- No update/delete for audit logs (immutable)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Fix INTERVIEWS table RLS
-- ============================================
DROP POLICY IF EXISTS "Admins can read interviews" ON public.interviews;
DROP POLICY IF EXISTS "Applicants can read own interview" ON public.interviews;
DROP POLICY IF EXISTS "Admins can insert interviews" ON public.interviews;
DROP POLICY IF EXISTS "Admins can update interviews" ON public.interviews;
DROP POLICY IF EXISTS "Super admins can delete interviews" ON public.interviews;
DROP POLICY IF EXISTS "Allow All Access" ON public.interviews;

CREATE POLICY "interviews_select_admin"
ON public.interviews FOR SELECT
USING (is_any_admin());

CREATE POLICY "interviews_select_own"
ON public.interviews FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.applications a 
    WHERE a.id = application_id AND a.email = auth.email()
  )
);

CREATE POLICY "interviews_insert"
ON public.interviews FOR INSERT
WITH CHECK (is_any_admin());

CREATE POLICY "interviews_update"
ON public.interviews FOR UPDATE
USING (is_any_admin());

CREATE POLICY "interviews_delete"
ON public.interviews FOR DELETE
USING (is_super_admin());

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFY EVERYTHING
-- ============================================
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
