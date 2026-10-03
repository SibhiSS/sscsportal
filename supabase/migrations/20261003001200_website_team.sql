-- =============================================================================
-- WEBSITE TEAM: THE /team PAGE COMES FROM THE DATABASE
--
-- Run after 20261003001100_website_events.sql. Safe to re-run.
--
--   * public.website_team: faculty coordinators, core team and leads, one row
--     per person per tenure ("2026-27"). Faculty rows have no tenure and are
--     shown for every tenure.
--   * anyone (signed in or not) can read it; only super admins change it
--   * face photos go in the existing public "site-media" bucket under team/
--   * seeds the people /team used to hard-code
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.website_team (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL CHECK (section IN ('faculty', 'core', 'lead')),
  tenure      text CHECK (tenure ~ '^\d{4}-\d{2}$'),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  role        text NOT NULL CHECK (length(trim(role)) BETWEEN 1 AND 80),
  quote       text CHECK (quote IS NULL OR length(quote) <= 200),
  image       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Faculty belong to every tenure; everyone else to exactly one.
  CONSTRAINT website_team_tenure CHECK ((section = 'faculty') = (tenure IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_website_team_order ON public.website_team (tenure, section, sort_order);

ALTER TABLE public.website_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_team_read ON public.website_team;
CREATE POLICY website_team_read ON public.website_team
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS website_team_super_write ON public.website_team;
CREATE POLICY website_team_super_write ON public.website_team
  FOR ALL TO authenticated
  USING (public.is_club_super_admin())
  WITH CHECK (public.is_club_super_admin());

REVOKE ALL ON public.website_team FROM PUBLIC;
GRANT SELECT ON public.website_team TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.website_team TO authenticated;

-- -----------------------------------------------------------------------------
-- Seed (only into an empty table, so re-running never duplicates or undoes edits)
-- -----------------------------------------------------------------------------

INSERT INTO public.website_team (section, tenure, name, role, quote, image, sort_order)
SELECT v.section, v.tenure, v.name, v.role, NULLIF(v.quote, ''), v.image, v.ord
FROM (VALUES
  ('faculty', NULL,      'Sangeetha R G',     'Faculty Coordinator', 'Expert mentorship in technical direction and academic excellence for IEEE SSCS.', '/sangeetha.png', 0),
  ('faculty', NULL,      'Hemanth C',         'Faculty Coordinator', 'Guiding innovation and student engagement within the solid-state circuits domain.', '/hemanth.png', 1),

  ('core', '2025-26', 'E Abijay',        'Chairperson',       'Never Settle!', '/abijay.png', 0),
  ('core', '2025-26', 'Kiran Kumar',     'Vice Chairperson',  'I create systems that redefine the best.', '/kiran.png', 1),
  ('core', '2025-26', 'Manasa Grandhi',  'General Secretary', 'Troubles are just passing clouds.', '/manasa.png', 2),
  ('core', '2025-26', 'Mrithubashini',   'General Secretary', 'Let''s see what happens.', '/mrithubashini.png', 3),
  ('core', '2025-26', 'Arushi',          'Treasurer',         'Who wishes to fight must first count the cost.', '/arushi.png', 4),

  ('lead', '2025-26', 'Shivaranjani',   'Technical Lead',        'Life''s a circuit—I''m still meeting setup and hold.', '/shivaranjani.png', 0),
  ('lead', '2025-26', 'Harshan',        'Technical Lead',        'Observe. Plan. Execute.', '/harshan.png', 1),
  ('lead', '2025-26', 'Ilangkumaran',   'Operations Lead',       'Big ideas don''t need noise, they need action.', '/ilangkumaran.png', 2),
  ('lead', '2025-26', 'Sibhi S',        'Operations Lead',       'Click Me!!!', '/sibhi.png', 3),
  ('lead', '2025-26', 'Neyalakshmi',    'Editorial Lead',        'PEACE!', '/neya.png', 4),
  ('lead', '2025-26', 'Goutham P',      'Editorial Lead',        'SKY IS THE LIMIT', '/goutham.png', 5),
  ('lead', '2025-26', 'Priyadarshini',  'Design Lead',           'LOST IN A PASTEL SKY', '/priyadharshini.png', 6),
  ('lead', '2025-26', 'Midhun P',       'Associate Design Lead', 'COOL TONE WARM CORE', '/midhun.png', 7),

  ('core', '2026-27', 'Sibhi',          'Chairperson',                     'Click Me!!!', '/sibhi.png', 0),
  ('core', '2026-27', 'Goutham P',      'Vice Chairperson',                'SKY IS THE LIMIT', '/goutham.png', 1),
  ('core', '2026-27', 'Ilangkumaran',   'General Secretary',               'Big ideas don''t need noise, they need action.', '/ilangkumaran.png', 2),
  ('core', '2026-27', 'Neyalakshmi',    'Treasurer',                       'PEACE!', '/neya.png', 3),
  ('core', '2026-27', 'Sarweshwari',    'Women in SSCS (Chairperson)',     'Empowering women in circuits.', '/sarweshwari.png', 4),
  ('core', '2026-27', 'Shree Devi',     'Women in SSCS (Vice-Chairperson)', 'Breaking barriers.', '/shreedevi.png', 5),

  ('lead', '2026-27', 'S Jai Akaash',      'Technical Lead',                         '', '/jai.png', 0),
  ('lead', '2026-27', 'Pranav J',          'Associate Technical Lead',               '', '/pranav.png', 1),
  ('lead', '2026-27', 'Hitesh V S',        'Associate Technical Lead',               '', '/hitesh.png', 2),
  ('lead', '2026-27', 'M Varshinee',       'Management Lead',                        '', '/varshinee.png', 3),
  ('lead', '2026-27', 'Adriza Banerji',    'Associate Management Lead',              '', '/adriza.png', 4),
  ('lead', '2026-27', 'C S Tejasvini',     'Event Operations Lead',                  '', '/tejasvini.png', 5),
  ('lead', '2026-27', 'Aariya Manikandan', 'Associate Event Operations Lead',        '', '/aariya.png', 6),
  ('lead', '2026-27', 'Rohith M',          'Creative Lead',                          '', '/rohith.png', 7),
  ('lead', '2026-27', 'Tharun S',          'Associate Creative Lead',                '', '/tharun.png', 8),
  ('lead', '2026-27', 'Anjana Varma',      'Outreach & Partnerships Lead',           '', '/anjana.png', 9),
  ('lead', '2026-27', 'Karthikeyan D',     'Associate Outreach & Partnerships Lead', '', '/karthikeyan.png', 10),
  ('lead', '2026-27', 'P Midhun',          'Human Resource Lead',                    'COOL TONE WARM CORE', '/midhun.png', 11),
  ('lead', '2026-27', 'K Srishtithaa',     'Associate Human Resource Lead',          '', '/srishtithaa.png', 12)
) AS v(section, tenure, name, role, quote, image, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.website_team);

COMMIT;

-- =============================================================================
-- AFTER RUNNING, sanity check:
--
--   SELECT tenure, section, count(*) FROM public.website_team GROUP BY 1, 2 ORDER BY 1, 2;
-- =============================================================================
