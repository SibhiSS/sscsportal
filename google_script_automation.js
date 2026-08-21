/**
 * GOOGLE APPS SCRIPT — SINGLE FILE FOR THE IEEE SSCS PORTAL
 *
 * This is the entire Apps Script project. It has two independent jobs living in one
 * file on purpose: they were previously split across two "logical" pieces (this cron
 * plus a `doPost` relay documented only in INSTRUCTIONS_SMTP_SETUP.md), and the relay
 * half was lost the last time the reminder logic here got trimmed down — nothing in
 * source control caught it because `doPost` was never actually tracked as code. Keep
 * both halves in this one file and paste the whole thing into `Code.gs` so a future
 * cleanup of one job can't silently delete the other.
 *
 *   1. `automationCheck` — a time-driven cron: interview reminders + staff alerts.
 *   2. `doPost`          — the HTTP relay the web app calls (sendEmail in
 *                           src/lib/email.ts) for admin-triggered mail: booking
 *                           links, "Notify Shortlisted", result emails, etc.
 *
 * ─── SETUP (one-time, done inside Google Apps Script, NEVER in source code) ───
 * 1. Go to https://script.google.com/ and open this project.
 * 2. Click Project Settings (⚙️) → Script Properties → Add property.
 * 3. Add the following properties:
 *      SUPABASE_URL        → https://your-project-id.supabase.co
 *      SUPABASE_KEY        → your-service-role-key   (service_role — full DB access)
 *      ADMIN_ALERT_EMAIL   → ieee.sscs.vitchennai@gmail.com
 *      SENDER_NAME         → IEEE SSCS HR Team
 *      MAIL_RELAY_TOKEN    → a long random string, must match VITE_MAIL_RELAY_TOKEN
 *                            in the app's .env / Netlify env vars, exactly.
 * 4. Set up a Time-driven trigger on `automationCheck` to run every 10 minutes.
 * 5. Apply src/database/migration_notification_idempotency.sql to the database. The
 *    send-once guards below depend on the columns it adds; without them every slot
 *    reads as "not yet notified" and a drifted trigger re-sends.
 * 6. Delete any trigger on `send15MinuteInterviewReminders` — that cron has been
 *    removed. `automationCheck` is now the only thing that mails candidates on a
 *    schedule; `doPost` is the only thing that mails candidates on admin action.
 * 7. Deploy → New deployment → Web app → Execute as `Me`, Who has access `Anyone`.
 *    Copy the `/exec` URL into `VITE_GOOGLE_SCRIPT_URL`. See
 *    INSTRUCTIONS_SMTP_SETUP.md for the full deploy + CSP checklist.
 * 8. (Optional) Run `initialSetup` once to grant OAuth authorisation.
 *
 * ⚠️  NEVER hard-code secrets in this file.  PropertiesService keeps them
 *     server-side in Google's encrypted store and out of version control.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── WHAT automationCheck SENDS ────────────────────────────────────────────
 * A candidate receives exactly ONE automated email per booked slot: a reminder
 * 10 minutes before the interview, carrying the meeting link the super admin set
 * on the panel. There is deliberately no T-15 pre-reminder, no separate "join now"
 * mail, and no interviewer reminder — every one of those was a second copy landing
 * in the same Gmail thread.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Returns the script configuration from Google Apps Script PropertiesService.
 * Values are stored in Project Settings → Script Properties, never in code.
 */
function getConfig() {
    const props = PropertiesService.getScriptProperties();
    return {
        SUPABASE_URL:       props.getProperty('SUPABASE_URL'),
        SUPABASE_KEY:       props.getProperty('SUPABASE_KEY'),
        ADMIN_ALERT_EMAIL:  props.getProperty('ADMIN_ALERT_EMAIL'),
        SENDER_NAME:        props.getProperty('SENDER_NAME') || 'IEEE SSCS HR Team',
    };
}

/**
 * Main function to be triggered every 10 minutes
 */
