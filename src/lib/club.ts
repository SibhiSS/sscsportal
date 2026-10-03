import { supabase } from '@/lib/supabase';
import type {
  Contribution,
  ContributionType,
  EventOption,
  LeaderboardRow,
  MyAttendance,
  MyMember,
  NewContribution,
  TeamMember,
  WebsiteEvent,
} from '@/types/club';

// Data access for the club panel. Every call runs as the signed-in user, so the
// row-level security in supabase/migrations/20261003000000_club_panel.sql
// decides what comes back.

export type ContributionWithRefs = Contribution & {
  contribution_types: Pick<ContributionType, 'name' | 'category' | 'default_points'> | null;
};

/** Turns database errors into something a member can act on. */
export function friendlyError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.code === '42501' || /row-level security/i.test(error.message ?? '')) {
    return "You don't have permission to do that.";
  }
  if (/Only .* contribution types/.test(error.message ?? '')) {
    return 'That contribution type cannot be submitted.';
  }
  return error.message || 'Something went wrong. Please try again.';
}

/** The signed-in user's roster entry, or null when they are not on the roster. */
export async function fetchMyMember(): Promise<MyMember | null> {
  const { data, error } = await supabase.rpc('my_member');
  if (error) throw error;
  return (data as MyMember[] | null)?.[0] ?? null;
}

/** Types a member can submit (not attendance roles), in display order. */
export async function fetchSubmissionTypes(): Promise<ContributionType[]> {
  const { data, error } = await supabase
    .from('contribution_types')
    .select('*')
    .eq('source', 'submission')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data as ContributionType[];
}

/** Events a member may tag: past ones, plus upcoming ones a super admin has opened up. */
export async function fetchEventOptions(): Promise<EventOption[]> {
  const { data, error } = await supabase.rpc('member_event_options');
  if (error) throw error;
  return (data ?? []) as EventOption[];
}

export async function fetchMyContributions(memberId: string): Promise<ContributionWithRefs[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*, contribution_types(name, category, default_points)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ContributionWithRefs[];
}

export async function fetchMyAttendance(): Promise<MyAttendance[]> {
  const { data, error } = await supabase.rpc('my_attendance');
  if (error) throw error;
  return (data ?? []) as MyAttendance[];
}

/** The member's leaderboard row, or null for leads and inactive members. */
export async function fetchLeaderboardRow(memberId: string): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data as LeaderboardRow | null;
}

/**
 * The public leaderboard: members who have earned points, best first. Ties share
 * a rank (the view uses rank()), so dropping the zeros never shifts anyone's rank.
 */
export async function fetchPublicLeaderboard(limit?: number): Promise<LeaderboardRow[]> {
  let query = supabase
    .from('leaderboard')
    .select('*')
    .gt('total_points', 0)
    .order('rank')
    .order('full_name');
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

// ---------------------------------------------------------------------------
// Website events (public "website_events" view + public "site-media" bucket)
// ---------------------------------------------------------------------------

export const SITE_MEDIA_BUCKET = 'site-media';

/** Turns a stored image reference into a URL: "/public" paths pass through, storage paths go via the public bucket. */
export function siteMediaUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith('/') || /^https?:\/\//.test(ref)) return ref;
  return supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(ref).data.publicUrl;
}

/** How many events the home page shows. */
export const HOME_EVENT_SLOTS = 4;

/** Spotlight order: lowest position first, unpositioned ones after, newest first within a tie. */
export function byFeatureOrder<T extends { start_date: string }>(order: (e: T) => number | null | undefined) {
  return (a: T, b: T) => {
    const oa = order(a) ?? Infinity, ob = order(b) ?? Infinity;
    return oa !== ob ? oa - ob : b.start_date.localeCompare(a.start_date);
  };
}

/** What the home page shows: featured events in spotlight order, or the latest published ones if none are featured. */
export function homeEvents<T extends { start_date: string }>(
  published: T[], isFeatured: (e: T) => boolean, order: (e: T) => number | null | undefined = () => null,
): T[] {
  const byNewest = [...published].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const featured = byNewest.filter(isFeatured).sort(byFeatureOrder(order));
  return (featured.length ? featured : byNewest).slice(0, HOME_EVENT_SLOTS);
}

/** "Today" as YYYY-MM-DD in India, where the club's dates live. */
export const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * Exactly what the home page's Events section shows, shared with the admin
 * preview: the next upcoming published event, then `homeEvents` of the past ones.
 */
export function splitHomeEvents<T extends { start_date: string; end_date: string }>(
  published: T[], isFeatured: (e: T) => boolean, today = todayIst(), order?: (e: T) => number | null | undefined,
): { upNext: T | null; past: T[] } {
  const upcoming = published.filter(e => e.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return { upNext: upcoming[0] ?? null, past: homeEvents(published.filter(e => e.end_date < today), isFeatured, order) };
}

/** Every published event, newest first. Readable signed out. */
export async function fetchWebsiteEvents(): Promise<WebsiteEvent[]> {
  const { data, error } = await supabase
    .from('website_events')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WebsiteEvent[];
}

/** Everyone on the /team page, in display order. Readable signed out. */
export async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('website_team')
    .select('id, section, tenure, name, role, quote, image, sort_order')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

/** Tenures that have anyone in them, newest first ("2026-27", "2025-26", …). */
export const teamTenures = (team: TeamMember[]) =>
  [...new Set(team.map(m => m.tenure).filter((t): t is string => !!t))].sort().reverse();

/** Inserts the contribution and returns the lookup code the database assigned. */
export async function submitContribution(input: NewContribution): Promise<string> {
  const { data, error } = await supabase.from('contributions').insert(input).select('code').single();
  if (error) throw error;
  return (data as { code: string }).code;
}

/** Withdraw a pending contribution and its images. Reviewed ones are protected by RLS. */
export async function withdrawContribution(contribution: Pick<Contribution, 'id' | 'proof_images'>): Promise<void> {
  const { data, error } = await supabase
    .from('contributions')
    .delete()
    .eq('id', contribution.id)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This contribution has already been reviewed and cannot be withdrawn.');
  await removeProofImages(contribution.proof_images);
}

// ---------------------------------------------------------------------------
// Proof images (private "contribution-proofs" bucket, "<member id>/<file>")
// ---------------------------------------------------------------------------

export const PROOF_BUCKET = 'contribution-proofs';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;

/**
 * Downscales a photo to at most 1600px on its longest side and re-encodes it as
 * JPEG, so phone photos fit the bucket's 5 MB limit. GIFs are kept as they are.
 */
export async function prepareProofImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} can't be read. Use a JPG, PNG or WebP image.`);
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error(`${file.name} couldn't be processed.`);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is still larger than 5 MB after resizing.`);
  return blob;
}

/** Uploads prepared images into the member's folder and returns their storage paths. */
export async function uploadProofImages(memberId: string, images: Blob[]): Promise<string[]> {
  const paths: string[] = [];
  try {
    for (const image of images) {
      const ext = image.type === 'image/gif' ? 'gif' : 'jpg';
      const path = `${memberId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, image, { contentType: image.type });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  } catch (err) {
    await removeProofImages(paths);
    throw err;
  }
}

/** Best-effort cleanup; a leftover file is harmless, so failures are only logged. */
export async function removeProofImages(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(PROOF_BUCKET).remove(paths);
  if (error) console.warn('[club] Could not remove proof images:', error.message);
}

/** Short-lived viewing links for private images, keyed by storage path. */
export async function signProofImages(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
