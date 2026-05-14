-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. App Settings (Recruitment Control)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial Seed for Recruitment Status
INSERT INTO public.app_settings (key, value)
VALUES ('recruitment_status', '{"isOpen": true, "message": "Recruitment is currently open."}')
ON CONFLICT (key) DO NOTHING;

-- 2. Admin Users (Dynamic Team Management)
CREATE TABLE public.admins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'interviewer', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  added_by TEXT -- Email of the admin who added this user
);

-- Seed initial admins (You can edit this list)
INSERT INTO public.admins (email, role) VALUES 
('sibhi.s2024@vitstudent.ac.in', 'super_admin'),
('sibhis5223@gmail.com', 'super_admin'),
('santhosh.v2024d@vitstudent.ac.in', 'super_admin'),
('tspradeepkumar@vit.ac.in', 'viewer')
ON CONFLICT (email) DO NOTHING;

-- 3. Audit Logs (Security Tracking)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Interview Slots (Booking Engine)
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  panel_id INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  booked_by UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Panel Assignments (Admin Allocation)
CREATE TABLE IF NOT EXISTS public.panel_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  panel_id INTEGER NOT NULL,
  date DATE NOT NULL,
  interviewer_email TEXT NOT NULL,
  meeting_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(panel_id, date, interviewer_email)
);

-- 6. Interview Feedback (Evaluation)
CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  interviewer_email TEXT NOT NULL,
  score INTEGER CHECK (score >= 0 AND score <= 10),
  comments TEXT,
  recommends_committee BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(application_id, interviewer_email)
);

-- 4. Interviews (Scheduler)
CREATE TABLE public.interviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  interviewer_email TEXT NOT NULL, -- The admin conducting the interview
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  meeting_link TEXT, -- Google Meet / Zoom link
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interview_slots_start ON public.interview_slots(start_time);
CREATE INDEX IF NOT EXISTS idx_panel_assignments_date ON public.panel_assignments(date);
CREATE INDEX IF NOT EXISTS idx_feedback_app_id ON public.interview_feedback(application_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

-- Simple Policies (OPEN FOR DEVELOPMENT)
CREATE POLICY "Allow All Access" ON public.app_settings FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.admins FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.interview_slots FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.panel_assignments FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.interview_feedback FOR ALL USING (true);
