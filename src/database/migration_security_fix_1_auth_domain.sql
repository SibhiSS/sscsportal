-- ==============================================================================
-- SECURITY FIX #1: BACKEND DOMAIN ENFORCEMENT ON AUTH USERS
-- Description: Rejects non-VIT emails at the database level during OAuth signup.
-- Target Table: auth.users
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.restrict_user_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow @vitstudent.ac.in, @vit.ac.in, and explicitly allowed admin emails
  IF NEW.email NOT LIKE '%@vitstudent.ac.in' 
     AND NEW.email NOT LIKE '%@vit.ac.in' 
     AND NEW.email != 'sibhis5223@gmail.com' THEN
    RAISE EXCEPTION 'Access Restricted: Only VIT email addresses (@vitstudent.ac.in / @vit.ac.in) are permitted.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists previously
DROP TRIGGER IF EXISTS tr_restrict_user_email_domain ON auth.users;

-- Bind trigger to BEFORE INSERT on auth.users
CREATE TRIGGER tr_restrict_user_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_user_email_domain();
