/**
 * GOOGLE APPS SCRIPT — MAIL RELAY  ("dopost" project)
 *
 * ⚠️  This file is ONE Apps Script project on its own. It is NOT the same project as
 *     google_script_automation.js. Keep them separate and never paste one over the
 *     other — they are wired to two different deployed URLs:
 *
 *       this file → VITE_GOOGLE_SCRIPT_URL      (admin-triggered mail)
 *       automation → VITE_GOOGLE_SHEETS_API_URL (registration intake + cron)
 *
 *     Both projects define a `doPost`. Pasting this project's code into the automation
 *     project silently replaces the registration handler with this mail relay, and
 *     /register starts answering "unauthorized" to every applicant.
 *
 * ─── WHAT THIS DOES ─────────────────────────────────────────────────────────
 * The HTTP relay that `sendEmail()` in src/lib/email.ts calls for every
 * admin-triggered email: interview booking links, "Notify Shortlisted", result
 * emails. React cannot speak SMTP, so this sends from the club Gmail account.
 *
 * This lived for months as a snippet inside INSTRUCTIONS_SMTP_SETUP.md and nowhere
 * else — untracked, so when the reminder cron was trimmed down nothing in source
 * control noticed the relay had gone missing, and "Notify Shortlisted" was silently
 * dead from Aug 20 to Aug 22 2026. It is a tracked file now. Keep it that way.
 *
 * ─── SETUP ──────────────────────────────────────────────────────────────────
 * 1. Project Settings (⚙️) → Script Properties:
 *      MAIL_RELAY_TOKEN → long random string, must equal VITE_MAIL_RELAY_TOKEN
 *                         in .env and in the Netlify env vars, exactly.
 *      SENDER_NAME      → IEEE SSCS Team
 * 2. Deploy → New deployment → Web app → Execute as `Me`, access `Anyone`.
 * 3. Copy the /exec URL into VITE_GOOGLE_SCRIPT_URL.
 *
 * ⚠️  DEPLOYING AN EDIT: a `Version N` web app deployment is a FROZEN SNAPSHOT.
 *     Pasting new code into the editor does not change what the live URL serves.
 *     You must Deploy → Manage deployments → ✏️ → Version: "New version" → Deploy.
 *     Skipping that is why a redeploy once appeared to change nothing for two days.
 *
 * See INSTRUCTIONS_SMTP_SETUP.md for the full deploy + CSP checklist.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Allowed recipient domains and addresses.
 *
 * This is the control that survives token leakage. VITE_MAIL_RELAY_TOKEN is compiled
 * into the public bundle, so a determined attacker can extract it — but even holding
 * the token they can only send to VIT addresses and our own inboxes, never to an
 * arbitrary victim. Keep this list as narrow as the product allows.
 */
var ALLOWED_DOMAINS = ['vitstudent.ac.in', 'vit.ac.in'];
var ALLOWED_ADDRESSES = ['ieee.sscs.vitchennai@gmail.com'];

/**
 * How long a dedupeId is remembered, in seconds (max 21600 for CacheService).
 *
 * The client sends one dedupeId per logical email. If the same id arrives again inside
 * this window we acknowledge it without sending, so a re-POST cannot become a second
 * copy in the candidate's inbox. This matters because the relay sends the mail and
 * *then* answers with a redirect: any client-side failure is reported after delivery,
 * so a retry on the client is always a duplicate, never a recovery.
 */
var DEDUPE_WINDOW_SECONDS = 900;

function isAllowedRecipient(email) {
    if (!email || email.indexOf('@') === -1) return false;
    var addr = email.trim().toLowerCase();
    if (ALLOWED_ADDRESSES.indexOf(addr) !== -1) return true;
    var domain = addr.split('@').pop();
    return ALLOWED_DOMAINS.indexOf(domain) !== -1;
}

/**
 * Actually hands the message to Google, preferring GmailApp and falling back to MailApp.
 *
 * These are two different services with two different scopes over the same daily quota:
 * GmailApp needs the broad `https://mail.google.com/`, MailApp only needs the narrow
 * `script.send_mail`. A project can end up authorised for one and not the other — a
 * half-granted consent screen, an admin policy on the Workspace account, or a
 * deployment frozen from before a scope was added. When that happens GmailApp throws
 * on every single send while MailApp would have worked fine, which is indistinguishable
 * from "mail is broken" unless you try both.
 *
 * Returns the name of the service that accepted the message. Throws only if BOTH
 * refused, and then it throws an error naming both failures so the caller can report
 * something more useful than "send failed".
 */
