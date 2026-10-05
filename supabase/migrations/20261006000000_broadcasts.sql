-- =============================================================================
-- BROADCASTS: MESSAGES FROM SUPER ADMINS TO SIGNED-IN USERS
--
-- Run after 20261003002200_club_meets.sql. Safe to re-run.
--
--   * public.broadcasts: a message, its priority and who it is for.
--       priority  critical  -> full-screen card on sign-in; must be acknowledged
--                 important -> banner until dismissed
--                 info      -> toast once, then in the inbox
--       audience  everyone (signed in) | members (non-admins) | admins
--       starts_at / expires_at schedule it; only super admins write.
--   * public.broadcast_reads: who has seen / acknowledged what. Written only
--     through broadcast_mark(), which takes the email from the session.
--   * my_broadcasts(): what the caller should see right now, with read state.
--   * broadcast_people(): everyone a broadcast can reach, for read receipts.
--   * broadcasts is added to supabase_realtime so open tabs get new ones live.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  body       text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  priority   text NOT NULL DEFAULT 'info' CHECK (priority IN ('critical', 'important', 'info')),
  audience   text NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'members', 'admins')),
  starts_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz CHECK (expires_at IS NULL OR expires_at > starts_at),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_starts ON public.broadcasts (starts_at DESC);

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  email        text NOT NULL,
  seen_at      timestamptz NOT NULL DEFAULT now(),
  acked_at     timestamptz,
  PRIMARY KEY (broadcast_id, email)
);

-- The author is recorded from the session, not trusted from the browser.
CREATE OR REPLACE FUNCTION public.broadcasts_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := COALESCE(NULLIF(public.club_jwt_email(), ''), NEW.created_by);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS tr_broadcasts_stamp ON public.broadcasts;
CREATE TRIGGER tr_broadcasts_stamp
  BEFORE INSERT ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.broadcasts_stamp();

-- Is a broadcast live and addressed to the caller? The one place this is decided.
CREATE OR REPLACE FUNCTION public.broadcast_is_for_me(p_audience text, p_starts timestamptz, p_expires timestamptz)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.club_jwt_email() <> ''
     AND p_starts <= now()
     AND (p_expires IS NULL OR p_expires > now())
     AND CASE p_audience
           WHEN 'everyone' THEN true
           WHEN 'admins'   THEN public.is_club_admin()
           WHEN 'members'  THEN NOT public.is_club_admin()
           ELSE false
         END;
$$;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- Super admins manage everything; everyone else reads only what is live and theirs.
-- (Realtime checks this policy too, so a tab only hears about its own broadcasts.)
DROP POLICY IF EXISTS broadcasts_read ON public.broadcasts;
CREATE POLICY broadcasts_read ON public.broadcasts
  FOR SELECT TO authenticated
  USING (public.is_club_super_admin() OR public.broadcast_is_for_me(audience, starts_at, expires_at));
DROP POLICY IF EXISTS broadcasts_write ON public.broadcasts;
CREATE POLICY broadcasts_write ON public.broadcasts
  FOR ALL TO authenticated
  USING (public.is_club_super_admin()) WITH CHECK (public.is_club_super_admin());

DROP POLICY IF EXISTS broadcast_reads_read ON public.broadcast_reads;
CREATE POLICY broadcast_reads_read ON public.broadcast_reads
  FOR SELECT TO authenticated
  USING (public.is_club_super_admin() OR email = public.club_jwt_email());

REVOKE ALL ON public.broadcasts, public.broadcast_reads FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT SELECT ON public.broadcast_reads TO authenticated;

-- What the caller should see now, newest first. Super admins get only what is
-- addressed to them here, like anyone else; the admin page reads the table.
CREATE OR REPLACE FUNCTION public.my_broadcasts()
RETURNS TABLE (
  id uuid, title text, body text, priority text, audience text,
  starts_at timestamptz, expires_at timestamptz, created_by text,
  seen_at timestamptz, acked_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.title, b.body, b.priority, b.audience, b.starts_at, b.expires_at, b.created_by,
         r.seen_at, r.acked_at
  FROM public.broadcasts b
  LEFT JOIN public.broadcast_reads r
    ON r.broadcast_id = b.id AND r.email = public.club_jwt_email()
  WHERE public.broadcast_is_for_me(b.audience, b.starts_at, b.expires_at)
  ORDER BY b.starts_at DESC
  LIMIT 50;
$$;

-- Record that the caller saw a broadcast, and optionally acknowledged it.
-- Seeing never clears an earlier acknowledgement.
CREATE OR REPLACE FUNCTION public.broadcast_mark(p_id uuid, p_ack boolean DEFAULT false)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.broadcast_reads (broadcast_id, email, seen_at, acked_at)
  SELECT b.id, public.club_jwt_email(), now(), CASE WHEN p_ack THEN now() END
  FROM public.broadcasts b
  WHERE b.id = p_id AND public.broadcast_is_for_me(b.audience, b.starts_at, b.expires_at)
  ON CONFLICT (broadcast_id, email) DO UPDATE
    SET acked_at = COALESCE(public.broadcast_reads.acked_at, EXCLUDED.acked_at);
$$;

-- Everyone a broadcast can reach: active roster members and admins, by email.
-- Super admins only (it lists the roster).
CREATE OR REPLACE FUNCTION public.broadcast_people()
RETURNS TABLE (email text, name text, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT lower(trim(a.email)) AS email, a.full_name AS name
    FROM public.applications a
    WHERE a.is_member AND a.member_status = 'active'
    UNION ALL
    SELECT lower(trim(ad.email)), NULL
    FROM public.admins ad
    WHERE ad.role IN ('super_admin', 'admin')
  )
  SELECT p.email,
         coalesce(max(p.name), p.email),
         EXISTS (SELECT 1 FROM public.admins ad
                 WHERE lower(trim(ad.email)) = p.email AND ad.role IN ('super_admin', 'admin'))
  FROM people p
  WHERE public.is_club_super_admin() AND p.email <> ''
  GROUP BY p.email
  ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.my_broadcasts(), public.broadcast_mark(uuid, boolean), public.broadcast_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_broadcasts(), public.broadcast_mark(uuid, boolean), public.broadcast_people() TO authenticated;

-- Live delivery to open tabs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcasts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
  END IF;
END
$$;

COMMIT;
