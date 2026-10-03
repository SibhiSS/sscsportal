-- =============================================================================
-- Storage figures are for super admins only. Run after
-- 20261003001700_wis_role_names.sql. Safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (bucket_id text, bytes bigint, files bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint, count(*)
  FROM storage.objects o
  WHERE public.is_club_super_admin()
  GROUP BY o.bucket_id
  ORDER BY 2 DESC;
$$;
