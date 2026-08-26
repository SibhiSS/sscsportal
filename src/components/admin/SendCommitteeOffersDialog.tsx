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
import { Checkbox } from '@/components/ui/checkbox';
import { Send, CheckCircle2, Loader2, Search } from 'lucide-react';
import { Application } from '@/types';
import { enqueueMailBatch } from '@/lib/email';

interface SendCommitteeOffersDialogProps {
    open: boolean;
    onClose: () => void;
    /** Confirmed committee members not yet mailed (status 'selected'), already
     *  sorted by the parent — this dialog doesn't re-rank them. */
    candidates: Application[];
}

type Step = 'select' | 'confirm' | 'sending' | 'done';

function buildOfferEmail(app: Application): { subject: string; message: string } {
    const dept = app.assignedPosition || app.primaryDept || 'the';
    return {
        subject: `IEEE SSCS Results — Selected for ${dept} Committee!`,
        message: `<p>Dear <strong>${app.fullName}</strong>,</p>
            <p>The selection results for IEEE SSCS are officially out!</p>
            <p>We are pleased to offer you a position as a <strong>Core Committee Member in the ${dept} Department</strong> at IEEE SSCS for the tenure 2026-27!</p>
            <p>We expect helpful co-ordination and teamwork throughout this tenure, along with active participation in our upcoming flagship events.</p>
            <p>Congratulations and welcome aboard!</p>
            <p>Best regards,<br>IEEE SSCS Executive Committee</p>`,
    };
}

