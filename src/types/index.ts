export interface Application {
    id: string;
    fullName: string;
    email: string;
    rollNumber: string;
    phone: string;
    year: string;
    department: string; // Academic dept

    // Derived Metadata
    admissionYear?: number;
    programCode?: string;
    programName?: string;
    batch?: string;
    programCategory?: string;

    // Primary Choice
    primaryDept: string;
    domains: string[];
    skills: string;
    reason: string;

    // Secondary Choice
    secondaryDept: string;
    secondaryDomains: string[];
    secondarySkills: string;
    secondaryReason: string;

    submittedAt: any;
    status: ApplicationStatus;
    rating: number; // 0-5
    notes?: string;
    shortlistNotified?: boolean;
}

export type ApplicationStatus =
    | 'submitted'
    | 'under_review'
    | 'interview_scheduled'
    | 'interviewed'
    | 'waitlisted'
    | 'selected'
    | 'rejected'
    // Legacy/UI mappings
    | 'pending' | 'shortlisted' | 'rejected_pending' | 'neutral'
    // Lifecycle
    | 'active_member' | 'alumni' | 'inactive';

export type RecruitmentPhase =
    | 'APPLICATIONS_OPEN'
    | 'REVIEW_PHASE'
    | 'INTERVIEWS_ONGOING'
    | 'RESULTS_PUBLISHED';

export interface AdminUser {
    id: string;
    email: string;
    role: 'super_admin' | 'admin' | 'interviewer' | 'viewer';
    createdAt: string;
    addedBy?: string;
}

export interface AuditLog {
    id: string;
    actorEmail: string;
    action: string;
    targetId?: string;
    details?: any;
    timestamp: string;
}

export interface Interview {
    id: string;
    applicationId: string;
    interviewerEmail: string;
    startTime: string;
    endTime: string;
    meetingLink?: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
    notes?: string;
}

export interface AppSettings {
    isOpen: boolean;
    message: string;
    currentPhase: RecruitmentPhase;
}

export interface PanelAssignment {
    id: string;
    panel_id: number;
    date: string;
    interviewer_email: string;
    meeting_link?: string;
    created_at: string;
}

export interface InterviewFeedback {
    id: string;
    application_id: string;
    interviewer_email: string;
    score: number;
    comments: string;
    recommends_committee: boolean;
    created_at: string;
}
