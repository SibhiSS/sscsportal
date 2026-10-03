-- =============================================================================
-- Two more venues for proposals and events. Run after
-- 20261003001800_storage_usage_super.sql. Safe to re-run (keeps any edits).
-- =============================================================================

INSERT INTO public.venues (id, name, short_name, notes, sort_order) VALUES
  ('ab3-gallery', 'AB3 Gallery Classrooms', 'AB3 Gallery', NULL, 70),
  ('classroom',   'Normal Classroom',       'Classroom',   NULL, 80)
ON CONFLICT (id) DO NOTHING;
