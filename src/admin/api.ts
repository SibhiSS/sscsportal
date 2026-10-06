import { supabase } from '@/lib/supabase';
import type {
  AdminContribution, AttendanceRow, BucketUsage, BudgetItem, CalendarEntry, ClubMeet, EventActivity, MeetAttendance, ClubEvent, DriveFile, DriveFolder, RosterMember, Venue, VenueBooking,
} from '@/types/admin';
import type { ContributionType, EventProposal, LeaderboardRow, TeamMember } from '@/types/club';
import { prepareProofImage, SITE_MEDIA_BUCKET } from '@/lib/club';
import { PANEL_ROLES, type PanelRole } from '@/lib/roles';
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

// ---- venue availability (board + collaborators) --------------------------------
// Collaborators can't read the venue tables; these functions give them names and
// busy times only. Rows are shaped like VenueBooking so the calendar helpers work.

export interface AvailabilityVenue { id: string; name: string; short_name: string }

export const fetchAvailabilityVenues = async () =>
  check(await supabase.rpc('availability_venues')) as AvailabilityVenue[];

export const fetchVenueDataAsOf = async () =>
  check(await supabase.rpc('venue_data_as_of')) as string | null;

export async function fetchBusySlots(fromIso: string, toIso: string): Promise<VenueBooking[]> {
  const rows = await fetchAll<{ venue_id: string; booking_date: string; from_time: string; to_time: string }>((from, to) =>
    supabase.rpc('venue_busy_slots', { p_from: fromIso, p_to: toIso }).range(from, to));
  return rows.map((b, i) => ({
    id: `${b.venue_id}|${b.booking_date}|${i}`, venue_id: b.venue_id, booking_date: b.booking_date,
    from_time: hhmm(b.from_time), to_time: hhmm(b.to_time), event_name: '', booked_by: null, phone: null, is_ours: false,
  }));
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

// ---- admin drive (private "admin-drive" bucket, 5 MB per file, 400 MB in total) ---------

export const DRIVE_BUCKET = 'admin-drive';
export const DRIVE_MAX_FILE = 5 * 1024 * 1024;
export const DRIVE_QUOTA = 400 * 1024 * 1024;
/** The project's whole storage allowance on Supabase's free plan. */
export const STORAGE_PLAN_BYTES = 1024 * 1024 * 1024;
export const DRIVE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,image/*';

export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export const fetchDriveFolders = async () =>
  check(await supabase.from('drive_folders').select('*').order('name')) as DriveFolder[];

export const fetchDriveFiles = async () =>
  fetchAll<DriveFile>((from, to) =>
    supabase.from('drive_files').select('*').order('created_at', { ascending: false }).range(from, to));

export const fetchEventDriveFiles = async (eventId: string) =>
  check(await supabase.from('drive_files').select('*').eq('event_id', eventId).order('created_at', { ascending: false })) as DriveFile[];

export const createDriveFolder = async (name: string, by: string) =>
  check(await supabase.from('drive_folders').insert({ name, created_by: by }).select().single()) as DriveFolder;

export const deleteDriveFolder = async (id: string) =>
  check(await supabase.from('drive_folders').delete().eq('id', id));

/** Files are named by the database; the storage path just needs to be unique and safe. */
const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file';

/**
 * Uploads one file into a drive location. Photos are shrunk like proof images
 * (staying under 5 MB); anything else over 5 MB is refused before uploading.
 */
export async function uploadDriveFile(file: File, where: { folder_id: string | null; event_id: string | null }, by: string) {
  let body: Blob = file;
  if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size > 1024 * 1024) body = await prepareProofImage(file);
  if (body.size > DRIVE_MAX_FILE) throw new Error(`${file.name} is larger than 5 MB.`);
  const area = where.event_id ? `events/${where.event_id}` : where.folder_id ? `folders/${where.folder_id}` : 'general';
  const path = `${area}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const contentType = body.type || file.type || 'application/octet-stream';
  check(await supabase.storage.from(DRIVE_BUCKET).upload(path, body, { contentType }));
  try {
    return check(await supabase.from('drive_files').insert({
      ...where, name: file.name.slice(0, 160), path, size: body.size, mime: contentType, uploaded_by: by,
    }).select().single()) as DriveFile;
  } catch (err) {
    await supabase.storage.from(DRIVE_BUCKET).remove([path]);
    throw err;
  }
}

export const updateDriveFile = async (id: string, p: Partial<Pick<DriveFile, 'name' | 'folder_id' | 'event_id'>>) =>
  check(await supabase.from('drive_files').update(p).eq('id', id).select().single()) as DriveFile;

export async function deleteDriveFile(f: Pick<DriveFile, 'id' | 'path'>) {
  check(await supabase.from('drive_files').delete().eq('id', f.id));
  const { error } = await supabase.storage.from(DRIVE_BUCKET).remove([f.path]);
  if (error) console.warn('[drive] Could not remove the stored file:', error.message);
}

/** A short-lived link that downloads the file under its own name. */
export async function driveDownloadUrl(f: Pick<DriveFile, 'path' | 'name'>) {
  const { data, error } = await supabase.storage.from(DRIVE_BUCKET).createSignedUrl(f.path, 60, { download: f.name });
  if (error) throw error;
  return data.signedUrl;
}

export const fetchStorageUsage = async () =>
  ((check(await supabase.rpc('storage_usage')) as BucketUsage[] | null) ?? []).map(r => ({ ...r, bytes: Number(r.bytes), files: Number(r.files) }));

// ---- event budgets ------------------------------------------------------------------

/** Postgres numerics arrive as strings; make them numbers. */
const toItem = (r: BudgetItem): BudgetItem => ({
  ...r, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost), actual: r.actual === null ? null : Number(r.actual),
});

export const fetchBudgetItems = async (eventId: string) =>
  ((check(await supabase.from('event_budget_items').select('*').eq('event_id', eventId)
    .order('kind').order('sort_order').order('created_at')) as BudgetItem[]) ?? []).map(toItem);

export const addBudgetItem = async (b: Partial<BudgetItem> & Pick<BudgetItem, 'event_id' | 'kind'>) =>
  toItem(check(await supabase.from('event_budget_items').insert(b).select().single()) as BudgetItem);

export const updateBudgetItem = async (id: string, p: Partial<BudgetItem>) =>
  toItem(check(await supabase.from('event_budget_items').update(p).eq('id', id).select().single()) as BudgetItem);

export const deleteBudgetItem = async (id: string) =>
  check(await supabase.from('event_budget_items').delete().eq('id', id));

// ---- activity log (super admins) -----------------------------------------------------

export const fetchEventActivity = async (eventId: string) =>
  check(await supabase.from('event_activity').select('*').eq('event_id', eventId)
    .order('created_at', { ascending: false }).limit(200)) as EventActivity[];

// ---- club meets (1 point online, 2 offline) -------------------------------------------

export const meetPoints = (online: boolean) => (online ? 1 : 2);

export const fetchMeets = async () =>
  check(await supabase.from('club_meets').select('*').order('meet_date', { ascending: false }).order('created_at', { ascending: false })) as ClubMeet[];

export const fetchMeetAttendance = async () =>
  fetchAll<MeetAttendance>((from, to) => supabase.from('meet_attendance').select('*').range(from, to));

export const createMeet = async (m: Pick<ClubMeet, 'title' | 'meet_date' | 'is_online'> & { created_by: string | null }) =>
  check(await supabase.from('club_meets').insert(m).select().single()) as ClubMeet;

export const updateMeet = async (id: string, p: Partial<Pick<ClubMeet, 'title' | 'meet_date' | 'is_online' | 'notes'>>) =>
  check(await supabase.from('club_meets').update(p).eq('id', id).select().single()) as ClubMeet;

export const deleteMeet = async (id: string) => check(await supabase.from('club_meets').delete().eq('id', id));

export const markMeet = async (meet_id: string, member_id: string, marked_by: string | null) =>
  check(await supabase.from('meet_attendance').insert({ meet_id, member_id, marked_by }).select().single()) as MeetAttendance;

export const unmarkMeet = async (id: string) => check(await supabase.from('meet_attendance').delete().eq('id', id));

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

export interface AdminRow { id: string; email: string; role: PanelRole; created_at: string; added_by: string | null }

export async function fetchAdmins() {
  const rows = check(await supabase.from('admins').select('id, email, role, created_at, added_by').in('role', [...PANEL_ROLES]).order('email')) as AdminRow[];
  return rows.sort((a, b) => PANEL_ROLES.indexOf(a.role) - PANEL_ROLES.indexOf(b.role));
}

export async function addAdmin(email: string, role: PanelRole, addedBy: string) {
  // A legacy row (old interviewer/viewer, now "member") may already exist for this email: promote it.
  // Case-insensitive exact match: escape LIKE wildcards ("_" is common in emails).
  const pattern = email.replace(/[\\%_]/g, c => '\\' + c);
  const existing = check(await supabase.from('admins').select('id').ilike('email', pattern).maybeSingle()) as { id: string } | null;
  if (existing) check(await supabase.from('admins').update({ role }).eq('id', existing.id));
  else check(await supabase.from('admins').insert({ email, role, added_by: addedBy }));
}

export const setAdminRole = async (id: string, role: PanelRole) =>
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
