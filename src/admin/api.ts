import { supabase } from '@/lib/supabase';
import type {
  AdminContribution, AttendanceRow, CalendarEntry, ClubEvent, RosterMember, Venue, VenueBooking,
} from '@/types/admin';
import type { ContributionType, EventProposal, LeaderboardRow, TeamMember } from '@/types/club';
import { prepareProofImage, SITE_MEDIA_BUCKET } from '@/lib/club';
import type { ImportRow } from './calendarLogic';

// Admin data access. Every table here is admin-only under RLS.

type PgError = { message?: string; code?: string } | null;
const check = <T>({ data, error }: { data: T | null; error: PgError }): T => {
  if (error) throw error;
  return data as T;
};

/** Reads past PostgREST's per-request row cap in pages of 1000. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PgError }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await build(from, from + 999)) ?? [];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const hhmm = (t: string) => t.slice(0, 5);

// ---- venues + bookings -------------------------------------------------------

export const fetchVenues = async () =>
  check(await supabase.from('venues').select('*').order('sort_order').order('name')) as Venue[];

export async function saveVenue(v: Venue, isNew: boolean) {
  if (isNew) check(await supabase.from('venues').insert(v));
  else check(await supabase.from('venues').update({
    name: v.name, short_name: v.short_name, notes: v.notes, is_active: v.is_active, sort_order: v.sort_order,
  }).eq('id', v.id));
}

export async function fetchBookings(): Promise<VenueBooking[]> {
  const rows = await fetchAll<VenueBooking>((from, to) =>
    supabase.from('venue_bookings').select('*').order('booking_date').order('from_time').range(from, to));
  return rows.map(b => ({ ...b, from_time: hhmm(b.from_time), to_time: hhmm(b.to_time) }));
}

export const addBooking = async (b: Omit<VenueBooking, 'id'>) =>
  check(await supabase.from('venue_bookings').insert(b));

export const setBookingOurs = async (id: string, is_ours: boolean) =>
  check(await supabase.from('venue_bookings').update({ is_ours }).eq('id', id));

export const deleteBooking = async (id: string) =>
  check(await supabase.from('venue_bookings').delete().eq('id', id));

export async function importBookings(rows: ImportRow[]) {
  const data = check(await supabase.rpc('import_venue_bookings', { rows })) as
    { imported: number; replaced: number; venue_days: number }[];
  return data[0];
}

// ---- calendar entries + events ----------------------------------------------

export const fetchEntries = async () =>
  check(await supabase.from('calendar_entries').select('*').order('start_date')) as CalendarEntry[];

export async function saveEntry(e: Omit<CalendarEntry, 'id'>, id?: string) {
  if (id) check(await supabase.from('calendar_entries').update(e).eq('id', id));
  else check(await supabase.from('calendar_entries').insert(e));
}

export const deleteEntry = async (id: string) =>
  check(await supabase.from('calendar_entries').delete().eq('id', id));

export const fetchEvents = async () =>
  check(await supabase.from('events').select('*').order('start_date')) as ClubEvent[];

export async function createEvent(e: Partial<ClubEvent> & Pick<ClubEvent, 'title' | 'start_date' | 'end_date'>) {
  return check(await supabase.from('events').insert(e).select('*').single()) as ClubEvent;
}

export async function updateEvent(id: string, patch: Partial<ClubEvent>) {
  return check(await supabase.from('events').update(patch).eq('id', id).select('*').single()) as ClubEvent;
}

export const deleteEvent = async (id: string) =>
  check(await supabase.from('events').delete().eq('id', id));

// ---- settings ------------------------------------------------------------------

export async function fetchSettings(): Promise<Record<string, unknown>> {
  const rows = check(await supabase.from('club_settings').select('key, value')) as { key: string; value: unknown }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export const saveSetting = async (key: string, value: unknown) =>
  check(await supabase.from('club_settings').upsert({ key, value, updated_at: new Date().toISOString() }));

// ---- roster ----------------------------------------------------------------------

const ROSTER_COLS =
  'id, email, full_name, roll_number, phone, primary_dept, member_department, member_position, is_member, is_lead, member_status, created_at';

export const fetchRoster = async () =>
  check(await supabase.from('applications').select(ROSTER_COLS).eq('is_member', true).order('full_name')) as RosterMember[];

/** Former applicants who are not on the roster, to add them with one click. Super admins only. */
export const fetchNonMembers = async () =>
  check(await supabase.from('applications').select(ROSTER_COLS).eq('is_member', false).order('full_name')) as RosterMember[];

