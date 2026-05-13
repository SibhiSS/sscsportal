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

-- 3. Audit Logs (Security)
CREATE TABLE public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL, -- e.g., 'UPDATE_STATUS', 'DELETE_APP', 'PUBLISH_RESULTS'
  target_id TEXT, -- ID of the application or entity affected
  details JSONB, -- Previous value, New value, etc.
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_interviews_start_time ON public.interviews(start_time);
CREATE INDEX idx_interviews_interviewer ON public.interviews(interviewer_email);

-- Enable RLS (Row Level Security) - recommended
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Simple Policies (OPEN FOR NOW - YOU SHOULD LOCK THIS DOWN IN PROD)
-- Allow read/write for now to make development easy. 
-- In production, you would check "auth.email() IN (SELECT email FROM admins)"
CREATE POLICY "Allow All Access" ON public.app_settings FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.admins FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Allow All Access" ON public.interviews FOR ALL USING (true);
