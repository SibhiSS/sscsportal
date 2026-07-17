/**
 * Centralized email sending utility for IEEE SSCS Portal.
 * All email sends go through this module for consistency,
 * retry logic, and rate-limiting protection.
 */

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

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
 */
export async function sendEmail(
    email: string,
    subject: string,
    message: string
): Promise<boolean> {
    if (!GOOGLE_SCRIPT_URL) {
        console.warn('[Email] VITE_GOOGLE_SCRIPT_URL is not configured. Skipping email to:', email);
        return false;
    }

    // Clean up HTML whitespace & append unique hidden ref tag so Gmail never collapses the body into quoted text [...]
    const cleanedMessage = message
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    const formattedBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; font-size: 14px; line-height: 1.6; max-width: 600px;">
            ${cleanedMessage}
            <div style="display:none !important; font-size:1px; color:#ffffff; opacity:0; overflow:hidden; mso-hide:all;">
                Ref ID: ${Date.now()}-${Math.random().toString(36).substring(2, 7)}
            </div>
        </div>
    `.trim();

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify({ email, subject, message: formattedBody }),
            });
            console.log(`[Email] ✓ Dispatched to ${email} — "${subject}"`);
            return true;
        } catch (error) {
            console.error(`[Email] ✗ Attempt ${attempt}/2 failed for ${email}:`, error);
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }

    console.error(`[Email] ✗ All attempts failed for ${email}`);
    return false;
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
