// Shapes of the admin-only tables. Source of truth:
// supabase/migrations/20261003000300_admin_panel.sql

import type { ClubEvent, Contribution, ContributionType } from '@/types/club';

export type { ClubEvent };

export interface Venue {
  id: string;
  name: string;
  short_name: string;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface VenueBooking {
  id: string;
  venue_id: string;
  booking_date: string;
  /** "HH:MM" (the database's "HH:MM:SS" is trimmed on load). */
  from_time: string;
  to_time: string;
  event_name: string;
  booked_by: string | null;
  phone: string | null;
  is_ours: boolean;
}

export type CalendarEntryType = 'holiday' | 'blocked' | 'exam' | 'buffer' | 'noclass' | 'vacation';

export interface CalendarEntry {
  id: string;
  entry_type: CalendarEntryType;
  title: string;
  start_date: string;
  end_date: string;
  note: string | null;
}

/** A roster row: the club-relevant columns of `applications`. */
export interface RosterMember {
  id: string;
  email: string;
  full_name: string;
  roll_number: string | null;
  phone: string | null;
  primary_dept: string | null;
  member_department: string | null;
  member_position: string | null;
  is_member: boolean;
  is_lead: boolean;
  member_status: 'active' | 'inactive';
  created_at: string;
}

export interface AttendanceRow {
  id: string;
  event_id: string;
  member_id: string;
  type_id: string;
}

export type AdminContribution = Contribution & {
  contribution_types: Pick<ContributionType, 'name' | 'category' | 'default_points'> | null;
};