export const updateMember = async (id: string, patch: Partial<RosterMember>) =>
  check(await supabase.from('applications').update(patch).eq('id', id));

/** Takes someone off the roster. A function, because the row stops being visible to an admin. */
export const removeFromRoster = async (id: string) =>
  check(await supabase.rpc('remove_from_roster', { p_id: id }));

export const addMember = async (m: Pick<RosterMember, 'email' | 'full_name'> & Partial<RosterMember>) =>
  check(await supabase.from('applications').insert({ ...m, is_member: true }));

// ---- attendance --------------------------------------------------------------------

export const fetchAttendanceTypes = async () =>
  check(await supabase.from('contribution_types').select('*').eq('source', 'attendance').order('sort_order')) as ContributionType[];

export const fetchAllAttendance = async () =>
  fetchAll<AttendanceRow>((from, to) =>
    supabase.from('event_attendance').select('id, event_id, member_id, type_id').range(from, to));

export const addAttendance = async (event_id: string, member_id: string, type_id: string, marked_by: string) =>
  check(await supabase.from('event_attendance').insert({ event_id, member_id, type_id, marked_by }));

export const setAttendanceType = async (id: string, type_id: string) =>
  check(await supabase.from('event_attendance').update({ type_id }).eq('id', id));

export const removeAttendance = async (id: string) =>
  check(await supabase.from('event_attendance').delete().eq('id', id));

// ---- contributions + leaderboard -------------------------------------------------

