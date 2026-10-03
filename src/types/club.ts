// Shapes of the club panel tables. Source of truth:
// supabase/migrations/20261003000000_club_panel.sql

/** A roster entry: the roster columns of `public.applications` (is_member = true). */
export interface Member {
  id: string;
  email: string;
  full_name: string;
  roll_number: string | null;
  phone: string | null;
  member_department: string | null;
  member_position: string | null;
  is_member: boolean;
  is_lead: boolean;
  member_status: 'active' | 'inactive';
  created_at: string;
}

/** What `my_member()` returns for the signed-in user. */
export type MyMember = Pick<
  Member,
  'id' | 'email' | 'full_name' | 'member_department' | 'member_position' | 'is_lead' | 'member_status'
>;

export type ContributionSource = 'submission' | 'attendance';

export interface ContributionType {
  id: string;
  category: string;
  name: string;
  default_points: number;
  source: ContributionSource;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

/** A club event, with its planning checklist. Admin-only table. */
export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  /** Calendar days, "YYYY-MM-DD". */
  start_date: string;
  end_date: string;
  is_online: boolean;
  venue_id: string | null;
  venue_booked: boolean;
  poster_path: string | null;
  report_path: string | null;
  budget_sheet_path: string | null;
  budget_planned: number | null;
  budget_actual: number | null;
  attendance_posted: boolean;
  od_posted: boolean;
  /** Upcoming events members may tag (past events always can). Super admins switch it. */
  shown_to_members: boolean;
  /** What the public website shows. Super admins only (enforced by a trigger). */
  website_published: boolean;
  website_featured: boolean;
  /** Position among featured (spotlight) events, lowest first; null = by date. */
  website_feature_order: number | null;
  website_blurb: string | null;
  website_details: string[];
  website_tags: string[];
  /** A "site-media" storage path, or a "/public" path like "/event1.jpg". */
  website_cover: string | null;
  website_gallery: string[];
  website_link: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A published event as the public site sees it (`website_events` view). */
export interface WebsiteEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  is_online: boolean;
  venue: string | null;
  featured: boolean;
  /** Missing until the feature-order migration has run. */
  feature_order?: number | null;
  blurb: string | null;
  details: string[];
  tags: string[];
  cover: string | null;
  gallery: string[];
  link: string | null;
}

export type TeamSection = 'faculty' | 'core' | 'lead';

/** A person on the public /team page (`website_team`). Faculty have no tenure. */
export interface TeamMember {
  id: string;
  section: TeamSection;
  tenure: string | null;
  name: string;
  role: string;
  quote: string | null;
  image: string | null;
  sort_order: number;
}

/** What members can see of an event, via `member_event_options()`. */
export interface EventOption {
  id: string;
  title: string;
  start_date: string;
}

/** A member's own attendance row, via `my_attendance()`. */
export interface MyAttendance {
  id: string;
  event_id: string;
  event_title: string;
  start_date: string;
  role: string;
  points: number;
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  /** Always an `attendance` contribution type (coordinator / volunteer / attendee). */
  type_id: string;
  marked_by: string | null;
  created_at: string;
}

export type ContributionStatus = 'pending' | 'approved' | 'rejected';

/** Most proof images a contribution can carry (enforced by the database). */
export const MAX_PROOF_IMAGES = 3;

export interface Contribution {
  id: string;
  /** 4-character lookup code assigned by the database, e.g. "K7Q2". */
  code: string;
  member_id: string;
  /** Always a `submission` contribution type. */
  type_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  proof_url: string | null;
  /** Storage paths in the contribution-proofs bucket, "<member id>/<file>". */
  proof_images: string[];
  status: ContributionStatus;
  points_awarded: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

/** Fields a member sends when submitting; everything else is set by the database or a reviewer. */
export type NewContribution = Pick<Contribution, 'member_id' | 'type_id' | 'title'> &
  Partial<Pick<Contribution, 'event_id' | 'description' | 'proof_url' | 'proof_images'>>;

export interface LeaderboardRow {
  rank: number;
  member_id: string;
  full_name: string;
  department: string | null;
  total_points: number;
  contribution_count: number;
}
