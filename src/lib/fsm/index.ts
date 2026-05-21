
import { ApplicationStatus, RecruitmentPhase } from '@/types';

// Valid transitions for Applicant Status — Full 8-stage ATS pipeline
export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    // ── Stage 1: Applied (entry point) ──────────────────────────────────
    'applied':             ['under_review', 'rejected'],
    // Legacy alias
    'pending':             ['applied', 'under_review', 'shortlisted', 'rejected', 'rejected_pending', 'neutral'],

    // ── Stage 2: Under Review ────────────────────────────────────────────
    'under_review':        ['shortlisted', 'waitlisted', 'rejected', 'applied'],
    // Legacy alias
    'neutral':             ['under_review', 'shortlisted', 'rejected_pending'],

    // ── Stage 3: Shortlisted (cleared resume + review) ──────────────────
    'shortlisted':         ['interview_scheduled', 'waitlisted', 'rejected'],

    // ── Stage 4: Interview Scheduled (slot booked) ───────────────────────
    'interview_scheduled': ['interviewed', 'shortlisted', 'waitlisted', 'rejected'],

    // ── Stage 5: Interviewed (evaluation complete) ────────────────────────
    'interviewed':         ['selected', 'waitlisted', 'rejected'],

    // ── Stage 6: Selected ────────────────────────────────────────────────
    'selected':            ['active_member', 'rejected'], // rejection can be revoked

    // ── Stage 7: Waitlisted ──────────────────────────────────────────────
    'waitlisted':          ['selected', 'rejected', 'interview_scheduled'],

    // ── Stage 8: Rejected (terminal) ────────────────────────────────────
    'rejected':            ['applied', 'under_review'], // Super admin can reopen

    // ── Legacy states ────────────────────────────────────────────────────
    'rejected_pending':    ['rejected', 'under_review', 'waitlisted'],

    // ── Post-selection lifecycle ──────────────────────────────────────────
    'active_member':       ['alumni', 'inactive'],
    'alumni':              [],
    'inactive':            ['active_member'],
};

// Pipeline stages in order (for Kanban column ordering)
export const PIPELINE_STAGES: ApplicationStatus[] = [
    'applied',
    'under_review',
    'shortlisted',
    'interview_scheduled',
    'interviewed',
    'selected',
    'waitlisted',
    'rejected',
];

export const STAGE_LABELS: Record<string, string> = {
    applied:              'Applied',
    under_review:         'Under Review',
    shortlisted:          'Shortlisted',
    interview_scheduled:  'Interview Scheduled',
    interviewed:          'Interviewed',
    selected:             'Selected',
    waitlisted:           'Waitlisted',
    rejected:             'Rejected',
    // Legacy
    pending:              'Applied',
    neutral:              'Under Review',
    rejected_pending:     'To Reject',
};

export const STAGE_COLORS: Record<string, string> = {
    applied:              'blue',
    under_review:         'yellow',
    shortlisted:          'cyan',
    interview_scheduled:  'purple',
    interviewed:          'orange',
    selected:             'green',
    waitlisted:           'amber',
    rejected:             'red',
};

// Phase Restrictions
export const PHASE_PERMISSIONS: Record<RecruitmentPhase, {
    canApply: boolean;
    canReview: boolean;
    canInterview: boolean;
    canDecide: boolean;
}> = {
    'APPLICATIONS_OPEN': {
        canApply: true,
        canReview: true,
        canInterview: false,
        canDecide: false
    },
    'REVIEW_PHASE': {
        canApply: false,
        canReview: true,
        canInterview: false,
        canDecide: false
    },
    'INTERVIEWS_ONGOING': {
        canApply: false,
        canReview: false,
        canInterview: true,
        canDecide: false
    },
    'RESULTS_PUBLISHED': {
        canApply: false,
        canReview: false,
        canInterview: false,
        canDecide: true
    }
};

export const canTransition = (current: ApplicationStatus, next: ApplicationStatus): boolean => {
    const validNext = VALID_TRANSITIONS[current];
    return validNext ? validNext.includes(next) : false;
};

export const canPerformAction = (
    phase: RecruitmentPhase,
    action: keyof typeof PHASE_PERMISSIONS['APPLICATIONS_OPEN']
): boolean => {
    return PHASE_PERMISSIONS[phase][action];
};

// Normalize legacy statuses to canonical pipeline stage for display
export const normalizeStatus = (status: ApplicationStatus): ApplicationStatus => {
    if (status === 'pending') return 'applied';
    if (status === 'neutral') return 'under_review';
    if (status === 'rejected_pending') return 'rejected';
    return status;
};
