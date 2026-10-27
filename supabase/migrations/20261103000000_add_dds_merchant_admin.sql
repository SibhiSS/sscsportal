-- Adds "DDS Merchant" (dds.mechant@gmail.com) as an admin so they can test the panel.
-- Safe to re-run. To remove later: Admin > Settings > Who can sign in > Remove.

BEGIN;

UPDATE public.admins SET role = 'admin' WHERE lower(email) = 'dds.mechant@gmail.com';

INSERT INTO public.admins (email, role, added_by)
SELECT 'dds.mechant@gmail.com', 'admin', 'sql-migration'
WHERE NOT EXISTS (SELECT 1 FROM public.admins WHERE lower(email) = 'dds.mechant@gmail.com');

COMMIT;
