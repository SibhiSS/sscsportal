-- FIX: Allow authenticated users to check their own admin status
-- Run this in your Supabase SQL Editor IMMEDIATELY

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can read admins" ON public.admins;

-- Create a new policy that allows:
-- 1. Any authenticated user to check if THEY are an admin (their own row)
-- 2. Admins to see the full admin list
CREATE POLICY "Users can check own admin status"
ON public.admins FOR SELECT
USING (
  -- Allow users to read their OWN entry (for role check during login)
  auth.email() = email
);

-- Separate policy for admins to see all admins (for admin management page)
CREATE POLICY "Admins can read all admins"
ON public.admins FOR SELECT
USING (
  -- This checks via a service-level function or uses the user's own verified row
  EXISTS (
    SELECT 1 FROM public.admins a 
    WHERE a.email = auth.email() 
    AND a.role IN ('super_admin', 'admin')
  )
);
