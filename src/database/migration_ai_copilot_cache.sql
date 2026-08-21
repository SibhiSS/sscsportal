-- Caches the AI Copilot's analysis on the application row itself.
--
-- Why: the copilot panel previously called the LLM fresh on every single modal
-- open, which is what was tripping 429s under normal admin browsing. Caching
-- the result means a candidate is only re-analyzed when an admin explicitly
-- hits Refresh, or via the batch auto-shortlist tool (which itself skips
-- already-analyzed candidates unless a re-analysis is forced).
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE;
