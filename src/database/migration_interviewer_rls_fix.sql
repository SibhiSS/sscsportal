-- BULLETPROOF FIX FOR INTERVIEWER SUBMISSION
-- Run this in your Supabase SQL Editor

-- 1. Applications Table (Allow any authenticated user to update)
DROP POLICY IF EXISTS "applications_update" ON public.applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;

CREATE POLICY "applications_update"
ON public.applications FOR UPDATE
USING (auth.role() = 'authenticated');

-- 2. Interview Feedback Table (Allow any authenticated user to insert/update)
DROP POLICY IF EXISTS "Allow All Access" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_all" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_select" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_insert" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_update" ON public.interview_feedback;
DROP POLICY IF EXISTS "interview_feedback_delete" ON public.interview_feedback;

CREATE POLICY "interview_feedback_select"
ON public.interview_feedback FOR SELECT
USING (true);

CREATE POLICY "interview_feedback_insert"
ON public.interview_feedback FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "interview_feedback_update"
ON public.interview_feedback FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "interview_feedback_delete"
ON public.interview_feedback FOR DELETE
USING (auth.role() = 'authenticated');

-- 3. Interview Slots Table (Allow any authenticated user to update)
DROP POLICY IF EXISTS "Allow All Access" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_all" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_update" ON public.interview_slots;

CREATE POLICY "interview_slots_all"
ON public.interview_slots FOR ALL
USING (true);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
