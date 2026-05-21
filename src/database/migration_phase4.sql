-- PHASE 4: Auto Ranking + Department Weights
-- Run this AFTER migration_phase2.sql

-- Add scoring/ranking columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS task_score NUMERIC(4,1) DEFAULT 0 CHECK (task_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS resume_score NUMERIC(4,1) DEFAULT 0 CHECK (resume_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS final_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_in_dept INTEGER;

-- Create department_weights table
CREATE TABLE IF NOT EXISTS public.department_weights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  department TEXT NOT NULL UNIQUE,
  -- Per-metric weights within the interview component (must sum to 1.0)
  metric_weight_communication NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_technical NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_enthusiasm NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_leadership NUMERIC(4,2) DEFAULT 0.20,
  metric_weight_team_fit NUMERIC(4,2) DEFAULT 0.20,
  -- Component weights (must sum to 1.0)
  weight_resume NUMERIC(4,2) DEFAULT 0.20,
  weight_task NUMERIC(4,2) DEFAULT 0.35,
  weight_interview NUMERIC(4,2) DEFAULT 0.45,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by TEXT
);

-- Seed defaults for all SSCS departments
INSERT INTO public.department_weights (department) VALUES
  ('Technical'),
  ('Operations'),
  ('Design'),
  ('Content'),
  ('Web Dev'),
  ('Media'),
  ('Finance')
ON CONFLICT (department) DO NOTHING;

-- Technical dept: higher weight on technical knowledge
UPDATE public.department_weights 
SET 
  metric_weight_communication = 0.10,
  metric_weight_technical = 0.40,
  metric_weight_enthusiasm = 0.15,
  metric_weight_leadership = 0.15,
  metric_weight_team_fit = 0.20
WHERE department = 'Technical';

-- Operations dept: higher weight on communication
UPDATE public.department_weights 
SET 
  metric_weight_communication = 0.30,
  metric_weight_technical = 0.10,
  metric_weight_enthusiasm = 0.20,
  metric_weight_leadership = 0.25,
  metric_weight_team_fit = 0.15
WHERE department = 'Operations';

-- Enable RLS
ALTER TABLE public.department_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Access" ON public.department_weights FOR ALL USING (true);

-- Index for rankings
CREATE INDEX IF NOT EXISTS idx_apps_final_score ON public.applications(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_apps_dept_rank ON public.applications(primary_dept, rank_in_dept);
