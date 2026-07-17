import { Application } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, Users, Send, AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { sendEmail } from '@/lib/email';

const BOARD_POSITIONS = [
    'Chairperson',
    'Vice-Chair Person',
    'Secretary',
    'Treasurer/Co-Sec',
    'Chairperson (WiS)',
    'Vice-Chairperson (WiS)'
];

const DEPARTMENTS = [
    'Technical',
    'Management',
    'Event Operations',
    'Creative',
    'Outreach & Partnerships',
    'Human Resources'
];

interface PositionManagerProps {
    applications: Application[];
    onUpdate: (id: string, updates: Partial<Application>) => Promise<void>;
}

const PositionManager = ({ applications, onUpdate }: PositionManagerProps) => {
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendSuccessCount, setSendSuccessCount] = useState<number | null>(null);

    // Candidates who currently have an assigned position
    const assignedCandidates = applications.filter(app => !!app.assignedPosition);

    // Filter to candidates who have completed their interview (or already assigned)
    const eligibleCandidates = applications.filter(app => 
        ['interviewed', 'selected', 'active_member'].includes(app.status)
    ).sort((a, b) => a.fullName.localeCompare(b.fullName));

    const handleAssignPosition = async (candidateId: string, positionName: string) => {
        if (candidateId === "none") {
            // Find who currently has this position and clear it
            const currentHolder = applications.find(a => a.assignedPosition === positionName);
            if (currentHolder) {
                setUpdatingIds(prev => new Set(prev).add(currentHolder.id));
                await onUpdate(currentHolder.id, { assignedPosition: null as any });
                setUpdatingIds(prev => {
                    const next = new Set(prev);
                    next.delete(currentHolder.id);
                    return next;
                });
            }
            return;
        }

        setUpdatingIds(prev => new Set(prev).add(candidateId));

        // If someone else already has this position, clear it first
        const currentHolder = applications.find(a => a.assignedPosition === positionName);
        if (currentHolder && currentHolder.id !== candidateId) {
            await onUpdate(currentHolder.id, { assignedPosition: null as any });
        }

        // Assign to new candidate
        await onUpdate(candidateId, { assignedPosition: positionName, status: 'selected' });

        setUpdatingIds(prev => {
            const next = new Set(prev);
            next.delete(candidateId);
            return next;
        });
    };

    const getCandidateForPosition = (positionName: string) => {
        return applications.find(a => a.assignedPosition === positionName)?.id || "none";
    };

    const handleSendPositionEmails = async () => {
        if (confirmText.trim() !== 'CONFIRM' || isSending) return;
        setIsSending(true);
        setSendSuccessCount(null);

        let count = 0;
        try {
            for (const app of assignedCandidates) {
                if (!app.assignedPosition || !app.email) continue;

                await sendEmail(
                    app.email,
                    `Selection Result: ${app.assignedPosition} - IEEE SSCS`,
                    `<p>Dear <strong>${app.fullName}</strong>,</p>
                    <p>We are pleased to inform you that you have been selected for the position of <strong>${app.assignedPosition}</strong> at IEEE SSCS!</p>
                    <p><strong>Important Note:</strong> Students selected for Board/Lead positions are required to hold an active IEEE Student Membership with IEEE Solid-State Circuits Society (SSCS) membership to serve as office bearers of the IEEE SSCS Student Branch Chapter.</p>
                    <p>Our team will contact you shortly regarding onboarding and team initialization.</p>
                    <p>Best regards,<br>IEEE SSCS Executive Committee</p>`
                );

                await onUpdate(app.id, { status: 'active_member' });
                count++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit protection
            }
            setSendSuccessCount(count);
        } catch (err) {
            console.error('Failed to send position emails:', err);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* TOP BAR / ACTION HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                <div>
                    <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-purple-400" />
                        Position Notifications
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        {assignedCandidates.length} candidate{assignedCandidates.length !== 1 ? 's' : ''} currently assigned to positions.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setConfirmText('');
                        setSendSuccessCount(null);
                        setIsSendDialogOpen(true);
                    }}
                    disabled={assignedCandidates.length === 0}
                    className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-500/20"
                >
                    <Send className="w-4 h-4 mr-2" />
                    Send Position Mails
                </Button>
            </div>

            {/* BOARD POSITIONS */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                    <Crown className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-heading font-bold text-white tracking-widest uppercase">Board Positions</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {BOARD_POSITIONS.map(position => (
                        <Card key={position} className="bg-white/5 border-white/10 backdrop-blur-xl">
                            <CardContent className="p-5 flex flex-col gap-3">
                                <div className="text-sm font-bold tracking-widest uppercase text-yellow-400/80">
                                    {position}
                                </div>
                                <Select 
                                    value={getCandidateForPosition(position)} 
                                    onValueChange={(val) => handleAssignPosition(val, position)}
                                >
                                    <SelectTrigger className="w-full bg-black/50 border-white/10 h-10 text-xs">
                                        <SelectValue placeholder="Select candidate..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                        <SelectItem value="none" className="text-muted-foreground italic">None (Clear)</SelectItem>
                                        {eligibleCandidates.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">
                                                {c.fullName} ({c.primaryDept})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* DEPARTMENT POSITIONS */}
            <div className="space-y-4 pt-8 border-t border-white/10">
                <div className="flex items-center gap-2 mb-6">
                    <Users className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-heading font-bold text-white tracking-widest uppercase">Department Leads</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {DEPARTMENTS.map(dept => (
                        <Card key={dept} className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
                            <div className="bg-white/5 px-5 py-3 border-b border-white/10">
                                <h3 className="text-sm font-bold tracking-widest uppercase text-blue-400">{dept}</h3>
                            </div>
                            <CardContent className="p-5 space-y-4">
                                {['Lead', 'Associate'].map(role => {
                                    const fullPositionName = `${role} - ${dept}`;
                                    return (
                                        <div key={role} className="space-y-2">
                                            <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                                                {role}
                                            </label>
                                            <Select 
                                                value={getCandidateForPosition(fullPositionName)} 
                                                onValueChange={(val) => handleAssignPosition(val, fullPositionName)}
                                            >
                                                <SelectTrigger className="w-full bg-black/50 border-white/10 h-10 text-xs">
                                                    <SelectValue placeholder="Select candidate..." />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                                    <SelectItem value="none" className="text-muted-foreground italic">None (Clear)</SelectItem>
                                                    {eligibleCandidates.map(c => (
                                                        <SelectItem key={c.id} value={c.id} className="text-xs">
                                                            {c.fullName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
            {/* CONFIRM DIALOG */}
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogContent className="bg-zinc-950 border-purple-500/30 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-heading font-bold text-white flex items-center gap-2">
                            <Send className="w-5 h-5 text-purple-400" />
                            Confirm Position Mails
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs">
                            This will send official position confirmation emails to all assigned candidates.
                        </DialogDescription>
                    </DialogHeader>

                    {sendSuccessCount !== null ? (
                        <div className="py-6 text-center space-y-3">
                            <CheckCircle className="w-12 h-12 text-green-400 mx-auto animate-bounce" />
                            <h4 className="text-lg font-bold text-white">Emails Dispatched!</h4>
                            <p className="text-xs text-zinc-400">Successfully sent emails to {sendSuccessCount} candidate(s).</p>
                            <Button onClick={() => setIsSendDialogOpen(false)} className="w-full bg-white/10 text-white font-bold text-xs mt-4">
                                Close
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 pt-2">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10 max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">Recipients ({assignedCandidates.length})</div>
                                {assignedCandidates.map(c => (
                                    <div key={c.id} className="flex justify-between items-center text-xs">
                                        <span className="text-white font-medium">{c.fullName}</span>
                                        <span className="text-purple-300 font-mono text-[10px]">{c.assignedPosition}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs text-zinc-300 font-semibold">
                                    Type <span className="font-mono font-bold text-red-400">CONFIRM</span> to send:
                                </label>
                                <Input
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder="Type CONFIRM here"
                                    className="bg-black/50 border-white/10 text-white text-xs font-mono uppercase tracking-widest"
                                />
                            </div>

                            <div className="flex gap-2 pt-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsSendDialogOpen(false)}
                                    disabled={isSending}
                                    className="flex-1 border-white/10 text-zinc-400 text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSendPositionEmails}
                                    disabled={confirmText.trim() !== 'CONFIRM' || isSending}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs"
                                >
                                    {isSending ? 'Sending Mails...' : 'Confirm & Send'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PositionManager;
