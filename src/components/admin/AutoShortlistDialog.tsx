import React, { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Wand2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Application, AIAnalysisResult } from '@/types';
import { analyzeCandidatesBatch, BatchAnalysisProgress } from '@/services/aiService';
import { canTransition } from '@/lib/fsm';

interface AutoShortlistDialogProps {
    open: boolean;
    onClose: () => void;
    applications: Application[];
    onAnalysisCached: (id: string, analysis: AIAnalysisResult) => void;
    onShortlist: (ids: string[]) => Promise<void>;
}

type Step = 'configure' | 'analyzing' | 'preview' | 'applying';

// Only candidates still early in the pipeline are eligible — anyone already
// shortlisted/rejected/etc. shouldn't be silently reprocessed by a bulk tool.
const ELIGIBLE_STATUSES = ['applied', 'pending', 'under_review', 'neutral'];

const AutoShortlistDialog: React.FC<AutoShortlistDialogProps> = ({ open, onClose, applications, onAnalysisCached, onShortlist }) => {
    const [step, setStep] = useState<Step>('configure');
    const [targetCount, setTargetCount] = useState(20);
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [forceReanalyze, setForceReanalyze] = useState(false);
    const [progress, setProgress] = useState<BatchAnalysisProgress>({ completed: 0, total: 0 });
    const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);
    const [ranked, setRanked] = useState<{ app: Application; analysis: AIAnalysisResult }[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const uniqueDepts = useMemo(() => Array.from(new Set(applications.map(a => a.primaryDept))).sort(), [applications]);

    const eligiblePool = useMemo(() => applications.filter(a =>
        ELIGIBLE_STATUSES.includes(a.status) && (deptFilter === 'ALL' || a.primaryDept === deptFilter)
    ), [applications, deptFilter]);

    const reset = () => {
        setStep('configure');
        setProgress({ completed: 0, total: 0 });
        setFailures([]);
        setRanked([]);
        setSelectedIds(new Set());
    };

    const handleClose = () => {
        if (step === 'analyzing' || step === 'applying') return; // don't let admin close mid-run
        reset();
        onClose();
    };

    const runAnalysis = async () => {
        if (eligiblePool.length === 0) return;
        setStep('analyzing');
        setFailures([]);
        const localFailures: { name: string; error: string }[] = [];

        const computed = await analyzeCandidatesBatch(eligiblePool, {
            force: forceReanalyze,
            concurrency: 3,
            onProgress: setProgress,
            onResult: (id, analysis, error) => {
                if (analysis) onAnalysisCached(id, analysis);
                if (error) {
                    const app = eligiblePool.find(a => a.id === id);
                    localFailures.push({ name: app?.fullName || id, error });
                }
            },
        });

        const combined = eligiblePool
            .map(app => ({ app, analysis: computed.get(app.id) || app.aiAnalysis }))
            .filter((x): x is { app: Application; analysis: AIAnalysisResult } => !!x.analysis)
            .sort((a, b) => b.analysis.matchScore - a.analysis.matchScore);

        setRanked(combined);
        setFailures(localFailures);
        setSelectedIds(new Set(combined.slice(0, targetCount).map(x => x.app.id)));
        setStep('preview');
    };

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const confirmShortlist = async () => {
        const ids = Array.from(selectedIds).filter(id => {
            const app = ranked.find(r => r.app.id === id)?.app;
            return app && canTransition(app.status, 'shortlisted');
        });
        if (ids.length === 0) return;
        setStep('applying');
        await onShortlist(ids);
        reset();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent className="max-w-2xl bg-black/90 border-white/10 text-foreground backdrop-blur-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-400" />
                        Auto-Shortlist with AI Copilot
                    </DialogTitle>
                    <DialogDescription>
                        Ranks candidates by AI match score and pre-selects the top N for shortlisting. You review and confirm before anything changes — nothing is shortlisted automatically without your approval.
                    </DialogDescription>
                </DialogHeader>

                {step === 'configure' && (
                    <div className="space-y-5 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Shortlist top</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={eligiblePool.length || 1}
                                    value={targetCount}
                                    onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value) || 1))}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Department scope</Label>
                                <Select value={deptFilter} onValueChange={setDeptFilter}>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-zinc-800">
                                        <SelectItem value="ALL">All Departments</SelectItem>
                                        {uniqueDepts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                            <Checkbox id="force-reanalyze" checked={forceReanalyze} onCheckedChange={(c) => setForceReanalyze(!!c)} />
                            <Label htmlFor="force-reanalyze" className="text-xs text-muted-foreground cursor-pointer">
                                Re-run AI analysis even for candidates that already have a cached score
                            </Label>
                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-xs text-purple-200/90 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                {eligiblePool.length} candidate{eligiblePool.length === 1 ? '' : 's'} eligible (status: Applied / Under Review{deptFilter !== 'ALL' ? `, dept: ${deptFilter}` : ''}).
                                {' '}{eligiblePool.filter(a => a.aiAnalysis).length} already have a cached score and will be reused unless "re-run" is checked above.
                            </span>
                        </div>
                    </div>
                )}

                {step === 'analyzing' && (
                    <div className="py-10 space-y-4 text-center">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                        <p className="text-sm text-white/80">
                            Analyzing candidates{progress.current ? ` — ${progress.current}` : '...'}
                        </p>
                        <Progress value={progress.total ? (progress.completed / progress.total) * 100 : 0} className="max-w-sm mx-auto" />
                        <p className="text-xs text-muted-foreground">{progress.completed} / {progress.total}</p>
                    </div>
                )}

                {(step === 'preview' || step === 'applying') && (
                    <div className="space-y-4 py-2">
                        {failures.length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{failures.length} candidate{failures.length === 1 ? '' : 's'} failed to analyze and were excluded from ranking (e.g. {failures[0].name}: {failures[0].error}).</span>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {selectedIds.size} selected — ranked by match score, top {targetCount} pre-checked. Uncheck anyone you'd rather leave for manual review.
                        </p>
                        <div className="max-h-[45vh] overflow-y-auto space-y-1.5 pr-1">
                            {ranked.map(({ app, analysis }, idx) => (
                                <label
                                    key={app.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(app.id) ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                >
                                    <Checkbox checked={selectedIds.has(app.id)} onCheckedChange={() => toggleSelected(app.id)} />
                                    <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate">{app.fullName}</span>
                                            <span className="text-[10px] text-muted-foreground truncate">{app.primaryDept}</span>
                                        </div>
                                        {analysis.aiGeneratedLikelihood >= 60 && (
                                            <span className="text-[10px] text-amber-400/90">⚠ high AI-content likelihood — review answers manually</span>
                                        )}
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] font-bold ${analysis.matchScore >= 80 ? 'text-green-400 border-green-500/30' : analysis.matchScore >= 65 ? 'text-yellow-400 border-yellow-500/30' : 'text-red-400 border-red-500/30'}`}>
                                        {analysis.matchScore}%
                                    </Badge>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'configure' && (
                        <>
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={runAnalysis}
                                disabled={eligiblePool.length === 0}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Sparkles className="w-4 h-4 mr-2" /> Analyze & Rank
                            </Button>
                        </>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={confirmShortlist}
                                disabled={selectedIds.size === 0}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Shortlist {selectedIds.size} Candidate{selectedIds.size === 1 ? '' : 's'}
                            </Button>
                        </>
                    )}
                    {step === 'applying' && (
                        <Button disabled className="bg-cyan-600 text-white">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Shortlisting...
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AutoShortlistDialog;
