import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Application } from '@/types';

// Mirrors CommitteeDraftBoard.tsx's DEPARTMENTS list. Duplicated rather than
// imported to avoid a circular import (CommitteeDraftBoard imports this module
// to trigger the export) — six chapter department names change rarely enough
// that this is a safe trade.
const DEPARTMENTS = [
    'Technical',
    'Management',
    'Event Operations',
    'Creative',
    'Outreach & Partnerships',
    'Human Resources',
];

// Only actual, confirmed members go in a document handed to club members —
// never the working draft, which can be mid-edit, over quota, or contain
// placements an admin hasn't reviewed yet. 'selected' is the admin-internal
// pre-publish state; 'active_member' is who has actually been told they're in.
const CONFIRMED_STATUSES = ['selected', 'active_member'];

/**
 * Generates and downloads a per-department committee roster PDF: one table
 * per department, each row a member's name / roll number / year. Reads only
 * from `applications` (the saved, DB-backed roster) — never the in-memory
 * draft — so what gets handed to club members always matches what's actually
 * been committed with Save Roster.
 */
export function exportCommitteeRosterPdf(applications: Application[]): void {
    const confirmed = applications.filter(a =>
        CONFIRMED_STATUSES.includes(a.status) && a.assignedPosition && DEPARTMENTS.includes(a.assignedPosition)
    );

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let cursorY = 50;

    const dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('IEEE SSCS — Committee Roster', marginX, cursorY);
    cursorY += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated ${dateStr}`, marginX, cursorY);
    doc.setTextColor(0);
    cursorY += 20;

    if (confirmed.length === 0) {
        doc.setFontSize(11);
        doc.text('No confirmed committee members yet. Save Roster on the Committee Draft Board first.', marginX, cursorY);
        doc.save('IEEE-SSCS-Committee-Roster.pdf');
        return;
    }

    DEPARTMENTS.forEach(dept => {
        const members = confirmed
            .filter(a => a.assignedPosition === dept)
            .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        if (members.length === 0) return;

        // Section heading, with a page break first if the heading itself would
        // otherwise land in the bottom margin.
        if (cursorY > doc.internal.pageSize.getHeight() - 80) {
            doc.addPage();
            cursorY = 50;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`${dept}  (${members.length} member${members.length === 1 ? '' : 's'})`, marginX, cursorY);
        cursorY += 8;

        autoTable(doc, {
            startY: cursorY,
            margin: { left: marginX, right: marginX },
            head: [['#', 'Name', 'Roll Number', 'Year']],
            body: members.map((m, i) => [String(i + 1), m.fullName || '—', m.rollNumber || '—', m.year || '—']),
            styles: { fontSize: 9, cellPadding: 5 },
            headStyles: { fillColor: [88, 28, 135], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 243, 255] },
            theme: 'grid',
        });

        // jspdf-autotable stashes the Y position it finished at on the doc
        // instance itself — this is the documented way to chain sections.
        cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
    });

    const totalPages = doc.internal.pages.length - 1;
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    }

    doc.save(`IEEE-SSCS-Committee-Roster-${new Date().toISOString().slice(0, 10)}.pdf`);
}
