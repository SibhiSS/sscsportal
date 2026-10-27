-- =============================================================================
-- WEBSITE TEAM: AI CLUB FACULTY AND 2026-27 BOARD
--
-- Run after 20261102000000_website_upcoming_events.sql.
--
-- REPLACES everything in public.website_team (the old IEEE SSCS people) with
-- the AI Club faculty coordinators and the 2026-27 board. The six lead rows
-- are placeholders: edit names, quotes and photos from Admin > Team.
-- Photos are the files in /public (dhavakumar.jpg, santhosh.jpg, ...).
-- =============================================================================

BEGIN;

DELETE FROM public.website_team;

INSERT INTO public.website_team (section, tenure, name, role, quote, image, sort_order) VALUES
  ('faculty', NULL, 'Dr. Dhavakumar P', 'Faculty Coordinator', 'Guiding the club''s direction and student growth in artificial intelligence.', '/dhavakumar.jpg', 0),
  ('faculty', NULL, 'Dr. M. Sivabalakrishnan', 'Faculty Coordinator', 'Mentoring projects, research and innovation across the AI Club community.', '/sivabalakrishnan.jpg', 1),

  ('core', '2026-27', 'Santhosh V', 'Chairperson', NULL, '/santhosh.jpg', 0),
  ('core', '2026-27', 'Hemasri Chamarthi', 'Vice Chairperson', NULL, '/hemasri.jpg', 1),
  ('core', '2026-27', 'Daksha Boredekar', 'General Secretary', NULL, '/daksha.jpg', 2),
  ('core', '2026-27', '"Treasurer Name"', 'Treasurer', '"Your quote goes here."', NULL, 3),

  ('lead', '2026-27', '"Technical Lead Name"', 'Technical Lead', '"Your quote goes here."', NULL, 0),
  ('lead', '2026-27', '"Associate Technical Lead Name"', 'Associate Technical Lead', '"Your quote goes here."', NULL, 1),
  ('lead', '2026-27', '"Management Lead Name"', 'Management Lead', '"Your quote goes here."', NULL, 2),
  ('lead', '2026-27', '"Associate Management Lead Name"', 'Associate Management Lead', '"Your quote goes here."', NULL, 3),
  ('lead', '2026-27', '"Event Operations Lead Name"', 'Event Operations Lead', '"Your quote goes here."', NULL, 4),
  ('lead', '2026-27', '"Associate Event Operations Lead Name"', 'Associate Event Operations Lead', '"Your quote goes here."', NULL, 5),
  ('lead', '2026-27', '"Creative Lead Name"', 'Creative Lead', '"Your quote goes here."', NULL, 6),
  ('lead', '2026-27', '"Associate Creative Lead Name"', 'Associate Creative Lead', '"Your quote goes here."', NULL, 7),
  ('lead', '2026-27', '"Outreach Lead Name"', 'Outreach & Partnerships Lead', '"Your quote goes here."', NULL, 8),
  ('lead', '2026-27', '"Associate Outreach Lead Name"', 'Associate Outreach & Partnerships Lead', '"Your quote goes here."', NULL, 9),
  ('lead', '2026-27', '"HR Lead Name"', 'Human Resource Lead', '"Your quote goes here."', NULL, 10),
  ('lead', '2026-27', '"Associate HR Lead Name"', 'Associate Human Resource Lead', '"Your quote goes here."', NULL, 11);

COMMIT;
