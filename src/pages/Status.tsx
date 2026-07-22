import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, LogIn, Clock, XOctagon, CalendarDays,
    Video, ChevronRight, Zap, CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import TechGridBackground from '@/components/ui/TechGridBackground';
import HolographicCard from '@/components/ui/HolographicCard';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Pipeline stages ──────────────────────────────────────────────────────────
const STAGES = [
    { key: 'applied',             label: 'Applied' },
    { key: 'under_review',        label: 'Under Review' },
    { key: 'shortlisted',         label: 'Shortlisted' },
    { key: 'interview_scheduled', label: 'Interview Booked' },
    { key: 'interviewed',         label: 'Interviewed' },
    { key: 'selected',            label: 'Decision Made' },
] as const;

const STATUS_ORDER = STAGES.map(s => s.key);

function getStageIndex(status: string): number {
    if (['active_member', 'selected'].includes(status)) return STATUS_ORDER.indexOf('selected');
    if (status === 'rejected')  return STATUS_ORDER.indexOf('selected');
    if (status === 'waitlisted') return STATUS_ORDER.indexOf('selected');
    if (status === 'interviewed') return STATUS_ORDER.indexOf('interviewed');
    if (status === 'interview_scheduled') return STATUS_ORDER.indexOf('interview_scheduled');
    if (status === 'shortlisted') return STATUS_ORDER.indexOf('shortlisted');
    if (status === 'under_review') return STATUS_ORDER.indexOf('under_review');
    return STATUS_ORDER.indexOf('applied');
}

// ─── Scanline animation for the selected credential card ─────────────────────
const ScanLine = () => (
    <motion.div
        className="absolute left-0 right-0 h-[2px] pointer-events-none z-20"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(220,20,60,0.6), transparent)' }}
        initial={{ top: '-2px' }}
        animate={{ top: '102%' }}
        transition={{ duration: 2.4, ease: 'linear', repeat: Infinity, repeatDelay: 1.5 }}
    />
);

// ─── Glitching number counter ─────────────────────────────────────────────────
const GlitchChar = ({ char, delay }: { char: string; delay: number }) => (
    <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3, ease: 'easeOut' }}
        className="inline-block"
    >
        {char}
    </motion.span>
);

