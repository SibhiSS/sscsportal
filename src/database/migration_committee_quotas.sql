-- COMMITTEE SEAT QUOTAS
-- Backs the seat counters on the Committee Draft Board (admin → Committees tab).
--
-- Before this table the quotas lived in React useState, so every reload reset
-- them to the hardcoded defaults and two admins on two laptops were working
-- against different seat counts without either of them knowing. Persisting them
-- here makes the numbers shared and durable.
--
-- Run this in your Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.committee_quotas (
  department TEXT PRIMARY KEY,
  seats      INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 99),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by TEXT
);

-- Seed the six SSCS committee departments with the values that used to be
-- hardcoded in CommitteeDraftBoard.tsx. ON CONFLICT DO NOTHING so re-running
-- this migration never stomps quotas an admin has since edited.
INSERT INTO public.committee_quotas (department, seats) VALUES
  ('Technical',               15),
  ('Management',              12),
  ('Event Operations',        12),
  ('Creative',                10),
  ('Outreach & Partnerships', 10),
  ('Human Resources',         10)
ON CONFLICT (department) DO NOTHING;

-- RLS: same posture as department_weights — any admin may read and write.
-- Applicants have no business seeing seat counts, so there is no public policy.
ALTER TABLE public.committee_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotas_manage" ON public.committee_quotas;
CREATE POLICY "quotas_manage" ON public.committee_quotas
  FOR ALL USING (is_any_admin()) WITH CHECK (is_any_admin());
