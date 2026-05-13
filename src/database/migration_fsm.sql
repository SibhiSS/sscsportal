-- Create new enum types for state management
CREATE TYPE recruitment_phase_enum AS ENUM ('APPLICATIONS_OPEN', 'REVIEW_PHASE', 'INTERVIEWS_ONGOING', 'RESULTS_PUBLISHED');

-- Add recruitment_phase to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS current_phase recruitment_phase_enum DEFAULT 'APPLICATIONS_OPEN';

-- Update app_settings to ensure only one row (singleton)
-- (Assuming existing app_settings logic uses a specific ID or just strictly one row)

-- Update applications status check to include new FSM states
-- We need to drop the old constraint and add a new comprehensive one
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications 
ADD CONSTRAINT applications_status_check 
CHECK (status IN (
    'submitted', 'under_review', 'interview_scheduled', 'interviewed', 
    'selected', 'rejected', 'waitlisted',
    'pending', 'shortlisted', 'rejected_pending', 'neutral', -- Keep legacy temporarily for migration if needed
    'active_member', 'alumni', 'inactive' -- Lifecycle states
));

-- State Transition History Table
CREATE TABLE IF NOT EXISTS public.application_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL, -- Email of admin
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_app_id ON public.application_status_history(application_id);
