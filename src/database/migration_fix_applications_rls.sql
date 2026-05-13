-- FIX: Allow admins to read all applications
-- Run this in your Supabase SQL Editor IMMEDIATELY

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can read own applications" ON public.applications;

-- Policy 1: Users can read their OWN application
CREATE POLICY "Users can read own application"
ON public.applications FOR SELECT
USING (
  auth.email() = email
);

-- Policy 2: Admins can read ALL applications
-- This now properly checks via the user's own admin row (which they CAN read)
CREATE POLICY "Admins can read all applications"
ON public.applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE admins.email = auth.email()
  )
);

-- Also fix the UPDATE policy (same issue)
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;

CREATE POLICY "Admins can update applications"
ON public.applications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE admins.email = auth.email() 
    AND admins.role IN ('super_admin', 'admin')
  )
);

-- Also fix the DELETE policy
DROP POLICY IF EXISTS "Super admins can delete applications" ON public.applications;

CREATE POLICY "Super admins can delete applications"
ON public.applications FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE admins.email = auth.email() 
    AND admins.role = 'super_admin'
  )
);
