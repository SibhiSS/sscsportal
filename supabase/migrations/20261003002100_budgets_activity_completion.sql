-- =============================================================================
-- ITEMISED BUDGETS, ACTIVITY LOG, "EVENT COMPLETED", ADMIN EDIT RIGHTS
--
-- Run after 20261003002000_proposal_board_date.sql. Safe to re-run.
--
--   * plain admins may now change an event's description, online switch and
--     venue; only super admins create/delete events or change title and dates
--   * public.event_budget_items: expense and income lines per event
--     (category, quantity, unit cost, actual amount, status, who paid,
--     receipt in the drive). Admins manage them.
--   * events.budget_planned / budget_actual follow the expense lines, so the
--     checklist and reports keep working
--   * public.event_activity: who did what on each event, written by
--     triggers; only super admins read it
--   * events.completed_at / completed_by: a super admin marks an event
--     completed; only then do its volunteers, coordinators and attendees get
--     their points. Events that have already ended count as completed.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Completion
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by text;

-- Nobody loses points they already have: past events are completed.
UPDATE public.events SET completed_at = now(), completed_by = 'already ended'
WHERE completed_at IS NULL AND end_date < public.club_today();

-- -----------------------------------------------------------------------------
-- 1. Only the name and dates are super-admin only now
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_events_details_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.club_jwt_email() = '' OR public.is_club_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only super admins can create events. Propose it instead.' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Only super admins can delete events' USING ERRCODE = '42501';
  ELSIF (NEW.title, NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.title, OLD.start_date, OLD.end_date) THEN
    RAISE EXCEPTION 'Only super admins can change an event''s name or dates' USING ERRCODE = '42501';
  ELSIF (NEW.completed_at, NEW.completed_by) IS DISTINCT FROM (OLD.completed_at, OLD.completed_by) THEN
    RAISE EXCEPTION 'Only super admins can mark an event completed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Budget lines
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_budget_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income')),
  category        text NOT NULL DEFAULT 'Miscellaneous' CHECK (length(trim(category)) BETWEEN 1 AND 60),
  item            text NOT NULL DEFAULT '' CHECK (length(item) <= 160),
  quantity        numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost       numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  actual          numeric(12, 2) CHECK (actual IS NULL OR actual >= 0),
  status          text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid', 'reimbursed', 'received')),
  paid_by         text CHECK (paid_by IS NULL OR length(paid_by) <= 80),
  notes           text CHECK (notes IS NULL OR length(notes) <= 500),
  receipt_file_id uuid REFERENCES public.drive_files(id) ON DELETE SET NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event ON public.event_budget_items (event_id, kind, sort_order);

ALTER TABLE public.event_budget_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_budget_items_admin ON public.event_budget_items;
CREATE POLICY event_budget_items_admin ON public.event_budget_items
  FOR ALL TO authenticated
  USING (public.is_club_admin()) WITH CHECK (public.is_club_admin());

REVOKE ALL ON public.event_budget_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_budget_items TO authenticated;

-- Keep the event's planned/actual spend in step with its expense lines.
-- Planned = sum of quantity × unit cost; actual = sum of the actual amounts
-- filled in so far (empty until at least one is). No lines left = both empty.
CREATE OR REPLACE FUNCTION public.event_budget_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ev uuid;
  n int; planned numeric; spent numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN ev := OLD.event_id; ELSE ev := NEW.event_id; END IF;
  SELECT count(*), sum(quantity * unit_cost), sum(actual)
    INTO n, planned, spent
  FROM public.event_budget_items WHERE event_id = ev AND kind = 'expense';

  UPDATE public.events
  SET budget_planned = CASE WHEN n = 0 THEN NULL ELSE round(planned, 2) END,
      budget_actual  = CASE WHEN n = 0 THEN NULL ELSE round(spent, 2) END
  WHERE id = ev
    AND (budget_planned, budget_actual) IS DISTINCT FROM
        (CASE WHEN n = 0 THEN NULL ELSE round(planned, 2) END, CASE WHEN n = 0 THEN NULL ELSE round(spent, 2) END);
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_budget_sync ON public.event_budget_items;
CREATE TRIGGER tr_event_budget_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.event_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.event_budget_sync();

