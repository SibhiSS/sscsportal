-- =============================================================================
-- Women in SSCS roles read "Women in SSCS (Chairperson)" and
-- "Women in SSCS (Vice-Chairperson)". Run after 20261003001600_admin_drive.sql.
-- Safe to re-run.
-- =============================================================================

UPDATE public.website_team SET role = 'Women in SSCS (Chairperson)'
WHERE role = 'Chairperson (Women in SSCS)';

UPDATE public.website_team SET role = 'Women in SSCS (Vice-Chairperson)'
WHERE role = 'Vice-Chairperson (Women in SSCS)';
