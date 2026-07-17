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
    rating: number; // 0-5 star rating (resume proxy)
    notes?: string;
    shortlistNotified?: boolean;

    githubUrl?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;

    // Scoring & Ranking
    taskScore?: number;       // 0-10, set by admin
    interviewScore?: number;  // 0-10, live average from interview feedbacks
    finalScore?: number;      // weighted composite
    rankInDept?: number;      // auto-assigned rank within dept

    // Timeline timestamps
    shortlistedAt?: string;
    interviewedAt?: string;
    decidedAt?: string;

    // Post-Selection Position
    assignedPosition?: string;
}

export type ApplicationStatus =
    // Canonical 8-stage pipeline
    | 'applied'
    | 'under_review'
    | 'shortlisted'
    | 'interview_scheduled'
    | 'interviewed'
    | 'selected'
    | 'waitlisted'
    | 'rejected'
    // Legacy/backward compat
    | 'pending' | 'neutral' | 'rejected_pending'
    // Lifecycle post-selection
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
    // Structured 5-metric scores (0-10 each)
    score_communication: number;
    score_technical: number;
    score_enthusiasm: number;
    score_leadership: number;
    score_team_fit: number;
    // Computed
    total_score: number;         // avg of 5 metrics
    score: number;               // legacy alias for total_score
    // Evaluation
    recommendation: 'strong_select' | 'select' | 'maybe' | 'reject';
    interviewer_remarks: string;
    comments: string;            // legacy alias
    recommends_committee: boolean; // legacy alias
    created_at: string;
    updated_at?: string;
}

export interface PanelMetadata {
    id?: string;
    panel_id: number;
    date: string;
    panel_name: string;
}

export type EvaluationRecommendation = 'strong_select' | 'select' | 'maybe' | 'reject';

export interface AggregatedFeedback {
    applicationId: string;
    feedbacks: InterviewFeedback[];
    averageScores: {
        communication: number;
        technical: number;
        enthusiasm: number;
        leadership: number;
        teamFit: number;
        total: number;
    };
    variance: number;
    hasConflict: boolean; // variance > 2.5
    recommendationSummary: Record<EvaluationRecommendation, number>;
    interviewerCount: number;
}

export interface DepartmentWeights {
    id: string;
    department: string;
    // Per-metric weights within interview component
    metric_weight_communication: number;
    metric_weight_technical: number;
    metric_weight_enthusiasm: number;
    metric_weight_leadership: number;
    metric_weight_team_fit: number;
    // Component weights
    weight_task: number;
    weight_interview: number;
    updated_at?: string;
    updated_by?: string;
}

export interface SkillFrequency {
    skill: string;
    count: number;
    percentage: number;
}
