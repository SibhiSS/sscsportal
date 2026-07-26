/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTOMATED NIGHTLY IEEE SSCS CANDIDATE CSV EMAIL CRON JOB
 * ─────────────────────────────────────────────────────────────────────────────
 * How to set this up (Takes 1 minute, runs 24/7 in Google's cloud for free):
 *
 * 1. Open your Google Apps Script project (where your VITE_GOOGLE_SCRIPT_URL is hosted).
 * 2. Paste this entire script into your `Code.gs` file.
 * 3. Fill in your SUPABASE_URL and SUPABASE_ANON_KEY in the CONFIG object below.
 * 4. In the left sidebar of Google Apps Script, click on "Triggers" (the alarm clock icon).
 * 5. Click the "+ Add Trigger" button at the bottom right.
 * 6. Set the following options:
 *    - Choose which function to run: `sendNightlyCSVReport`
 *    - Choose which deployment should run: `Head`
 *    - Select event source: `Time-driven`
 *    - Select type of time based trigger: `Day timer`
 *    - Select time of day: `Midnight to 1am` (or whichever time you prefer)
 * 7. Click "Save". Grant permissions if prompted by Google.
 *
 * Done! Every single night, Google will automatically query your Supabase database,
 * generate a fresh candidate CSV file, and email it as an attachment to ieee.sscs.vitchennai@gmail.com!
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CONFIG = {
  // Replace with your actual Supabase URL and API Key (from project Settings -> API)
  SUPABASE_URL: "https://your-supabase-project.supabase.co", 
  SUPABASE_ANON_KEY: "your-supabase-anon-or-service-role-key",
  
  // The recipient email address you specified
  TARGET_EMAIL: "ieee.sscs.vitchennai@gmail.com",
  SUBJECT_PREFIX: "📊 [IEEE SSCS] Nightly Candidate CSV Backup Report"
};

function sendNightlyCSVReport() {
  try {
    Logger.log("Starting Nightly Candidate CSV Backup Job...");
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/applications?select=*&order=created_at.desc`;
    
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        "apikey": CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Supabase API responded with status ${response.getResponseCode()}: ${response.getContentText()}`);
    }

    const candidates = JSON.parse(response.getContentText());
    if (!Array.isArray(candidates) || candidates.length === 0) {
      Logger.log("No candidate applications found in database to backup.");
      return;
    }

    // 1. Generate CSV Headers & Rows
    const headers = [
      "Application ID", "Full Name", "Email", "Phone", "Roll Number", 
      "Academic Department", "Year / Batch", "Primary Choice", 
      "Domains of Interest", "Status", "Resume Rating (0-5)", "Task Score", 
      "Interview Score", "Final Score", "Submitted At"
    ];

    const rows = candidates.map(app => [
      `"${app.id || ''}"`,
      `"${(app.full_name || app.fullName || '').replace(/"/g, '""')}"`,
      `"${app.email || ''}"`,
      `"${app.phone || ''}"`,
      `"${app.roll_number || app.rollNumber || ''}"`,
      `"${(app.program_name || app.department || '').replace(/"/g, '""')}"`,
      `"${app.batch || app.admission_year || app.year || ''}"`,
      `"${(app.primary_dept || app.primaryDept || '').replace(/"/g, '""')}"`,
      `"${(app.domains || []).join(', ').replace(/"/g, '""')}"`,
      `"${app.status || ''}"`,
      `"${app.rating ?? 0}"`,
      `"${app.task_score ?? app.taskScore ?? 'N/A'}"`,
      `"${app.interview_score ?? app.interviewScore ?? 'N/A'}"`,
      `"${app.final_score ?? app.finalScore ?? 'N/A'}"`,
      `"${app.created_at || app.submittedAt || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // 2. Create CSV File Attachment Blob
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `sscs_candidates_backup_${dateStr}.csv`;
    const csvBlob = Utilities.newBlob(csvContent, 'text/csv', fileName);

    // 3. Calculate Summary Statistics for Email Body
    const totalCount = candidates.length;
    const selectedCount = candidates.filter(c => c.status === 'selected').length;
    const shortlistedCount = candidates.filter(c => c.status === 'shortlisted').length;
    const interviewCount = candidates.filter(c => c.status === 'interview_scheduled' || c.status === 'interviewed').length;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; color: #18181b; line-height: 1.6;">
        <div style="background: #09090b; padding: 24px; border-radius: 12px 12px 0 0; border-bottom: 3px solid #10b981;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">✨ IEEE SSCS Nightly Candidate Report</h1>
          <p style="color: #a7f3d0; margin: 4px 0 0 0; font-size: 13px;">Automated Database CSV Backup & Summary</p>
        </div>
        
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e4e4e7; border-top: 0; border-radius: 0 0 12px 12px;">
          <p style="margin-top: 0;">Hello Team,</p>
          <p>Attached to this email is the automated nightly CSV backup of all candidate applications currently stored in your Supabase database (<b>${fileName}</b>).</p>
          
          <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border: 1px solid #bbf7d0; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 15px;">📊 Recruitment Summary (${dateStr})</h3>
            <table style="width: 100%; font-size: 13px; color: #166534; border-collapse: collapse;">
              <tr><td style="padding: 4px 0;"><b>Total Applications Received:</b></td><td style="text-align: right; font-weight: bold; font-size: 16px;">${totalCount}</td></tr>
              <tr><td style="padding: 4px 0;"><b>Shortlisted for Interview:</b></td><td style="text-align: right;">${shortlistedCount}</td></tr>
              <tr><td style="padding: 4px 0;"><b>In Interview Stage:</b></td><td style="text-align: right;">${interviewCount}</td></tr>
              <tr><td style="padding: 4px 0;"><b>Selected Candidates:</b></td><td style="text-align: right; color: #059669; font-weight: bold;">${selectedCount}</td></tr>
            </table>
          </div>
          
          <p style="font-size: 12px; color: #71717a; margin-bottom: 0; border-top: 1px solid #e4e4e7; pt: 16px;">
            🔒 <i>This is an automated system email dispatched by your Google Apps Script Time-Driven Cron trigger to guarantee zero data loss. Do not reply directly to this email.</i>
          </p>
        </div>
      </div>
    `;

    // 4. Send Email with Attachment
    MailApp.sendEmail({
      to: CONFIG.TARGET_EMAIL,
      subject: `${CONFIG.SUBJECT_PREFIX} (${dateStr}) — ${totalCount} Candidates`,
      htmlBody: htmlBody,
      attachments: [csvBlob]
    });

    Logger.log(`[Success] Nightly CSV backup dispatched to ${CONFIG.TARGET_EMAIL} with ${totalCount} candidate records.`);
  } catch (error) {
    Logger.log(`[Error] Failed to send nightly CSV report: ${error.toString()}`);
  }
}
