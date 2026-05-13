-- Migration: Add 'admin' role to admins table
-- Run this in your Supabase SQL Editor

-- 1. Drop the existing check constraint
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;

-- 2. Add the updated check constraint including 'admin'
ALTER TABLE public.admins 
ADD CONSTRAINT admins_role_check 
CHECK (role IN ('super_admin', 'admin', 'interviewer', 'viewer'));

-- 3. (Optional) Update any specific user to 'admin' if needed
-- UPDATE public.admins SET role = 'admin' WHERE email = 'your_email@example.com';
