import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, LogIn, Trophy, Clock, XOctagon, CalendarDays,
    Video, Star, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import TechGridBackground from '@/components/ui/TechGridBackground';
import HolographicCard from '@/components/ui/HolographicCard';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Pipeline stages shown in the tracker ────────────────────────────────────
const STAGES = [
    { key: 'applied',              label: 'Applied' },
    { key: 'under_review',         label: 'Under Review' },
    { key: 'shortlisted',          label: 'Shortlisted' },
    { key: 'interview_scheduled',  label: 'Interview Booked' },
    { key: 'interviewed',          label: 'Interviewed' },
    { key: 'selected',             label: 'Decision Made' },
] as const;

const STATUS_ORDER = STAGES.map(s => s.key);

function getStageIndex(status: string): number {
    // Map terminal states to visible pipeline position
    if (['active_member', 'selected'].includes(status)) return STATUS_ORDER.indexOf('selected');
    if (status === 'rejected') return STATUS_ORDER.indexOf('selected');
    if (status === 'waitlisted') return STATUS_ORDER.indexOf('selected');
    if (status === 'interviewed') return STATUS_ORDER.indexOf('interviewed');
    if (status === 'interview_scheduled') return STATUS_ORDER.indexOf('interview_scheduled');
    if (status === 'shortlisted') return STATUS_ORDER.indexOf('shortlisted');
    if (status === 'under_review') return STATUS_ORDER.indexOf('under_review');
    return STATUS_ORDER.indexOf('applied'); // 'applied', 'pending', 'neutral' etc.
}

