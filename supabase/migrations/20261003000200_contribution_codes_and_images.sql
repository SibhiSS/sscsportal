-- =============================================================================
-- CONTRIBUTION CODES AND PROOF IMAGES
--
-- Run after 20261003000000_club_panel.sql. Safe to re-run.
--
--   * every contribution gets a 4-character code (e.g. K7Q2) for quick lookup.
--     The database picks it; members cannot choose or change it. Look-alike
--     characters (0/O, 1/I/L) are left out so codes are easy to read aloud.
--   * up to 3 proof images per contribution, stored in the private
--     "contribution-proofs" bucket under <member id>/<file>. Only the member
--     who uploaded them and admins can see them.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS code         text,
  ADD COLUMN IF NOT EXISTS proof_images text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_proof_images_max;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_proof_images_max CHECK (cardinality(proof_images) <= 3);

-- -----------------------------------------------------------------------------
-- 2. Codes
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_new_contribution_code()
RETURNS text
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars, no 0/O/1/I/L
  candidate text;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..4 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.contributions WHERE code = candidate);
  END LOOP;
  RETURN candidate;
END
$$;

-- Backfill anything submitted before this migration.
UPDATE public.contributions SET code = public.club_new_contribution_code() WHERE code IS NULL;

ALTER TABLE public.contributions ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contributions_code_key ON public.contributions (code);

-- On insert the database always assigns the code and checks the image paths;
-- on update the code can never change.
CREATE OR REPLACE FUNCTION public.club_contribution_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  path text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.code := public.club_new_contribution_code();
  ELSIF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'A contribution code cannot be changed' USING ERRCODE = '55000';
  END IF;

  -- Images must live in the submitting member's own folder.
  FOREACH path IN ARRAY coalesce(NEW.proof_images, '{}') LOOP
    IF path IS NULL OR path NOT LIKE NEW.member_id::text || '/%' OR path LIKE '%..%' THEN
      RAISE EXCEPTION 'Proof images must be uploaded to your own folder' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_contributions_guard ON public.contributions;
CREATE TRIGGER tr_contributions_guard
  BEFORE INSERT OR UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.club_contribution_guard();

-- -----------------------------------------------------------------------------
-- 3. Storage bucket for proof images (private, 5 MB per image, images only)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contribution-proofs',
  'contribution-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Members upload into, read and delete from their own folder (<member id>/...).
-- Uploading needs the caller to be able to earn points (active, not a lead).
-- Admins can read and delete everything in the bucket.
DROP POLICY IF EXISTS contribution_proofs_upload_own ON storage.objects;
CREATE POLICY contribution_proofs_upload_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contribution-proofs'
    AND (storage.foldername(name))[1] = public.current_earner_id()::text
  );

DROP POLICY IF EXISTS contribution_proofs_read ON storage.objects;
CREATE POLICY contribution_proofs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contribution-proofs'
    AND (
      (storage.foldername(name))[1] = public.current_member_id()::text
      OR public.is_club_admin()
    )
  );

DROP POLICY IF EXISTS contribution_proofs_delete ON storage.objects;
CREATE POLICY contribution_proofs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contribution-proofs'
    AND (
      (storage.foldername(name))[1] = public.current_member_id()::text
      OR public.is_club_admin()
    )
  );

COMMIT;