function automationCheck() {
    const now = new Date();
    console.log("Running automation check at " + now.toISOString());

    // 1. Fetch Slots and Assignments
    const slots = fetchSupabase("/rest/v1/interview_slots?select=*,applications(*)");
    const assignments = fetchSupabase("/rest/v1/panel_assignments?select=*");

    // 2. Process each slot
    slots.forEach(slot => {
        if (!slot.is_booked || !slot.applications) return;

        const slotStart = new Date(slot.start_time);
        const timeDiffMinutes = (slotStart - now) / (1000 * 60);

        const slotDate = slot.start_time.split('T')[0];
        const assignedInterviewers = assignments.filter(a => a.panel_id === slot.panel_id && a.date === slotDate);
        const meetingLink = slot.meeting_link || (assignedInterviewers.length > 0 ? assignedInterviewers[0].meeting_link : null);

        // --- LOGIC 1: Staff alerts (T-60 mins Window: 50 to 60 mins before) ---
        // `alert_sent` guards the window: this trigger runs every 10 minutes against a
        // 10-minute window, so drift or a manual run would otherwise alert twice.
        // These exist so the meeting link is in place before LOGIC 2 needs it.
        if (timeDiffMinutes > 50 && timeDiffMinutes <= 60 && !slot.alert_sent) {
            if (assignedInterviewers.length === 0) {
                markSlot(slot.id, { alert_sent: true });
                sendAdminAlert(slot);
            } else if (!meetingLink) {
                markSlot(slot.id, { alert_sent: true });
                assignedInterviewers.forEach(interviewer => {
                    sendMissingLinkAlert(interviewer.interviewer_email, slot);
                });
            }
        }

        // --- LOGIC 2: The candidate's single reminder (T-10 mins) ---
        //
        // Fires once, in the window from 10 minutes before the slot to 15 minutes after,
        // and `reminder_sent` closes it permanently. If the super admin has not set a
        // meeting link yet at T-10 we hold for one cycle rather than mailing a reminder
        // with nothing in it; by T-0 we send regardless, because a candidate waiting with
        // no email at all is worse than one told the link is coming.
        if (timeDiffMinutes <= 10 && timeDiffMinutes > -15 && !slot.reminder_sent) {
            if (meetingLink) {
                markSlot(slot.id, { reminder_sent: true });
                sendApplicantReminder(slot.applications.email, slot, meetingLink);
            } else if (timeDiffMinutes <= 0) {
                markSlot(slot.id, { reminder_sent: true });
                sendApplicantReminder(slot.applications.email, slot, null);
            }
        }
    });

    // Check for expired shortlisted applications (older than 48 hours)
    checkShortlistedExpiry();
}

/**
 * API Helper for Supabase
 */
function fetchSupabase(endpoint) {
    const cfg = getConfig();
    const url = cfg.SUPABASE_URL + endpoint;
    const options = {
        method: "get",
        headers: {
            "apikey": cfg.SUPABASE_KEY,
            "Authorization": "Bearer " + cfg.SUPABASE_KEY
        }
    };
    const response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
}

function patchSupabase(endpoint, payload) {
    const cfg = getConfig();
    const url = cfg.SUPABASE_URL + endpoint;
    const options = {
        method: "patch",
        contentType: "application/json",
        headers: {
            "apikey": cfg.SUPABASE_KEY,
            "Authorization": "Bearer " + cfg.SUPABASE_KEY
        },
        payload: JSON.stringify(payload)
    };
    UrlFetchApp.fetch(url, options);
}

/**
 * Marks a notification as sent on the slot row.
 *
 * Called BEFORE the mail goes out, on purpose. If the write succeeds and the send then
 * fails, one candidate misses one reminder; if the send succeeds and the write fails,
 * every subsequent run of this trigger mails them again. The first failure is the one
 * worth having.
 */
