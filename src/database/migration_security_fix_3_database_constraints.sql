-- ==============================================================================
-- SECURITY FIX #3: DATABASE SECURITY (UNIQUE CONSTRAINTS & PAYLOAD LIMITS)
-- Description: Adds unique constraints on email, roll_number, and user_id to prevent
--              duplicate submissions, and enforces length limits to prevent DoS.
-- Target Table: public.applications
-- ==============================================================================

-- 1. Ensure Unique Constraints on Applications
DO $$ 
BEGIN 
  -- Unique constraint on email
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_applications_email'
  ) THEN
    ALTER TABLE public.applications ADD CONSTRAINT unique_applications_email UNIQUE (email);
  END IF;

  -- Unique constraint on roll_number
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_applications_roll_number'
  ) THEN
    ALTER TABLE public.applications ADD CONSTRAINT unique_applications_roll_number UNIQUE (roll_number);
  END IF;

  -- Unique constraint on user_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_applications_user_id'
  ) THEN
    ALTER TABLE public.applications ADD CONSTRAINT unique_applications_user_id UNIQUE (user_id);
  END IF;
END $$;

-- 2. Add Size & Payload Constraints to Prevent Storage Bloat / DoS Attacks
DO $$ 
BEGIN 
  -- Full name max 100 chars
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_full_name_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_full_name_length CHECK (length(full_name) <= 100);
  END IF;

  -- Phone number max 15 chars
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_phone_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_phone_length CHECK (length(phone) <= 15);
  END IF;

  -- Roll number max 20 chars
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_roll_number_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_roll_number_length CHECK (length(roll_number) <= 20);
  END IF;

  -- Answers max 4000 chars each
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_reason_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_reason_length CHECK (length(COALESCE(reason, '')) <= 4000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_skills_length') THEN
    ALTER TABLE public.applications ADD CONSTRAINT check_skills_length CHECK (length(COALESCE(skills, '')) <= 4000);
  END IF;
END $$;

-- 3. Verify RLS is Enabled & Least Privilege is Enforced
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
