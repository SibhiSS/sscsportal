import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Application } from '@/types';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Users, CheckCircle, RefreshCw, Trash2, Plus, UserCheck, GripVertical, AlertTriangle, Bot, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommitteeFitResult } from '@/services/aiService';
import AICommitteeAllocationDialog, { CommitteeAiCandidate } from './AICommitteeAllocationDialog';
import { exportCommitteeRosterPdf } from '@/lib/committeeRosterPdf';

const DEPARTMENTS = [
    'Technical',
    'Management',
    'Event Operations',
    'Creative',
    'Outreach & Partnerships',
    'Human Resources'
];

interface CommitteeDraftBoardProps {
    applications: Application[];
    onUpdate: (id: string, updates: Partial<Application>) => Promise<void>;
    onViewCandidate?: (app: Application) => void;
}

// Fallback seat counts, used only until committee_quotas loads (or if that table
// is missing because migration_committee_quotas.sql hasn't been run yet).
const DEFAULT_QUOTAS: Record<string, number> = {
    Technical: 15,
    Management: 12,
    'Event Operations': 12,
    Creative: 10,
    'Outreach & Partnerships': 10,
    'Human Resources': 10
};

const MIN_SEATS = 1;
const MAX_SEATS = 99;

// Only candidates who have actually been through an interview may be drafted.
// The old filter was "not rejected and not withdrawn" — and 'withdrawn' is not
// even a real status, so in practice untouched 'applied' rows were draftable.
const DRAFT_ELIGIBLE_STATUSES = ['interviewed', 'selected_pending', 'selected', 'active_member'];

