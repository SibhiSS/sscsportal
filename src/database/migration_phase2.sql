-- PHASE 2: Structured Interview Evaluation
-- Run this in Supabase SQL Editor AFTER migration_phase1.sql

-- Add 5 structured scoring columns + new fields to interview_feedback
ALTER TABLE public.interview_feedback 
  ADD COLUMN IF NOT EXISTS score_communication INTEGER DEFAULT 0 CHECK (score_communication BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_technical INTEGER DEFAULT 0 CHECK (score_technical BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_enthusiasm INTEGER DEFAULT 0 CHECK (score_enthusiasm BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_leadership INTEGER DEFAULT 0 CHECK (score_leadership BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS score_team_fit INTEGER DEFAULT 0 CHECK (score_team_fit BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS total_score NUMERIC(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommendation TEXT DEFAULT 'maybe' CHECK (recommendation IN ('strong_select', 'select', 'maybe', 'reject')),
  ADD COLUMN IF NOT EXISTS interviewer_remarks TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create a function to auto-calc total_score on insert/update
CREATE OR REPLACE FUNCTION compute_total_interview_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_score := ROUND(
    (COALESCE(NEW.score_communication, 0) + 
     COALESCE(NEW.score_technical, 0) + 
     COALESCE(NEW.score_enthusiasm, 0) + 
     COALESCE(NEW.score_leadership, 0) + 
     COALESCE(NEW.score_team_fit, 0))::NUMERIC / 5.0, 1
  );
  -- Also keep legacy score in sync
  NEW.score := NEW.total_score::INTEGER;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_interview_score ON public.interview_feedback;
CREATE TRIGGER trg_compute_interview_score
  BEFORE INSERT OR UPDATE ON public.interview_feedback
  FOR EACH ROW EXECUTE FUNCTION compute_total_interview_score();
