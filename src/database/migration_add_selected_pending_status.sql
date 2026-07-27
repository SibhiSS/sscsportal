-- ==============================================================================
-- FIX: Add 'selected_pending' as an internal staging status
-- ==============================================================================
-- Problem: When admins drag a candidate to "Selected" in the Kanban board, the
-- status immediately becomes 'selected', which the applicant portal detects and
-- shows a "Congratulations!" screen — before results are officially published.
--
-- Solution: Introduce 'selected_pending' as an internal admin-only staging bucket.
-- Applicants with this status see "Under Review" (the default fallback in Apply.tsx).
-- Only when the admin clicks "Publish Results" are these records promoted to
-- 'active_member' with an email sent — making the selection official.
-- ==============================================================================

-- 1. Drop the old check constraint that only allows the original statuses
ALTER TABLE public.applications
DROP CONSTRAINT IF EXISTS applications_status_check;

-- 2. Re-add with selected_pending included
ALTER TABLE public.applications
ADD CONSTRAINT applications_status_check
CHECK (status IN (
  'applied',
  'pending',
  'under_review',
  'neutral',
  'shortlisted',
  'interview_scheduled',
  'interviewed',
  'selected_pending',   -- NEW: admin internal draft bucket (hidden from applicants)
  'selected',           -- published / applicant-visible
  'active_member',
  'waitlisted',
  'rejected',
  'rejected_pending',
  'alumni',
  'inactive'
));
