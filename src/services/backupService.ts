import { supabase } from '@/lib/supabase';
import { Application } from '@/types';
import { logAction } from '@/services/auditService';
import { sendEmail } from '@/lib/email';

export interface SystemBackupSnapshot {
    version: string;
    timestamp: string;
    exportedBy: string;
    data: {
        app_settings: any[];
        admins: any[];
        applications: any[];
        candidate_notes: any[];
        interview_slots: any[];
        panel_assignments: any[];
        interview_feedback: any[];
        interviews: any[];
        department_weights: any[];
        [key: string]: any[];
    };
    stats: Record<string, number>;
}

const BACKUP_TABLES = [
    'app_settings',
    'admins',
    'applications',
    'candidate_notes',
    'interview_slots',
    'panel_assignments',
    'interview_feedback',
    'interviews',
    'department_weights'
];

// Helper to get primary key / unique column for upsert conflict resolution
function getConflictKey(tableName: string): string {
    switch (tableName) {
        case 'app_settings': return 'key';
        case 'admins': return 'email';
        case 'department_weights': return 'department';
        case 'panel_assignments': return 'id'; // Or unique composite if needed, id works
        default: return 'id';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Full Database Snapshot (JSON Archive)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportSystemSnapshot(actorEmail: string = 'super_admin@sscs.org'): Promise<SystemBackupSnapshot> {
    const data: Record<string, any[]> = {};
    const stats: Record<string, number> = {};

    for (const table of BACKUP_TABLES) {
        try {
            const { data: rows, error } = await supabase.from(table).select('*');
            if (!error && rows) {
                data[table] = rows;
                stats[table] = rows.length;
            } else {
                data[table] = [];
                stats[table] = 0;
            }
        } catch (err) {
            // Table might not exist yet (e.g. before migration), default to empty
            data[table] = [];
            stats[table] = 0;
        }
    }

    const snapshot: SystemBackupSnapshot = {
        version: '2.0-enterprise',
        timestamp: new Date().toISOString(),
        exportedBy: actorEmail,
        data: data as SystemBackupSnapshot['data'],
        stats
    };

    // Log the backup action
    try {
        await logAction(actorEmail, 'EXPORT_SYSTEM_SNAPSHOT', 'DATABASE', {
            tablesCount: BACKUP_TABLES.length,
            totalRecords: Object.values(stats).reduce((a, b) => a + b, 0)
        });
    } catch (e) {
        console.warn("[BackupService] Could not log audit action:", e);
    }

    return snapshot;
}

// Helper to download snapshot as a JSON file in browser
export function downloadSnapshotFile(snapshot: SystemBackupSnapshot): void {
    const jsonStr = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sscs_portal_backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Restore Database Snapshot (Transactional Upsert)
// ─────────────────────────────────────────────────────────────────────────────
export async function restoreSystemSnapshot(
    snapshot: SystemBackupSnapshot,
    actorEmail: string = 'super_admin@sscs.org',
    onProgress?: (step: string, table: string, count: number) => void
): Promise<{ success: boolean; results: Record<string, number>; errors: string[] }> {
    if (!snapshot || !snapshot.data || !snapshot.version) {
        throw new Error("Invalid or corrupted backup snapshot file. Missing version or data payload.");
    }

    const results: Record<string, number> = {};
    const errors: string[] = [];

    // Order of restoration is critical to respect foreign key constraints:
    // 1. Independent tables first: app_settings, admins, applications, department_weights
    // 2. Dependent tables next: interview_slots, panel_assignments, interviews, interview_feedback, candidate_notes
    const RESTORE_ORDER = [
        'app_settings',
        'admins',
        'applications',
        'department_weights',
        'interview_slots',
        'panel_assignments',
        'interviews',
        'interview_feedback',
        'candidate_notes'
    ];

    for (const table of RESTORE_ORDER) {
        const rows = snapshot.data[table] || [];
        if (rows.length === 0) {
            results[table] = 0;
            if (onProgress) onProgress("Skipping empty table", table, 0);
            continue;
        }

        if (onProgress) onProgress(`Restoring records into ${table}...`, table, rows.length);

        try {
            // We restore in chunks of 100 to prevent Supabase payload size limits
            const CHUNK_SIZE = 100;
            let restoredCount = 0;

            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE);
                const conflictKey = getConflictKey(table);

                const { error } = await supabase
                    .from(table)
                    .upsert(chunk, { onConflict: conflictKey });

                if (error) {
                    console.error(`[BackupService] Error restoring table ${table} (chunk ${i}):`, error);
                    errors.push(`Table [${table}]: ${error.message || error.details || 'Upsert failed'}`);
                } else {
                    restoredCount += chunk.length;
                }
            }
            results[table] = restoredCount;
            if (onProgress) onProgress(`Completed ${table}`, table, restoredCount);
        } catch (tableErr: any) {
            console.error(`[BackupService] Exception on table ${table}:`, tableErr);
            errors.push(`Table [${table}]: ${tableErr.message}`);
            results[table] = 0;
        }
    }

    // Log the restore action
    try {
        await logAction(actorEmail, 'RESTORE_SYSTEM_SNAPSHOT', 'DATABASE', {
            snapshotTimestamp: snapshot.timestamp,
            results,
            errorsCount: errors.length
        });
    } catch (e) {
        console.warn("[BackupService] Could not log restore audit:", e);
    }

    return {
        success: errors.length === 0,
        results,
        errors
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Candidate Applications to CSV/Excel
// ─────────────────────────────────────────────────────────────────────────────
export function exportApplicationsToCSV(applications: Application[]): void {
    if (!applications || applications.length === 0) {
        throw new Error("No candidate applications available to export.");
    }

    const headers = [
        "Application ID",
        "Full Name",
        "Email",
        "Phone",
        "Roll Number",
        "Academic Department",
        "Year / Batch",
        "Primary Choice",
        "Domains of Interest",
        "Status",
        "Resume Rating (Stars)",
        "Task Score",
        "Interview Score",
        "Final Score",
        "Submitted At"
    ];

    const rows = applications.map(app => [
        `"${app.id || ''}"`,
        `"${(app.fullName || '').replace(/"/g, '""')}"`,
        `"${app.email || ''}"`,
        `"${app.phone || ''}"`,
        `"${app.rollNumber || ''}"`,
        `"${(app.programName || app.department || '').replace(/"/g, '""')}"`,
        `"${app.batch || app.admissionYear || app.year || ''}"`,
        `"${(app.primaryDept || '').replace(/"/g, '""')}"`,
        `"${(app.domains || []).join(', ').replace(/"/g, '""')}"`,
        `"${app.status || ''}"`,
        `"${app.rating ?? 0}"`,
        `"${app.taskScore ?? 'N/A'}"`,
        `"${app.interviewScore ?? 'N/A'}"`,
        `"${app.finalScore ?? 'N/A'}"`,
        `"${app.submittedAt ? new Date(app.submittedAt).toISOString() : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel UTF-8 support
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sscs_candidate_applications_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Candidate CSV Report via Email (Instant Dispatch & Cron Support)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendCSVBackupViaEmail(
    targetEmail: string = 'ieee.sscs.vitchennai@gmail.com'
): Promise<boolean> {
    try {
        const { data: applications, error } = await supabase
            .from('applications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !applications) {
            throw new Error(error?.message || "Could not fetch applications from Supabase");
        }

        if (applications.length === 0) {
            throw new Error("No applications found in database to send.");
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        const totalCount = applications.length;
        const selectedCount = applications.filter(c => c.status === 'selected').length;
        const shortlistedCount = applications.filter(c => c.status === 'shortlisted').length;
        const interviewCount = applications.filter(c => c.status === 'interview_scheduled' || c.status === 'interviewed').length;

        // Formulate a clean CSV string summary for the email message body
        const headers = ["ID", "Full Name", "Email", "Phone", "Roll Number", "Department", "Primary Choice", "Status", "Score"];
        const sampleRows = applications.map(app => [
            app.id || '',
            app.full_name || app.fullName || '',
            app.email || '',
            app.phone || '',
            app.roll_number || app.rollNumber || '',
            app.program_name || app.department || '',
            app.primary_dept || app.primaryDept || '',
            app.status || '',
            app.final_score ?? app.rating ?? 0
        ]);

        const csvText = [headers.join(', '), ...sampleRows.map(r => r.join(', '))].join('\n');

        const subject = `📊 [IEEE SSCS Backup] Candidate Database Report (${dateStr}) - ${totalCount} Applicants`;
        const message = `
================================================================================
IEEE SSCS RECRUITMENT PORTAL — CANDIDATE DATABASE BACKUP REPORT
Date: ${dateStr}
Target Recipient: ${targetEmail}
================================================================================

📊 RECRUITMENT SUMMARY STATS:
--------------------------------------------------------------------------------
• Total Applications Received : ${totalCount}
• Shortlisted Candidates      : ${shortlistedCount}
• In Interview Pipeline       : ${interviewCount}
• Selected / Confirmed Members: ${selectedCount}
--------------------------------------------------------------------------------

📋 RAW CSV DATA SUMMARY (All Candidate Applications):
================================================================================
${csvText}
================================================================================

Note: This automated backup report was dispatched from the IEEE SSCS Portal Admin Dashboard.
For automated nightly email deliveries with direct .CSV attachments, refer to the Google Apps Script time-driven cron configuration in src/backend/nightly_csv_email_cron.js.
        `.trim();

        const success = await sendEmail(targetEmail, subject, message);
        if (!success) {
            throw new Error("Email dispatch service returned false. Check VITE_GOOGLE_SCRIPT_URL configuration or script permissions.");
        }

        await logAction('system_cron@sscs.org', 'DISPATCH_EMAIL_BACKUP', 'EMAIL', {
            recipient: targetEmail,
            recordsCount: totalCount
        });

        return true;
    } catch (err: any) {
        console.error("[BackupService] Email dispatch failed:", err);
        throw err;
    }
}