// ─── Interview slot sub-component ─────────────────────────────────────────────
const SlotDetails = ({ appId }: { appId: string }) => {
    const [slot, setSlot] = useState<{ start_time: string; panel_id: number } | null>(null);
    const [meetingLink, setMeetingLink] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data: slotData } = await supabase
                .from('interview_slots')
                .select('start_time, panel_id')
                .eq('booked_by', appId)
                .single();
            if (!slotData) return;
            setSlot(slotData);

            const dateStr = format(parseISO(slotData.start_time), 'yyyy-MM-dd');
            const { data: assign } = await supabase
                .from('panel_assignments')
                .select('meeting_link')
                .eq('panel_id', slotData.panel_id)
                .eq('date', dateStr)
                .not('meeting_link', 'is', null)
                .limit(1)
                .single();
            if (assign?.meeting_link?.trim()) setMeetingLink(assign.meeting_link.trim());
        })();
    }, [appId]);

    if (!slot) return null;

    return (
        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 text-left">
            <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Date</div>
                <div className="font-medium text-white text-sm">
                    {format(parseISO(slot.start_time), 'EEEE, MMMM d, yyyy')}
                </div>
            </div>
            <div className="h-px bg-white/5" />
            <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Time</div>
                <div className="font-bold text-purple-300 font-mono">
                    {format(parseISO(slot.start_time), 'h:mm a')}
                </div>
            </div>
            {meetingLink && (
                <>
                    <div className="h-px bg-white/5" />
                    <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors w-full"
                    >
                        <Video className="w-4 h-4" />
                        Join Interview
                    </a>
                </>
            )}
            {!meetingLink && (
                <p className="text-xs text-muted-foreground">
                    Meeting link will appear here once assigned.
                </p>
            )}
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const StatusPage = () => {
    const { user, signInWithGoogle, loading: authLoading } = useAuth();
    const [app, setApp] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        (async () => {
            setLoading(true);
            const { data } = await supabase
                .from('applications')
                .select('*')
                .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
                .order('created_at', { ascending: false })
                .limit(1);
            setApp(data?.[0] ?? null);
            setLoading(false);
        })();
    }, [user]);

    // ── Derived display state ─────────────────────────────────────────────────
    const status: string = app?.status ?? '';
    const isSelected  = ['selected', 'active_member'].includes(status);
    const isRejected  = status === 'rejected';
    const isWaitlist  = status === 'waitlisted';
    const hasPosition = !!app?.assigned_position;
    const currentStageIdx = getStageIndex(status);

    // ── Loading shell ─────────────────────────────────────────────────────────
    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center">
                <LogoSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
            <TechGridBackground />

            {/* Top-left back link */}
            <div className="absolute top-6 left-6 z-20">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-sm group"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Home
                </Link>
            </div>

            <div className="container mx-auto px-4 pt-24 pb-16 relative z-10 flex flex-col items-center min-h-screen">
                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-10"
                >
                    <span className="text-[11px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                        IEEE SSCS Recruitment
                    </span>
                    <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mt-4 text-white">
                        Application Status
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Sign in with your VIT Google account to view your result.
                    </p>
                </motion.div>

                {/* ── Not signed in ── */}
                <AnimatePresence mode="wait">
                    {!user ? (
                        <motion.div
                            key="sign-in"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-md"
                        >
                            <HolographicCard className="p-10 text-center">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
                                    <LogIn className="w-9 h-9 text-primary" />
                                </div>
                                <h2 className="text-2xl font-heading font-bold text-white mb-2">Sign In Required</h2>
                                <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                                    Use your VIT Student Google account (@vitstudent.ac.in) to check your recruitment status.
                                </p>
                                <Button
                                    onClick={() => signInWithGoogle()}
                                    className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-white"
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign In with Google
                                </Button>
                            </HolographicCard>
                        </motion.div>
                    ) : !app ? (
                        /* ── No application found ── */
                        <motion.div
                            key="no-app"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-md"
                        >
                            <HolographicCard className="p-10 text-center">
                                <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
                                    <Clock className="w-9 h-9 text-yellow-500/70" />
                                </div>
                                <h2 className="text-2xl font-heading font-bold text-white mb-2">No Application Found</h2>
                                <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                                    We couldn't find an application linked to <span className="text-white font-medium">{user.email}</span>.
                                    If you've applied, make sure you're signed in with the same account.
                                </p>
                                <Button asChild className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-white">
                                    <Link to="/apply">Apply Now</Link>
                                </Button>
                            </HolographicCard>
                        </motion.div>
                    ) : (
                        /* ── Application exists ── */
                        <motion.div
                            key="status-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-2xl space-y-6"
                        >
                            {/* ── Result card ── */}
                            <HolographicCard className={`p-8 text-center relative overflow-hidden ${
                                isSelected ? 'border-green-500/30' :
                                isRejected || isWaitlist ? 'border-white/10' : ''
                            }`}>
                                {/* Subtle radial glow for selected */}
                                {isSelected && (
                                    <div className="absolute inset-0 pointer-events-none"
                                         style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.1) 0%, transparent 70%)' }} />
                                )}

                                {/* Icon */}
                                <div className="relative z-10">
                                    {isSelected ? (
                                        <div className="w-24 h-24 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-green-500/40 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                                            <Trophy className="w-11 h-11 text-green-400" />
                                        </div>
                                    ) : isRejected || isWaitlist ? (
                                        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-5 border border-white/10">
                                            <XOctagon className="w-9 h-9 text-zinc-500" />
                                        </div>
                                    ) : status === 'interview_scheduled' ? (
                                        <div className="w-20 h-20 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-purple-500/30">
                                            <Video className="w-9 h-9 text-purple-400" />
                                        </div>
                                    ) : status === 'shortlisted' ? (
                                        <div className="w-20 h-20 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-purple-500/30 animate-pulse">
                                            <CalendarDays className="w-9 h-9 text-purple-400" />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-primary/20 animate-pulse">
                                            <Clock className="w-9 h-9 text-primary" />
                                        </div>
                                    )}

                                    {/* Headline */}
                                    <h2 className="text-3xl font-heading font-bold text-white mb-2">
                                        {isSelected
                                            ? 'Congratulations!'
                                            : isRejected || isWaitlist
                                            ? 'Thank You for Applying'
                                            : status === 'interview_scheduled'
                                            ? 'Interview Confirmed'
                                            : status === 'shortlisted'
                                            ? "You're Shortlisted!"
                                            : status === 'interviewed'
                                            ? 'Interview Complete'
                                            : 'Application Under Review'}
                                    </h2>

                                    {/* Status badge */}
                                    <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5 ${
                                        isSelected
                                            ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                            : isRejected || isWaitlist
                                            ? 'bg-zinc-800 text-zinc-400 border border-white/10'
                                            : status === 'interview_scheduled'
                                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                            : status === 'shortlisted'
                                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                            : status === 'interviewed'
                                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                    }`}>
                                        {isSelected ? (hasPosition ? 'Selected' : 'Offer Extended')
                                            : isRejected ? 'Not Selected'
                                            : isWaitlist ? 'Waitlisted'
                                            : status === 'interview_scheduled' ? 'Booked'
                                            : status === 'shortlisted' ? 'Shortlisted'
                                            : status === 'interviewed' ? 'Result Pending'
                                            : 'Pending Review'}
                                    </div>

                                    {/* ── Selected: show position ── */}
                                    {isSelected && hasPosition && (
                                        <div className="mb-5">
                                            <p className="text-sm text-muted-foreground mb-3">You have been selected for</p>
                                            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-green-500/10 border border-green-500/25 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                                                <Star className="w-5 h-5 text-green-400 flex-shrink-0" />
                                                <span className="text-xl font-heading font-bold text-white">
                                                    {app.assigned_position}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-3">
                                                IEEE SSCS Student Branch Chapter
                                            </p>
                                        </div>
                                    )}

                                    {/* ── Selected without explicit position yet ── */}
                                    {isSelected && !hasPosition && (
                                        <p className="text-sm text-gray-300 mb-5 leading-relaxed max-w-sm mx-auto">
                                            You've been selected to join IEEE SSCS! Our team will reach out
                                            shortly with your role and onboarding details.
                                        </p>
                                    )}

                                    {/* ── Rejected / Waitlist ── */}
                                    {(isRejected || isWaitlist) && (
                                        <p className="text-sm text-muted-foreground mb-5 leading-relaxed max-w-sm mx-auto">
                                            Thank you for your time and effort. Due to the highly competitive
                                            applicant pool this year, we're unable to offer you a position.
                                            We encourage you to apply again in our next cycle.
                                        </p>
                                    )}

                                    {/* ── Shortlisted: CTA ── */}
                                    {status === 'shortlisted' && (
                                        <>
                                            <p className="text-sm text-gray-300 mb-4">
                                                You've moved to the interview round. Book your slot now — they're first come, first served.
                                            </p>
                                            <Button asChild className="w-full max-w-xs mx-auto h-11 bg-purple-600 hover:bg-purple-700 font-bold text-white animate-bounce">
                                                <Link to="/schedule">
                                                    Book Interview Slot
                                                    <ChevronRight className="w-4 h-4 ml-1" />
                                                </Link>
                                            </Button>
                                        </>
                                    )}

                                    {/* ── Interview scheduled: show slot info ── */}
                                    {status === 'interview_scheduled' && (
                                        <div className="max-w-xs mx-auto">
                                            <SlotDetails appId={app.id} />
                                        </div>
                                    )}

                                    {/* ── Under review / interviewed ── */}
                                    {['applied', 'under_review', 'pending', 'neutral', 'interviewed'].includes(status) && (
                                        <p className="text-sm text-muted-foreground mb-5 leading-relaxed max-w-sm mx-auto">
                                            Your application is being evaluated. We'll notify you by email once a decision is made.
                                        </p>
                                    )}
                                </div>
                            </HolographicCard>

                            {/* ── Progress tracker ── */}
                            <div className="bg-white/[0.03] rounded-2xl border border-white/10 p-6">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-5 font-bold">
                                    Your Progress
                                </div>
                                <div className="flex items-start gap-0">
                                    {STAGES.map((stage, idx) => {
                                        const isCompleted = idx < currentStageIdx;
                                        const isCurrent   = idx === currentStageIdx;
                                        const isFuture    = idx > currentStageIdx;
                                        // For terminal rejection, don't mark last stage green
                                        const isTerminalBad = (isRejected || isWaitlist) && isCurrent;
                                        return (
                                            <div key={stage.key} className="flex-1 flex flex-col items-center relative">
                                                {/* Connector line */}
                                                {idx < STAGES.length - 1 && (
                                                    <div className={`absolute top-[14px] left-1/2 w-full h-[2px] ${
                                                        isCompleted ? 'bg-green-500/60' : 'bg-white/10'
                                                    }`} />
                                                )}
                                                {/* Circle */}
                                                <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                                                    isTerminalBad
                                                        ? 'bg-zinc-800 border-zinc-600'
                                                        : isCompleted
                                                        ? 'bg-green-500/20 border-green-500/60'
                                                        : isCurrent
                                                        ? 'bg-primary/20 border-primary shadow-[0_0_12px_rgba(220,20,60,0.4)]'
                                                        : 'bg-white/5 border-white/10'
                                                }`}>
                                                    {isCompleted && !isTerminalBad ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                                    ) : isCurrent && !isTerminalBad ? (
                                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                    ) : (
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isFuture ? 'bg-white/10' : 'bg-zinc-600'}`} />
                                                    )}
                                                </div>
                                                {/* Label */}
                                                <div className={`mt-2 text-center text-[9px] font-bold uppercase tracking-wide leading-tight ${
                                                    isTerminalBad
                                                        ? 'text-zinc-600'
                                                        : isCompleted
                                                        ? 'text-green-400/80'
                                                        : isCurrent
                                                        ? 'text-primary'
                                                        : 'text-muted-foreground/40'
                                                }`}>
                                                    {stage.label}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Applicant details strip ── */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { label: 'Name',        value: app.full_name },
                                    { label: 'Roll Number', value: app.roll_number },
                                    { label: 'Department',  value: app.primary_dept },
                                ].map(({ label, value }) => (
                                    <div key={label} className="bg-white/[0.03] rounded-xl border border-white/10 p-4">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
                                        <div className="text-sm font-semibold text-white truncate">{value || '—'}</div>
                                    </div>
                                ))}
                            </div>

                            <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 text-muted-foreground">
                                <Link to="/">Return to Home</Link>
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StatusPage;
