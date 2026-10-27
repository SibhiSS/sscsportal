/**
 * Centralized email sending utility for IEEE SSCS Portal.
 * All email sends go through this module for consistency,
 * idempotency, and rate-limiting protection.
 */

import { supabase } from '@/lib/supabase';

/**
 * FIX #14 — Masks an email address for safe logging.
 * e.g. "jane.doe2024@vitstudent.ac.in" → "ja***@vitstudent.ac.in"
 */
function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return local.slice(0, 2) + '***@' + domain;
}

/**
 * Per-send idempotency key.
 *
 * Sent to the send-email Edge Function as dedupeId. The function's `send`
 * action inserts into mail_queue with this as the (unique) dedupe_id before
 * attempting delivery, so a browser retry of the same logical email is
 * recognised and answered from the existing row rather than sent twice.
 */
function newDedupeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Optional hook that ties a send to a bounded server-side side effect —
 * e.g. flipping applications.shortlist_notified — applied by a Postgres
 * trigger the MOMENT the send-email function confirms the ESP accepted the
 * message, never before. See migration_mail_queue.sql section 3. Omit it for
 * mail that has nothing to flip.
 */
export interface MailSideEffect {
    purpose: 'shortlist_notify' | 'publish_selected' | 'publish_rejected' | 'committee_offer' | 'position_offer';
    targetApplicationId: string;
    /** Only read by purpose = 'committee_offer'. */
    assignedPosition?: string;
}

/**
 * Send a single email via the send-email Supabase Edge Function.
 *
 * This replaced a Google Apps Script relay called with `mode: 'no-cors'`,
 * which meant the return value here used to mean "the browser didn't throw
 * before the request left" — never "delivered". supabase.functions.invoke()
 * is a same-origin-authenticated, readable HTTP call: the Edge Function
 * actually talks to the configured ESP (Resend/Brevo/SES — see
 * supabase/functions/send-email) and this returns its REAL answer. Code that
 * gates a database write on this return value (shortlist_notified, publish
 * results, committee/position offers) is now gating it on an email that
 * genuinely sent, not on an unread response.
 *
 * The caller's own Supabase session is what authenticates this call — no
 * shared secret compiled into the JS bundle anymore. The Edge Function's
 * allowlist (mirroring the old relay's ALLOWED_DOMAINS/ALLOWED_ADDRESSES) is
 * what stops an authenticated session being used to mail an arbitrary
 * third party.
 */
export async function sendEmail(
    email: string,
    subject: string,
    message: string,
    sideEffect?: MailSideEffect
): Promise<boolean> {
    const dedupeId = newDedupeId();

    // Clean up HTML whitespace & append the hidden ref tag so Gmail-side
    // clients never collapse the body into quoted text on a resend.
    const cleanedMessage = message
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    const formattedBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; font-size: 14px; line-height: 1.6; max-width: 600px;">
            ${cleanedMessage}
            <div style="display:none !important; font-size:1px; color:#ffffff; opacity:0; overflow:hidden; mso-hide:all;">
                Ref ID: ${dedupeId}
            </div>
        </div>
    `.trim();

    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                action: 'send',
                to: email,
                subject,
                html: formattedBody,
                dedupeId,
                purpose: sideEffect?.purpose,
                targetApplicationId: sideEffect?.targetApplicationId,
                assignedPosition: sideEffect?.assignedPosition,
            },
        });

        if (error) {
            console.error(`[Email] ✗ send-email invocation failed for ${maskEmail(email)} — "${subject}": ${error.message}`);
            return false;
        }

        if (data?.success !== true) {
            console.warn(`[Email] ✗ Not delivered to ${maskEmail(email)} — "${subject}": ${data?.error ?? 'unknown reason'}`);
            return false;
        }

        console.log(`[Email] ✓ Dispatched to ${maskEmail(email)} — "${subject}"`);
        return true;
    } catch (error) {
        console.error(`[Email] ✗ Dispatch blocked before sending for ${maskEmail(email)} — "${subject}"`, error);
        return false;
    }
}

export interface BatchEmailItem {
    email: string;
    subject: string;
    message: string;
    sideEffect?: MailSideEffect;
}

export interface BatchEmailResult {
    /** How many were newly queued for sending. */
    queued: number;
    /** How many were already queued/sent from an earlier call with the same purpose+target (or dedupeId) — not an error. */
    skippedDuplicates: number;
}

/**
 * Enqueues many emails in a single admin-authenticated call instead of
 * looping sendEmail() in the browser.
 *
 * The old shape — a client-side `for` loop awaiting sendEmail() one at a
 * time with a fixed delay — depended on the admin's tab staying open for the
 * full length of a blast, and a closed laptop mid-send just stopped: whatever
 * hadn't been reached yet never went out, with no record of where it left
 * off. This call returns almost immediately; sending itself happens on the
 * Edge Function, in the background, and (via the pg_cron sweep set up by
 * migration_mail_queue_cron.sql) keeps draining even if nothing in the
 * browser is running anymore.
 *
 * Requires the caller to be signed in as an admin (checked server-side via
 * is_any_admin() — this function is not a way around that check, only a way
 * to skip re-implementing it in every call site).
 */
export async function enqueueMailBatch(
    items: BatchEmailItem[],
    batchLabel?: string
): Promise<BatchEmailResult> {
    if (items.length === 0) return { queued: 0, skippedDuplicates: 0 };

    const emails = items.map(item => {
        const cleaned = item.message
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; font-size: 14px; line-height: 1.6; max-width: 600px;">
                ${cleaned}
            </div>
        `.trim();

        return {
            to: item.email,
            subject: item.subject,
            html,
            purpose: item.sideEffect?.purpose,
            targetApplicationId: item.sideEffect?.targetApplicationId,
            assignedPosition: item.sideEffect?.assignedPosition,
        };
    });

    const { data, error } = await supabase.functions.invoke('send-email', {
        body: { action: 'enqueue', emails, batchLabel },
    });

    if (error) {
        throw new Error(`Could not queue the batch: ${error.message}`);
    }
    if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    }

    return { queued: data.queued ?? 0, skippedDuplicates: data.skippedDuplicates ?? 0 };
}
