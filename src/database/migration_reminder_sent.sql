-- Migration: Add reminder_sent column to interview_slots
-- This ensures candidates receive EXACTLY ONE notification 15 minutes before their interview starts.

ALTER TABLE public.interview_slots 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Create an index to optimize query performance when checking for upcoming interviews
CREATE INDEX IF NOT EXISTS idx_interview_slots_reminder 
ON public.interview_slots (start_time, is_booked, reminder_sent);
