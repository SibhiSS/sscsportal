-- 5. Interview Slots (FCFS Booking System)
CREATE TABLE public.interview_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  panel_id INTEGER NOT NULL CHECK (panel_id IN (1, 2, 3)),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_booked BOOLEAN DEFAULT FALSE,
  booked_by UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for quick lookup of available slots
CREATE INDEX idx_interview_slots_booking ON public.interview_slots(is_booked, start_time);
CREATE INDEX idx_interview_slots_booked_by ON public.interview_slots(booked_by);

-- RLS
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Access" ON public.interview_slots FOR ALL USING (true);
