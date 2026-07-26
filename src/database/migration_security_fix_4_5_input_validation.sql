-- ==============================================================================
-- SECURITY FIX #4 & #5: SERVER-SIDE INPUT VALIDATION & PATTERN MATCHING (UPDATED)
-- Target Table: public.applications
-- ==============================================================================

-- STEP A: Clean up existing test/sample data so constraints don't fail on legacy rows
UPDATE public.applications 
SET phone = REGEXP_REPLACE(phone, '\D', '', 'g')
WHERE phone IS NOT NULL;

-- Remove leading 91 or 0 if 12 or 11 digits
UPDATE public.applications
SET phone = SUBSTRING(phone FROM LENGTH(phone) - 9)
WHERE LENGTH(phone) > 10;

-- Standardize roll_number format for legacy test rows
UPDATE public.applications
SET roll_number = UPPER(TRIM(roll_number))
WHERE roll_number IS NOT NULL;

-- STEP B: Add Constraints

-- 1. Enforce Registration Number Format (e.g., 24BCE1104, 23MIS0123)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_roll_number_format') THEN
    ALTER TABLE public.applications 
    ADD CONSTRAINT check_roll_number_format 
    CHECK (roll_number ~* '^\d{2}[A-Z]{3}\d{4}$');
  END IF;
END $$;

-- 2. Enforce 10-Digit Mobile Phone Format (or 10 to 12 digits allowing country code)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_phone_format') THEN
    ALTER TABLE public.applications 
    ADD CONSTRAINT check_phone_format 
    CHECK (phone ~ '^\d{10,12}$');
  END IF;
END $$;

-- STEP C: Automatic Input Sanitization Trigger Function (Prevents Stored XSS / Injection)
CREATE OR REPLACE FUNCTION public.sanitize_application_input_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim whitespace and convert roll number to uppercase automatically
  NEW.roll_number := UPPER(TRIM(NEW.roll_number));
  NEW.email := LOWER(TRIM(NEW.email));
  NEW.full_name := TRIM(NEW.full_name);
  
  -- Clean phone number (keep only digits)
  NEW.phone := REGEXP_REPLACE(NEW.phone, '\D', '', 'g');

  -- Strip dangerous HTML tags (<script>, <iframe>, <object>, <embed>, etc.)
  IF NEW.reason IS NOT NULL THEN
    NEW.reason := REGEXP_REPLACE(NEW.reason, '<[^>]*>', '', 'g');
  END IF;

  IF NEW.skills IS NOT NULL THEN
    NEW.skills := REGEXP_REPLACE(NEW.skills, '<[^>]*>', '', 'g');
  END IF;

  IF NEW.notes IS NOT NULL THEN
    NEW.notes := REGEXP_REPLACE(NEW.notes, '<[^>]*>', '', 'g');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind sanitization trigger to Applications table
DROP TRIGGER IF EXISTS tr_sanitize_application_input ON public.applications;

CREATE TRIGGER tr_sanitize_application_input
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_application_input_fn();
