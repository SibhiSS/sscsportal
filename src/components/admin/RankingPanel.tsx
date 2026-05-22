import { useEffect, useState, useMemo } from 'react';
import { Application, AggregatedFeedback, DepartmentWeights } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  fetchDeptWeights,
  rankApplicationsInDept,
  persistRankings,
  RankedApplication,
} from '@/services/rankingService';
import { aggregateFeedbacks } from '@/services/interviewService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, RefreshCw, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HolographicCard from '@/components/ui/HolographicCard';
import { InterviewFeedback } from '@/types';

interface RankingPanelProps {
  applications: Application[];
  onUpdateTaskScore: (id: string, score: number) => Promise<void>;
  userEmail: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 5) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

const RECOMMENDATION_META: Record<string, { label: string; className: string }> = {
  strong_select: { label: 'Strong Select', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  select:        { label: 'Select',        className: 'bg-teal-500/20 text-teal-400 border border-teal-500/30' },
  maybe:         { label: 'Maybe',         className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  reject:        { label: 'Reject',        className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
};

function getTopRecommendation(agg: AggregatedFeedback | undefined): string | null {
  if (!agg) return null;
  const summary = agg.recommendationSummary;
  const order = ['strong_select', 'select', 'maybe', 'reject'] as const;
  for (const rec of order) {
    if (summary[rec] > 0) return rec;
  }
  return null;
}

// ── Inline task score editor ──────────────────────────────────────────────────

interface TaskScoreEditorProps {
  applicationId: string;
  currentScore: number | undefined;
  onSave: (id: string, score: number) => Promise<void>;
}

function TaskScoreEditor({ applicationId, currentScore, onSave }: TaskScoreEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(currentScore?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0 || parsed > 10) return;
    setSaving(true);
    await onSave(applicationId, parsed);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          className="w-16 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-primary"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
        >
          <Check size={13} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 group text-xs text-white/60 hover:text-white transition-colors"
    >
      <span>{currentScore != null ? currentScore.toFixed(1) : '—'}</span>
      <Edit2 size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RankingPanel({ applications, onUpdateTaskScore, userEmail }: RankingPanelProps) {
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [weights, setWeights] = useState<DepartmentWeights[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Map<string, AggregatedFeedback>>(new Map());
  const [rankedMap, setRankedMap] = useState<Map<string, RankedApplication[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unique departments from applications
  const departments = useMemo(() => {
    const depts = Array.from(new Set(applications.map(a => a.primaryDept || a.department || 'Unknown')));
    return ['All', ...depts.sort()];
  }, [applications]);

  // Applications for the selected dept
  const filteredApps = useMemo(() => {
    if (selectedDept === 'All') return applications;
    return applications.filter(a => (a.primaryDept || a.department) === selectedDept);
  }, [applications, selectedDept]);

  // ── Load weights + feedbacks on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedWeights, feedbackRows] = await Promise.all([
          fetchDeptWeights(),
          supabase.from('interview_feedback').select('*').then(r => r.data ?? []),
        ]);

        if (cancelled) return;

        setWeights(fetchedWeights);

        // Group feedbacks by application_id
        const grouped: Record<string, InterviewFeedback[]> = {};
        for (const row of (feedbackRows as InterviewFeedback[])) {
          const aid = row.application_id;
          if (!grouped[aid]) grouped[aid] = [];
          grouped[aid].push(row);
        }

        const aggMap = new Map<string, AggregatedFeedback>();
        for (const [aid, fbs] of Object.entries(grouped)) {
          const agg = aggregateFeedbacks(fbs);
          if (agg) aggMap.set(aid, agg);
        }
        setFeedbackMap(aggMap);

        // Run initial ranking
        runRanking(fetchedWeights, aggMap, false);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load ranking data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications]);

  // ── Rank calculation ────────────────────────────────────────────────────
  const runRanking = (
    w: DepartmentWeights[],
    fMap: Map<string, AggregatedFeedback>,
    shouldPersist: boolean
  ) => {
    const newRankedMap = new Map<string, RankedApplication[]>();

    // Group apps by dept
    const byDept: Record<string, Application[]> = { All: applications };
    for (const app of applications) {
      const d = app.primaryDept || app.department || 'Unknown';
      if (!byDept[d]) byDept[d] = [];
      byDept[d].push(app);
    }

    // For each dept, find weights (fall back to first weights or a default)
    for (const [dept, apps] of Object.entries(byDept)) {
      const deptWeight =
        w.find(dw => dw.department === dept) ??
        w[0] ?? {
          id: '',
          department: dept,
          metric_weight_communication: 0.2,
          metric_weight_technical: 0.2,
          metric_weight_enthusiasm: 0.2,
          metric_weight_leadership: 0.2,
          metric_weight_team_fit: 0.2,
          weight_task: 0.40,
          weight_interview: 0.60,
        };

      newRankedMap.set(dept, rankApplicationsInDept(apps, fMap, deptWeight));
    }

    setRankedMap(newRankedMap);

    if (shouldPersist) {
      const allRanked = newRankedMap.get('All') ?? [];
      persistRankings(allRanked).catch(console.error);
    }
  };

  // ── Recalculate handler ─────────────────────────────────────────────────
  const handleRecalculate = async () => {
    setRecalculating(true);
    setPersisting(false);
    try {
      runRanking(weights, feedbackMap, false);
      // Persist after small delay so UI updates first
      await new Promise(r => setTimeout(r, 400));
      setPersisting(true);
      const allRanked = rankedMap.get('All') ?? [];
      await persistRankings(allRanked);
    } catch (err: any) {
      setError(err.message ?? 'Recalculation failed.');
    } finally {
      setRecalculating(false);
      setPersisting(false);
    }
  };

  // ── Displayed ranked list ───────────────────────────────────────────────
  const displayedRanked = useMemo(() => {
    return rankedMap.get(selectedDept) ?? rankedMap.get('All') ?? [];
  }, [rankedMap, selectedDept]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-white">Rankings Leaderboard</h2>
          {displayedRanked.length > 0 && (
            <span className="text-xs text-white/30 ml-1">
              {displayedRanked.length} candidate{displayedRanked.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          onClick={handleRecalculate}
          disabled={recalculating || loading}
          variant="outline"
          size="sm"
          className="border-primary/40 text-primary hover:bg-primary/10 hover:border-primary gap-1.5"
        >
          <RefreshCw size={13} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Recalculating…' : persisting ? 'Saving…' : 'Recalculate Rankings'}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Dept filter tabs */}
      <div className="flex flex-wrap gap-2">
        {departments.map(dept => (
          <button
            key={dept}
            onClick={() => setSelectedDept(dept)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedDept === dept
                ? 'bg-primary text-white shadow-[0_0_12px_rgba(220,20,60,0.35)]'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <HolographicCard className="p-10">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              className="w-10 h-10 rounded-full border-2 border-primary/50 border-t-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-white/40 text-sm">Loading scores and rankings…</p>
          </div>
        </HolographicCard>
      ) : displayedRanked.length === 0 ? (
        <HolographicCard className="p-10 text-center">
          <Trophy size={32} className="mx-auto text-white/10 mb-3" />
          <p className="text-white/30 text-sm">No ranked candidates yet. Try recalculating.</p>
        </HolographicCard>
      ) : (
        <motion.div
          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider w-12">Rank</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Dept</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Task</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Interview</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider w-28">Final Score</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {displayedRanked.map((ranked, idx) => {
                    const rec = getTopRecommendation(feedbackMap.get(ranked.app.id));
                    const recMeta = rec ? RECOMMENDATION_META[rec] : null;

                    return (
                      <motion.tr
                        key={ranked.app.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, delay: idx * 0.03 }}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Rank */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {ranked.rank <= 3 && (
                              <span className="text-sm">
                                {ranked.rank === 1 ? '🥇' : ranked.rank === 2 ? '🥈' : '🥉'}
                              </span>
                            )}
                            <span className={`font-bold text-sm ${ranked.rank <= 3 ? 'text-white' : 'text-white/40'}`}>
                              #{ranked.rank}
                            </span>
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium text-sm leading-tight">{ranked.app.fullName}</p>
                            <p className="text-white/30 text-xs mt-0.5">{ranked.app.rollNumber}</p>
                          </div>
                        </td>

                        {/* Dept */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
                            {ranked.app.primaryDept || ranked.app.department || '—'}
                          </span>
                        </td>

                        {/* Task score — editable */}
                        <td className="px-4 py-3 text-right">
                          <TaskScoreEditor
                            applicationId={ranked.app.id}
                            currentScore={ranked.taskScore}
                            onSave={onUpdateTaskScore}
                          />
                        </td>

                        {/* Interview score */}
                        <td className="px-4 py-3 text-right">
                          {ranked.interviewScore > 0 ? (
                            <span className="text-xs text-white/60">{ranked.interviewScore.toFixed(1)}</span>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </td>

                        {/* Final score badge */}
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-block border rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${scoreBg(ranked.finalScore)} ${scoreColor(ranked.finalScore)}`}>
                            {ranked.finalScore.toFixed(2)}
                          </span>
                        </td>

                        {/* Recommendation */}
                        <td className="px-4 py-3">
                          {recMeta ? (
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${recMeta.className}`}>
                              {recMeta.label}
                            </span>
                          ) : (
                            <span className="text-xs text-white/20">Not evaluated</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Footer info */}
      {!loading && displayedRanked.length > 0 && (
        <p className="text-xs text-white/20 text-right">
          Scores computed from task · interview weights. Last operator: {userEmail}
        </p>
      )}
    </div>
  );
}
