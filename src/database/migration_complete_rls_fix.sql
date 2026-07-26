-- COMPLETE RLS LOCKDOWN & SEED SCRIPT (9 TABLES)
-- Run this in your Supabase SQL Editor to secure all tables and seed app_settings.

-- ============================================
-- STEP 1: Helper Functions (SECURITY DEFINER)
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
-- STEP 2: Seed APP_SETTINGS (Fixes 0 rows issue)
-- ============================================
INSERT INTO public.app_settings (key, value)
VALUES ('recruitment_status', '{"isOpen": true, "message": "Recruitment is currently open."}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================
-- STEP 3: Secure ADMINS Table
-- ============================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.admins;
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admins;
DROP POLICY IF EXISTS "Admins can read all admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can read admins" ON public.admins;
DROP POLICY IF EXISTS "Super admins can insert admins" ON public.admins;
DROP POLICY IF EXISTS "Super admins can update admins" ON public.admins;
DROP POLICY IF EXISTS "Super admins can delete admins" ON public.admins;
DROP POLICY IF EXISTS "admins_select_own" ON public.admins;
DROP POLICY IF EXISTS "admins_select_all" ON public.admins;
DROP POLICY IF EXISTS "admins_manage" ON public.admins;
DROP POLICY IF EXISTS "admins_insert" ON public.admins;
DROP POLICY IF EXISTS "admins_update" ON public.admins;
DROP POLICY IF EXISTS "admins_delete" ON public.admins;

CREATE POLICY "admins_select_own" ON public.admins FOR SELECT USING (auth.email() = email);
CREATE POLICY "admins_select_all" ON public.admins FOR SELECT USING (is_super_admin());
CREATE POLICY "admins_manage" ON public.admins FOR ALL USING (is_super_admin());

-- ============================================
-- STEP 4: Secure APP_SETTINGS Table
-- ============================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Super admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Super admins can delete app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_manage" ON public.app_settings;

CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_manage" ON public.app_settings FOR ALL USING (is_admin_or_super());

-- ============================================
-- STEP 5: Secure APPLICATIONS Table
-- ============================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.applications;
DROP POLICY IF EXISTS "applications_update" ON public.applications;
DROP POLICY IF EXISTS "applications_select_own" ON public.applications;
DROP POLICY IF EXISTS "applications_select_admin" ON public.applications;
DROP POLICY IF EXISTS "applications_insert" ON public.applications;
DROP POLICY IF EXISTS "applications_delete" ON public.applications;
DROP POLICY IF EXISTS "Users can read own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can read own application" ON public.applications;
DROP POLICY IF EXISTS "Admins can read all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
DROP POLICY IF EXISTS "Super admins can delete applications" ON public.applications;
DROP POLICY IF EXISTS "Authenticated users can submit applications" ON public.applications;

CREATE POLICY "applications_select_own" ON public.applications FOR SELECT USING (auth.email() = email);
CREATE POLICY "applications_select_admin" ON public.applications FOR SELECT USING (is_any_admin());
CREATE POLICY "applications_insert" ON public.applications FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.email() = email);
CREATE POLICY "applications_update" ON public.applications FOR UPDATE USING (is_any_admin());
CREATE POLICY "applications_delete" ON public.applications FOR DELETE USING (is_super_admin());

-- ============================================
-- STEP 6: Secure AUDIT_LOGS Table
-- ============================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit_logs" ON public.audit_logs;

CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT USING (is_any_admin());
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (is_any_admin());

-- ============================================
-- STEP 7: Secure DEPARTMENT_WEIGHTS Table
-- ============================================
ALTER TABLE public.department_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.department_weights;
DROP POLICY IF EXISTS "weights_manage" ON public.department_weights;

CREATE POLICY "weights_manage" ON public.department_weights FOR ALL USING (is_any_admin());

-- ============================================
-- STEP 8: Secure INTERVIEW_FEEDBACK Table
-- ============================================
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_delete" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_insert" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_select" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_update" ON public.interview_feedback;
DROP POLICY IF EXISTS "feedback_manage" ON public.interview_feedback;

CREATE POLICY "feedback_manage" ON public.interview_feedback FOR ALL USING (is_any_admin());

-- ============================================
-- STEP 9: Secure INTERVIEW_SLOTS Table
-- ============================================
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_all" ON public.interview_slots;
DROP POLICY IF EXISTS "slots_select" ON public.interview_slots;
DROP POLICY IF EXISTS "slots_manage" ON public.interview_slots;

CREATE POLICY "slots_select" ON public.interview_slots FOR SELECT USING (auth.role() = 'authenticated' OR is_any_admin());
CREATE POLICY "slots_manage" ON public.interview_slots FOR ALL USING (is_any_admin());

-- ============================================
-- STEP 10: Secure PANEL_ASSIGNMENTS Table
-- ============================================
ALTER TABLE public.panel_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.panel_assignments;
DROP POLICY IF EXISTS "panels_manage" ON public.panel_assignments;

CREATE POLICY "panels_manage" ON public.panel_assignments FOR ALL USING (is_any_admin());

-- ============================================
-- STEP 11: Secure PANEL_METADATA Table
-- ============================================
ALTER TABLE public.panel_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.panel_metadata;
DROP POLICY IF EXISTS "panel_meta_manage" ON public.panel_metadata;

CREATE POLICY "panel_meta_manage" ON public.panel_metadata FOR ALL USING (is_any_admin());

-- ============================================
-- FINISHED! All 9 tables are secured and seeded.
-- ============================================
