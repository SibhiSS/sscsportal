
import { ApplicationStatus, RecruitmentPhase } from '@/types';

// Valid transitions for Applicant Status
export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    // Initial State
    'submitted': ['under_review', 'rejected', 'pending'], // pending is legacy
    'pending': ['under_review', 'shortlisted', 'rejected', 'rejected_pending', 'neutral'], // legacy state transitions

    // Review Process
    'under_review': ['interview_scheduled', 'rejected', 'waitlisted', 'shortlisted', 'rejected_pending', 'extended_review' as ApplicationStatus], // extended_review not yet in type but useful concept
    'neutral': ['shortlisted', 'rejected_pending', 'under_review'],

    // Legacy mappings (shortlisted ~= interview_scheduled/waitlisted/selected depending on context)
    'shortlisted': ['interview_scheduled', 'selected', 'rejected'],
    'rejected_pending': ['rejected', 'pending', 'neutral'],

    // Interview Cycle
    'interview_scheduled': ['interviewed', 'no_show' as ApplicationStatus, 'rescheduled' as ApplicationStatus], // no_show/rescheduled to add later
    'interviewed': ['selected', 'rejected', 'waitlisted', 'second_interview' as ApplicationStatus],

    // Decisions
    'waitlisted': ['selected', 'rejected'],
    'selected': ['active_member', 'rejected'], // Can be revoked
    'rejected': [], // Terminal mostly, unless admin override

    // Lifecycle (For future)
    'active_member': ['alumni', 'inactive'],
    'alumni': [],
    'inactive': ['active_member']
};

// Phase Restrictions
export const PHASE_PERMISSIONS: Record<RecruitmentPhase, {
    canApply: boolean;
    canReview: boolean;
    canInterview: boolean;
    canDecide: boolean; // Publish results
}> = {
    'APPLICATIONS_OPEN': {
        canApply: true,
        canReview: true, // Parallel review allowed
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
        canReview: false, // Generally closed, but maybe exceptions
        canInterview: true,
        canDecide: false
    },
    'RESULTS_PUBLISHED': {
        canApply: false,
        canReview: false,
        canInterview: false,
        canDecide: true // Technically deciding logic is done, but permissions might linger or disable everything
    }
};

export const canTransition = (current: ApplicationStatus, next: ApplicationStatus): boolean => {
    // Super admins might bypass, but UI should check this
    const validNext = VALID_TRANSITIONS[current];
    return validNext ? validNext.includes(next) : false;
};

export const canPerformAction = (phase: RecruitmentPhase, action: keyof typeof PHASE_PERMISSIONS['APPLICATIONS_OPEN']): boolean => {
    return PHASE_PERMISSIONS[phase][action];
};
