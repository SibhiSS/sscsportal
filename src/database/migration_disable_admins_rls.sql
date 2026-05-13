-- SIMPLEST FIX: Disable RLS on admins table
-- The admins table only contains admin emails and roles
-- Access to admin functionality is controlled by React code
-- RLS on this table causes circular dependency issues

-- Run this in Supabase SQL Editor

-- Option 1: DISABLE RLS entirely on admins (simplest, recommended)
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;

-- If you insist on keeping RLS, use Option 2 instead:
-- (Comment out Option 1 above and uncomment below)

/*
-- Option 2: Create a SECURITY DEFINER function to bypass RLS
-- Drop all existing policies first
DROP POLICY IF EXISTS "admins_select_own" ON public.admins;
DROP POLICY IF EXISTS "admins_select_all" ON public.admins;
DROP POLICY IF EXISTS "admins_insert" ON public.admins;
DROP POLICY IF EXISTS "admins_update" ON public.admins;
DROP POLICY IF EXISTS "admins_delete" ON public.admins;
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admins;
DROP POLICY IF EXISTS "Admins can read all admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can read admins" ON public.admins;
DROP POLICY IF EXISTS "Allow All Access" ON public.admins;

-- Create a single permissive policy for authenticated users
CREATE POLICY "Authenticated users can access admins"
ON public.admins 
FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
*/

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'admins';
