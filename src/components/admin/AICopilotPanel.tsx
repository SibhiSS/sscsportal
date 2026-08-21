import React, { useState, useEffect } from 'react';
import { Application, AIAnalysisResult } from '@/types';
import { analyzeCandidate, saveAnalysisToDb } from '@/services/aiService';
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, Cpu, Award, Zap, ShieldQuestion, BrainCircuit, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface AICopilotPanelProps {
    application: Application;
    /** Called after a fresh (non-cached) analysis completes, so the parent can
     * mirror the result into its own state — the panel itself only writes the
     * DB row via saveAnalysisToDb. */
    onAnalysisComplete?: (id: string, analysis: AIAnalysisResult) => void;
}

/**
 * Renders **bold** markers as <strong> without injecting raw HTML.
 *
 * Summary bullets interpolate applicant-controlled fields (program_name, department,
 * batch, primary_dept, secondary_dept), and a direct PostgREST insert bypasses the
 * apply form entirely — so this text must never reach dangerouslySetInnerHTML.
 */
function BoldMarkdown({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
                    <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                ) : (
                    part
                )
            )}
        </>
    );
}

export default function AICopilotPanel({ application, onAnalysisComplete }: AICopilotPanelProps) {
    // Seed from the cached analysis on the application row so opening a candidate
    // that's already been analyzed (e.g. via batch auto-shortlist, or a previous
    // visit) never calls the LLM at all — this is the main fix for the AI Copilot
    // tripping provider rate limits under normal admin browsing.
    const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(application.aiAnalysis || null);
    const [loading, setLoading] = useState<boolean>(!application.aiAnalysis);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Cached result already covers this candidate — skip the API call.
        if (application.aiAnalysis) {
            setAnalysis(application.aiAnalysis);
            setLoading(false);
            setError(null);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);
        analyzeCandidate(application).then(res => {
            if (isMounted) {
                setAnalysis(res);
                setLoading(false);
            }
            saveAnalysisToDb(application.id, res);
            onAnalysisComplete?.(application.id, res);
        }).catch(err => {
            console.error("AI Copilot failed:", err);
            if (isMounted) {
                setError(err?.message || 'AI Copilot failed to analyze this candidate.');
                setLoading(false);
            }
        });
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [application.id]);

    const handleRefresh = async () => {
        if (refreshing || loading) return;
        setRefreshing(true);
        try {
            const res = await analyzeCandidate(application);
            setAnalysis(res);
            setError(null);
            await saveAnalysisToDb(application.id, res);
            onAnalysisComplete?.(application.id, res);
        } catch (err: any) {
            console.error("Refresh AI Copilot failed:", err);
            setError(err?.message || 'AI Copilot failed to analyze this candidate.');
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-r from-purple-950/40 via-black/80 to-indigo-950/40 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden shadow-2xl animate-pulse">
                <div className="flex items-center gap-3 text-purple-400 font-semibold text-sm mb-4">
                    <Sparkles className="w-5 h-5 animate-spin" />
                    <span>AI Copilot synthesizing candidate profile & technical alignment...</span>
                </div>
                <div className="space-y-2">
                    <div className="h-4 bg-purple-500/10 rounded w-3/4" />
                    <div className="h-4 bg-purple-500/10 rounded w-5/6" />
                    <div className="h-4 bg-purple-500/10 rounded w-2/3" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gradient-to-r from-amber-950/30 via-black/80 to-amber-950/10 border border-amber-500/30 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden shadow-2xl">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                        <p className="text-sm font-semibold text-amber-200">AI Copilot unavailable</p>
                        <p className="text-xs text-amber-200/70 leading-relaxed">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="mt-1 h-8 border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!analysis) return null;

    const matchColor = analysis.matchScore >= 80 ? '#4ade80' : analysis.matchScore >= 65 ? '#facc15' : '#f87171';
    const matchBg = analysis.matchScore >= 80 ? 'rgba(74, 222, 128, 0.15)' : analysis.matchScore >= 65 ? 'rgba(250, 204, 21, 0.15)' : 'rgba(248, 113, 113, 0.15)';
    const matchBorder = analysis.matchScore >= 80 ? 'rgba(74, 222, 128, 0.3)' : analysis.matchScore >= 65 ? 'rgba(250, 204, 21, 0.3)' : 'rgba(248, 113, 113, 0.3)';

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-purple-950/30 via-black/90 to-indigo-950/30 border border-purple-500/30 rounded-2xl p-5 md:p-6 backdrop-blur-xl relative overflow-hidden shadow-2xl space-y-5"
        >
            {/* Background Holographic Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-white/10 relative z-10">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 shadow-lg shadow-purple-500/10">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                            AI Recruitment Copilot
                            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                {`Cloud LLM (${analysis.mode.toUpperCase()})`}
                            </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Automated competency matching for <span className="text-purple-300 font-medium">{application.primaryDept}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Match Score Badge */}
                    <div
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-lg transition-all"
                        style={{ backgroundColor: matchBg, borderColor: matchBorder, color: matchColor }}
                    >
                        <Award className="w-4 h-4" />
                        <div className="flex flex-col text-right">
                            <span className="text-sm font-black tabular-nums leading-none">{analysis.matchScore}%</span>
                            <span className="text-[9px] uppercase tracking-widest opacity-80 leading-none mt-0.5">Domain Fit</span>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="h-8 w-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                        title="Re-run AI Analysis"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Signal Breakdown: Technical vs Engagement (creativity/activeness/eagerness) */}
            <div className="grid grid-cols-2 gap-3 relative z-10">
                <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-blue-300/90">
                        <span className="flex items-center gap-1.5"><BrainCircuit className="w-3 h-3" /> Technical</span>
                        <span className="tabular-nums">{analysis.technicalScore}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400/70 rounded-full transition-all" style={{ width: `${analysis.technicalScore}%` }} />
                    </div>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-pink-300/90">
                        <span className="flex items-center gap-1.5"><Flame className="w-3 h-3" /> Creativity &amp; Drive</span>
                        <span className="tabular-nums">{analysis.engagementScore}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-400/70 rounded-full transition-all" style={{ width: `${analysis.engagementScore}%` }} />
                    </div>
                </div>
            </div>

            {/* Content Authenticity Flag — a review nudge, never an auto-reject */}
            {analysis.aiGeneratedLikelihood >= 35 && (
                <div className={`relative z-10 flex items-start gap-2.5 rounded-xl p-3 border text-xs ${analysis.aiGeneratedLikelihood >= 65 ? 'bg-red-950/20 border-red-500/30 text-red-200' : 'bg-amber-950/20 border-amber-500/30 text-amber-200'}`}>
                    <ShieldQuestion className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold">
                            {analysis.aiGeneratedLikelihood >= 65 ? 'Possible AI-generated content' : 'Some AI-polish suspected'} ({analysis.aiGeneratedLikelihood}%)
                        </span>
                        <p className="opacity-80 mt-0.5">{analysis.aiGeneratedNotes} — this is a flag for manual review, not a scoring penalty.</p>
                    </div>
                </div>
            )}

            {/* Executive Summary Bullets */}
            <div className="space-y-2.5 relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-widest text-purple-300/80 block">Executive Summary</span>
                <div className="grid gap-2 text-xs text-white/90 leading-relaxed bg-black/40 p-3.5 rounded-xl border border-white/5 shadow-inner">
                    {analysis.summaryBullets.map((bullet, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                            <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                            <span className="flex-1"><BoldMarkdown text={bullet} /></span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Strengths & Gaps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {/* Key Strengths */}
                <div className="space-y-2 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Key Strengths</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {analysis.strengths.map((str, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium tracking-wide shadow-sm"
                            >
                                {str}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Potential Gaps / Areas to Probe */}
                <div className="space-y-2 bg-amber-950/20 border border-amber-500/20 rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Areas to Probe in Interview</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {analysis.gaps.map((gap, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-medium tracking-wide shadow-sm"
                            >
                                {gap}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recommendation Banner */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center gap-3 relative z-10">
                <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                <p className="text-xs text-purple-200/90 font-medium italic">
                    "{analysis.recommendation}"
                </p>
            </div>
        </motion.div>
    );
}