function sendRelayMail(recipient, subject, htmlMessage, senderName) {
    var gmailError;
    try {
        GmailApp.sendEmail(recipient, subject, htmlMessage, {
            htmlBody: htmlMessage,
            name: senderName
        });
        return 'GmailApp';
    } catch (err) {
        gmailError = err;
        console.warn('GmailApp.sendEmail failed, falling back to MailApp: ' + err);
    }

    try {
        MailApp.sendEmail({
            to: recipient,
            subject: subject,
            htmlBody: htmlMessage,
            name: senderName
        });
        return 'MailApp';
    } catch (mailAppError) {
        throw new Error(
            'GmailApp: ' + (gmailError && gmailError.message ? gmailError.message : gmailError) +
            ' | MailApp: ' + (mailAppError && mailAppError.message ? mailAppError.message : mailAppError)
        );
    }
}

function doPost(e) {
    var lock = LockService.getScriptLock();

    // Only errors raised *after* the shared secret checks out are described in the
    // response. Before that point the caller is anonymous, and a parse error or a stack
    // detail handed back to an unauthenticated stranger is free reconnaissance.
    var authed = false;

    try {
        var props = PropertiesService.getScriptProperties();
        var expectedToken = props.getProperty('MAIL_RELAY_TOKEN');
        var data = JSON.parse(e.postData.contents);

        // 1. Reject anything without the shared secret.
        if (!expectedToken || data.token !== expectedToken) {
            console.warn('Rejected relay request: bad or missing token.');
            return jsonOut({ status: 'error', message: 'unauthorized' });
        }
        authed = true;

        // 2. Reject recipients outside the allowlist.
        if (!isAllowedRecipient(data.email)) {
            console.warn('Rejected relay request: recipient not allowed.');
            return jsonOut({ status: 'error', message: 'recipient not allowed' });
        }

        // 3. Cheap circuit breaker so a leaked token cannot drain the daily quota in
        //    one burst. The remaining count is echoed on failure below, because a
        //    genuinely exhausted quota and a scope problem both surface as a throw
        //    from the send and are otherwise impossible to tell apart from outside.
        var remainingQuota = MailApp.getRemainingDailyQuota();
        if (remainingQuota < 20) {
            console.warn('Rejected relay request: daily quota nearly exhausted.');
            return jsonOut({ status: 'error', message: 'quota exhausted', remainingQuota: remainingQuota });
        }

        // 4. Idempotency. The lock serialises concurrent duplicates; the cache entry is
        //    written *before* sending so a crash mid-send cannot be replayed by a client
        //    retry, and is cleared again only if the send itself threw.
        var cache = CacheService.getScriptCache();
        var dedupeKey = data.dedupeId ? 'mail:' + data.dedupeId : null;

        if (dedupeKey) {
            lock.waitLock(10000);
            if (cache.get(dedupeKey)) {
                console.log('Ignored duplicate send for dedupeId ' + data.dedupeId);
                return jsonOut({ status: 'duplicate', message: 'already sent' });
            }
            cache.put(dedupeKey, '1', DEDUPE_WINDOW_SECONDS);
            lock.releaseLock();
        }

        var sentVia;
        try {
            sentVia = sendRelayMail(
                data.email,
                data.subject,
                data.message,
                props.getProperty('SENDER_NAME') || 'IEEE SSCS Team'
            );
        } catch (sendError) {
            // Nothing was delivered, so let the id be used again.
            if (dedupeKey) cache.remove(dedupeKey);
            throw sendError;
        }

        return jsonOut({ status: 'success', sentVia: sentVia, remainingQuota: remainingQuota });

    } catch (error) {
        console.error(error.toString());
        var out = { status: 'error', message: 'send failed' };
        if (authed) out.detail = String(error && error.message ? error.message : error);
        return jsonOut(out);
    } finally {
        try { lock.releaseLock(); } catch (ignored) {}
    }
}

function jsonOut(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}