const SendCommitteeOffersDialog: React.FC<SendCommitteeOffersDialogProps> = ({ open, onClose, candidates }) => {
    const [step, setStep] = useState<Step>('select');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [result, setResult] = useState<{ queued: number; skippedDuplicates: number; skippedNoEmail: number } | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return candidates;
        return candidates.filter(c =>
            (c.fullName || '').toLowerCase().includes(q) || (c.assignedPosition || '').toLowerCase().includes(q)
        );
    }, [candidates, search]);

    const reset = () => {
        setStep('select');
        setSelectedIds(new Set());
        setSearch('');
        setConfirmText('');
        setResult(null);
        setSendError(null);
    };

    const handleClose = () => {
        if (step === 'sending') return; // don't let admin close mid-send
        reset();
        onClose();
    };

    const toggle = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAllFiltered = () => setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.add(c.id));
        return next;
    });

    const deselectAllFiltered = () => setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.delete(c.id));
        return next;
    });

    const confirmSend = async () => {
        if (confirmText.trim() !== 'CONFIRM') return;
        setStep('sending');
        setSendError(null);

        const chosen = candidates.filter(c => selectedIds.has(c.id));
        const withEmail = chosen.filter(c => !!c.email);
        const skippedNoEmail = chosen.length - withEmail.length;

        const items = withEmail.map(app => {
            const { subject, message } = buildOfferEmail(app);
            return {
                email: app.email,
                subject,
                message,
                sideEffect: {
                    purpose: 'committee_offer' as const,
                    targetApplicationId: app.id,
                    assignedPosition: app.assignedPosition || app.primaryDept,
                },
            };
        });

        try {
            const { queued, skippedDuplicates } = await enqueueMailBatch(items, `committee-offers-${new Date().toISOString().slice(0, 10)}`);
            setResult({ queued, skippedDuplicates, skippedNoEmail });
            setStep('done');
        } catch (err) {
            setSendError(err instanceof Error ? err.message : String(err));
            setStep('confirm');
        }
    };

    const selectedCount = candidates.filter(c => selectedIds.has(c.id)).length;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent className="max-w-2xl bg-black/90 border-white/10 text-foreground backdrop-blur-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Send className="w-5 h-5 text-purple-400" />
                        Send Committee Offer Mails
                    </DialogTitle>
                    <DialogDescription>
                        Pick exactly who gets the offer email today — check the box next to each name. Sends are queued server-side (deduplicated, survives closing this tab) and only flip a candidate to Active Member once the mail provider confirms delivery.
                    </DialogDescription>
                </DialogHeader>

                {(step === 'select' || step === 'confirm') && (
                    <div className="space-y-3 py-2">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Filter by name or department..."
                                    className="bg-white/5 border-white/10 pl-8 h-9 text-sm"
                                />
                            </div>
                            <Button variant="ghost" size="sm" onClick={selectAllFiltered} className="text-xs shrink-0">Select all{search ? ' (filtered)' : ''}</Button>
                            <Button variant="ghost" size="sm" onClick={deselectAllFiltered} className="text-xs shrink-0">Clear{search ? ' (filtered)' : ''}</Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {selectedCount} of {candidates.length} selected. Only candidates with status "Selected" (not yet mailed) are listed here.
                        </p>

                        {candidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Nobody is waiting on an offer mail right now — Save Roster first, or everyone confirmed has already been sent theirs.
                            </p>
                        ) : (
                            <div className="max-h-[40vh] overflow-y-auto space-y-1 pr-1">
                                {filtered.map(c => (
                                    <label
                                        key={c.id}
                                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(c.id) ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                    >
                                        <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium truncate">{c.fullName}</div>
                                                {!c.email && <div className="text-[10px] text-red-400">No email on file — will be skipped</div>}
                                            </div>
                                            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded shrink-0">{c.assignedPosition}</span>
                                        </div>
                                    </label>
                                ))}
                                {filtered.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-6">No matches for "{search}".</p>
                                )}
                            </div>
                        )}

                        {step === 'confirm' && (
                            <div className="space-y-2 pt-2 border-t border-white/10">
                                {sendError && (
                                    <p className="text-xs text-red-400">Could not queue the batch: {sendError}</p>
                                )}
                                <label className="text-xs font-extrabold uppercase tracking-widest text-white/80 block">
                                    Type <span className="text-purple-400 font-mono">CONFIRM</span> to send {selectedCount} offer mail{selectedCount === 1 ? '' : 's'}:
                                </label>
                                <Input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className="bg-black/50 border-white/15 font-mono tracking-widest uppercase h-11 text-center font-bold text-white rounded-xl focus:border-purple-500"
                                    placeholder="CONFIRM"
                                />
                            </div>
                        )}
                    </div>
                )}

                {step === 'sending' && (
                    <div className="py-10 space-y-4 text-center">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                        <p className="text-sm text-white/80">Queuing {selectedCount} email{selectedCount === 1 ? '' : 's'}...</p>
                        <p className="text-xs text-muted-foreground">This can take a little while for a large batch — do not close this tab yet.</p>
                    </div>
                )}

                {step === 'done' && result && (
                    <div className="py-6 text-center space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                        <h4 className="text-lg font-black text-white">Queued</h4>
                        <div className="flex justify-center gap-6 text-sm font-bold flex-wrap">
                            <span className="text-green-400">{result.queued} newly queued</span>
                            {result.skippedDuplicates > 0 && <span className="text-amber-400">{result.skippedDuplicates} already queued/sent — skipped</span>}
                            {result.skippedNoEmail > 0 && <span className="text-red-400">{result.skippedNoEmail} skipped — no email on file</span>}
                        </div>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto">
                            Sending continues in the background even if you close this tab. Each candidate flips to Active Member only once their email is confirmed delivered — refresh the board in a bit to see updated statuses.
                        </p>
                    </div>
                )}

                <DialogFooter>
                    {step === 'select' && (
                        <>
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={() => setStep('confirm')}
                                disabled={selectedCount === 0}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Send className="w-4 h-4 mr-2" /> Continue with {selectedCount}
                            </Button>
                        </>
                    )}
                    {step === 'confirm' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('select')}>Back</Button>
                            <Button
                                onClick={confirmSend}
                                disabled={confirmText.trim() !== 'CONFIRM'}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-extrabold"
                            >
                                <Send className="w-4 h-4 mr-2" /> Dispatch {selectedCount} Mail{selectedCount === 1 ? '' : 's'}
                            </Button>
                        </>
                    )}
                    {step === 'done' && (
                        <Button onClick={handleClose} className="w-full bg-white/10 hover:bg-white/20 text-white">Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SendCommitteeOffersDialog;
