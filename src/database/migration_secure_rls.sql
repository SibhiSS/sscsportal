-- SECURITY FIX: Proper Row Level Security Policies
-- Run this in your Supabase SQL Editor
-- This replaces the "Allow All Access" policies with proper security

-- ============================================
-- STEP 1: Drop the insecure "Allow All" policies
-- ============================================
DROP POLICY IF EXISTS "Allow All Access" ON public.app_settings;
DROP POLICY IF EXISTS "Allow All Access" ON public.admins;
DROP POLICY IF EXISTS "Allow All Access" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow All Access" ON public.interviews;
DROP POLICY IF EXISTS "Allow All Access" ON public.applications;

-- ============================================
-- STEP 2: Create secure policies for APP_SETTINGS
-- ============================================
-- Everyone can READ settings (needed for "is recruitment open?" check)
CREATE POLICY "Public can read app_settings"
ON public.app_settings FOR SELECT
USING (true);

-- Only admins can UPDATE settings
CREATE POLICY "Admins can update app_settings"
ON public.app_settings FOR UPDATE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role IN ('super_admin', 'admin'))
);

-- Only super_admins can INSERT/DELETE settings
CREATE POLICY "Super admins can insert app_settings"
ON public.app_settings FOR INSERT
WITH CHECK (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

CREATE POLICY "Super admins can delete app_settings"
ON public.app_settings FOR DELETE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

-- ============================================
-- STEP 3: Create secure policies for ADMINS table
-- ============================================
-- Only admins can read the admin list
CREATE POLICY "Admins can read admins"
ON public.admins FOR SELECT
USING (
  auth.email() IN (SELECT email FROM public.admins)
);

-- Only super_admins can manage admins
CREATE POLICY "Super admins can insert admins"
ON public.admins FOR INSERT
WITH CHECK (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

CREATE POLICY "Super admins can update admins"
ON public.admins FOR UPDATE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

CREATE POLICY "Super admins can delete admins"
ON public.admins FOR DELETE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

-- ============================================
-- STEP 4: Create secure policies for APPLICATIONS
-- ============================================
-- Public can submit applications (INSERT)
CREATE POLICY "Authenticated users can submit applications"
ON public.applications FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND auth.email() = email
);

-- Users can only read their own applications
CREATE POLICY "Users can read own applications"
ON public.applications FOR SELECT
USING (
  auth.email() = email OR 
  auth.email() IN (SELECT email FROM public.admins)
);

-- Only admins can update applications
CREATE POLICY "Admins can update applications"
ON public.applications FOR UPDATE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role IN ('super_admin', 'admin'))
);

-- Only super_admins can delete applications
CREATE POLICY "Super admins can delete applications"
ON public.applications FOR DELETE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

-- ============================================
-- STEP 5: Create secure policies for AUDIT_LOGS
-- ============================================
-- Only admins can read audit logs
CREATE POLICY "Admins can read audit_logs"
ON public.audit_logs FOR SELECT
USING (
  auth.email() IN (SELECT email FROM public.admins)
);

-- Only authenticated admins can create audit logs
CREATE POLICY "Admins can insert audit_logs"
ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.email() IN (SELECT email FROM public.admins)
);

-- No one can update or delete audit logs (immutable)
-- (no policies for UPDATE/DELETE = denied)

-- ============================================
-- STEP 6: Create secure policies for INTERVIEWS
-- ============================================
-- Admins and interviewers can read interviews
CREATE POLICY "Admins can read interviews"
ON public.interviews FOR SELECT
USING (
  auth.email() IN (SELECT email FROM public.admins)
);

-- Applicants can read their own interview
CREATE POLICY "Applicants can read own interview"
ON public.interviews FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.applications a 
    WHERE a.id = application_id AND a.email = auth.email()
  )
);

-- Only admins can manage interviews
CREATE POLICY "Admins can insert interviews"
ON public.interviews FOR INSERT
WITH CHECK (
  auth.email() IN (SELECT email FROM public.admins WHERE role IN ('super_admin', 'admin', 'interviewer'))
);

CREATE POLICY "Admins can update interviews"
ON public.interviews FOR UPDATE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role IN ('super_admin', 'admin', 'interviewer'))
);

CREATE POLICY "Super admins can delete interviews"
ON public.interviews FOR DELETE
USING (
  auth.email() IN (SELECT email FROM public.admins WHERE role = 'super_admin')
);

-- ============================================
-- NOTE: Make sure RLS is enabled on applications table too
-- ============================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
