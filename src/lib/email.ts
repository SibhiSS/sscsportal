/**
 * Centralized email sending utility for IEEE SSCS Portal.
 * All email sends go through this module for consistency,
 * idempotency, and rate-limiting protection.
 */

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

/**
 * Shared secret checked by the Apps Script `doPost` before it will send anything.
 *
 * This is NOT authentication — like every VITE_* value it is compiled into the public
 * bundle, so anyone willing to read the JS can extract it. It exists to stop drive-by
 * abuse of what was otherwise a completely open relay: the endpoint URL alone was
 * enough to send arbitrary mail from the club Gmail account, which burns the ~100/day
 * send quota and silently kills real interview and result emails.
 *
 * The durable fix is to move sending behind a Supabase Edge Function that validates
 * the caller's JWT and holds this token server-side. Until then, rotate the token in
 * Script Properties whenever it is abused.
 */
const MAIL_TOKEN = import.meta.env.VITE_MAIL_RELAY_TOKEN;

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
 * The relay records it in CacheService and ignores a repeat within the dedupe window,
 * so a re-POST — from a browser retry, an admin double-click, or a re-run of a batch —
 * can never become a second copy of the same email. The same value is embedded in the
 * body as the hidden Ref ID, so a duplicate in someone's inbox can be traced back to
 * either one send that got through twice or two genuinely separate sends.
 */
function newDedupeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Send a single email via Google Apps Script.
 *
 * Note: Uses `mode: 'no-cors'` because Google Apps Script does not support
 * CORS preflight (OPTIONS) requests. This means we cannot read the response
 * to verify delivery. Check Google Apps Script execution logs for failures.
 *
 * We use `Content-Type: text/plain` instead of `application/json` because
 * `no-cors` mode downgrades non-simple headers. By explicitly setting
 * `text/plain`, we avoid the silent header stripping by the browser.
 * The JSON body is still parsed correctly server-side via JSON.parse().
 *
 * ── Why there is no retry here ──────────────────────────────────────────────
 * `doPost` sends the mail and *then* answers with a 302 to
 * script.googleusercontent.com. An opaque `no-cors` response tells us nothing, and a
 * rejection tells us even less: the throw can happen after Gmail has already accepted
 * the message. Retrying on failure therefore does not recover a lost email, it just
 * sends a second one.
 *
 * That is exactly what happened once `connect-src` was tightened without listing
 * script.googleusercontent.com: the browser refused to follow the relay's redirect,
 * `fetch` rejected on every single send, and the old two-attempt loop mailed every
 * applicant twice — identical subject and body, so Gmail threaded the pair and hid the
 * second copy behind "quoted text". Keep that host in the CSP (netlify.toml and
 * vercel.json) or this call starts failing again.
 *
 * The return value means "handed to the relay", never "delivered". Callers that use it
 * to flip a `notified` flag should treat it as best-effort.
 */
export async function sendEmail(
    email: string,
    subject: string,
    message: string
): Promise<boolean> {
    if (!GOOGLE_SCRIPT_URL) {
        // FIX #14: Don't log the email address here — it would expose PII in the console.
        console.warn('[Email] VITE_GOOGLE_SCRIPT_URL is not configured. Email send skipped.');
        return false;
    }

    const dedupeId = newDedupeId();

    // Clean up HTML whitespace & append the hidden ref tag so Gmail never collapses the body into quoted text
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
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({ token: MAIL_TOKEN, dedupeId, email, subject, message: formattedBody }),
        });
        // FIX #14: Use masked email in logs — never log raw PII to the console.
        console.log(`[Email] ✓ Dispatched to ${maskEmail(email)} — "${subject}"`);
        return true;
    } catch (error) {
        // Almost always this means the request never left the browser — a CSP block, an
        // offline tab, an extension. It can also fire after the relay already accepted
        // the message, which is exactly why this is reported as a failure but never
        // retried: see the note above.
        console.error(`[Email] ✗ Dispatch blocked before sending for ${maskEmail(email)} — "${subject}"`);
        return false;
    }
}

/**
 * Send emails to multiple recipients with a delay between each send
 * to avoid Google Apps Script rate limiting.
 *
 * @param delayMs - milliseconds to wait between each send (default 600ms)
 */
export async function sendEmailBatch(
    emails: Array<{ email: string; subject: string; message: string }>,
    delayMs: number = 600
): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < emails.length; i++) {
        const success = await sendEmail(emails[i].email, emails[i].subject, emails[i].message);
        if (success) sent++;
        else failed++;

        // Rate-limit: wait between sends (skip after last)
        if (i < emails.length - 1) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    return { sent, failed };
}
