-- =============================================================================
-- ADMIN DRIVE
--
-- Run after 20261003001500_event_proposals.sql. Safe to re-run.
--
--   * "admin-drive": private bucket, 5 MB per file, documents and images
--   * public.drive_folders: named folders under "General" (flat)
--   * public.drive_files: one row per file. A file sits in General
--     (no folder, no event), in a folder, or in an event's folder.
--   * admins and super admins only. Anyone of them uploads and downloads;
--     the uploader or a super admin renames, moves or deletes.
--   * the drive holds at most 400 MB in total (checked against the real
--     object sizes in storage, not what the browser claims)
--   * storage_usage(): bytes per bucket, for the usage bar
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Bucket
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-drive', 'admin-drive', false, 5242880, ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/zip', 'application/x-zip-compressed'
])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS admin_drive_read ON storage.objects;
CREATE POLICY admin_drive_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admin-drive' AND public.is_club_admin());

DROP POLICY IF EXISTS admin_drive_upload ON storage.objects;
CREATE POLICY admin_drive_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-drive' AND public.is_club_admin());

-- Removing a file: its uploader, or a super admin.
DROP POLICY IF EXISTS admin_drive_delete ON storage.objects;
CREATE POLICY admin_drive_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-drive' AND public.is_club_admin()
         AND (owner = auth.uid() OR public.is_club_super_admin()));

-- -----------------------------------------------------------------------------
-- 2. Folders and files
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.drive_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_drive_folders_name ON public.drive_folders (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.drive_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid REFERENCES public.drive_folders(id) ON DELETE RESTRICT,
  event_id    uuid REFERENCES public.events(id) ON DELETE SET NULL,
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  path        text NOT NULL UNIQUE,
  size        bigint NOT NULL CHECK (size > 0 AND size <= 5242880),
  mime        text,
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (folder_id IS NULL OR event_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON public.drive_files (folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_files_event ON public.drive_files (event_id, created_at DESC);

-- Trust storage for the size, and keep the drive under 400 MB in total.
CREATE OR REPLACE FUNCTION public.drive_files_check()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_size bigint;
  used bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT (o.metadata->>'size')::bigint INTO real_size
    FROM storage.objects o WHERE o.bucket_id = 'admin-drive' AND o.name = NEW.path;
    IF real_size IS NULL THEN
      RAISE EXCEPTION 'Upload the file before registering it';
    END IF;
    NEW.size := real_size;
    NEW.uploaded_by := public.club_jwt_email();
    SELECT coalesce(sum(size), 0) INTO used FROM public.drive_files;
    IF used + NEW.size > 400 * 1024 * 1024 THEN
      RAISE EXCEPTION 'The drive is full (400 MB). Delete old files first.' USING ERRCODE = '53100';
    END IF;
  ELSE
    -- Renames and moves only; the stored file and its owner never change.
    NEW.path := OLD.path; NEW.size := OLD.size; NEW.mime := OLD.mime;
    NEW.uploaded_by := OLD.uploaded_by; NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_drive_files_check ON public.drive_files;
CREATE TRIGGER tr_drive_files_check
  BEFORE INSERT OR UPDATE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.drive_files_check();

ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drive_folders_read ON public.drive_folders;
CREATE POLICY drive_folders_read ON public.drive_folders
  FOR SELECT TO authenticated USING (public.is_club_admin());
DROP POLICY IF EXISTS drive_folders_create ON public.drive_folders;
CREATE POLICY drive_folders_create ON public.drive_folders
  FOR INSERT TO authenticated WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_folders_super ON public.drive_folders;
CREATE POLICY drive_folders_super ON public.drive_folders
  FOR UPDATE TO authenticated USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());
DROP POLICY IF EXISTS drive_folders_super_delete ON public.drive_folders;
CREATE POLICY drive_folders_super_delete ON public.drive_folders
  FOR DELETE TO authenticated USING (public.is_club_super_admin());

DROP POLICY IF EXISTS drive_files_read ON public.drive_files;
CREATE POLICY drive_files_read ON public.drive_files
  FOR SELECT TO authenticated USING (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_create ON public.drive_files;
CREATE POLICY drive_files_create ON public.drive_files
  FOR INSERT TO authenticated WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_change ON public.drive_files;
CREATE POLICY drive_files_change ON public.drive_files
  FOR UPDATE TO authenticated
  USING (public.is_club_admin() AND (lower(uploaded_by) = public.club_jwt_email() OR public.is_club_super_admin()))
  WITH CHECK (public.is_club_admin());
DROP POLICY IF EXISTS drive_files_delete ON public.drive_files;
CREATE POLICY drive_files_delete ON public.drive_files
  FOR DELETE TO authenticated
  USING (public.is_club_admin() AND (lower(uploaded_by) = public.club_jwt_email() OR public.is_club_super_admin()));

REVOKE ALL ON public.drive_folders, public.drive_files FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_folders, public.drive_files TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage usage per bucket (admins), for the usage bar
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (bucket_id text, bytes bigint, files bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint, count(*)
  FROM storage.objects o
  WHERE public.is_club_admin()
  GROUP BY o.bucket_id
  ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage() TO authenticated;

COMMIT;
