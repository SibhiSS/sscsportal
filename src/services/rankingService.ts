import { supabase } from '@/lib/supabase';
import { Application, DepartmentWeights } from '@/types';
import { AggregatedFeedback } from '@/types';

// ── Fetch department weights ─────────────────────────────────────────────────

export async function fetchDeptWeights(): Promise<DepartmentWeights[]> {
    const { data, error } = await supabase
        .from('department_weights')
        .select('*')
        .order('department');
    if (error) console.error('fetchDeptWeights error:', error);
    return (data || []) as DepartmentWeights[];
}

export async function saveDeptWeights(weights: Partial<DepartmentWeights> & { department: string }, updatedBy: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('department_weights')
        .upsert({ ...weights, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: 'department' });
    return { error: error?.message ?? null };
}

// ── Score calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the weighted final score for an application.
 * @param app - Application object (needs rating, taskScore)
 * @param aggregated - Aggregated feedback for this application (can be null)
 * @param weights - Dept weight config
 */
export function calculateFinalScore(
    app: Application,
    aggregated: AggregatedFeedback | null,
    weights: DepartmentWeights
): number {
    const taskScore = app.taskScore && app.taskScore > 0 ? Math.min(10, app.taskScore) : 0;
    const interviewScore = aggregated ? aggregated.averageScores.total : (app.interviewScore ?? 0);

    if (taskScore > 0 && interviewScore > 0) {
        const totalW = (weights.weight_task || 0) + (weights.weight_interview || 0);
        const raw = (taskScore * weights.weight_task) + (interviewScore * weights.weight_interview);
        return Math.round((totalW > 0 ? raw / totalW : (taskScore + interviewScore) / 2) * 100) / 100;
    }

    const final = interviewScore > 0 ? interviewScore : taskScore;
    return Math.round(final * 100) / 100;
}

// ── Batch rank a department ───────────────────────────────────────────────────

export interface RankedApplication {
    app: Application;
    finalScore: number;
    rank: number;
    taskScore: number;
    interviewScore: number;
}

export function rankApplicationsInDept(
    apps: Application[],
    aggregates: Map<string, AggregatedFeedback>,
    weights: DepartmentWeights
): RankedApplication[] {
    const scored = apps.map(app => {
        const aggregated = aggregates.get(app.id) ?? null;
        const taskScore = app.taskScore && app.taskScore > 0 ? Math.min(10, app.taskScore) : 0;
        const interviewScore = aggregated?.averageScores.total ?? app.interviewScore ?? 0;

        let finalScore = 0;
        if (taskScore > 0 && interviewScore > 0) {
            const totalW = (weights.weight_task || 0) + (weights.weight_interview || 0);
            const raw = (taskScore * weights.weight_task) + (interviewScore * weights.weight_interview);
            finalScore = totalW > 0 ? raw / totalW : (taskScore + interviewScore) / 2;
        } else {
            finalScore = interviewScore > 0 ? interviewScore : taskScore;
        }

        return {
            app,
            finalScore: Math.round(finalScore * 100) / 100,
            rank: 0,
            taskScore,
            interviewScore,
        };
    });

    // Sort descending by finalScore
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // Assign ranks
    scored.forEach((item, idx) => { item.rank = idx + 1; });

    return scored;
}

// ── Persist final scores back to Supabase ────────────────────────────────────

export async function persistRankings(ranked: RankedApplication[]): Promise<void> {
    const updates = ranked.map(r => ({
        id: r.app.id,
        final_score: r.finalScore,
        rank_in_dept: r.rank,
        task_score: r.taskScore,
        interview_score: r.interviewScore,
    }));

    for (const update of updates) {
        await supabase
            .from('applications')
            .update({
                final_score: update.final_score,
                rank_in_dept: update.rank_in_dept,
                interview_score: update.interview_score
            })
            .eq('id', update.id);
    }
}
