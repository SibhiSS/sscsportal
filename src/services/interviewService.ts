import { supabase } from '@/lib/supabase';
import { InterviewFeedback, AggregatedFeedback, EvaluationRecommendation } from '@/types';

// ── Fetch all feedbacks for a candidate ──────────────────────────────────────

export async function fetchFeedbacksForApplication(applicationId: string): Promise<InterviewFeedback[]> {
    const { data, error } = await supabase
        .from('interview_feedback')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching feedbacks:', error);
        return [];
    }
    return (data || []).map((f: any) => {
        let remarks = f.interviewer_remarks || f.comments || '';
        let dept = f.recommended_dept || f.recommends_for || '';
        // If fallback format [Dept: ...] was used in comments, parse it out cleanly!
        if (!dept && typeof remarks === 'string' && remarks.startsWith('[Dept: ')) {
            const match = remarks.match(/^\[Dept:\s*([^\]]+)\]\s*(.*)$/s);
            if (match) {
                dept = match[1].trim();
                remarks = match[2].trim();
            }
        }
        return {
            ...f,
            interviewer_remarks: remarks,
            recommended_dept: dept,
        };
    }) as InterviewFeedback[];
}

// ── Compute aggregate scores + conflict detection ─────────────────────────────

export function aggregateFeedbacks(feedbacks: InterviewFeedback[]): AggregatedFeedback | null {
    if (!feedbacks.length) return null;

    const n = feedbacks.length;
    const sum = (key: keyof InterviewFeedback) =>
        feedbacks.reduce((acc, f) => acc + (Number(f[key]) || 0), 0);

    const avgCommunication = sum('score_communication') / n;
    const avgTechnical     = sum('score_technical') / n;
    const avgEnthusiasm    = sum('score_enthusiasm') / n;
    const avgLeadership    = sum('score_leadership') / n;
    const avgTeamFit       = sum('score_team_fit') / n;
    const avgTotal         = (avgCommunication + avgTechnical + avgEnthusiasm + avgLeadership + avgTeamFit) / 5;

    // Compute variance of total_score across interviewers
    const totals = feedbacks.map(f => Number(f.total_score) || 0);
    const mean = totals.reduce((a, b) => a + b, 0) / n;
    const variance = totals.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / n;

    // Recommendation summary
    const recommendationSummary: Record<EvaluationRecommendation, number> = {
        strong_select: 0, select: 0, maybe: 0, reject: 0,
    };
    for (const f of feedbacks) {
        const rec = f.recommendation || 'maybe';
        if (rec in recommendationSummary) {
            recommendationSummary[rec as EvaluationRecommendation]++;
        }
    }

    return {
        applicationId: feedbacks[0]?.application_id ?? '',
        feedbacks,
        averageScores: {
            communication: Math.round(avgCommunication * 10) / 10,
            technical:     Math.round(avgTechnical * 10) / 10,
            enthusiasm:    Math.round(avgEnthusiasm * 10) / 10,
            leadership:    Math.round(avgLeadership * 10) / 10,
            teamFit:       Math.round(avgTeamFit * 10) / 10,
            total:         Math.round(avgTotal * 10) / 10,
        },
        variance: Math.round(variance * 100) / 100,
        hasConflict: variance > 6.25, // std dev > 2.5 → variance > 6.25
        recommendationSummary,
        interviewerCount: n,
    };
}

// ── Submit / update an evaluation ─────────────────────────────────────────────

export interface EvaluationPayload {
    application_id: string;
    interviewer_email: string;
    score_communication: number;
    score_technical: number;
    score_enthusiasm: number;
    score_leadership: number;
    score_team_fit: number;
    recommendation: EvaluationRecommendation;
    interviewer_remarks: string;
    recommended_dept?: string;
}

export async function submitEvaluation(payload: EvaluationPayload): Promise<{ error: string | null }> {
    const baseRow: any = {
        ...payload,
        // Round scores to integers — DB columns are INTEGER type
        score_communication: Math.round(payload.score_communication),
        score_technical:     Math.round(payload.score_technical),
        score_enthusiasm:    Math.round(payload.score_enthusiasm),
        score_leadership:    Math.round(payload.score_leadership),
        score_team_fit:      Math.round(payload.score_team_fit),
        // Legacy field compat & explicit column assignment
        comments: payload.interviewer_remarks,
        interviewer_remarks: payload.interviewer_remarks,
        recommended_dept: payload.recommended_dept || '',
        recommends_committee: payload.recommendation !== 'reject',
    };

    let { data: feedbackData, error } = await supabase
        .from('interview_feedback')
        .upsert(baseRow, { onConflict: 'application_id,interviewer_email' })
        .select();

    // If upsert fails due to missing recommended_dept or interviewer_remarks columns before SQL migration is run, retry without them
    if (error && (error.message?.includes('recommended_dept') || error.message?.includes('interviewer_remarks') || error.message?.includes('schema cache'))) {
        console.warn('Column missing in interview_feedback table, retrying with legacy schema fallback...', error.message);
        delete baseRow.recommended_dept;
        delete baseRow.interviewer_remarks;
        // Embed remarks and dept in comments as fallback if columns don't exist yet
        baseRow.comments = `${payload.recommended_dept ? `[Dept: ${payload.recommended_dept}] ` : ''}${payload.interviewer_remarks || ''}`;
        const fallbackRes = await supabase
            .from('interview_feedback')
            .upsert(baseRow, { onConflict: 'application_id,interviewer_email' })
            .select();
        error = fallbackRes.error;
        feedbackData = fallbackRes.data;
    }

    if (error) {
        console.error('Feedback upsert error:', error);
        return { error: `Feedback save failed: ${error.message}` };
    }

    // Calculate new live interview average
    const allFeedbacks = await fetchFeedbacksForApplication(payload.application_id);
    const aggregated = aggregateFeedbacks(allFeedbacks);
    const newInterviewScore = aggregated?.averageScores.total ?? 0;

    // Fetch current status to conditionally update it
    const { data: currentApp } = await supabase
        .from('applications')
        .select('status')
        .eq('id', payload.application_id)
        .single();
        
    const shouldUpdateStatus = currentApp && ['interview_scheduled', 'shortlisted'].includes(currentApp.status);
    const updateData: any = { interview_score: newInterviewScore };
    
    if (shouldUpdateStatus) {
        updateData.status = 'interviewed';
        updateData.interviewed_at = new Date().toISOString();
    }

    // Update application with new interview score (fire and forget — RLS may block for some roles but feedback is already saved)
    await supabase
        .from('applications')
        .update(updateData)
        .eq('id', payload.application_id);

    return { error: null };
}
