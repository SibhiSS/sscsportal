-- Add meeting_link to panel_assignments
ALTER TABLE public.panel_assignments 
ADD COLUMN IF NOT EXISTS meeting_link TEXT;
