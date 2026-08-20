-- ==============================================================================
-- FIX: Admin login silently downgraded to 'viewer' on email casing mismatch
--
-- admins.email is a plain TEXT column matched with byte-exact equality. Rows
-- added via Admin -> Settings -> Admins were inserted with whatever casing was
-- typed (e.g. "John.Doe@vitstudent.ac.in"), while Google OAuth always returns
-- the email lowercased. The AuthContext lookup then matched zero rows, the
-- lookup error was swallowed, and the admin was silently treated as 'viewer'
-- and denied access to the admin panel.
--
-- The app now looks up admins case-insensitively (ilike) and normalizes new
-- rows to lowercase on insert. This migration cleans up existing rows so
-- direct SQL edits / old data stay consistent, and guards against the same
-- bug recurring.
-- ==============================================================================

-- 1. Normalize existing rows. If two rows differ only by case (e.g. an admin
--    was accidentally added twice with different casing), keep the older one
--    and drop the newer duplicate before lowercasing, so the UNIQUE constraint
--    on email doesn't reject the UPDATE.
WITH duplicates AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY lower(trim(email)) ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM public.admins
  ) ranked
  WHERE rn > 1
)
DELETE FROM public.admins WHERE id IN (SELECT id FROM duplicates);

UPDATE public.admins
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- 2. Prevent future case/whitespace-variant duplicates at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_lower_idx
  ON public.admins (lower(trim(email)));
