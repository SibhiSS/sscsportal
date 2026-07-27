-- Remove santhosh.v2024d@vitstudent.ac.in from the admins table.
-- He was seeded as super_admin in schema.sql but is no longer part of the project.
DELETE FROM public.admins WHERE email = 'santhosh.v2024d@vitstudent.ac.in';
