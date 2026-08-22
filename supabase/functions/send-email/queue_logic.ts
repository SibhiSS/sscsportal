// Pure logic shared by the request handler — kept separate from index.ts so it
// can be unit tested without a Supabase client, a live database, or Deno's
// Edge Runtime globals, none of which are available outside a deployed
// function. index.ts should do nothing this file could do instead.

export type MailPurpose =
  | 'shortlist_notify'
  | 'publish_selected'
  | 'publish_rejected'
  | 'committee_offer'
  | 'position_offer';

export const VALID_PURPOSES: readonly MailPurpose[] = [
  'shortlist_notify',
  'publish_selected',
  'publish_rejected',
  'committee_offer',
  'position_offer',
];

export interface EnqueueItem {
  to: string;
  subject: string;
  html: string;
  dedupeId?: string;
  purpose?: MailPurpose;
  targetApplicationId?: string;
  assignedPosition?: string;
}

/**
 * Mirrors mail_queue_dedupe_id() in migration_mail_queue.sql exactly. Kept in
 * two places deliberately: the SQL version is the actual source of truth
 * (nothing stops a future direct insert from bypassing this file), but the
 * Edge Function computes its own copy so ON CONFLICT DO NOTHING here behaves
 * identically to what the database would derive — a double-enqueue is
 * recognised as a duplicate on the FIRST insert attempt, not only if it ever
 * reached a raw SQL path.
 */
export function buildDedupeId(
  purpose: MailPurpose | undefined,
  targetApplicationId: string | undefined,
  fallback: string | undefined,
): string {
  if (purpose && targetApplicationId) {
    return `${purpose}:${targetApplicationId}`;
  }
  return fallback || crypto.randomUUID();
}

export interface ValidationError {
  index: number;
  reason: string;
}

/**
 * Every failure mode caught here would otherwise surface as either a
 * confusing Postgres constraint violation (mail_queue_purpose_needs_target)
 * or, worse, silently mail the wrong template because a required field was
 * missing. Checked before a single row reaches the database, and ALL items
 * are validated before any are inserted — a bulk call with one bad row fails
 * clearly instead of half-sending.
 */
export function validateEnqueueItems(items: EnqueueItem[]): ValidationError[] {
  const errors: ValidationError[] = [];

  items.forEach((item, index) => {
    if (!item.to || !item.to.includes('@')) {
      errors.push({ index, reason: 'missing or invalid "to" address' });
    }
    if (!item.subject || item.subject.trim().length === 0) {
      errors.push({ index, reason: 'missing "subject"' });
    }
    if (!item.html || item.html.trim().length === 0) {
      errors.push({ index, reason: 'missing "html"' });
    }
    if (item.purpose && !VALID_PURPOSES.includes(item.purpose)) {
      errors.push({ index, reason: `unknown purpose "${item.purpose}"` });
    }
    if (item.purpose && !item.targetApplicationId) {
      errors.push({ index, reason: `purpose "${item.purpose}" requires targetApplicationId` });
    }
    if (item.purpose === 'committee_offer' && !item.assignedPosition) {
      errors.push({ index, reason: 'purpose "committee_offer" requires assignedPosition' });
    }
  });

  return errors;
}

/**
 * How long to wait between sends while draining the queue, in milliseconds.
 * Conservative on purpose — every provider adapter here supports far higher
 * throughput, but there is no upside to finding out a specific account's
 * actual rate limit the hard way in the middle of a shortlist blast.
 */
export const DRAIN_DELAY_MS = 400;

/** Default cap on how many rows one drain pass claims and sends. */
export const DEFAULT_DRAIN_LIMIT = 25;
