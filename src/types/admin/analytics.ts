export interface AdminAnalytics {
    totalApplications: number;
    byDepartment: Record<string, number>;
    conversionRates: {
        submitted_to_review: number;
        review_to_interview: number;
        interview_to_selected: number;
        overall: number;
    };
    dropOffPoints: {
        stage: string;
        count: number;
        percentage: number;
    }[];
    selectionRatio: number;
}
