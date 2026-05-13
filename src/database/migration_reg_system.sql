-- Add derived metadata columns to applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS admission_year INTEGER,
ADD COLUMN IF NOT EXISTS program_code TEXT,
ADD COLUMN IF NOT EXISTS program_name TEXT,
ADD COLUMN IF NOT EXISTS batch TEXT,
ADD COLUMN IF NOT EXISTS program_category TEXT;

-- Enforce uniqueness on roll_number
-- First, handle duplicates if any exist (optional depending on current data state)
-- DELETE FROM public.applications ... (omitted for safety, assuming clean slate or uniqueness already mostly there)

-- Add unique constraint
ALTER TABLE public.applications 
ADD CONSTRAINT unique_roll_number UNIQUE (roll_number);

-- Update status check constraint to include new lifecycle states
-- Note: Modifying a check constraint in Postgres usually involves dropping and re-adding
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications 
ADD CONSTRAINT applications_status_check 
CHECK (status IN ('pending', 'selected', 'rejected', 'neutral', 'shortlisted', 'rejected_pending', 'active_member', 'alumni', 'inactive'));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_apps_program_code ON public.applications(program_code);
CREATE INDEX IF NOT EXISTS idx_apps_admission_year ON public.applications(admission_year);
CREATE INDEX IF NOT EXISTS idx_apps_batch ON public.applications(batch);
