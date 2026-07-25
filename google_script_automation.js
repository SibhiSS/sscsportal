
/**
 * GOOGLE APPS SCRIPT AUTOMATION FOR NOVA CPS INTERVIEWS
 * 
 * Instructions:
 * 1. Go to https://script.google.com/
 * 2. Create a new project.
 * 3. Paste this code.
 * 4. Update the CONFIG object below with your Supabase URL and Service Role Key (or API Key).
 * 5. Set up a Time-driven trigger to run `automationCheck` every 10 minutes.
 * 6. (Optional) Run `initialSetup` once to authorize.
 */

const CONFIG = {
    SUPABASE_URL: "https://your-project-id.supabase.co",
    SUPABASE_KEY: "your-service-role-key", // Use service_role key for full read access
    ADMIN_ALERT_EMAIL: "sibhi.s2024@vitstudent.ac.in",
    SENDER_NAME: "IEEE SSCS HR Team"
};

/**
 * Main function to be triggered every 10 minutes
 */
function automationCheck() {
    const now = new Date();
    const startTimeMin = new Date(now.getTime() + 55 * 60 * 1000); // ~1 hour from now
    const startTimeMax = new Date(now.getTime() + 65 * 60 * 1000);
    const applicantRemind5Min = new Date(now.getTime() + 0 * 60 * 1000); // 5 min threshold
    const applicantRemind5Max = new Date(now.getTime() + 10 * 60 * 1000);

    console.log("Checking slots starting between " + startTimeMin + " and " + startTimeMax);

    // 1. Fetch Slots and Assignments
    const slots = fetchSupabase("/rest/v1/interview_slots?select=*,applications(*)");
    const assignments = fetchSupabase("/rest/v1/panel_assignments?select=*");

    slots.forEach(slot => {
        if (!slot.is_booked || !slot.applications) return;

        const slotStart = new Date(slot.start_time);
        const timeDiffMinutes = (slotStart - now) / (1000 * 60);

        // --- LOGIC 1 & 2: Interviewer Reminders ---
        // Find interviewer for this panel and date
        const slotDate = slot.start_time.split('T')[0];
        const assignedInterviewers = assignments.filter(a => a.panel_id === slot.panel_id && a.date === slotDate);

        if (assignedInterviewers.length > 0) {
            // A: 1 Hour Before -> Send GMeet Link
            if (timeDiffMinutes >= 55 && timeDiffMinutes <= 65) {
                assignedInterviewers.forEach(interviewer => {
                    sendInterviewerReminder(interviewer.interviewer_email, slot, true);
                });
            }
            // B: Every 10 mins (if within 60 min)
            else if (timeDiffMinutes > 0 && timeDiffMinutes < 60) {
                assignedInterviewers.forEach(interviewer => {
                    sendInterviewerReminder(interviewer.interviewer_email, slot, false);
                });
            }
        } else {
            // --- LOGIC 3: No Interviewer Alert ---
            if (timeDiffMinutes >= 55 && timeDiffMinutes <= 65) {
                sendAdminAlert(slot);
            }
        }

        // --- LOGIC 4: Applicant Reminders ---
        // A: 1 Hour Before
        if (timeDiffMinutes >= 55 && timeDiffMinutes <= 65) {
            sendApplicantReminder(slot.applications.email, slot, "1 hour", assignedInterviewers.length > 0 ? assignedInterviewers[0].meeting_link : null);
        }
        // B: 15 Mins Before
        else if (timeDiffMinutes >= 10 && timeDiffMinutes <= 20) {
            sendApplicantReminder(slot.applications.email, slot, "15 minutes", assignedInterviewers.length > 0 ? assignedInterviewers[0].meeting_link : null);
        }
        
        // --- LOGIC 5: Missing Meeting Link Alert ---
        if (timeDiffMinutes >= 55 && timeDiffMinutes <= 65 && !slot.meeting_link) {
            assignedInterviewers.forEach(interviewer => {
                sendMissingLinkAlert(interviewer.interviewer_email, slot);
            });
        }
    });
    
    // Check for expired shortlisted applications (older than 48 hours)
    checkShortlistedExpiry();
}

/**
 * API Helper for Supabase
 */
function fetchSupabase(endpoint) {
    const url = CONFIG.SUPABASE_URL + endpoint;
    const options = {
        method: "get",
        headers: {
            "apikey": CONFIG.SUPABASE_KEY,
            "Authorization": "Bearer " + CONFIG.SUPABASE_KEY
        }
    };
    const response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
}

function patchSupabase(endpoint, payload) {
    const url = CONFIG.SUPABASE_URL + endpoint;
    const options = {
        method: "patch",
        contentType: "application/json",
        headers: {
            "apikey": CONFIG.SUPABASE_KEY,
            "Authorization": "Bearer " + CONFIG.SUPABASE_KEY
        },
        payload: JSON.stringify(payload)
    };
    UrlFetchApp.fetch(url, options);
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

function sendInterviewerReminder(email, slot, includeLink) {
    const subject = includeLink ? "ACTION REQUIRED: Join Interview & GMeet Link - IEEE SSCS" : "REMINDER: Interview starting in " + Math.round((new Date(slot.start_time) - new Date()) / 60000) + "m";
    const body = `
    <h3>Interview Reminder</h3>
    <p>Hi,</p>
    <p>You have an interview scheduled with <b>${slot.applications.full_name}</b>.</p>
    <p><b>Time:</b> ${new Date(slot.start_time).toLocaleTimeString()} - ${new Date(slot.end_time).toLocaleTimeString()}</p>
    <p><b>Panel:</b> ${slot.panel_id}</p>
    ${includeLink ? '<p>Please ensure you have generated a GMeet link and shared it or joined the designated room.</p>' : ''}
    <p>Login to Dashboard: <a href="https://sscsportal.netlify.app/interviewer">Interviewer Dashboard</a></p>
  `;
    MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: body,
        name: CONFIG.SENDER_NAME
    });
}

function sendApplicantReminder(email, slot, threshold, meetingLink) {
    const linkHtml = meetingLink 
        ? `<p><b>Meeting Link:</b> <a href="${meetingLink}">${meetingLink}</a></p>`
        : `<p>Your meeting link will be shared shortly.</p>`;

    const body = `
    <h3>Interview Reminder - IEEE SSCS</h3>
    <p>Hi ${slot.applications.full_name},</p>
    <p>This is a reminder that your interview starts in <b>${threshold}</b>.</p>
    <p><b>Time:</b> ${new Date(slot.start_time).toLocaleTimeString()}</p>
    ${linkHtml}
    <p>Please be ready 5 minutes before the slot starts.</p>
    <p>Best regards,<br/>IEEE SSCS Team</p>
  `;
    MailApp.sendEmail({
        to: email,
        subject: "Reminder: Your Interview with IEEE SSCS",
        htmlBody: body,
        name: CONFIG.SENDER_NAME
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
        to: CONFIG.ADMIN_ALERT_EMAIL,
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
    <p><b>You have not provided a meeting link for this slot.</b> Please log in to your dashboard immediately and add a GMeet link so the candidate can join.</p>
    <p>Login to Dashboard: <a href="https://sscsportal.netlify.app/interviewer">Interviewer Dashboard</a></p>
  `;
    MailApp.sendEmail({
        to: email,
        subject: "URGENT: Add Meeting Link for Upcoming Interview",
        htmlBody: body,
        name: CONFIG.SENDER_NAME
    });
}
