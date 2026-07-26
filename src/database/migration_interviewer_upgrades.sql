-- Migration: Interviewer Upgrades (Remarks & Recommended Department)
-- Run this in Supabase SQL Editor to enable dedicated columns for Recommended Department and Remarks

ALTER TABLE public.interview_feedback 
  ADD COLUMN IF NOT EXISTS interviewer_remarks TEXT,
  ADD COLUMN IF NOT EXISTS recommended_dept TEXT;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'interview_feedback';
