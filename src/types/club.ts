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

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
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
