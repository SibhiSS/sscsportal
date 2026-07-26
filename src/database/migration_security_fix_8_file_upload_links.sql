-- ==============================================================================
-- SECURITY FIX #8: FILE & LINK UPLOAD SECURITY
-- Description: Validates portfolio/drive/social URLs to prevent javascript: or 
--              data: URI schemes and malicious link injection.
-- Target Table: public.applications
-- ==============================================================================

-- 1. Ensure URLs start strictly with http:// or https:// (if provided)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_linkedin_url_format') THEN
    ALTER TABLE public.applications 
    ADD CONSTRAINT check_linkedin_url_format 
    CHECK (linkedin_url IS NULL OR linkedin_url = '' OR linkedin_url ~* '^https?://');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_github_url_format') THEN
    ALTER TABLE public.applications 
    ADD CONSTRAINT check_github_url_format 
    CHECK (github_url IS NULL OR github_url = '' OR github_url ~* '^https?://');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_portfolio_url_format') THEN
    ALTER TABLE public.applications 
    ADD CONSTRAINT check_portfolio_url_format 
    CHECK (portfolio_website IS NULL OR portfolio_website = '' OR portfolio_website ~* '^https?://');
  END IF;
END $$;