export const fetchMemberContributions = async (memberId: string) =>
  check(await supabase.from('contributions')
    .select('*, contribution_types(name, category, default_points)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })) as AdminContribution[];

export async function findContributionByCode(code: string) {
  const data = check(await supabase.from('contributions').select('id, member_id, code, title')
    .eq('code', code.toUpperCase()).maybeSingle()) as { id: string; member_id: string; code: string; title: string } | null;
  return data;
}

export async function countPendingContributions() {
  const { count, error } = await supabase.from('contributions').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

export const fetchLeaderboard = async () =>
  check(await supabase.from('leaderboard').select('*').order('rank').order('full_name')) as LeaderboardRow[];

// ---- event files (private bucket) -------------------------------------------------

export const EVENT_BUCKET = 'event-files';
export type EventFileKind = 'poster' | 'report' | 'budget';

export async function uploadEventFile(eventId: string, kind: EventFileKind, file: File) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const path = `${eventId}/${kind}-${crypto.randomUUID()}.${ext}`;
  check(await supabase.storage.from(EVENT_BUCKET).upload(path, file, { contentType: file.type || undefined }));
  return path;
}

export async function removeEventFile(path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from(EVENT_BUCKET).remove([path]);
  if (error) console.warn('[admin] Could not remove event file:', error.message);
}

export async function signEventFile(path: string, download?: string) {
  const { data, error } = await supabase.storage.from(EVENT_BUCKET)
    .createSignedUrl(path, 60 * 60, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

// ---- website images (public "site-media" bucket, super admins write) ---------------

/** Downscales like proof images do, uploads under the event's folder, returns the storage path. */
export async function uploadSiteImage(eventId: string, file: File) {
  const blob = await prepareProofImage(file);
  const ext = blob.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
  check(await supabase.storage.from(SITE_MEDIA_BUCKET).upload(path, blob, { contentType: blob.type }));
  return path;
}

/** Best-effort cleanup of uploaded images. "/public" paths (the seeded events) are left alone. */
export async function removeSiteImages(refs: (string | null)[]) {
  const paths = refs.filter((r): r is string => !!r && !r.startsWith('/') && !/^https?:/.test(r));
  if (!paths.length) return;
  const { error } = await supabase.storage.from(SITE_MEDIA_BUCKET).remove(paths);
  if (error) console.warn('[admin] Could not remove site images:', error.message);
}

// ---- team page (public "website_team" table, super admins write) --------------------

export type TeamMemberInput = Omit<TeamMember, 'id'>;

export const addTeamMember = async (m: TeamMemberInput) =>
  check(await supabase.from('website_team').insert(m).select().single()) as TeamMember;

export const updateTeamMember = async (id: string, p: Partial<TeamMemberInput>) =>
  check(await supabase.from('website_team').update(p).eq('id', id).select().single()) as TeamMember;

export async function deleteTeamMember(m: Pick<TeamMember, 'id' | 'image'>) {
  check(await supabase.from('website_team').delete().eq('id', m.id));
  await removeSiteImages([m.image]);
}

/** Saves the batch of new sort orders after a reorder. */
export async function reorderTeam(ids: string[]) {
  await Promise.all(ids.map((id, i) => supabase.from('website_team').update({ sort_order: i }).eq('id', id).then(r => check(r))));
}

/** Uploads an already-cropped face photo; returns its storage path. */
export async function uploadTeamPhoto(blob: Blob) {
  const path = `team/${crypto.randomUUID()}.jpg`;
  check(await supabase.storage.from(SITE_MEDIA_BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
  return path;
}

// ---- event proposals ----------------------------------------------------------------

export const fetchProposals = async () =>
  check(await supabase.from('event_proposals').select('*').order('created_at', { ascending: false }).limit(500)) as EventProposal[];

/** Super admins only (checked in the database). Creates the event and returns its id. */
export const acceptProposal = async (id: string, start: string, end: string, note: string) =>
  check(await supabase.rpc('accept_event_proposal', { p_id: id, p_start: start, p_end: end, p_note: note || null })) as string;

export const rejectProposal = async (id: string, note: string) =>
  check(await supabase.rpc('reject_event_proposal', { p_id: id, p_note: note || null }));

// ---- approvals ---------------------------------------------------------------------

export type ReviewFilter = 'pending' | 'approved' | 'rejected' | 'all';

export async function fetchContributionsForReview(filter: ReviewFilter): Promise<AdminContribution[]> {
  let q = supabase.from('contributions').select('*, contribution_types(name, category, default_points)');
  if (filter !== 'all') q = q.eq('status', filter);
  // Oldest first while waiting in the queue; newest first once reviewed.
  q = q.order('created_at', { ascending: filter === 'pending' }).limit(300);
  return check(await q) as AdminContribution[];
}

export async function reviewContribution(id: string, status: 'approved' | 'rejected', points: number | null, note: string | null) {
  return check(await supabase.rpc('review_contribution', {
    p_id: id, p_status: status, p_points: points, p_note: note,
  })) as AdminContribution;
}

// ---- settings: admins + contribution types ------------------------------------------

export interface AdminRow { id: string; email: string; role: 'super_admin' | 'admin' | 'member'; created_at: string; added_by: string | null }

export const fetchAdmins = async () =>
  check(await supabase.from('admins').select('id, email, role, created_at, added_by').in('role', ['super_admin', 'admin']).order('role', { ascending: false }).order('email')) as AdminRow[];

export async function addAdmin(email: string, role: 'super_admin' | 'admin', addedBy: string) {
  // A legacy row (old interviewer/viewer, now "member") may already exist for this email: promote it.
  // Case-insensitive exact match: escape LIKE wildcards ("_" is common in emails).
  const pattern = email.replace(/[\\%_]/g, c => '\\' + c);
  const existing = check(await supabase.from('admins').select('id').ilike('email', pattern).maybeSingle()) as { id: string } | null;
  if (existing) check(await supabase.from('admins').update({ role }).eq('id', existing.id));
  else check(await supabase.from('admins').insert({ email, role, added_by: addedBy }));
}

export const setAdminRole = async (id: string, role: 'super_admin' | 'admin') =>
  check(await supabase.from('admins').update({ role }).eq('id', id));

export const removeAdmin = async (id: string) =>
  check(await supabase.from('admins').delete().eq('id', id));

export const fetchAllTypes = async () =>
  check(await supabase.from('contribution_types').select('*').order('sort_order').order('name')) as ContributionType[];

export async function saveType(t: Partial<ContributionType> & Pick<ContributionType, 'category' | 'name' | 'default_points'>) {
  if (t.id) {
    check(await supabase.from('contribution_types').update({
      category: t.category, name: t.name, default_points: t.default_points, is_active: t.is_active,
    }).eq('id', t.id));
  } else {
    check(await supabase.from('contribution_types').insert(t));
  }
}

export const deleteType = async (id: string) =>
  check(await supabase.from('contribution_types').delete().eq('id', id));

/** Puts a reviewed contribution back in the queue: its points come off and the review is cleared. */
export async function reopenContribution(id: string) {
  return check(await supabase.rpc('reopen_contribution', { p_id: id })) as AdminContribution;
}

/** Deletes a contribution and its proof images. */
export async function deleteContribution(c: Pick<AdminContribution, 'id' | 'proof_images'>) {
  check(await supabase.from('contributions').delete().eq('id', c.id));
  if (c.proof_images?.length) {
    const { error } = await supabase.storage.from('contribution-proofs').remove(c.proof_images);
    if (error) console.warn('[admin] Could not remove proof images:', error.message);
  }
}
