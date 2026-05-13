-- Add notified flag to applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS shortlist_notified BOOLEAN DEFAULT FALSE;
