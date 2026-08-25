-- COMMITTEE SEAT QUOTAS
-- Backs the seat counters on the Committee Draft Board (admin → Committees tab).
--
-- Before this table the quotas lived in React useState, so every reload reset
-- them to the hardcoded defaults and two admins on two laptops were working
-- against different seat counts without either of them knowing. Persisting them
-- here makes the numbers shared and durable.
--
-- Run this in your Supabase SQL Editor. Safe to re-run.

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. Make sure the admin predicate exists BEFORE any policy references it.
--
-- The SQL Editor runs a script as a single transaction: if CREATE POLICY trips
-- over a missing is_any_admin(), the whole script rolls back — including the
-- CREATE TABLE — and the board then reports that quotas could not be loaded even
-- though the migration "ran". Only define it when it is genuinely absent, so a
-- database that already has its own (possibly stricter) version keeps it.
--
-- The fallback matches the app's own case-insensitive admin lookup: Google OAuth
-- returns lowercased emails while rows added through Admin → Settings keep
-- whatever casing was typed. See migration_normalize_admin_email_case.sql.
-- ──────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_any_admin' AND n.nspname = 'public'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.is_any_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.admins
          WHERE lower(trim(email)) = lower(trim(coalesce(auth.email(), '')))
        );
      $body$;
    $fn$;
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. The table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.committee_quotas (
  department TEXT PRIMARY KEY,
  seats      INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 99),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by TEXT
);

-- Seed the six SSCS committee departments with the values that used to be
-- hardcoded in CommitteeDraftBoard.tsx. ON CONFLICT DO NOTHING so re-running
-- this migration never stomps quotas an admin has since edited.
INSERT INTO public.committee_quotas (department, seats) VALUES
  ('Technical',               15),
  ('Management',              12),
  ('Event Operations',        12),
  ('Creative',                10),
  ('Outreach & Partnerships', 10),
  ('Human Resources',         10)
ON CONFLICT (department) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. RLS — same posture as department_weights: any admin may read and write.
--    Applicants have no business seeing seat counts, so there is no public policy.
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.committee_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotas_manage" ON public.committee_quotas;
CREATE POLICY "quotas_manage" ON public.committee_quotas
  FOR ALL USING (is_any_admin()) WITH CHECK (is_any_admin());

-- Supabase's default privileges normally cover tables created in public, but
-- state them explicitly so a project whose defaults were altered still works.
GRANT SELECT, INSERT, UPDATE ON TABLE public.committee_quotas TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Tell PostgREST about the new table.
--
-- The REST API serves from a cached schema. Until it reloads, a table that
-- genuinely exists still answers PGRST205 "Could not find the table in the
-- schema cache". This is normally automatic within a minute; the NOTIFY makes
-- it immediate.
-- ──────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