-- -----------------------------------------------------------------------------
-- 3. Activity log: who did what on each event (super admins read it)
--    Written only by the triggers below, never directly by users.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_activity (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  actor      text NOT NULL,
  action     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_activity_event ON public.event_activity (event_id, created_at DESC);

ALTER TABLE public.event_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_activity_super_read ON public.event_activity;
CREATE POLICY event_activity_super_read ON public.event_activity
  FOR SELECT TO authenticated USING (public.is_club_super_admin());
REVOKE ALL ON public.event_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_activity TO authenticated;

-- Skips events that are being deleted (their log goes with them).
CREATE OR REPLACE FUNCTION public.log_event_activity(p_event uuid, p_action text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.event_activity (event_id, actor, action)
  SELECT p_event, COALESCE(NULLIF(public.club_jwt_email(), ''), 'system'), p_action
  WHERE p_action IS NOT NULL AND p_action <> ''
    AND EXISTS (SELECT 1 FROM public.events WHERE id = p_event);
$$;
REVOKE ALL ON FUNCTION public.log_event_activity(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.money_txt(n numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN n IS NULL THEN '—' ELSE '₹' || trim(to_char(n, 'FM999G999G990D00')) END $$;

-- Events: creation and every field that matters, in plain words.
CREATE OR REPLACE FUNCTION public.event_activity_events()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[] := '{}';
  onoff text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.id,
      CASE WHEN NEW.created_by LIKE 'proposal:%' THEN 'Created the event from a proposal' ELSE 'Created the event' END);
    RETURN NULL;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN parts := parts || format('renamed it from "%s" to "%s"', OLD.title, NEW.title); END IF;
  IF (NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.start_date, OLD.end_date) THEN
    parts := parts || format('moved the dates to %s – %s', to_char(NEW.start_date, 'DD Mon YYYY'), to_char(NEW.end_date, 'DD Mon YYYY'));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN parts := parts || 'edited the description'::text; END IF;
  IF NEW.is_online IS DISTINCT FROM OLD.is_online THEN parts := parts || CASE WHEN NEW.is_online THEN 'made it online' ELSE 'made it in person' END; END IF;
  IF NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
    parts := parts || COALESCE('set the venue to ' || (SELECT name FROM public.venues WHERE id = NEW.venue_id), 'cleared the venue');
  END IF;
  IF NEW.venue_booked IS DISTINCT FROM OLD.venue_booked THEN parts := parts || CASE WHEN NEW.venue_booked THEN 'ticked "venue booked"' ELSE 'unticked "venue booked"' END; END IF;
  IF NEW.poster_path IS DISTINCT FROM OLD.poster_path THEN parts := parts || CASE WHEN NEW.poster_path IS NULL THEN 'removed the poster' ELSE 'uploaded the poster' END; END IF;
  IF NEW.report_path IS DISTINCT FROM OLD.report_path THEN parts := parts || CASE WHEN NEW.report_path IS NULL THEN 'removed the report' ELSE 'uploaded the report' END; END IF;
  IF NEW.budget_sheet_path IS DISTINCT FROM OLD.budget_sheet_path THEN parts := parts || CASE WHEN NEW.budget_sheet_path IS NULL THEN 'removed the budget sheet' ELSE 'uploaded the budget sheet' END; END IF;
  IF NEW.attendance_posted IS DISTINCT FROM OLD.attendance_posted THEN parts := parts || CASE WHEN NEW.attendance_posted THEN 'ticked "attendance posted"' ELSE 'unticked "attendance posted"' END; END IF;
  IF NEW.od_posted IS DISTINCT FROM OLD.od_posted THEN parts := parts || CASE WHEN NEW.od_posted THEN 'ticked "OD posted"' ELSE 'unticked "OD posted"' END; END IF;
  IF NEW.calendar_confirmed IS DISTINCT FROM OLD.calendar_confirmed THEN parts := parts || CASE WHEN NEW.calendar_confirmed THEN 'confirmed it for the members'' calendar' ELSE 'took it off the members'' calendar' END; END IF;
  IF (NEW.completed_at IS NULL) IS DISTINCT FROM (OLD.completed_at IS NULL) THEN
    parts := parts || CASE WHEN NEW.completed_at IS NOT NULL THEN 'marked it completed successfully (points credited)' ELSE 'reopened it (points withdrawn)' END;
  END IF;
  IF NEW.website_published IS DISTINCT FROM OLD.website_published THEN parts := parts || CASE WHEN NEW.website_published THEN 'published it on the website' ELSE 'took it off the website' END; END IF;
  IF NEW.website_featured IS DISTINCT FROM OLD.website_featured THEN parts := parts || CASE WHEN NEW.website_featured THEN 'featured it on the home page' ELSE 'unfeatured it' END; END IF;
  IF (NEW.website_blurb, NEW.website_details, NEW.website_tags, NEW.website_cover, NEW.website_gallery, NEW.website_link)
     IS DISTINCT FROM (OLD.website_blurb, OLD.website_details, OLD.website_tags, OLD.website_cover, OLD.website_gallery, OLD.website_link) THEN
    parts := parts || 'edited the website details'::text;
  END IF;
  -- Budget totals change through budget lines (logged there); only log hand edits.
  IF (NEW.budget_planned, NEW.budget_actual) IS DISTINCT FROM (OLD.budget_planned, OLD.budget_actual)
     AND NOT EXISTS (SELECT 1 FROM public.event_budget_items WHERE event_id = NEW.id) THEN
    parts := parts || format('set the budget to %s planned, %s spent', public.money_txt(NEW.budget_planned), public.money_txt(NEW.budget_actual));
  END IF;

  IF cardinality(parts) > 0 THEN
    onoff := array_to_string(parts, '; ');
    PERFORM public.log_event_activity(NEW.id, upper(left(onoff, 1)) || substr(onoff, 2));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_events ON public.events;
CREATE TRIGGER tr_event_activity_events
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_events();

-- Coordinators, volunteers and attendees.
CREATE OR REPLACE FUNCTION public.event_activity_attendance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who text;
  role_new text;
  role_old text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    who := (SELECT full_name FROM public.applications WHERE id = OLD.member_id);
  ELSE
    who := (SELECT full_name FROM public.applications WHERE id = NEW.member_id);
    role_new := (SELECT name FROM public.contribution_types WHERE id = NEW.type_id);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    role_old := (SELECT name FROM public.contribution_types WHERE id = OLD.type_id);
  END IF;
  role_new := lower(regexp_replace(coalesce(role_new, 'attendee'), ' (at|for) an event$', '', 'i'));
  role_old := lower(regexp_replace(coalesce(role_old, 'attendee'), ' (at|for) an event$', '', 'i'));
  who := coalesce(who, 'a member');

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Added %s as %s', who, role_new));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Removed %s (%s)', who, role_old));
  ELSIF NEW.type_id IS DISTINCT FROM OLD.type_id THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Changed %s from %s to %s', who, role_old, role_new));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_attendance ON public.event_attendance;
CREATE TRIGGER tr_event_activity_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_attendance();

-- Budget lines.
CREATE OR REPLACE FUNCTION public.event_activity_budget()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  label text;
  parts text[] := '{}';
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Removed %s "%s" from the budget', OLD.kind, coalesce(nullif(OLD.item, ''), OLD.category)));
    RETURN NULL;
  END IF;
  label := format('%s "%s"', NEW.kind, coalesce(nullif(NEW.item, ''), NEW.category));
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Added %s to the budget', label));
    RETURN NULL;
  END IF;
  IF (NEW.item, NEW.category) IS DISTINCT FROM (OLD.item, OLD.category) THEN parts := parts || 'renamed it'::text; END IF;
  IF (NEW.quantity, NEW.unit_cost) IS DISTINCT FROM (OLD.quantity, OLD.unit_cost) THEN
    parts := parts || format('planned %s', public.money_txt(NEW.quantity * NEW.unit_cost));
  END IF;
  IF NEW.actual IS DISTINCT FROM OLD.actual THEN parts := parts || format('actual %s', public.money_txt(NEW.actual)); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN parts := parts || format('marked %s', NEW.status); END IF;
  IF NEW.paid_by IS DISTINCT FROM OLD.paid_by THEN parts := parts || format('paid by %s', coalesce(NEW.paid_by, '—')); END IF;
  IF NEW.receipt_file_id IS DISTINCT FROM OLD.receipt_file_id THEN
    parts := parts || CASE WHEN NEW.receipt_file_id IS NULL THEN 'removed the receipt' ELSE 'attached a receipt' END;
  END IF;
  IF cardinality(parts) > 0 THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Budget %s: %s', label, array_to_string(parts, ', ')));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_budget ON public.event_budget_items;
CREATE TRIGGER tr_event_activity_budget
  AFTER INSERT OR UPDATE OR DELETE ON public.event_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_budget();

-- Files in the event's drive folder.
CREATE OR REPLACE FUNCTION public.event_activity_drive()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.event_id IS NOT NULL THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Uploaded "%s" to the event''s files', NEW.name));
  ELSIF TG_OP = 'DELETE' AND OLD.event_id IS NOT NULL THEN
    PERFORM public.log_event_activity(OLD.event_id, format('Deleted "%s" from the event''s files', OLD.name));
  ELSIF TG_OP = 'UPDATE' AND NEW.event_id IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
    PERFORM public.log_event_activity(NEW.event_id, format('Renamed file "%s" to "%s"', OLD.name, NEW.name));
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_event_activity_drive ON public.drive_files;
CREATE TRIGGER tr_event_activity_drive
  AFTER INSERT OR UPDATE OR DELETE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.event_activity_drive();

-- -----------------------------------------------------------------------------
-- 4. Points from events count once the event is completed
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
WITH points AS (
  SELECT c.member_id, c.points_awarded AS points, 1 AS is_contribution
  FROM public.contributions c
  WHERE c.status = 'approved'
  UNION ALL
  SELECT ea.member_id, ct.default_points, 0
  FROM public.event_attendance ea
  JOIN public.contribution_types ct ON ct.id = ea.type_id
  JOIN public.events e ON e.id = ea.event_id
  WHERE e.completed_at IS NOT NULL
)
SELECT
  rank() OVER (ORDER BY coalesce(sum(p.points), 0) DESC)::integer AS rank,
  a.id                                                         AS member_id,
  a.full_name,
  a.member_department                                          AS department,
  coalesce(sum(p.points), 0)::integer                          AS total_points,
  coalesce(sum(p.is_contribution), 0)::integer                 AS contribution_count
FROM public.applications a
LEFT JOIN points p ON p.member_id = a.id
WHERE a.is_member AND NOT a.is_lead AND a.member_status = 'active'
GROUP BY a.id, a.full_name, a.member_department;

REVOKE ALL ON public.leaderboard FROM PUBLIC;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- A member's own attendance: points show once the event is completed.
CREATE OR REPLACE FUNCTION public.my_attendance()
RETURNS TABLE (id uuid, event_id uuid, event_title text, start_date date, role text, points integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ea.id, e.id, e.title, e.start_date, ct.name,
         CASE WHEN e.completed_at IS NOT NULL THEN ct.default_points ELSE 0 END
  FROM public.event_attendance ea
  JOIN public.events e ON e.id = ea.event_id
  JOIN public.contribution_types ct ON ct.id = ea.type_id
  WHERE ea.member_id = public.current_member_id()
  ORDER BY e.start_date DESC;
$$;

COMMIT;
