-- ==============================================================================
-- SECURITY FIX #2: AUTHORIZATION & IMMUTABLE DATABASE-BACKED AUDIT LOGS
-- Description: Enforces database-level audit logging via triggers so audit records
--              cannot be bypassed or forged by client-side requests.
-- Target Tables: applications, admins, audit_logs
-- ==============================================================================

-- 1. Ensure audit_logs table structure is complete and RLS enabled
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Make audit_logs IMMUTABLE (Only SELECT and INSERT permitted for admins; NO UPDATE/DELETE allowed)
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_select"
ON public.audit_logs FOR SELECT
USING (is_any_admin());

CREATE POLICY "audit_logs_insert"
ON public.audit_logs FOR INSERT
WITH CHECK (is_any_admin());

-- Notice: No UPDATE or DELETE policies are created for audit_logs.
-- In PostgreSQL RLS, missing UPDATE/DELETE policies means those operations are 100% BLOCKED.

-- 3. Automatic Trigger Function for Applications Changes
CREATE OR REPLACE FUNCTION public.audit_applications_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  current_actor TEXT;
BEGIN
  -- Get actor email from JWT session context, fallback to system/unknown
  current_actor := COALESCE(auth.email(), 'system@sscs');

  IF TG_OP = 'UPDATE' THEN
    -- Only log if meaningful status, score, or rating changes
    IF OLD.status IS DISTINCT FROM NEW.status OR 
       OLD.rating IS DISTINCT FROM NEW.rating OR 
       OLD.task_score IS DISTINCT FROM NEW.task_score OR 
       OLD.interview_score IS DISTINCT FROM NEW.interview_score THEN
      
      INSERT INTO public.audit_logs (actor_email, action, target_id, details)
      VALUES (
        current_actor,
        'UPDATE_APPLICATION',
        NEW.id::text,
        jsonb_build_object(
          'applicant_email', NEW.email,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'old_rating', OLD.rating,
          'new_rating', NEW.rating,
          'old_task_score', OLD.task_score,
          'new_task_score', NEW.task_score
        )
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (
      current_actor,
      'DELETE_APPLICATION',
      OLD.id::text,
      jsonb_build_object(
        'applicant_email', OLD.email,
        'applicant_name', OLD.full_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to applications table
DROP TRIGGER IF EXISTS tr_audit_applications ON public.applications;

CREATE TRIGGER tr_audit_applications
  AFTER UPDATE OR DELETE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_applications_trigger_fn();

-- 4. Automatic Trigger Function for Admin Role Management Changes
CREATE OR REPLACE FUNCTION public.audit_admins_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  current_actor TEXT;
BEGIN
  current_actor := COALESCE(auth.email(), 'system@sscs');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (current_actor, 'ADD_ADMIN', NEW.id::text, jsonb_build_object('target_email', NEW.email, 'role', NEW.role));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (current_actor, 'UPDATE_ADMIN_ROLE', NEW.id::text, jsonb_build_object('target_email', NEW.email, 'old_role', OLD.role, 'new_role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (actor_email, action, target_id, details)
    VALUES (current_actor, 'REMOVE_ADMIN', OLD.id::text, jsonb_build_object('target_email', OLD.email, 'old_role', OLD.role));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to admins table
DROP TRIGGER IF EXISTS tr_audit_admins ON public.admins;

CREATE TRIGGER tr_audit_admins
  AFTER INSERT OR UPDATE OR DELETE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admins_trigger_fn();