// ─── Selected: full-bleed credential card ─────────────────────────────────────
const SelectedCard = ({ app }: { app: any }) => {
    const position: string = app.assigned_position || '';
    const name: string = app.full_name || '';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-2xl"
        >
            {/* ── Main credential card ── */}
            <div className="relative rounded-[2rem] overflow-hidden border border-primary/40 bg-[#0a0202]"
                 style={{ boxShadow: '0 0 60px rgba(220,20,60,0.18), inset 0 0 80px rgba(220,20,60,0.04)' }}>

                <ScanLine />

                {/* Top accent bar */}
                <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

                {/* Circuit corner ornaments */}
                <svg className="absolute top-4 left-4 text-primary/20" width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M2 38 L2 2 L38 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="2" cy="2" r="2" fill="currentColor"/>
                </svg>
                <svg className="absolute top-4 right-4 text-primary/20 rotate-90" width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M2 38 L2 2 L38 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="2" cy="2" r="2" fill="currentColor"/>
                </svg>
                <svg className="absolute bottom-4 left-4 text-primary/20 -rotate-90" width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M2 38 L2 2 L38 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="2" cy="2" r="2" fill="currentColor"/>
                </svg>
                <svg className="absolute bottom-4 right-4 text-primary/20 rotate-180" width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M2 38 L2 2 L38 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="2" cy="2" r="2" fill="currentColor"/>
                </svg>

                <div className="px-5 sm:px-8 pt-8 sm:pt-10 pb-8 sm:pb-10 text-center relative z-10">
                    {/* Org badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 mb-8">
                        <img src="/logo.png" alt="IEEE SSCS" className="w-4 h-4 object-contain opacity-80" />
                        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80">
                            IEEE SSCS — {new Date().getFullYear()} Tenure
                        </span>
                    </div>

                    {/* Congratulations line */}
                    <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="text-sm text-muted-foreground uppercase tracking-[0.25em] mb-2 font-medium"
                    >
                        This is to certify that
                    </motion.p>

                    {/* Name */}
                    <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.4 }}
                        className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-white tracking-tight mb-1"
                    >
                        {name}
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-xs text-muted-foreground mb-8 tracking-widest uppercase"
                    >
                        {app.roll_number}
                    </motion.p>

                    {/* "has been selected as" */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 }}
                        className="text-sm text-muted-foreground mb-4 tracking-wider"
                    >
                        has been selected as
                    </motion.p>

                    {/* ── Position — the hero element ── */}
                    {position ? (
                        <motion.div
                            initial={{ opacity: 0, y: 16, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.7, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="relative inline-block mb-8"
                        >
                            <div className="relative px-5 sm:px-8 py-3 sm:py-4 rounded-xl"
                                 style={{
                                     background: 'linear-gradient(135deg, rgba(220,20,60,0.15) 0%, rgba(220,20,60,0.05) 100%)',
                                     border: '1px solid rgba(220,20,60,0.4)',
                                     boxShadow: '0 0 30px rgba(220,20,60,0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
                                 }}>
                                <div className="text-[10px] text-primary/60 uppercase tracking-[0.3em] mb-1 font-bold">Position</div>
                                <div className="text-xl sm:text-2xl font-heading font-bold text-white leading-tight">
                                    {position.split('').map((c, i) => (
                                        <GlitchChar key={i} char={c} delay={0.75 + i * 0.03} />
                                    ))}
                                </div>
                            </div>
                            {/* Glow behind position box */}
                            <div className="absolute inset-0 rounded-xl blur-xl -z-10 opacity-40"
                                 style={{ background: 'radial-gradient(ellipse, rgba(220,20,60,0.4), transparent 70%)' }} />
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="mb-8 text-base text-white/70"
                        >
                            a position in IEEE SSCS Student Branch Chapter.
                            <br />
                            <span className="text-sm text-muted-foreground">Your role details will follow shortly.</span>
                        </motion.div>
                    )}

                    {/* Divider */}
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 1.1, duration: 0.5 }}
                        className="h-px w-3/4 mx-auto mb-6"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(220,20,60,0.3), transparent)' }}
                    />

                    {/* Footer info */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                        className="flex items-center justify-center gap-6 flex-wrap text-[11px] text-muted-foreground"
                    >
                        <span className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-primary/60" />
                            IEEE SSCS Student Branch Chapter
                        </span>
                        <span className="text-white/10">·</span>
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500/60" />
                            Verified Selection
                        </span>
                    </motion.div>
                </div>

                {/* Bottom accent bar */}
                <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            </div>

            {/* ── Status link ── */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="text-center text-xs text-muted-foreground mt-5"
            >
                This result is live at{' '}
                <span className="text-primary font-mono">{window.location.origin}/status</span>
            </motion.p>
        </motion.div>
    );
};

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
                <div className="font-medium text-white text-sm">{format(parseISO(slot.start_time), 'EEEE, MMMM d, yyyy')}</div>
            </div>
            <div className="h-px bg-white/5" />
            <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Time</div>
                <div className="font-bold text-purple-300 font-mono">{format(parseISO(slot.start_time), 'h:mm a')}</div>
            </div>
            {meetingLink ? (
                <>
                    <div className="h-px bg-white/5" />
                    <a href={meetingLink} target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors w-full">
                        <Video className="w-4 h-4" />
                        Join Interview
                    </a>
                </>
            ) : (
                <p className="text-xs text-muted-foreground">Meeting link will appear here once assigned.</p>
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

    const status: string = app?.status ?? '';
    const isSelected  = ['selected', 'active_member'].includes(status);
    const isRejected  = status === 'rejected';
    const isWaitlist  = status === 'waitlisted';
    const currentStageIdx = getStageIndex(status);

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

            <div className="absolute top-6 left-6 z-20">
                <Link to="/"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-sm group">
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Home
                </Link>
            </div>

            <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 relative z-10 flex flex-col items-center min-h-screen">

                {/* Header — hide when selected (credential card is the hero) */}
                {!isSelected && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-10"
                    >
                        <span className="text-[11px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                            IEEE SSCS Recruitment
                        </span>
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mt-4 text-white">
                            Application Status
                        </h1>
                    </motion.div>
                )}

                {isSelected && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-8"
                    >
                        <span className="text-[11px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                            IEEE SSCS — Results
                        </span>
                    </motion.div>
                )}

                <AnimatePresence mode="wait">
                    {/* ── Not signed in ── */}
                    {!user ? (
                        <motion.div key="sign-in" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-md">
                            <HolographicCard className="p-10 text-center">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
                                    <LogIn className="w-9 h-9 text-primary" />
                                </div>
                                <h2 className="text-2xl font-heading font-bold text-white mb-2">Sign In Required</h2>
                                <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                                    Use your VIT Student Google account (@vitstudent.ac.in) to check your recruitment status.
                                </p>
                                <Button onClick={() => signInWithGoogle()} className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-white">
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign In with Google
                                </Button>
                            </HolographicCard>
                        </motion.div>

                    ) : !app ? (
                        /* ── No application ── */
                        <motion.div key="no-app" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-md">
                            <HolographicCard className="p-10 text-center">
                                <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
                                    <Clock className="w-9 h-9 text-yellow-500/70" />
                                </div>
                                <h2 className="text-2xl font-heading font-bold text-white mb-2">No Application Found</h2>
                                <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                                    No application linked to <span className="text-white font-medium">{user.email}</span>.
                                    Make sure you're signed in with the same account you applied with.
                                </p>
                                <Button asChild className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-white">
                                    <Link to="/apply">Apply Now</Link>
                                </Button>
                            </HolographicCard>
                        </motion.div>

                    ) : isSelected ? (
                        /* ── Selected: credential card ── */
                        <motion.div key="selected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl space-y-5">
                            <SelectedCard app={app} />
                            <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 text-muted-foreground">
                                <Link to="/">Return to Home</Link>
                            </Button>
                        </motion.div>

                    ) : (
                        /* ── All other states ── */
                        <motion.div key="status-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-lg space-y-6">

                            {/* Main result card */}
                            <HolographicCard className="p-6 sm:p-8 text-center relative overflow-hidden">
                                <div className="relative z-10">
                                    {/* Icon */}
                                    {isRejected || isWaitlist ? (
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

                                    <h2 className="text-3xl font-heading font-bold text-white mb-2">
                                        {isRejected || isWaitlist ? 'Thank You for Applying'
                                            : status === 'interview_scheduled' ? 'Interview Confirmed'
                                            : status === 'shortlisted' ? "You're Shortlisted!"
                                            : status === 'interviewed' ? 'Interview Complete'
                                            : 'Application Under Review'}
                                    </h2>

                                    <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5 ${
                                        isRejected || isWaitlist
                                            ? 'bg-zinc-800 text-zinc-400 border border-white/10'
                                            : status === 'interview_scheduled' || status === 'shortlisted'
                                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                            : status === 'interviewed'
                                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                    }`}>
                                        {isRejected ? 'Not Selected'
                                            : isWaitlist ? 'Waitlisted'
                                            : status === 'interview_scheduled' ? 'Booked'
                                            : status === 'shortlisted' ? 'Shortlisted'
                                            : status === 'interviewed' ? 'Result Pending'
                                            : 'Pending Review'}
                                    </div>

                                    {/* State-specific body */}
                                    {(isRejected || isWaitlist) && (
                                        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                                            Thank you for your time and effort. Due to the highly competitive applicant pool,
                                            we're unable to offer you a position this time. We encourage you to apply again in our next cycle.
                                        </p>
                                    )}
                                    {status === 'shortlisted' && (
                                        <>
                                            <p className="text-sm text-gray-300 mb-4">
                                                You've made it to the interview round. Book your slot now — slots are first come, first served.
                                            </p>
                                            <Button asChild className="w-full h-11 bg-purple-600 hover:bg-purple-700 font-bold text-white animate-bounce">
                                                <Link to="/schedule">
                                                    Book Interview Slot
                                                    <ChevronRight className="w-4 h-4 ml-1" />
                                                </Link>
                                            </Button>
                                        </>
                                    )}
                                    {status === 'interview_scheduled' && (
                                        <SlotDetails appId={app.id} />
                                    )}
                                    {['applied', 'under_review', 'pending', 'neutral', 'interviewed'].includes(status) && (
                                        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                                            Your application is being evaluated. We'll notify you by email once a decision is made.
                                        </p>
                                    )}
                                </div>
                            </HolographicCard>

                            {/* Details strip */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Name',        value: app.full_name },
                                    { label: 'Roll Number', value: app.roll_number },
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
