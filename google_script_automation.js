/**
 * GOOGLE APPS SCRIPT — INTERVIEW AUTOMATION CRON  ("automation" project)
 *
 * ⚠️  This file is ONE Apps Script project. The mail relay in
 *     google_script_mail_relay.js is a SEPARATE project with its own deployed URL.
 *     Do not merge them and do not paste one over the other:
 *
 *       this file → VITE_GOOGLE_SHEETS_API_URL (registration intake + this cron)
 *       relay     → VITE_GOOGLE_SCRIPT_URL     (admin-triggered mail)
 *
 *     This project's web app URL is what src/services/registrationService.ts POSTs
 *     to, so its `doPost` belongs to registration intake. Pasting the relay in here
 *     replaces that handler and every applicant hitting /register gets back
 *     "unauthorized" instead of a saved registration.
 *
 * `automationCheck` is a time-driven cron: interview reminders + staff alerts.
 *
 * ─── SETUP (one-time, done inside Google Apps Script, NEVER in source code) ───
 * 1. Go to https://script.google.com/ and open this project.
 * 2. Click Project Settings (⚙️) → Script Properties → Add property.
 * 3. Add the following properties:
 *      SUPABASE_URL        → https://your-project-id.supabase.co
 *      SUPABASE_KEY        → your-service-role-key   (service_role — full DB access)
 *      ADMIN_ALERT_EMAIL   → ieee.sscs.vitchennai@gmail.com
 *      SENDER_NAME         → IEEE SSCS HR Team
 * 4. Set up a Time-driven trigger on `automationCheck` to run every 10 minutes.
 * 5. Apply src/database/migration_notification_idempotency.sql to the database. The
 *    send-once guards below depend on the columns it adds; without them every slot
 *    reads as "not yet notified" and a drifted trigger re-sends.
 * 6. Delete any trigger on `send15MinuteInterviewReminders` — that cron has been
 *    removed. `automationCheck` is now the only thing here that mails candidates.
 * 7. (Optional) Run `initialSetup` once to grant OAuth authorisation.
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
        // The applicant-facing WhatsApp group. Only ever mailed to someone who
        // already holds a booked slot — the reminder below is the only send here
        // that reaches a candidate at all. Set WHATSAPP_GROUP_URL in Script
        // Properties to rotate the invite without editing this file.
        WHATSAPP_GROUP_URL: props.getProperty('WHATSAPP_GROUP_URL') || '',
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

        // panel_assignments.date is written by the admin's browser as a LOCAL
        // (Asia/Kolkata) yyyy-MM-dd. slot.start_time.split('T')[0] is the UTC date,
        // which only matches the local one for slots at or after 05:30 IST. A slot
        // booked earlier than that — e.g. 02:00 IST, which is still "the 21st" to the
        // admin but "the 20th" in UTC — silently matched zero assignment rows, so
        // meetingLink stayed null and the T-10 reminder went out with no link.
        // Match on the IST date first, and fall back to the UTC date only if that
        // finds nothing, mirroring my_interview_details() in
        // migration_applicant_meeting_link.sql so the cron and the portal agree.
        const istDate = Utilities.formatDate(slotStart, 'Asia/Kolkata', 'yyyy-MM-dd');
        const utcDate = slot.start_time.split('T')[0];
        let assignedInterviewers = assignments.filter(a => a.panel_id === slot.panel_id && a.date === istDate);
        if (assignedInterviewers.length === 0 && utcDate !== istDate) {
            assignedInterviewers = assignments.filter(a => a.panel_id === slot.panel_id && a.date === utcDate);
        }
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

    const groupUrl = getConfig().WHATSAPP_GROUP_URL;
    const groupHtml = groupUrl
        ? `<p style="margin: 16px 0; padding: 12px; border-left: 4px solid #25D366; background: #e8f5e9;">
             All communication happens only in our WhatsApp group —
             <a href="${groupUrl}">join it here</a> if you have not already.
           </p>`
        : '';

    const body = `
    <h3>Your IEEE SSCS interview starts in 10 minutes</h3>
    <p>Hi ${slot.applications.full_name},</p>
    <p><b>Time:</b> ${new Date(slot.start_time).toLocaleTimeString()}</p>
    ${linkHtml}
    ${groupHtml}
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
