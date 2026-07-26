/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTOMATED 15-MINUTE INTERVIEW REMINDER CRON JOB (GOOGLE APPS SCRIPT)
 * ─────────────────────────────────────────────────────────────────────────────
 * How to set this up (Takes 1 minute, runs 24/7 in Google's cloud for free):
 *
 * 1. Open your Google Apps Script project editor.
 * 2. Click "+ (Add a file)" -> "Script" -> name it `InterviewReminderCron`.
 * 3. Paste this entire code into the new file.
 * 4. In the left menu, click "Triggers" (the alarm clock icon) -> "+ Add Trigger".
 * 5. Set options:
 *    - Choose which function to run: `send15MinuteInterviewReminders`
 *    - Select event source: `Time-driven`
 *    - Select type of time based trigger: `Minutes timer`
 *    - Select minute interval: `Every 5 minutes` (or Every 10 minutes)
 * 6. Click "Save".
 *
 * Done! Every 5 minutes, Google checks for any candidate whose interview starts 
 * in the next 15 to 25 minutes. If they haven't been notified yet, it sends them 
 * exactly ONE reminder email with their meeting link and marks reminder_sent = true!
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REMINDER_CONFIG = {
  SUPABASE_URL: "https://your-supabase-project.supabase.co", 
  SUPABASE_ANON_KEY: "your-supabase-anon-or-service-role-key"
};

function send15MinuteInterviewReminders() {
  try {
    const now = new Date();
    // Look for slots starting between 10 minutes and 25 minutes from now
    const minTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const maxTime = new Date(now.getTime() + 25 * 60 * 1000).toISOString();

    const url = `${REMINDER_CONFIG.SUPABASE_URL}/rest/v1/interview_slots?select=*,applications(full_name,email,primary_dept)&is_booked=eq.true&reminder_sent=is.false&start_time=gte.${minTime}&start_time=lte.${maxTime}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        "apikey": REMINDER_CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${REMINDER_CONFIG.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (response.getResponseCode() !== 200) {
      Logger.log(`Supabase fetch failed: ${response.getContentText()}`);
      return;
    }

    const slots = JSON.parse(response.getContentText());
    if (!Array.isArray(slots) || slots.length === 0) {
      return; // No upcoming slots needing reminders
    }

    for (const slot of slots) {
      const app = slot.applications;
      if (!app || !app.email) continue;

      // Fetch meeting link from panel_assignments for this panel & date
      const dateStr = slot.start_time.slice(0, 10);
      const assignUrl = `${REMINDER_CONFIG.SUPABASE_URL}/rest/v1/panel_assignments?select=meeting_link&panel_id=eq.${slot.panel_id}&date=eq.${dateStr}`;
      const assignResp = UrlFetchApp.fetch(assignUrl, {
        method: "get",
        headers: {
          "apikey": REMINDER_CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${REMINDER_CONFIG.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      const assignments = JSON.parse(assignResp.getContentText());
      const meetingLink = assignments.find(a => a.meeting_link && a.meeting_link.trim())?.meeting_link || "No online link provided yet (Check portal or contact HR)";

      // Format time
      const startTimeObj = new Date(slot.start_time);
      const timeStr = startTimeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      const htmlBody = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;color:#18181b;line-height:1.6;">
          <div style="background:#09090b;padding:24px;border-radius:12px 12px 0 0;border-bottom:3px solid #dc143c;">
            <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">⏰ IEEE SSCS Interview Reminder</h1>
            <p style="color:#fecdd3;margin:4px 0 0 0;font-size:13px;">Starting in 15 Minutes</p>
          </div>
          <div style="padding:24px;background:#ffffff;border:1px solid #e4e4e7;border-top:0;border-radius:0 0 12px 12px;">
            <p style="margin-top:0;">Dear <strong>${app.full_name || 'Candidate'}</strong>,</p>
            <p>This is your automated reminder that your IEEE SSCS recruitment interview starts in approximately <strong>15 minutes</strong>.</p>
            
            <div style="background:#f4f4f5;padding:16px;border-radius:8px;border-left:4px solid #dc143c;margin:20px 0;">
              <p style="margin:4px 0;"><strong>Start Time:</strong> ${timeStr}</p>
              <p style="margin:4px 0;"><strong>Panel Number:</strong> Panel ${slot.panel_id}</p>
              <p style="margin:4px 0;"><strong>Department:</strong> ${app.primary_dept || 'General'}</p>
              <p style="margin:12px 0 4px 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color:#dc143c;font-weight:bold;word-break:break-all;">${meetingLink}</a></p>
            </div>
            
            <p>Please click the meeting link and join 3-5 minutes before your scheduled slot. Ensure your microphone and camera are working properly.</p>
            <p style="margin-bottom:0;">Best of luck!<br><strong>IEEE SSCS Recruitment Team</strong></p>
          </div>
        </div>
      `;

      // Send Email
      MailApp.sendEmail({
        to: app.email,
        subject: `⏰ Reminder: Your IEEE SSCS Interview starts in 15 minutes! [${timeStr}]`,
        htmlBody: htmlBody
      });

      // Mark slot as reminder_sent = true in Supabase
      const updateUrl = `${REMINDER_CONFIG.SUPABASE_URL}/rest/v1/interview_slots?id=eq.${slot.id}`;
      UrlFetchApp.fetch(updateUrl, {
        method: "patch",
        headers: {
          "apikey": REMINDER_CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${REMINDER_CONFIG.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        payload: JSON.stringify({ reminder_sent: true })
      });

      Logger.log(`[Sent] 15-min reminder sent to ${app.email} for slot ${slot.id}`);
    }
  } catch (err) {
    Logger.log(`[Error] in send15MinuteInterviewReminders: ${err.toString()}`);
  }
}