export const CommitteeDraftBoard: React.FC<CommitteeDraftBoardProps> = ({ applications, onUpdate, onViewCandidate }) => {
    // Seat quotas per department, persisted in public.committee_quotas so every
    // admin sees the same numbers.
    const [quotas, setQuotas] = useState<Record<string, number>>(DEFAULT_QUOTAS);
    // Raw text of each seat input while it is being typed. Kept separate from
    // `quotas` so clearing the field to type "20" doesn't momentarily clamp to 1.
    const [seatDrafts, setSeatDrafts] = useState<Record<string, string>>({});
    const [quotaError, setQuotaError] = useState<string | null>(null);

    // Local draft map: candidateId -> department string (e.g., 'Technical')
    const [draftMap, setDraftMap] = useState<Record<string, string>>({});
    // Feedback map: candidateId -> array of recommended_dept strings from interviewers
    const [feedbackMap, setFeedbackMap] = useState<Record<string, string[]>>({});
    // Feedback TEXT map: candidateId -> array of raw comment/remarks strings, one
    // per interviewer. Only consumer is the AI committee-fit analysis.
    const [feedbackTextMap, setFeedbackTextMap] = useState<Record<string, string[]>>({});
    const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(true);
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Drag and drop state
    const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
    const [dragOverDept, setDragOverDept] = useState<string | null>(null);

    // Quick Preview Candidate State
    const [previewCandidate, setPreviewCandidate] = useState<Application | null>(null);


    // ── 1. Fetch interviewer recommendations on mount ─────────────────────────
    useEffect(() => {
        const fetchRecommendations = async () => {
            setIsLoadingFeedbacks(true);
            // Fix C: removed non-existent column 'recommends_for' (error 42703).
            // The actual schema column is 'recommends_committee' (boolean).
            // The fallback to recommends_for in the loop below is kept for legacy read safety.
            const { data, error } = await supabase
                .from('interview_feedback')
                .select('application_id, recommended_dept, recommends_committee, comments, interviewer_remarks');
            
            const map: Record<string, string[]> = {};
            // Raw comment/remarks text per candidate, one entry per interviewer who
            // left one — feeds the AI committee-fit analysis below, which is asked
            // to judge marks + this feedback text only, nothing else.
            const textMap: Record<string, string[]> = {};
            if (data && !error) {
                data.forEach((row: any) => {
                    const appId = row.application_id;
                    if (!map[appId]) map[appId] = [];
                    let dept = row.recommended_dept || row.recommends_for || '';
                    let remarks = typeof row.interviewer_remarks === 'string' ? row.interviewer_remarks : '';
                    if (!dept && remarks.startsWith('[Dept: ')) {
                        const m = remarks.match(/^\[Dept:\s*([^\]]+)\]\s*(.*)$/s);
                        if (m) {
                            dept = m[1].trim();
                            remarks = m[2].trim();
                        }
                    }
                    if (dept && !map[appId].includes(dept)) {
                        map[appId].push(dept);
                    }
                    const comment = (remarks || row.comments || '').trim();
                    if (comment) {
                        if (!textMap[appId]) textMap[appId] = [];
                        textMap[appId].push(comment);
                    }
                });
            }
            setFeedbackMap(map);
            setFeedbackTextMap(textMap);
            setIsLoadingFeedbacks(false);
        };
        fetchRecommendations();
    }, []);

    // ── 1b. Load persisted seat quotas ────────────────────────────────────────
    useEffect(() => {
        const fetchQuotas = async () => {
            const { data, error } = await supabase
                .from('committee_quotas')
                .select('department, seats');

            if (error) {
                // Fall back to the defaults rather than blocking the whole board, but
                // say so — edits won't stick and the admin needs to know that.
                //
                // Report what actually went wrong instead of always blaming the
                // migration: "run the migration" is useless advice to someone who
                // just ran it, and these three cases need three different fixes.
                console.error('[CommitteeDraftBoard] Could not load seat quotas:', error.code, error.message);

                const diagnosis =
                    error.code === 'PGRST205'
                        ? "the table isn't in Supabase's API schema cache yet. Run  NOTIFY pgrst, 'reload schema';  in the SQL Editor, or wait about a minute and reload."
                    : error.code === '42501'
                        ? 'the database refused the read for this account. Your email is probably missing from the admins table, or stored with different casing.'
                    : error.code === '42P01'
                        ? "the committee_quotas table doesn't exist. If you ran the migration, it likely rolled back — re-run migration_committee_quotas.sql."
                        : `${error.message} (code ${error.code || 'unknown'}).`;

                setQuotaError(`Seat quotas could not be loaded — showing defaults, and changes won't be saved. Reason: ${diagnosis}`);
                return;
            }

            if (data && data.length > 0) {
                const loaded: Record<string, number> = { ...DEFAULT_QUOTAS };
                data.forEach((row: { department: string; seats: number }) => { loaded[row.department] = row.seats; });
                setQuotas(loaded);
            }
        };
        fetchQuotas();
    }, []);

    // ── 2. Initialize local draft map from DB applications ──────────────────
    // This effect re-runs on every new `applications` array identity, which
    // includes background refetches. It used to overwrite draftMap each time,
    // so an unrelated refetch silently threw away unsaved placements. It now
    // seeds once and then leaves the draft alone until it's explicitly saved.
    const hasSeededDraft = useRef(false);

    useEffect(() => {
        if (hasSeededDraft.current || applications.length === 0) return;

        const initialMap: Record<string, string> = {};
        applications.forEach(app => {
            if (app.assignedPosition && DEPARTMENTS.includes(app.assignedPosition)) {
                initialMap[app.id] = app.assignedPosition;
            } else if (['selected', 'active_member'].includes(app.status)) {
                // If selected but no specific dept assigned, default to their primary dept if valid
                const defaultDept = DEPARTMENTS.includes(app.primaryDept) ? app.primaryDept : 'Technical';
                initialMap[app.id] = defaultDept;
            }
        });
        setDraftMap(initialMap);
        hasSeededDraft.current = true;
    }, [applications]);

    // Eligible candidates for drafting — interviewed and beyond only.
    const eligibleCandidates = useMemo(() => {
        return applications.filter(app =>
            DRAFT_ELIGIBLE_STATUSES.includes(app.status)
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

    // ── 3. MERIT-RANKED AUTO-DRAFT ───────────────────────────────────────────
    // Merit score for ranking. Deliberately defaults to 0, not 5: the old
    // fallback handed an unscored candidate 5 points, which outranked anyone who
    // genuinely scored below that.
    const meritScore = (c: Application): number =>
        Number(c.finalScore || c.interviewScore || (c.rating ? c.rating * 2 : 0)) || 0;

    // The ONLY departments a candidate may be placed in: the two they asked for,
    // plus anything an interviewer explicitly recommended. Returned in the order
    // they should be offered — an interviewer's verdict outranks a stated
    // preference, 1st preference outranks 2nd.
    const eligibleDeptsFor = (c: Application): string[] => {
        const ordered: string[] = [];
        const push = (d?: string | null) => {
            if (d && DEPARTMENTS.includes(d) && !ordered.includes(d)) ordered.push(d);
        };
        (feedbackMap[c.id] || []).forEach(push);   // interviewer recommendations
        push(c.primaryDept || c.department);       // 1st preference
        push(c.secondaryDept);                     // 2nd preference
        return ordered;
    };

    // Marks only, formatted for the AI committee-fit prompt — deliberately
    // excludes skills/reason/links, which is the whole point of this analysis
    // being different from the pre-interview resume-fit AI Copilot.
    // Task Score deliberately excluded — it's frequently unset (reads as a
    // literal 0.0/10 rather than "not recorded"), and was showing up in AI
    // reasoning as if a candidate had scored badly when the field simply hadn't
    // been filled in.
    const marksSummaryFor = (c: Application): string => {
        const parts: string[] = [];
        if (c.interviewScore != null) parts.push(`Interview Score: ${Number(c.interviewScore).toFixed(1)}/10`);
        if (c.finalScore != null) parts.push(`Final Score: ${Number(c.finalScore).toFixed(1)}`);
        if (c.rating != null) parts.push(`Star Rating: ${c.rating}/5`);
        return parts.length ? parts.join(', ') : 'No scores recorded.';
    };

    // Pool handed to the AI dialog: unassigned candidates only, matching
    // Auto-Fill's own merge behaviour — this never re-judges someone already
    // placed (by hand or by a previous AI run) without an explicit Clear Draft.
    const aiCandidatePool: CommitteeAiCandidate[] = useMemo(() => {
        return unassignedCandidates.map(c => ({
            app: c,
            eligibleDepts: eligibleDeptsFor(c),
            marksSummary: marksSummaryFor(c),
            feedbackText: (feedbackTextMap[c.id] || []).join(' | '),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unassignedCandidates, feedbackMap, feedbackTextMap]);

    // Seat-safe allocator shared by plain Auto-Fill and the AI-assisted dialog.
    // Candidates are processed strictly by marks, highest first, and each takes
    // the first department in ITS OWN priority list that still has a seat. This
    // is what guarantees the two properties that matter here:
    //
    //   1. Nobody is ever placed outside the departments the priority function
    //      hands back for them — both callers build that list from eligibleDeptsFor,
    //      so it is always a subset of what they applied to or were recommended
    //      for, never anything else.
    //   2. A higher-scoring candidate is never displaced by a lower-scoring one
    //      for a seat they both wanted, because seats are claimed in merit order.
    //
    // The two callers differ only in ORDER WITHIN a candidate's own eligible set:
    // plain Auto-Fill uses eligibleDeptsFor's fixed order (recommendation > 1st >
    // 2nd); the AI dialog reorders that same set to put the AI's judgment call
    // first. Neither caller can ever add a department the other wouldn't allow.
    const allocateBySeatPriority = (
        candidates: Application[],
        priorityListFor: (c: Application) => string[],
        existingDraft: Record<string, string>
    ): { newDraft: Record<string, string>; placedBefore: number; added: number; unplaced: Application[] } => {
        const newDraft: Record<string, string> = { ...existingDraft };

        const fillCount: Record<string, number> = {};
        DEPARTMENTS.forEach(d => { fillCount[d] = 0; });
        Object.values(newDraft).forEach(dept => {
            if (fillCount[dept] !== undefined) fillCount[dept] += 1;
        });

        const draftedIds = new Set<string>(Object.keys(newDraft));
        const placedBefore = draftedIds.size;

        const byMerit = [...candidates]
            .filter(c => !draftedIds.has(c.id))
            .sort((a, b) => {
                const diff = meritScore(b) - meritScore(a);
                return diff !== 0 ? diff : (a.fullName || '').localeCompare(b.fullName || '');
            });

        const unplaced: Application[] = [];

        for (const c of byMerit) {
            const choices = priorityListFor(c);
            const dept = choices.find(d => fillCount[d] < quotaFor(d));

            if (!dept) {
                unplaced.push(c);
                continue;
            }

            newDraft[c.id] = dept;
            draftedIds.add(c.id);
            fillCount[dept] += 1;
        }

        return { newDraft, placedBefore, added: draftedIds.size - placedBefore, unplaced };
    };

    // Auto-Fill MERGES: it keeps everyone already placed by hand and only fills the
    // seats still empty. Use Clear Draft if you want to start over.
    //
    // A candidate whose eligible departments are all full stays in the reserve
    // pool rather than being parked somewhere arbitrary.
    const handleRunAutoDraft = () => {
        setIsDrafting(true);
        setTimeout(() => {
            const { newDraft, placedBefore, added, unplaced } = allocateBySeatPriority(eligibleCandidates, eligibleDeptsFor, draftMap);

            setDraftMap(newDraft);
            setIsDrafting(false);

            const noEligible = unplaced.filter(c => eligibleDeptsFor(c).length === 0).length;
            const seatsFull = unplaced.length - noEligible;

            const parts = [`✅ Auto-Fill complete — ${added} member${added === 1 ? '' : 's'} placed by merit.`];
            if (placedBefore > 0) parts.push(`Kept your ${placedBefore} existing placement${placedBefore === 1 ? '' : 's'}.`);
            if (seatsFull > 0) parts.push(`${seatsFull} left in the reserve pool: every department they applied to or were recommended for is full.`);
            if (noEligible > 0) parts.push(`${noEligible} could not be placed at all: no valid preference and no interviewer recommendation.`);

            setSuccessMsg(parts.join(' '));
            setTimeout(() => setSuccessMsg(null), 10000);
        }, 600);
    };

    const handleClearDraft = () => {
        if (Object.keys(draftMap).length === 0) return;
        if (!confirm('Clear every placement from the current draft? Saved rosters are not affected until you press Save Roster.')) return;
        setDraftMap({});
    };

    // Applies the AI dialog's per-candidate department judgments. The AI never
    // supplies a department outside eligibleDeptsFor(c) — parseCommitteeFitJson
    // in aiService.ts already discards an invalid answer server-side — but this
    // re-checks that guarantee at the point of use rather than trusting a single
    // validation layer, since "never place someone somewhere they didn't apply
    // to" is the exact bug this whole feature exists to prevent. Seats are then
    // filled by the same merit-order allocator Auto-Fill uses; the AI only ever
    // reorders a candidate's OWN eligible list, it never adds to it.
    const handleApplyAiAllocation = (results: Map<string, CommitteeFitResult>) => {
        const priorityListFor = (c: Application): string[] => {
            const base = eligibleDeptsFor(c);
            const ai = results.get(c.id);
            if (!ai || !base.includes(ai.department)) return base;
            return [ai.department, ...base.filter(d => d !== ai.department)];
        };

        const { newDraft, placedBefore, added, unplaced } = allocateBySeatPriority(eligibleCandidates, priorityListFor, draftMap);
        setDraftMap(newDraft);
        setIsAiDialogOpen(false);

        const aiDecided = Array.from(results.values()).filter(r => r.reasoning !== 'Only eligible department').length;
        const noEligible = unplaced.filter(c => eligibleDeptsFor(c).length === 0).length;
        const seatsFull = unplaced.length - noEligible;

        const parts = [`✅ AI Allocation applied — ${added} member${added === 1 ? '' : 's'} placed${aiDecided > 0 ? `, ${aiDecided} by AI judgment on marks + feedback` : ''}.`];
        if (placedBefore > 0) parts.push(`Kept your ${placedBefore} existing placement${placedBefore === 1 ? '' : 's'}.`);
        if (seatsFull > 0) parts.push(`${seatsFull} left in the reserve pool: their eligible departments are full.`);
        if (noEligible > 0) parts.push(`${noEligible} could not be placed: no preference and no interviewer recommendation.`);

        setSuccessMsg(parts.join(' '));
        setTimeout(() => setSuccessMsg(null), 10000);
    };

    // The PDF always reads from `applications` (the saved roster), never the
    // in-memory draft — so a member moved in the draft but not yet saved would
    // silently export under their OLD department. Warn rather than let that
    // surprise whoever downloads it.
    const hasUnsavedDraftChanges = useMemo(() => {
        const draftIds = Object.keys(draftMap);
        if (draftIds.some(id => applications.find(a => a.id === id)?.assignedPosition !== draftMap[id])) return true;
        return applications.some(a => a.assignedPosition && !draftMap[a.id]);
    }, [draftMap, applications]);

    const handleExportPdf = () => {
        if (hasUnsavedDraftChanges && !confirm('You have unsaved draft changes. The PDF will reflect the last SAVED roster, not the current draft. Export anyway?')) return;
        exportCommitteeRosterPdf(applications);
    };

    // ── 4. Manual Assignment Helpers ──────────────────────────────────────────
    const seatsUsed = (dept: string, map: Record<string, string> = draftMap) =>
        Object.values(map).filter(d => d === dept).length;

    const quotaFor = (dept: string) => quotas[dept] ?? DEFAULT_QUOTAS[dept] ?? 15;

    // A department is full when its seats are all taken. Enforced on EVERY add
    // path — drag-drop, the dropdown and Save — not just on Auto-Fill.
    const isDeptFull = (dept: string) => seatsUsed(dept) >= quotaFor(dept);

    const assignCandidateToDept = (candidateId: string, dept: string) => {
        if (candidateId === 'none') return;
        // Moving someone already in this department is a no-op, not a new seat.
        if (draftMap[candidateId] === dept) return;

        if (isDeptFull(dept)) {
            setQuotaError(`${dept} is full (${seatsUsed(dept)}/${quotaFor(dept)} seats). Raise the seat count or remove a member first.`);
            setTimeout(() => setQuotaError(null), 5000);
            return;
        }

        setDraftMap(prev => ({
            ...prev,
            [candidateId]: dept
        }));
    };

    const removeCandidate = (candidateId: string) => {
        setDraftMap(prev => {
            const next = { ...prev };
            delete next[candidateId];
            return next;
        });
    };

    const getMembersForDept = (dept: string) => {
        return applications.filter(app => draftMap[app.id] === dept);
    };

    // A candidate may only go where they asked to go or were recommended to go.
    // Same rule the auto-draft uses, so every placement path agrees: previously
    // drag-drop allowed 1st/2nd preference only while auto-draft would place
    // anyone anywhere, and the two contradicted each other.
    const isDeptAllowedForCandidate = (candidateId: string | null, targetDept: string): boolean => {
        if (!candidateId) return false;
        const candidate = applications.find(a => a.id === candidateId);
        if (!candidate) return false;
        return eligibleDeptsFor(candidate).includes(targetDept);
    };

    // Why is this person in this department? Drives the badges and flags any
    // placement that has no justification at all.
    const placementBasis = (c: Application, dept: string): 'recommended' | 'first' | 'second' | 'none' => {
        if ((feedbackMap[c.id] || []).includes(dept)) return 'recommended';
        if ((c.primaryDept || c.department) === dept) return 'first';
        if (c.secondaryDept === dept) return 'second';
        return 'none';
    };

    // Anyone currently sitting in a department they never applied to and were
    // never recommended for — i.e. left over from the old allocator.
    const mismatchedMembers = useMemo(() => {
        return Object.entries(draftMap)
            .map(([id, dept]) => {
                const app = applications.find(a => a.id === id);
                return app && placementBasis(app, dept) === 'none' ? { app, dept } : null;
            })
            .filter((x): x is { app: Application; dept: string } => x !== null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftMap, applications, feedbackMap]);

    // ── 4b. Seat Quota Editing ────────────────────────────────────────────────
    // Commits whatever is in the seat box: clamped to the number of members
    // already placed (so a quota can never be set below a real roster) and to
    // 1..99, then persisted. A blank or non-numeric box reverts to the last
    // saved value rather than wiping the quota.
    const commitSeats = async (dept: string, raw: string) => {
        setSeatDrafts(prev => {
            const next = { ...prev };
            delete next[dept];
            return next;
        });

        const parsed = parseInt(raw, 10);
        if (isNaN(parsed)) return;

        const floor = Math.max(MIN_SEATS, seatsUsed(dept));
        const clamped = Math.min(MAX_SEATS, Math.max(floor, parsed));

        if (parsed < floor) {
            setQuotaError(`${dept} already has ${seatsUsed(dept)} members assigned — seats can't go below that. Remove members first.`);
            setTimeout(() => setQuotaError(null), 5000);
        }

        if (clamped === quotaFor(dept)) return;

        const previous = quotaFor(dept);
        setQuotas(prev => ({ ...prev, [dept]: clamped }));

        const { error } = await supabase
            .from('committee_quotas')
            .upsert({ department: dept, seats: clamped, updated_at: new Date().toISOString() }, { onConflict: 'department' });

        if (error) {
            // Roll the number back so the UI never shows a quota the DB rejected.
            console.error('[CommitteeDraftBoard] Could not save seat quota:', error.message);
            setQuotas(prev => ({ ...prev, [dept]: previous }));
            setQuotaError(`Could not save the seat count for ${dept}: ${error.message}`);
            setTimeout(() => setQuotaError(null), 6000);
        }
    };

    const nudgeSeats = (dept: string, delta: number) => {
        commitSeats(dept, String(quotaFor(dept) + delta));
    };

    // ── 5. Save & Apply Roster to Database ────────────────────────────────────
    // Note on error handling: Admin.updateApplication() deliberately swallows its
    // errors (it logs and refetches) because several call sites fire it without
    // awaiting. That means Promise.all below resolves even when writes failed, so
    // this reads the affected rows back and compares them against the draft before
    // claiming success — a green toast over a half-written roster is worse than
    // no toast at all.
    const handleSaveRoster = async () => {
        setIsSaving(true);
        try {
            const overfilled = DEPARTMENTS.filter(d => seatsUsed(d) > quotaFor(d));
            if (overfilled.length > 0) {
                setQuotaError(`Over seat limit: ${overfilled.map(d => `${d} (${seatsUsed(d)}/${quotaFor(d)})`).join(', ')}. Raise the seat count or remove members before saving.`);
                setTimeout(() => setQuotaError(null), 7000);
                return;
            }

            const updatePromises: Promise<any>[] = [];

            // 1. Drafted candidates -> 'selected' with their committee department.
            Object.entries(draftMap).forEach(([id, dept]) => {
                const app = applications.find(a => a.id === id);
                if (app && (app.assignedPosition !== dept || app.status !== 'selected')) {
                    updatePromises.push(onUpdate(id, { assignedPosition: dept, status: 'selected' }));
                }
            });

            // 2. Anyone dropped from the draft loses their assignment and goes back
            //    to 'interviewed'. Members already promoted to active_member are left
            //    alone: they have been told they are in, and silently demoting them
            //    here would contradict that.
            applications.forEach(app => {
                if (app.assignedPosition && !draftMap[app.id] && app.status !== 'active_member') {
                    updatePromises.push(onUpdate(app.id, { assignedPosition: null as any, status: 'interviewed' }));
                }
            });

            await Promise.all(updatePromises);

            // Read back and confirm the roster actually landed.
            const draftedIds = Object.keys(draftMap);
            if (draftedIds.length > 0) {
                const { data, error } = await supabase
                    .from('applications')
                    .select('id, assigned_position, status')
                    .in('id', draftedIds);

                if (error) {
                    setQuotaError(`Roster was submitted but could not be verified: ${error.message}. Reload before relying on it.`);
                    setTimeout(() => setQuotaError(null), 8000);
                    return;
                }

                const byId = new Map(
                    (data || []).map((r: { id: string; assigned_position: string | null }) => [r.id, r])
                );
                const mismatched = draftedIds.filter(id => {
                    const row = byId.get(id);
                    return !row || row.assigned_position !== draftMap[id];
                });

                if (mismatched.length > 0) {
                    const names = mismatched
                        .map(id => applications.find(a => a.id === id)?.fullName || id)
                        .slice(0, 5);
                    setQuotaError(`${mismatched.length} member${mismatched.length === 1 ? '' : 's'} did not save: ${names.join(', ')}${mismatched.length > 5 ? '…' : ''}. Check your admin permissions and try again.`);
                    setTimeout(() => setQuotaError(null), 10000);
                    return;
                }
            }

            setSuccessMsg(`✅ Committee Roster Saved! ${draftedIds.length} member${draftedIds.length === 1 ? '' : 's'} synced to the database.`);
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err: any) {
            console.error('Failed to save roster:', err);
            setQuotaError('Error saving roster: ' + (err?.message || 'unknown error'));
            setTimeout(() => setQuotaError(null), 8000);
        } finally {
            setIsSaving(false);
        }
    };

    const totalQuota = Object.values(quotas).reduce((a, b) => a + b, 0);
    const totalDrafted = Object.keys(draftMap).length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* ── TOP HERO BAR & COMMANDS ────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-purple-950/50 via-black/80 to-blue-950/50 p-6 md:p-8 rounded-3xl border border-purple-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(168,85,247,0.15)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold tracking-widest uppercase">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        Committee Allocation & Roster Management
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Committee Selection & Team Builder
                    </h2>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Visually organize and assign core committee members across departments. Click <strong className="text-purple-300">Auto-Fill Committees</strong> to distribute eligible candidates based on interviewer verdicts, 1st/2nd preferences, and interview scores. Review and fine-tune teams, then hit <strong className="text-green-400">Save Roster</strong>!
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
                            className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all hover:scale-[1.02]"
                        >
                            {isDrafting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            🔄 Auto-Fill Committees
                        </Button>
                        <Button
                            onClick={() => setIsAiDialogOpen(true)}
                            disabled={isLoadingFeedbacks}
                            variant="outline"
                            className="h-10 px-6 rounded-xl border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs uppercase tracking-wider"
                        >
                            <Bot className="w-3.5 h-3.5 mr-1.5" />
                            AI Allocate (marks + feedback)
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
                                onClick={handleClearDraft}
                                disabled={isSaving || totalDrafted === 0}
                                variant="outline"
                                className="h-10 px-4 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Clear Draft
                            </Button>
                        </div>
                        <Button
                            onClick={handleExportPdf}
                            variant="outline"
                            className="h-10 px-6 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider"
                        >
                            <FileDown className="w-3.5 h-3.5 mr-1.5" />
                            Export Roster PDF
                        </Button>
                    </div>
                </div>
            </div>

            <AICommitteeAllocationDialog
                open={isAiDialogOpen}
                onClose={() => setIsAiDialogOpen(false)}
                candidates={aiCandidatePool}
                onApply={handleApplyAiAllocation}
            />

            {/* Mismatched-placement audit. Every member the board shows should be in a
                department they applied to or were recommended for; anything else is
                left over from the old allocator and needs a decision. */}
            <AnimatePresence>
                {mismatchedMembers.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 space-y-3 shadow-lg"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-sm font-semibold">
                                {mismatchedMembers.length} member{mismatchedMembers.length === 1 ? ' is' : 's are'} in a department they did not apply to and were not recommended for.
                                <span className="font-normal text-amber-200/70"> Re-run Auto-Fill to reallocate them by merit, or move them by hand.</span>
                            </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 pl-8 scrollbar-thin">
                            {mismatchedMembers.map(({ app, dept }) => (
                                <div key={app.id} className="flex items-center justify-between gap-2 text-xs bg-black/30 rounded-lg px-2.5 py-1.5">
                                    <span className="text-white font-semibold truncate">{app.fullName}</span>
                                    <span className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                                        <span className="text-amber-300">{dept}</span>
                                        <span className="text-muted-foreground">
                                            (applied: {app.primaryDept || '—'}{app.secondaryDept ? ` / ${app.secondaryDept}` : ''})
                                        </span>
                                        <button
                                            onClick={() => removeCandidate(app.id)}
                                            className="ml-1 px-2 py-0.5 rounded bg-red-500/15 hover:bg-red-500/25 text-red-300 font-bold"
                                        >Remove</button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quota / save failure alert */}
            <AnimatePresence>
                {quotaError && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 flex items-start gap-3 font-medium text-sm shadow-lg"
                    >
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <span>{quotaError}</span>
                    </motion.div>
                )}
            </AnimatePresence>

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

            {/* ── DEPARTMENT COMMITTEES ROSTER ───────────────────────────────────── */}
            <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Users className="w-6 h-6 text-purple-400" />
                        <h3 className="text-xl font-heading font-black text-white tracking-widest uppercase">
                            Department Committee Teams
                        </h3>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                        Tip: Adjust committee seat quotas with [+] and [-] to fit your chapter needs.
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {DEPARTMENTS.map(dept => {
                        const members = getMembersForDept(dept);
                        const currentQuota = quotaFor(dept);
                        const fillRatio = members.length / currentQuota;
                        const deptFull = members.length >= currentQuota;
                        const progressColor = fillRatio >= 1 ? 'bg-green-500' : fillRatio >= 0.7 ? 'bg-purple-500' : 'bg-blue-500';

                        // Drag & drop state for this specific department
                        const isDraggingAny = !!draggedCandidateId;
                        // A full department is not a drop target: promising "Drop Allowed"
                        // and then refusing the drop is worse than showing it closed.
                        const draggedIsAlreadyHere = !!draggedCandidateId && draftMap[draggedCandidateId] === dept;
                        const isAllowedTarget = isDraggingAny
                            && isDeptAllowedForCandidate(draggedCandidateId, dept)
                            && (draggedIsAlreadyHere || !deptFull);
                        const isHoveredTarget = dragOverDept === dept && isAllowedTarget;

                        let cardBgStyle = "bg-gradient-to-br from-white/[0.04] via-black/60 to-black/90 border-white/10";
                        if (isDraggingAny) {
                            if (isAllowedTarget) {
                                cardBgStyle = isHoveredTarget 
                                    ? "bg-green-500/20 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.3)] ring-2 ring-green-400"
                                    : "bg-green-500/10 border-green-500/50 border-dashed shadow-[0_0_15px_rgba(34,197,94,0.15)]";
                            } else {
                                cardBgStyle = "bg-black/80 border-red-500/20 opacity-30 pointer-events-none";
                            }
                        }

                        return (
                            <Card 
                                key={dept} 
                                onDragOver={(e) => {
                                    if (isAllowedTarget) {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverDept !== dept) setDragOverDept(dept);
                                    } else {
                                        e.dataTransfer.dropEffect = 'none';
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dragOverDept === dept) setDragOverDept(null);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverDept(null);
                                    if (draggedCandidateId && isAllowedTarget) {
                                        assignCandidateToDept(draggedCandidateId, dept);
                                        setDraggedCandidateId(null);
                                    }
                                }}
                                className={`rounded-3xl overflow-hidden flex flex-col shadow-xl transition-all duration-300 ${cardBgStyle}`}
                            >
                                {/* Department Header & Quota Bar */}
                                <div className="bg-white/[0.03] p-5 border-b border-white/10 space-y-3">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h4 className="text-base font-black tracking-wider uppercase text-white">{dept}</h4>
                                            {isDraggingAny && (
                                                isAllowedTarget ? (
                                                    <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-[9px] font-extrabold uppercase animate-pulse">
                                                        Drop Allowed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[9px] font-bold">
                                                        {deptFull && isDeptAllowedForCandidate(draggedCandidateId, dept) ? 'Seats Full' : 'Not Preference'}
                                                    </Badge>
                                                )
                                            )}
                                        </div>
                                        {/* Seat quota editor. The old 16px +/- buttons were
                                            below any usable touch target, which made the seat
                                            count effectively uneditable on a phone — type the
                                            number instead. */}
                                        <div className="flex items-center gap-1.5 bg-black/50 pl-2.5 pr-1.5 py-1 rounded-xl border border-white/10 text-xs font-mono shrink-0">
                                            <span className={`font-bold ${fillRatio >= 1 ? 'text-green-400' : 'text-purple-300'}`}>
                                                {members.length}
                                            </span>
                                            <span className="text-muted-foreground">/</span>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={Math.max(MIN_SEATS, members.length)}
                                                max={MAX_SEATS}
                                                aria-label={`Seats for ${dept}`}
                                                value={seatDrafts[dept] ?? String(currentQuota)}
                                                onChange={(e) => setSeatDrafts(prev => ({ ...prev, [dept]: e.target.value }))}
                                                onFocus={(e) => e.currentTarget.select()}
                                                onBlur={(e) => commitSeats(dept, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                    if (e.key === 'Escape') {
                                                        setSeatDrafts(prev => {
                                                            const next = { ...prev };
                                                            delete next[dept];
                                                            return next;
                                                        });
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-14 h-10 bg-white/[0.06] border border-white/15 rounded-lg text-center text-white font-bold text-sm focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="text-muted-foreground">Seats</span>
                                            <div className="flex items-center gap-1 ml-0.5">
                                                <button
                                                    type="button"
                                                    aria-label={`Decrease seats for ${dept}`}
                                                    onClick={() => nudgeSeats(dept, -1)}
                                                    className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white flex items-center justify-center text-lg font-bold leading-none"
                                                >−</button>
                                                <button
                                                    type="button"
                                                    aria-label={`Increase seats for ${dept}`}
                                                    onClick={() => nudgeSeats(dept, 1)}
                                                    className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white flex items-center justify-center text-lg font-bold leading-none"
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

                                <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                                    {/* Core Members Roster Section */}
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                            <span>Selected Members ({members.length})</span>
                                        </div>

                                        {members.length === 0 ? (
                                            <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl text-xs text-muted-foreground/60 italic">
                                                No members assigned to {dept} yet. Click Auto-Fill or add manually below.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                                                {members.map(app => {
                                                    const is1st = app.primaryDept === dept || app.department === dept;
                                                    const is2nd = app.secondaryDept === dept;
                                                    const recDepts = feedbackMap[app.id] || [];
                                                    const isRec = recDepts.includes(dept);
                                                    const scoreVal = (Number(app.finalScore || app.interviewScore || app.rating * 2) || 0).toFixed(1);

                                                    return (
                                                        <div 
                                                            key={app.id} 
                                                            draggable={true}
                                                            onDragStart={(e) => {
                                                                e.dataTransfer.setData('text/plain', app.id);
                                                                setDraggedCandidateId(app.id);
                                                            }}
                                                            onDragEnd={() => {
                                                                setDraggedCandidateId(null);
                                                                setDragOverDept(null);
                                                            }}
                                                            onClick={() => {
                                                                setPreviewCandidate(app);
                                                                if (onViewCandidate) onViewCandidate(app);
                                                            }}
                                                            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 transition-all text-xs group cursor-pointer hover:bg-white/[0.07] ${draggedCandidateId === app.id ? 'opacity-40 border-purple-400 ring-2 ring-purple-400' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-purple-400 shrink-0" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                                                                        <span>{app.fullName}</span>
                                                                        <span className="text-[10px] font-mono font-normal text-purple-300 bg-purple-500/10 px-1.5 py-0.2 rounded">⭐ {scoreVal}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                                        {isRec && <Badge variant="outline" className="text-[9px] bg-purple-500/20 text-purple-300 border-purple-500/30 px-1 py-0">Interviewer Rec</Badge>}
                                                                        {is1st && <Badge variant="outline" className="text-[9px] bg-blue-500/20 text-blue-300 border-blue-500/30 px-1 py-0">1st Pref</Badge>}
                                                                        {!is1st && is2nd && <Badge variant="outline" className="text-[9px] bg-cyan-500/20 text-cyan-300 border-cyan-500/30 px-1 py-0">2nd Pref</Badge>}
                                                                        {!isRec && !is1st && !is2nd && (
                                                                            <Badge variant="outline" className="text-[9px] bg-amber-500/20 text-amber-300 border-amber-500/40 px-1 py-0 font-extrabold">
                                                                                ⚠ Not their preference
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeCandidate(app.id);
                                                                }}
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

                                    {/* Quick Add Candidate to Committee */}
                                    <div className="pt-3 border-t border-white/10">
                                        <Select
                                            value="none"
                                            onValueChange={(val) => {
                                                if (val && val !== 'none') assignCandidateToDept(val, dept);
                                            }}
                                        >
                                            <SelectTrigger
                                                disabled={deptFull}
                                                className={`w-full h-11 text-xs font-bold rounded-xl ${deptFull
                                                    ? 'bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed'
                                                    : 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-300'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>{deptFull ? `${dept} is full (${members.length}/${currentQuota})` : `Add Member to ${dept}...`}</span>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-950 border-zinc-800 max-h-60">
                                                <SelectItem value="none" className="text-muted-foreground italic text-xs">Select from Unassigned Pool ({unassignedCandidates.length})...</SelectItem>
                                                {/* Preference matches first — drag-drop only accepts
                                                    1st/2nd preference, so the dropdown flags the rest
                                                    rather than silently allowing what a drag forbids. */}
                                                {unassignedCandidates
                                                    .filter(c => isDeptAllowedForCandidate(c.id, dept))
                                                    .map(c => (
                                                        <SelectItem key={c.id} value={c.id} className="text-xs">
                                                            {c.fullName} ({c.primaryDept || 'General'}) — ⭐ {(Number(c.finalScore || c.interviewScore || c.rating * 2) || 0).toFixed(1)}
                                                        </SelectItem>
                                                    ))}
                                                {unassignedCandidates.some(c => !isDeptAllowedForCandidate(c.id, dept)) && (
                                                    <div className="px-2 py-1.5 mt-1 border-t border-white/10 text-[9px] font-bold uppercase tracking-widest text-amber-400/70">
                                                        Outside their preferences
                                                    </div>
                                                )}
                                                {unassignedCandidates
                                                    .filter(c => !isDeptAllowedForCandidate(c.id, dept))
                                                    .map(c => (
                                                        <SelectItem key={c.id} value={c.id} className="text-xs opacity-60">
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

            {/* ── CANDIDATE QUICK MARKS & DETAILS DIALOG ───────────────────────── */}
            <Dialog open={!!previewCandidate} onOpenChange={(open) => !open && setPreviewCandidate(null)}>
                <DialogContent className="bg-zinc-950 border-purple-500/30 text-white max-w-lg rounded-3xl p-6">
                    {previewCandidate && (
                        <div className="space-y-5">
                            <DialogHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold uppercase">
                                        {previewCandidate.assignedPosition || previewCandidate.primaryDept || 'Candidate'}
                                    </Badge>
                                    <span className="text-xs font-mono text-muted-foreground">{previewCandidate.rollNumber}</span>
                                </div>
                                <DialogTitle className="text-2xl font-black text-white pt-1">
                                    {previewCandidate.fullName}
                                </DialogTitle>
                                <DialogDescription className="text-zinc-400 text-xs">
                                    {previewCandidate.department} — Year {previewCandidate.year} | {previewCandidate.email}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Marks & Performance Grid */}
                            <div className="grid grid-cols-3 gap-3 bg-black/60 p-4 rounded-2xl border border-white/10 text-center">
                                <div>
                                    <div className="text-xs text-muted-foreground font-semibold">Interview Score</div>
                                    <div className="text-xl font-black text-purple-400 mt-1">
                                        ⭐ {(Number(previewCandidate.interviewScore || previewCandidate.finalScore || previewCandidate.rating * 2) || 0).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                                    </div>
                                </div>
                                <div className="border-x border-white/10">
                                    <div className="text-xs text-muted-foreground font-semibold">Task Score</div>
                                    <div className="text-xl font-black text-blue-400 mt-1">
                                        {(Number(previewCandidate.taskScore) || 0).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground font-semibold">Star Rating</div>
                                    <div className="text-xl font-black text-amber-400 mt-1">
                                        {previewCandidate.rating || 0} <span className="text-xs font-normal text-muted-foreground">/ 5</span>
                                    </div>
                                </div>
                            </div>

                            {/* Preferences & Recommendations */}
                            <div className="space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground font-semibold">1st Preference:</span>
                                    <span className="font-bold text-purple-300">{previewCandidate.primaryDept}</span>
                                </div>
                                {previewCandidate.secondaryDept && (
                                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                                        <span className="text-muted-foreground font-semibold">2nd Preference:</span>
                                        <span className="font-bold text-cyan-300">{previewCandidate.secondaryDept}</span>
                                    </div>
                                )}
                                {feedbackMap[previewCandidate.id] && feedbackMap[previewCandidate.id].length > 0 && (
                                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                                        <span className="text-muted-foreground font-semibold">Interviewer Rec:</span>
                                        <div className="flex gap-1">
                                            {feedbackMap[previewCandidate.id].map(r => (
                                                <Badge key={r} variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px] font-bold">{r}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button 
                                    onClick={() => {
                                        const app = previewCandidate;
                                        setPreviewCandidate(null);
                                        if (onViewCandidate) onViewCandidate(app);
                                    }}
                                    className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-10"
                                >
                                    Open Full Application & Interview Details ↗
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
