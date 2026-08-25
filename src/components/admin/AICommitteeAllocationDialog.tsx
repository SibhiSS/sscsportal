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
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Bot, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { Application } from '@/types';
import { analyzeCommitteeFitBatch, CommitteeFitProgress, CommitteeFitResult, COMMITTEE_FIT_BATCH_SIZE } from '@/services/aiService';

export interface CommitteeAiCandidate {
    app: Application;
    /** Same restriction the merit allocator uses — the AI is only ever offered
     *  these choices and can never answer outside them. */
    eligibleDepts: string[];
    marksSummary: string;
    feedbackText: string;
}

interface AICommitteeAllocationDialogProps {
    open: boolean;
    onClose: () => void;
    /** Unassigned, committee-eligible candidates — parent has already computed
     *  each one's eligible department set. */
    candidates: CommitteeAiCandidate[];
    /** Parent owns the actual seat allocation (allocateBySeatPriority) — this
     *  dialog only produces per-candidate department judgments for accepted rows. */
    onApply: (results: Map<string, CommitteeFitResult>) => void;
}

type Step = 'configure' | 'analyzing' | 'preview';

const AICommitteeAllocationDialog: React.FC<AICommitteeAllocationDialogProps> = ({ open, onClose, candidates, onApply }) => {
    const [step, setStep] = useState<Step>('configure');
    const [progress, setProgress] = useState<CommitteeFitProgress>({ completed: 0, total: 0 });
    const [results, setResults] = useState<Map<string, CommitteeFitResult>>(new Map());
    const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Anyone with zero eligible departments can't be analyzed at all — no choice
    // exists for the AI to make. Surfaced separately so it's clear why they're
    // missing from the run rather than silently dropped.
    const analyzable = useMemo(() => candidates.filter(c => c.eligibleDepts.length > 0), [candidates]);
    const noEligible = useMemo(() => candidates.filter(c => c.eligibleDepts.length === 0), [candidates]);
    const singleChoice = useMemo(() => analyzable.filter(c => c.eligibleDepts.length === 1), [analyzable]);
    const multiChoice = useMemo(() => analyzable.filter(c => c.eligibleDepts.length > 1), [analyzable]);

    const reset = () => {
        setStep('configure');
        setProgress({ completed: 0, total: 0 });
        setResults(new Map());
        setFailures([]);
        setSelectedIds(new Set());
    };

    const handleClose = () => {
        if (step === 'analyzing') return; // don't let admin close mid-run
        reset();
        onClose();
    };

    const runAnalysis = async () => {
        if (analyzable.length === 0) return;
        setStep('analyzing');
        setFailures([]);
        const localFailures: { name: string; error: string }[] = [];

        const computed = await analyzeCommitteeFitBatch(
            analyzable.map(c => ({
                id: c.app.id,
                fullName: c.app.fullName,
                marksSummary: c.marksSummary,
                feedbackText: c.feedbackText,
                eligibleDepts: c.eligibleDepts,
            })),
            {
                concurrency: 3,
                onProgress: setProgress,
                onResult: (id, result, error) => {
                    if (error) {
                        const c = analyzable.find(x => x.app.id === id);
                        localFailures.push({ name: c?.app.fullName || id, error });
                    }
                },
            }
        );

        setResults(computed);
        setFailures(localFailures);
        setSelectedIds(new Set(Array.from(computed.keys())));
        setStep('preview');
    };

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const confirmApply = () => {
        const filtered = new Map<string, CommitteeFitResult>();
        results.forEach((result, id) => { if (selectedIds.has(id)) filtered.set(id, result); });
        onApply(filtered);
        reset();
    };

    const previewRows = useMemo(() => {
        return analyzable
            .filter(c => results.has(c.app.id))
            .map(c => ({ candidate: c, result: results.get(c.app.id)! }))
            .sort((a, b) => (a.candidate.app.fullName || '').localeCompare(b.candidate.app.fullName || ''));
    }, [analyzable, results]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent className="max-w-2xl bg-black/90 border-white/10 text-foreground backdrop-blur-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-400" />
                        AI Committee Allocation
                    </DialogTitle>
                    <DialogDescription>
                        Gemini/ChatGPT judge each candidate's department fit using ONLY their marks and interviewer feedback — no resume or application text is sent. The AI can never pick a department a candidate didn't apply to or wasn't recommended for; seats are still filled strictly by merit, and nothing is placed until you review and apply below.
                    </DialogDescription>
                </DialogHeader>

                {step === 'configure' && (
                    <div className="space-y-4 py-2">
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-xs text-purple-200/90 flex items-start gap-2">
                            <Bot className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                {multiChoice.length} candidate{multiChoice.length === 1 ? '' : 's'} have more than one eligible department — the AI will judge these,
                                {' '}batched {COMMITTEE_FIT_BATCH_SIZE} at a time into {Math.max(1, Math.ceil(multiChoice.length / COMMITTEE_FIT_BATCH_SIZE))} request{Math.ceil(multiChoice.length / COMMITTEE_FIT_BATCH_SIZE) === 1 ? '' : 's'} total to stay well within a free-tier key's daily quota.
                                {' '}{singleChoice.length} have exactly one eligible department (nothing to judge, placed as-is, no API call spent).
                            </span>
                        </div>
                        {noEligible.length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    {noEligible.length} candidate{noEligible.length === 1 ? '' : 's'} have no preference and no interviewer recommendation — excluded entirely, since there is nothing eligible to place them in.
                                </span>
                            </div>
                        )}
                        {candidates.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">No unassigned candidates in the pool right now.</p>
                        )}
                    </div>
                )}

                {step === 'analyzing' && (
                    <div className="py-10 space-y-4 text-center">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                        <p className="text-sm text-white/80">
                            Analyzing{progress.current ? ` — ${progress.current}` : '...'}
                        </p>
                        <Progress value={progress.total ? (progress.completed / progress.total) * 100 : 0} className="max-w-sm mx-auto" />
                        <p className="text-xs text-muted-foreground">{progress.completed} / {progress.total}</p>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="space-y-4 py-2">
                        {failures.length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{failures.length} candidate{failures.length === 1 ? '' : 's'} could not be analyzed (e.g. {failures[0].name}: {failures[0].error}) — they'll fall back to plain preference order when you apply, same as Auto-Fill.</span>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {selectedIds.size} of {previewRows.length} accepted. Uncheck any you disagree with — those fall back to plain preference order instead of the AI's pick.
                        </p>
                        <div className="max-h-[45vh] overflow-y-auto space-y-1.5 pr-1">
                            {previewRows.map(({ candidate, result }) => (
                                <label
                                    key={candidate.app.id}
                                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(candidate.app.id) ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                >
                                    <Checkbox checked={selectedIds.has(candidate.app.id)} onCheckedChange={() => toggleSelected(candidate.app.id)} className="mt-0.5" />
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium truncate">{candidate.app.fullName}</span>
                                            <Badge variant="outline" className="text-[10px] font-bold text-purple-300 border-purple-500/30">{result.department}</Badge>
                                            <Badge variant="outline" className={`text-[10px] font-bold ${result.confidence >= 75 ? 'text-green-400 border-green-500/30' : result.confidence >= 50 ? 'text-yellow-400 border-yellow-500/30' : 'text-red-400 border-red-500/30'}`}>
                                                {result.confidence}% confident
                                            </Badge>
                                            {result.corrected && (
                                                <Badge variant="outline" className="text-[10px] font-bold text-amber-300 border-amber-500/40">⚠ answer auto-corrected</Badge>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-snug">{result.reasoning}</p>
                                    </div>
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
                                disabled={analyzable.length === 0}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Bot className="w-4 h-4 mr-2" /> Analyze {analyzable.length} Candidate{analyzable.length === 1 ? '' : 's'}
                            </Button>
                        </>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={confirmApply}
                                disabled={selectedIds.size === 0}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Apply to Draft
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AICommitteeAllocationDialog;
