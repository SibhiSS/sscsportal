import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchFeedbacksForApplication, aggregateFeedbacks } from '@/services/interviewService';
import { InterviewFeedback, AggregatedFeedback, EvaluationRecommendation } from '@/types';
import { AlertTriangle, CheckCircle, Users, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MultiInterviewerPanelProps {
  applicationId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreTextColor(value: number): string {
  if (value < 5)  return 'text-red-400';
  if (value < 7)  return 'text-yellow-400';
  return 'text-green-400';
}

function recommendationMeta(rec: string): { label: string; color: string; bg: string; border: string } {
  switch (rec) {
    case 'strong_select': return { label: 'Strong Select', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  };
    case 'select':        return { label: 'Select',        color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30'   };
    case 'maybe':         return { label: 'Maybe',         color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    case 'reject':        return { label: 'Reject',        color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    };
    default:              return { label: rec,             color: 'text-white/50',   bg: 'bg-white/5',       border: 'border-white/10'      };
  }
}

// Mini bar for aggregate score
function MiniBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  const colorClass = scoreTextColor(value);

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40 uppercase tracking-wider truncate">{label}</span>
        <span className={`text-[11px] font-mono font-semibold ${colorClass}`}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          style={{
            background:
              value < 5
                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                : value < 7
                ? 'linear-gradient(90deg, #eab308, #facc15)'
                : 'linear-gradient(90deg, #16a34a, #4ade80)',
          }}
        />
      </div>
    </div>
  );
}

// Loading skeleton
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/[0.06] ${className ?? ''}`} />
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_LABELS: { key: keyof AggregatedFeedback['averageScores']; label: string }[] = [
  { key: 'communication', label: 'Comm.' },
  { key: 'technical',     label: 'Tech.' },
  { key: 'enthusiasm',    label: 'Enthus.' },
  { key: 'leadership',    label: 'Lead.' },
  { key: 'teamFit',       label: 'Team Fit' },
];

const TABLE_SCORE_KEYS: Array<{ field: keyof InterviewFeedback; label: string }> = [
  { field: 'score_communication', label: 'Comm.' },
  { field: 'score_technical',     label: 'Tech.' },
  { field: 'score_enthusiasm',    label: 'Enthus.' },
  { field: 'score_leadership',    label: 'Lead.' },
  { field: 'score_team_fit',      label: 'Team Fit' },
];

export default function MultiInterviewerPanel({ applicationId }: MultiInterviewerPanelProps) {
  const [feedbacks, setFeedbacks]       = useState<InterviewFeedback[]>([]);
  const [aggregated, setAggregated]     = useState<AggregatedFeedback | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFeedbacksForApplication(applicationId)
      .then((data) => {
        if (cancelled) return;
        setFeedbacks(data);
        setAggregated(aggregateFeedbacks(data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load evaluations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [applicationId]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4">
        <PanelSkeleton />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        <AlertTriangle size={15} className="shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!feedbacks.length || !aggregated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-12 gap-3 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Users size={20} className="text-white/20" />
        </div>
        <p className="text-sm font-medium text-white/40">No evaluations submitted yet</p>
        <p className="text-xs text-white/20">Interviewers haven't scored this candidate.</p>
      </motion.div>
    );
  }

  const { averageScores, hasConflict, variance, recommendationSummary, interviewerCount } = aggregated;

  // Recommendation pill data — only show counts > 0
  const recPills = (Object.entries(recommendationSummary) as Array<[EvaluationRecommendation, number]>)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => {
      const order: EvaluationRecommendation[] = ['strong_select', 'select', 'maybe', 'reject'];
      return order.indexOf(a) - order.indexOf(b);
    });

  const totalScoreColor = scoreTextColor(averageScores.total);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* ── Aggregate score row ──────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-start gap-4">
          {/* Big score number */}
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-bold tabular-nums ${totalScoreColor}`}>
                {averageScores.total.toFixed(1)}
              </span>
              <span className="text-sm text-white/30">/10</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-white/30">
              <TrendingUp size={11} />
              <span className="text-[10px] uppercase tracking-widest">
                {interviewerCount} interviewer{interviewerCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-white/[0.07] mx-1" />

          {/* Mini bars */}
          <div className="flex gap-3 flex-1 min-w-0 flex-wrap">
            {METRIC_LABELS.map(({ key, label }) => (
              <MiniBar key={key} label={label} value={averageScores[key]} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Conflict alert ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasConflict && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-400">
                  Conflicting Opinions — Review Recommended
                </p>
                <p className="text-xs text-yellow-400/60 mt-0.5">
                  Score variance is <span className="font-mono font-semibold text-yellow-400/80">{variance.toFixed(2)}</span> — interviewers have significantly different assessments.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Per-interviewer table ────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
                Interviewer
              </th>
              {TABLE_SCORE_KEYS.map(({ label }) => (
                <th key={label} className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium text-center whitespace-nowrap">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium text-center whitespace-nowrap">
                Total
              </th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
                Verdict
              </th>
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium text-center whitespace-nowrap">
                Rec. Dept
              </th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((fb, idx) => {
              const rec = recommendationMeta(fb.recommendation || 'maybe');
              const rowTotal = Number(fb.total_score) ||
                ((Number(fb.score_communication) + Number(fb.score_technical) + Number(fb.score_enthusiasm) + Number(fb.score_leadership) + Number(fb.score_team_fit)) / 5);

              return (
                <motion.tr
                  key={(fb as any).id || idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.25 }}
                  className="border-t border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                >
                  {/* Email */}
                  <td className="px-4 py-3 text-xs text-white/70 font-mono max-w-[160px] truncate">
                    {fb.interviewer_email}
                  </td>

                  {/* Score cells */}
                  {TABLE_SCORE_KEYS.map(({ field }) => {
                    const val = Number((fb as any)[field]) ?? 0;
                    return (
                      <td key={field} className="px-3 py-3 text-center">
                        <span className={`font-mono text-xs font-semibold tabular-nums ${scoreTextColor(val)}`}>
                          {val.toFixed(1)}
                        </span>
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="px-3 py-3 text-center">
                    <span className={`font-mono text-xs font-bold tabular-nums ${scoreTextColor(rowTotal)}`}>
                      {rowTotal.toFixed(1)}
                    </span>
                  </td>

                  {/* Recommendation */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rec.color} ${rec.bg} ${rec.border}`}
                    >
                      {rec.label}
                    </span>
                  </td>

                  {/* Recommended Dept */}
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10px] font-bold">
                      {fb.recommended_dept || (fb as any).recommends_for || 'General'}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Detailed Interviewer Verdicts & Remarks (SuperAdmin View) ───────── */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <span className="p-1 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300">💬</span>
          Interviewer Remarks & Verdicts (SuperAdmin View)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {feedbacks.map((fb, idx) => {
            const rec = recommendationMeta(fb.recommendation || 'maybe');
            const dept = fb.recommended_dept || (fb as any).recommends_for || 'General';
            const remarksText = fb.interviewer_remarks || fb.comments;
            const rowTotal = Number(fb.total_score) ||
              ((Number(fb.score_communication) + Number(fb.score_technical) + Number(fb.score_enthusiasm) + Number(fb.score_leadership) + Number(fb.score_team_fit)) / 5);

            return (
              <div key={(fb as any).id || idx} className="bg-gradient-to-br from-white/[0.04] to-black/60 border border-white/10 rounded-xl p-4 space-y-2.5 shadow-lg">
                <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-white font-mono truncate">{fb.interviewer_email}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Overall Score: <span className="text-white font-bold">{rowTotal.toFixed(1)} / 10</span></div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${rec.color} ${rec.bg} ${rec.border}`}>
                      {rec.label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 font-extrabold border border-purple-500/30">
                      Dept: {dept}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-white/90 italic whitespace-pre-wrap bg-black/40 p-3 rounded-lg border border-white/5 leading-relaxed font-sans">
                  {remarksText ? `"${remarksText}"` : <span className="text-muted-foreground/50 not-italic">No verbal remarks left by this interviewer.</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recommendation summary pills ─────────────────────────────────────── */}
      {recPills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-white/30">
            <CheckCircle size={13} />
            <span className="text-[10px] uppercase tracking-widest font-medium">Summary</span>
          </div>
          {recPills.map(([rec, count]) => {
            const meta = recommendationMeta(rec);
            return (
              <Badge
                key={rec}
                className={`text-[11px] font-semibold border ${meta.color} ${meta.bg} ${meta.border} px-2.5 py-0.5`}
              >
                {count}× {meta.label}
              </Badge>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
