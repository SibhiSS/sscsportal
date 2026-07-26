import React, { useState, useEffect, useMemo } from 'react';
import { Application } from '@/types';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, Users, Crown, CheckCircle, XCircle, RefreshCw, Send, Mail, ShieldAlert, Award, ArrowRight, Trash2, Plus, Minus, UserCheck } from 'lucide-react';
import { sendEmail } from '@/lib/email';
import { motion, AnimatePresence } from 'framer-motion';

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
    'Human Resources',
    'Editorial & Media'
];

function getRolesForDept(dept: string): string[] {
    if (dept === 'Technical') {
        return ['Lead', 'Associate Lead 1', 'Associate Lead 2'];
    }
    return ['Lead', 'Associate'];
}

interface CommitteeDraftBoardProps {
    applications: Application[];
    onUpdate: (id: string, updates: Partial<Application>) => Promise<void>;
}

export const CommitteeDraftBoard: React.FC<CommitteeDraftBoardProps> = ({ applications, onUpdate }) => {
    // Quotas per department
    const [quotas, setQuotas] = useState<Record<string, number>>({
        Technical: 12,
        Management: 10,
        'Event Operations': 10,
        Creative: 8,
        'Outreach & Partnerships': 8,
        'Human Resources': 8,
        'Editorial & Media': 6
    });

    // Local draft map: candidateId -> position/department string
    const [draftMap, setDraftMap] = useState<Record<string, string>>({});
    // Feedback map: candidateId -> array of recommended_dept strings from interviewers
    const [feedbackMap, setFeedbackMap] = useState<Record<string, string[]>>({});
    const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(true);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Email sending dialog state
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

    // ── 1. Fetch interviewer recommendations on mount ─────────────────────────
    useEffect(() => {
        const fetchRecommendations = async () => {
            setIsLoadingFeedbacks(true);
            const { data, error } = await supabase
                .from('interview_feedback')
                .select('application_id, recommended_dept, recommends_for, comments, interviewer_remarks');
            
            const map: Record<string, string[]> = {};
            if (data && !error) {
                data.forEach((row: any) => {
                    const appId = row.application_id;
                    if (!map[appId]) map[appId] = [];
                    let dept = row.recommended_dept || row.recommends_for || '';
                    if (!dept && typeof row.interviewer_remarks === 'string' && row.interviewer_remarks.startsWith('[Dept: ')) {
                        const m = row.interviewer_remarks.match(/^\[Dept:\s*([^\]]+)\]/);
                        if (m) dept = m[1].trim();
                    }
                    if (dept && !map[appId].includes(dept)) {
                        map[appId].push(dept);
                    }
                });
            }
            setFeedbackMap(map);
            setIsLoadingFeedbacks(false);
        };
        fetchRecommendations();
    }, []);

    // ── 2. Initialize local draft map from DB applications ──────────────────
    useEffect(() => {
        const initialMap: Record<string, string> = {};
        applications.forEach(app => {
            if (app.assignedPosition) {
                initialMap[app.id] = app.assignedPosition;
            } else if (['selected', 'active_member'].includes(app.status)) {
                // If selected but no specific role assigned, default to their primary dept
                initialMap[app.id] = app.primaryDept || 'Technical';
            }
        });
        setDraftMap(initialMap);
    }, [applications]);

    // Eligible candidates for drafting (anyone not rejected or withdrawn)
    const eligibleCandidates = useMemo(() => {
        return applications.filter(app => 
            !['rejected', 'withdrawn'].includes(app.status)
        ).sort((a, b) => {
            const scoreA = Number(a.finalScore || a.interviewScore || a.rating * 2) || 0;
            const scoreB = Number(b.finalScore || b.interviewScore || b.rating * 2) || 0;
            return scoreB - scoreA;
        });
    }, [applications]);

    // Unassigned candidates in current draft
    const unassignedCandidates = useMemo(() => {
        return eligibleCandidates.filter(c => !draftMap[c.id]);
    }, [eligibleCandidates, draftMap]);

    // ── 3. ⚡ SMART AUTO-DRAFT ALGORITHM ─────────────────────────────────────
    const handleRunAutoDraft = () => {
        setIsDrafting(true);
        setTimeout(() => {
            const newDraft = { ...draftMap };

            // Keep existing Executive Board positions intact, but clear department allocations if desired,
            // or let's re-allocate unassigned and non-lead department members!
            const alreadyAssignedIds = new Set(
                Object.keys(newDraft).filter(id => {
                    const pos = newDraft[id];
                    return BOARD_POSITIONS.includes(pos) || pos.includes('Lead -');
                })
            );

            // Remaining candidates available for smart auto-draft
            const availablePool = eligibleCandidates.filter(c => !alreadyAssignedIds.has(c.id));

            // Track current fill count per department
            const fillCount: Record<string, number> = {};
            DEPARTMENTS.forEach(d => {
                fillCount[d] = Object.values(newDraft).filter(pos => 
                    pos === d || pos.endsWith(`- ${d}`)
                ).length;
            });

            // Score each candidate against each department
            interface MatchScore {
                candidateId: string;
                dept: string;
                score: number;
            }

            const matches: MatchScore[] = [];
            availablePool.forEach(c => {
                const basePerf = Number(c.finalScore || c.interviewScore || c.rating * 2) || 5;
                const recDepts = feedbackMap[c.id] || [];

                DEPARTMENTS.forEach(dept => {
                    let points = basePerf;
                    // +50 if explicitly recommended by interviewers for this department!
                    if (recDepts.includes(dept)) points += 50;
                    // +30 if it is their 1st Preference
                    if (c.primaryDept === dept || c.department === dept) points += 30;
                    // +15 if it is their 2nd Preference
                    if (c.secondaryDept === dept) points += 15;

                    matches.push({ candidateId: c.id, dept, score: points });
                });
            });

            // Sort all potential matches descending by score
            matches.sort((a, b) => b.score - a.score);

            const draftedIds = new Set(alreadyAssignedIds);

            // Greedy allocation
            for (const match of matches) {
                if (draftedIds.has(match.candidateId)) continue;
                if ((fillCount[match.dept] || 0) < (quotas[match.dept] || 10)) {
                    newDraft[match.candidateId] = match.dept;
                    draftedIds.add(match.candidateId);
                    fillCount[match.dept] = (fillCount[match.dept] || 0) + 1;
                }
            }

            setDraftMap(newDraft);
            setIsDrafting(false);
            setSuccessMsg('⚡ Smart Auto-Draft Complete! Candidates optimally allocated based on interviewer verdicts, 1st/2nd preferences, and interview scores.');
            setTimeout(() => setSuccessMsg(null), 5000);
        }, 600);
    };

    // ── 4. Manual Assignment Helpers ──────────────────────────────────────────
    const assignCandidate = (candidateId: string, positionOrDept: string) => {
        if (candidateId === 'none') return;
        setDraftMap(prev => {
            const next = { ...prev };
            // If positionOrDept is a unique role (like Chairperson or Lead), clear previous holder
            if (BOARD_POSITIONS.includes(positionOrDept) || positionOrDept.includes('Lead -')) {
                Object.keys(next).forEach(id => {
                    if (next[id] === positionOrDept) delete next[id];
                });
            }
            next[candidateId] = positionOrDept;
            return next;
        });
    };

    const removeCandidate = (candidateId: string) => {
        setDraftMap(prev => {
            const next = { ...prev };
            delete next[candidateId];
            return next;
        });
    };

    const getHolderForRole = (roleName: string) => {
        return Object.keys(draftMap).find(id => draftMap[id] === roleName) || 'none';
    };

    const getMembersForDept = (dept: string) => {
        return applications.filter(app => {
            const pos = draftMap[app.id];
            return pos === dept || (pos && pos.endsWith(`- ${dept}`) && !pos.includes('Lead -'));
        });
    };

    // ── 5. Save & Apply Roster to Database ────────────────────────────────────
    const handleSaveRoster = async () => {
        setIsSaving(true);
        try {
            const updatePromises: Promise<any>[] = [];

            // 1. Update all drafted candidates to 'selected' with their assigned position
            Object.entries(draftMap).forEach(([id, pos]) => {
                const app = applications.find(a => a.id === id);
                if (app && (app.assignedPosition !== pos || app.status !== 'selected')) {
                    updatePromises.push(onUpdate(id, { assignedPosition: pos, status: 'selected' }));
                }
            });

            // 2. Anyone previously selected/assigned who is now removed from draft -> revert to 'interviewed'
            applications.forEach(app => {
                if (app.assignedPosition && !draftMap[app.id]) {
                    updatePromises.push(onUpdate(app.id, { assignedPosition: null as any, status: 'interviewed' }));
                }
            });

            await Promise.all(updatePromises);
            setSuccessMsg('✅ Roster Saved! All committee allocations and board roles have been synced to the database.');
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err: any) {
            console.error('Failed to save roster:', err);
            alert('Error saving roster: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ── 6. Send Official Offer Emails ─────────────────────────────────────────
    const handleSendOfferMails = async () => {
        if (confirmText.trim() !== 'CONFIRM' || isSending) return;
        setIsSending(true);
        setSendResult(null);

        const draftedApps = applications.filter(app => !!draftMap[app.id]);
        let sent = 0;
        let failed = 0;

        for (const app of draftedApps) {
            const pos = draftMap[app.id];
            if (!pos || !app.email) {
                failed++;
                continue;
            }

            try {
                const displayPos = pos.replace(/ \d -/, ' -');
                const isRole = BOARD_POSITIONS.includes(pos) || pos.includes('Lead -');
                const titleText = isRole ? `Selected as "${displayPos}"!` : `Selected for ${pos} Department!`;
                const bodyText = isRole 
                    ? `We are thrilled to inform you that you have been selected as <strong>"${displayPos}"</strong> for the tenure 2026-27!`
                    : `We are pleased to offer you a position as a Core Member in the <strong>${pos} Department</strong> at IEEE SSCS for the tenure 2026-27!`;

                const portalUrl = window.location.origin;
                const success = await sendEmail(
                    app.email,
                    `IEEE SSCS Results — ${titleText}`,
                    `<p>Dear <strong>${app.fullName}</strong>,</p>
                    <p>The selection results for IEEE SSCS are officially out.</p>
                    <p>${bodyText}</p>
                    <p style="margin: 20px 0;">
                        <a href="${portalUrl}/status" style="background-color: #9333ea; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Onboarding & Status Portal</a>
                    </p>
                    <p>We expect helpful co-ordination and teamwork throughout this tenure, along with active participation in our upcoming flagship events.</p>
                    <p>Congratulations and welcome aboard!</p>
                    <p>Best regards,<br>IEEE SSCS Executive Committee</p>`
                );

                if (success) {
                    await onUpdate(app.id, { status: 'active_member', assignedPosition: pos });
                    sent++;
                } else {
                    const masked = app.email.replace(/(\w{2})\w+@/, '$1***@');
                    console.warn(`[CommitteeDraftBoard] Offer mail failed for ${masked}`);
                    failed++;
                }
            } catch (err) {
                console.error('[CommitteeDraftBoard] Mail send error:', err);
                failed++;
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        setSendResult({ sent, failed });
        setIsSending(false);
    };

    const totalQuota = Object.values(quotas).reduce((a, b) => a + b, 0);
    const totalDrafted = Object.keys(draftMap).length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* ── TOP HERO BAR & COMMANDS ────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-purple-950/50 via-black/80 to-blue-950/50 p-6 md:p-8 rounded-3xl border border-purple-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(168,85,247,0.15)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold tracking-widest uppercase">
                        <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" />
                        AI Smart Allocation Engine & Draft Board
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Committee Draft & Team Roster
                    </h2>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Visually build your chapter roster. Click <strong className="text-purple-300">Run Smart Auto-Draft</strong> to let the algorithm optimally allocate candidates based on interviewer verdicts, 1st/2nd preferences, and interview scores. Fine-tune teams, then hit <strong className="text-green-400">Save Roster</strong> before publishing results!
                    </p>
                </div>

                {/* Stat Counters & Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center justify-around gap-4 bg-black/60 px-5 py-3 rounded-2xl border border-white/10 shrink-0">
                        <div className="text-center">
                            <div className="text-2xl font-black text-white">{totalDrafted}</div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Drafted</div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                            <div className="text-2xl font-black text-purple-400">{totalQuota}</div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Quota</div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                            <div className="text-2xl font-black text-amber-400">{unassignedCandidates.length}</div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Reserve Pool</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                        <Button
                            onClick={handleRunAutoDraft}
                            disabled={isDrafting || isLoadingFeedbacks}
                            className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-500 hover:to-red-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all hover:scale-[1.02]"
                        >
                            {isDrafting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            ⚡ Run Smart Auto-Draft
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                onClick={handleSaveRoster}
                                disabled={isSaving || totalDrafted === 0}
                                className="h-10 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(22,163,74,0.3)]"
                            >
                                {isSaving ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1.5" />}
                                Save Roster
                            </Button>
                            <Button
                                onClick={() => { setConfirmText(''); setSendResult(null); setIsSendDialogOpen(true); }}
                                disabled={totalDrafted === 0}
                                variant="outline"
                                className="h-10 px-4 rounded-xl border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs uppercase tracking-wider"
                            >
                                <Send className="w-3.5 h-3.5 mr-1.5" />
                                Send Mails
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Message Alert */}
            <AnimatePresence>
                {successMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-green-500/15 border border-green-500/40 text-green-300 flex items-center gap-3 font-medium text-sm shadow-lg"
                    >
                        <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                        <span>{successMsg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SECTION 1: EXECUTIVE BOARD POSITIONS ───────────────────────────── */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Crown className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-xl font-heading font-black text-white tracking-widest uppercase">
                        Executive Board Positions
                    </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {BOARD_POSITIONS.map(pos => {
                        const holderId = getHolderForRole(pos);
                        const holderApp = applications.find(a => a.id === holderId);
                        return (
                            <Card key={pos} className="bg-gradient-to-br from-yellow-950/20 via-black/60 to-black/80 border-yellow-500/30 rounded-2xl overflow-hidden shadow-lg">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black tracking-widest uppercase text-yellow-400">
                                            {pos}
                                        </span>
                                        {holderApp && (
                                            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-[10px] font-bold">
                                                Assigned
                                            </Badge>
                                        )}
                                    </div>
                                    <Select 
                                        value={holderId} 
                                        onValueChange={(val) => assignCandidate(val, pos)}
                                    >
                                        <SelectTrigger className="w-full bg-black/60 border-white/10 h-11 text-xs font-semibold rounded-xl text-white">
                                            <SelectValue placeholder="Select candidate..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-zinc-800 max-h-60">
                                            <SelectItem value="none" className="text-muted-foreground italic text-xs">None (Clear)</SelectItem>
                                            {eligibleCandidates.map(c => (
                                                <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                                                    {c.fullName} ({c.primaryDept || 'General'}) — ⭐ {(Number(c.finalScore || c.interviewScore || c.rating * 2) || 0).toFixed(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* ── SECTION 2: DEPARTMENT COMMITTEES (LEADS & MEMBERS) ──────────────── */}
            <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Users className="w-6 h-6 text-purple-400" />
                        <h3 className="text-xl font-heading font-black text-white tracking-widest uppercase">
                            Department Committees & Roster
                        </h3>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                        Tip: Adjust seat quotas with [+] and [-] to fit your chapter needs.
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {DEPARTMENTS.map(dept => {
                        const roles = getRolesForDept(dept);
                        const members = getMembersForDept(dept);
                        const currentQuota = quotas[dept] || 10;
                        const fillRatio = members.length / currentQuota;
                        const progressColor = fillRatio >= 1 ? 'bg-green-500' : fillRatio >= 0.7 ? 'bg-purple-500' : 'bg-blue-500';

                        return (
                            <Card key={dept} className="bg-gradient-to-br from-white/[0.04] via-black/60 to-black/90 border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-xl">
                                {/* Department Header & Quota Bar */}
                                <div className="bg-white/[0.03] p-5 border-b border-white/10 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-base font-black tracking-wider uppercase text-white">{dept}</h4>
                                        <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-xl border border-white/10 text-xs font-mono">
                                            <span className={`font-bold ${fillRatio >= 1 ? 'text-green-400' : 'text-purple-300'}`}>
                                                {members.length}
                                            </span>
                                            <span className="text-muted-foreground">/ {currentQuota} Seats</span>
                                            <div className="flex items-center gap-0.5 ml-1">
                                                <button 
                                                    onClick={() => setQuotas(prev => ({ ...prev, [dept]: Math.max(1, (prev[dept] || 10) - 1) }))}
                                                    className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-[10px] font-bold"
                                                >-</button>
                                                <button 
                                                    onClick={() => setQuotas(prev => ({ ...prev, [dept]: (prev[dept] || 10) + 1 }))}
                                                    className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-[10px] font-bold"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${progressColor}`} 
                                            style={{ width: `${Math.min(100, fillRatio * 100)}%` }} 
                                        />
                                    </div>
                                </div>

                                <CardContent className="p-5 space-y-6 flex-1 flex flex-col justify-between">
                                    {/* 1. Department Leads Section */}
                                    <div className="space-y-3 bg-black/40 p-3.5 rounded-2xl border border-white/5">
                                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                            Leadership Allocation
                                        </div>
                                        {roles.map(role => {
                                            const fullPos = `${role} - ${dept}`;
                                            const holderId = getHolderForRole(fullPos);
                                            const labelColor = role === 'Lead' ? 'text-blue-400 font-extrabold' : 'text-teal-300 font-bold';
                                            return (
                                                <div key={role} className="space-y-1">
                                                    <label className={`text-[10px] uppercase tracking-wider ${labelColor}`}>
                                                        {role}
                                                    </label>
                                                    <Select 
                                                        value={holderId} 
                                                        onValueChange={(val) => assignCandidate(val, fullPos)}
                                                    >
                                                        <SelectTrigger className="w-full bg-black/60 border-white/10 h-9 text-xs rounded-lg text-white font-medium">
                                                            <SelectValue placeholder="Select Lead..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-zinc-950 border-zinc-800 max-h-52">
                                                            <SelectItem value="none" className="text-muted-foreground italic text-xs">None (Clear)</SelectItem>
                                                            {eligibleCandidates.map(c => (
                                                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                                                    {c.fullName} — ⭐ {(Number(c.finalScore || c.interviewScore || c.rating * 2) || 0).toFixed(1)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* 2. Core Members Roster Section */}
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                            <span>Core Committee Members ({members.length})</span>
                                        </div>

                                        {members.length === 0 ? (
                                            <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl text-xs text-muted-foreground/60 italic">
                                                No candidates currently assigned to {dept}. Use Auto-Draft or add below.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                                {members.map(app => {
                                                    const is1st = app.primaryDept === dept || app.department === dept;
                                                    const is2nd = app.secondaryDept === dept;
                                                    const recDepts = feedbackMap[app.id] || [];
                                                    const isRec = recDepts.includes(dept);
                                                    const scoreVal = (Number(app.finalScore || app.interviewScore || app.rating * 2) || 0).toFixed(1);

                                                    return (
                                                        <div key={app.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-all text-xs group">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-bold text-white truncate flex items-center gap-1.5">
                                                                    <span>{app.fullName}</span>
                                                                    <span className="text-[10px] font-mono font-normal text-purple-300 bg-purple-500/10 px-1.5 py-0.2 rounded">⭐ {scoreVal}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                                    {isRec && <Badge variant="outline" className="text-[9px] bg-purple-500/20 text-purple-300 border-purple-500/30 px-1 py-0">Interviewer Rec</Badge>}
                                                                    {is1st && <Badge variant="outline" className="text-[9px] bg-blue-500/20 text-blue-300 border-blue-500/30 px-1 py-0">1st Pref</Badge>}
                                                                    {!is1st && is2nd && <Badge variant="outline" className="text-[9px] bg-cyan-500/20 text-cyan-300 border-cyan-500/30 px-1 py-0">2nd Pref</Badge>}
                                                                    {!is1st && !is2nd && !isRec && <Badge variant="outline" className="text-[9px] bg-amber-500/20 text-amber-300 border-amber-500/30 px-1 py-0">🔄 Transfer</Badge>}
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => removeCandidate(app.id)}
                                                                className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity shrink-0"
                                                                title="Remove from Committee"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Quick Add Candidate to Committee */}
                                    <div className="pt-2 border-t border-white/10">
                                        <Select 
                                            value="none" 
                                            onValueChange={(val) => {
                                                if (val && val !== 'none') assignCandidate(val, dept);
                                            }}
                                        >
                                            <SelectTrigger className="w-full bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-300 h-10 text-xs font-bold rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Add Core Member to {dept}...</span>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-950 border-zinc-800 max-h-60">
                                                <SelectItem value="none" className="text-muted-foreground italic text-xs">Select from Unassigned Pool ({unassignedCandidates.length})...</SelectItem>
                                                {unassignedCandidates.map(c => (
                                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                                        {c.fullName} ({c.primaryDept || 'General'}) — ⭐ {(Number(c.finalScore || c.interviewScore || c.rating * 2) || 0).toFixed(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* ── EMAIL DISPATCH CONFIRMATION DIALOG ─────────────────────────────── */}
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogContent className="bg-zinc-950 border-purple-500/30 text-white max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-heading font-black text-white flex items-center gap-2">
                            <Send className="w-5 h-5 text-purple-400" />
                            Dispatch Official Offer Mails
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs leading-relaxed pt-1">
                            You are about to send formal selection offer and congratulations emails to <strong className="text-white font-bold">{totalDrafted} drafted candidates</strong> across all board roles and committees.
                        </DialogDescription>
                    </DialogHeader>

                    {sendResult !== null ? (
                        <div className="py-6 text-center space-y-4">
                            {sendResult.failed === 0 ? (
                                <CheckCircle className="w-12 h-12 text-green-400 mx-auto animate-bounce" />
                            ) : sendResult.sent === 0 ? (
                                <XCircle className="w-12 h-12 text-red-400 mx-auto animate-bounce" />
                            ) : (
                                <div className="flex justify-center gap-3">
                                    <CheckCircle className="w-10 h-10 text-green-400" />
                                    <XCircle className="w-10 h-10 text-red-400" />
                                </div>
                            )}
                            <h4 className="text-lg font-black text-white">
                                {sendResult.failed === 0 ? 'All Offer Mails Dispatched Successfully!' :
                                 sendResult.sent === 0 ? 'All Sends Failed' :
                                 'Partially Dispatched'}
                            </h4>
                            <div className="flex justify-center gap-6 text-sm font-bold">
                                <span className="text-green-400">{sendResult.sent} sent</span>
                                {sendResult.failed > 0 && <span className="text-red-400">{sendResult.failed} failed</span>}
                            </div>
                            <Button onClick={() => setIsSendDialogOpen(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs mt-4 rounded-xl h-10">
                                Close
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 pt-3">
                            <div className="bg-black/60 p-3.5 rounded-2xl border border-white/10 max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
                                <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">Drafted Recipients ({totalDrafted})</div>
                                {applications.filter(a => !!draftMap[a.id]).map(c => (
                                    <div key={c.id} className="flex justify-between items-center text-xs p-1.5 rounded-lg bg-white/[0.02]">
                                        <span className="text-white font-semibold truncate">{c.fullName}</span>
                                        <span className="text-purple-300 font-mono text-[10px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{draftMap[c.id]}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs font-extrabold uppercase tracking-widest text-white/80 block">
                                    Type <span className="text-purple-400 font-mono">CONFIRM</span> below to dispatch offer mails:
                                </label>
                                <Input 
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className="bg-black/50 border-white/15 font-mono tracking-widest uppercase h-11 text-center font-bold text-white rounded-xl focus:border-purple-500"
                                    placeholder="CONFIRM"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setIsSendDialogOpen(false)} className="flex-1 rounded-xl h-10 text-xs">Cancel</Button>
                                <Button 
                                    onClick={handleSendOfferMails}
                                    disabled={confirmText.trim() !== 'CONFIRM' || isSending}
                                    className="flex-1 rounded-xl h-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-extrabold text-xs tracking-wider shadow-lg shadow-purple-500/20"
                                >
                                    {isSending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                    Dispatch Now
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
export default CommitteeDraftBoard;
