
-- 5. Panel Assignments (Linking Interviewers to Panels)
CREATE TABLE public.panel_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  panel_id INTEGER NOT NULL, -- Logical ID (1, 2, 3...)
  date DATE NOT NULL,
  interviewer_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(panel_id, date, interviewer_email)
);

-- 6. Interview Feedback (Scores & Comments)
CREATE TABLE public.interview_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  interviewer_email TEXT NOT NULL,
  score INTEGER CHECK (score >= 0 AND score <= 10),
  comments TEXT,
  recommends_committee BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(application_id, interviewer_email)
);

-- RLS
ALTER TABLE public.panel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All Access" ON public.panel_assignments FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.interview_feedback FOR ALL USING (true);
