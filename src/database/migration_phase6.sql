-- PHASE 6: Resume Upload, GitHub/LinkedIn, Candidate Notes
-- Run this AFTER migration_phase4.sql

-- Add resume and social link columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_filename TEXT,
  ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS parsed_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS shortlisted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS interviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE;

-- Supabase Storage bucket for resumes (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false) ON CONFLICT DO NOTHING;

-- RLS policy for resumes bucket: owners can upload/read, admins can read all
-- (Configure in Supabase Dashboard > Storage > resumes > Policies)