function markSlot(slotId, patch) {
    try {
        patchSupabase("/rest/v1/interview_slots?id=eq." + slotId, patch);
    } catch (err) {
        console.error("Failed to mark slot " + slotId + ": " + err);
    }
}

function checkShortlistedExpiry() {
    const apps = fetchSupabase("/rest/v1/applications?select=id,shortlisted_at&status=eq.shortlisted");
    const now = new Date();
    apps.forEach(app => {
        if (!app.shortlisted_at) return;
        const shortlistedTime = new Date(app.shortlisted_at);
        const hoursDiff = (now - shortlistedTime) / (1000 * 60 * 60);
        if (hoursDiff > 48) {
            patchSupabase("/rest/v1/applications?id=eq." + app.id, { status: "waitlisted" });
            console.log("Moved expired shortlisted app to waitlisted: " + app.id);
        }
    });
}

/**
 * The one automated email a candidate gets for a booked slot.
 */
function sendApplicantReminder(email, slot, meetingLink) {
    const linkHtml = meetingLink
        ? `<p style="margin: 20px 0;">
             <a href="${meetingLink}" style="background-color: #dc143c; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Join Interview</a>
           </p>
           <p><b>Meeting link:</b> <a href="${meetingLink}">${meetingLink}</a></p>`
        : `<p>Your interviewer is finalising the meeting link and will share it in a moment. Please stay available.</p>`;

    const body = `
    <h3>Your IEEE SSCS interview starts in 10 minutes</h3>
    <p>Hi ${slot.applications.full_name},</p>
    <p><b>Time:</b> ${new Date(slot.start_time).toLocaleTimeString()}</p>
    ${linkHtml}
    <p>Please join on time, and keep your camera on if you can.</p>
    <p>Best regards,<br/>IEEE SSCS Team</p>
  `;

    MailApp.sendEmail({
        to: email,
        subject: "Your IEEE SSCS interview starts in 10 minutes",
        htmlBody: body,
        name: getConfig().SENDER_NAME
    });
}

function sendAdminAlert(slot) {
    const body = `
    <h2 style="color: red;">URGENT: No Interviewer Assigned</h2>
    <p>A booked slot has no interviewer assigned!</p>
    <p><b>Candidate:</b> ${slot.applications.full_name} (${slot.applications.email})</p>
    <p><b>Time:</b> ${slot.start_time}</p>
    <p><b>Panel:</b> ${slot.panel_id}</p>
    <p>Please assign an interviewer immediately in the Admin Dashboard: <a href="https://sscsportal.netlify.app/admin">Admin Panel</a></p>
  `;
    MailApp.sendEmail({
        to: getConfig().ADMIN_ALERT_EMAIL,
        subject: "!!! URGENT: No Interviewer for Upcoming Slot",
        htmlBody: body,
        name: "IEEE SSCS System Alert"
    });
}

function sendMissingLinkAlert(email, slot) {
    const body = `
    <h2 style="color: red;">URGENT: Missing Meeting Link</h2>
    <p>Hi,</p>
    <p>Your interview with <b>${slot.applications.full_name}</b> starts in less than 1 hour!</p>
    <p><b>Time:</b> ${new Date(slot.start_time).toLocaleTimeString()}</p>
    <p><b>Panel:</b> ${slot.panel_id}</p>
    <p><b>You have not provided a meeting link for this slot.</b> Please log in to your dashboard immediately and add a GMeet link — the candidate's 10-minute reminder carries whatever link is set at that point.</p>
    <p>Login to Dashboard: <a href="https://sscsportal.netlify.app/interviewer">Interviewer Dashboard</a></p>
  `;
    MailApp.sendEmail({
        to: email,
        subject: "URGENT: Add Meeting Link for Upcoming Interview",
        htmlBody: body,
        name: getConfig().SENDER_NAME
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAIL RELAY — handles admin-triggered sends (src/lib/email.ts sendEmail()).
 * This is what "Notify Shortlisted" / booking-link / result emails call.
 * ═══════════════════════════════════════════════════════════════════════════
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
