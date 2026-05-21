-- PHASE 1: Expand ApplicationStatus to full 8-stage pipeline
-- Run this in Supabase SQL Editor

-- Step 1: Drop the old check constraint
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;

-- Step 2: Add all canonical statuses
ALTER TABLE public.applications 
  ADD CONSTRAINT applications_status_check 
  CHECK (status IN (
    -- New canonical 8-stage pipeline
    'applied',
    'under_review',
    'shortlisted',
    'interview_scheduled',
    'interviewed',
    'selected',
    'waitlisted',
    'rejected',
    -- Legacy (keep for backward compat)
    'pending',
    'neutral',
    'rejected_pending',
    'active_member',
    'alumni',
    'inactive'
  ));

-- Step 3: Migrate legacy 'pending' records to 'applied'
UPDATE public.applications 
  SET status = 'applied' 
  WHERE status = 'pending';

-- Step 4: Migrate 'neutral' to 'under_review'
UPDATE public.applications 
  SET status = 'under_review' 
  WHERE status = 'neutral';
