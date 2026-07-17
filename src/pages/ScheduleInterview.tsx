import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Video, Calendar, Clock, Users, ShieldAlert, Zap, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import HolographicCard from '@/components/ui/HolographicCard';
import TechGridBackground from '@/components/ui/TechGridBackground';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SlotCalendar from '@/components/ui/SlotCalendar';
import LogoSpinner from '@/components/ui/LogoSpinner';

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
const PORTAL_URL = window.location.origin;
const ADMIN_EMAILS = [
    'sibhi.s2024@vitstudent.ac.in',
    'sibhis5223@gmail.com',
    'santhosh.v2024d@vitstudent.ac.in',
    'tspradeepkumar@vit.ac.in'
];

interface PendingSlot {
    id: string;
    start_time: string;
    panel_id: number;
}

const ScheduleInterview = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [existingApp, setExistingApp] = useState<any>(null);
    const [loadingApp, setLoadingApp] = useState(true);
    const [slots, setSlots] = useState<any[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    // Confirmation modal
    const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/apply');
        } else if (user) {
            fetchApplication();
        }
    }, [user, authLoading, navigate]);

    const fetchSlots = useCallback(async () => {
        setSlotsLoading(true);
        const { data } = await supabase
            .from('interview_slots')
            .select('*')
            .eq('is_booked', false)
            .order('start_time', { ascending: true });
        if (data) setSlots(data);
        setSlotsLoading(false);
    }, []);

    const fetchApplication = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('applications')
                .select('*')
                .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const app = data[0];
                setExistingApp(app);
                if (app.status === 'shortlisted') {
                    fetchSlots();
                }
            }
        } catch (err) {
            console.error('Fetch application error:', err);
        } finally {
            setLoadingApp(false);
        }
    }, [user, fetchSlots]);

    // Real-time slot refresh every 30s
    useEffect(() => {
        if (!existingApp || existingApp.status !== 'shortlisted') return;
        const interval = setInterval(fetchSlots, 30000);
        const handleFocus = () => fetchSlots();
        window.addEventListener('focus', handleFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [existingApp, fetchSlots]);

    // Called when user picks a slot in the calendar — opens confirmation modal
    const handlePreviewSlot = (slotId: string, slotTime: string, panelId: number) => {
        setBookingError(null);
        setPendingSlot({ id: slotId, start_time: slotTime, panel_id: panelId });
    };

    // Called when user confirms in the modal
    const handleConfirmBooking = async () => {
        if (!pendingSlot || !existingApp || !user) return;
        setIsBooking(true);
        setBookingError(null);

        try {
            // Check if candidate already has a slot booked
            const { data: existingBooking } = await supabase
                .from('interview_slots')
                .select('id')
                .eq('booked_by', existingApp.id)
                .limit(1);

            if (existingBooking && existingBooking.length > 0) {
                setBookingError("You have already booked an interview slot.");
                setIsBooking(false);
                setPendingSlot(null);
                await checkApplicationStatus();
                return;
            }

            const { data: bookingResult } = await supabase
                .from('interview_slots')
                .update({ is_booked: true, booked_by: existingApp.id })
                .eq('id', pendingSlot.id)
                .eq('is_booked', false)
                .select();

            if (bookingResult && bookingResult.length > 0) {
                await supabase
                    .from('applications')
                    .update({ status: 'interview_scheduled', shortlisted_at: new Date().toISOString() })
                    .eq('id', existingApp.id);

                // Send confirmation email to candidate
                if (GOOGLE_SCRIPT_URL) {
                    const startTime = parseISO(pendingSlot.start_time);
                    const dateStr = format(startTime, 'EEEE, MMMM d, yyyy');
                    const timeStr = format(startTime, 'h:mm a');
                    try {
                        await fetch(GOOGLE_SCRIPT_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: existingApp.email,
                                subject: 'Interview Slot Confirmed - IEEE SSCS',
                                message: `<div style="font-family:'Inter',sans-serif;background:#050505;color:#e5e5e5;max-width:600px;margin:0 auto;border:1px solid #1a1a1a;border-radius:12px;overflow:hidden;">
                                    <div style="background:#000;padding:40px 20px;text-align:center;border-bottom:1px solid #1a1a1a;">
                                        <h1 style="color:#fff;margin:0;text-transform:uppercase;letter-spacing:2px;font-size:16px;font-weight:600;">IEEE Solid-State Circuits Society</h1>
                                    </div>
                                    <div style="padding:45px 40px;">
                                        <h2 style="color:#a855f7;margin-top:0;font-size:24px;font-weight:700;">Interview Confirmed ✓</h2>
                                        <p style="font-size:15px;line-height:1.6;color:#d1d5db;">Dear <strong>${existingApp.full_name}</strong>,</p>
                                        <p style="font-size:15px;line-height:1.6;color:#d1d5db;">Your interview slot has been successfully booked. Here are your details:</p>
                                        <div style="background:#0a0a0a;border:1px solid #1f2937;padding:25px;border-radius:8px;margin:30px 0;">
                                            <table style="width:100%;border-collapse:collapse;">
                                                <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Date</td><td style="padding:8px 0;color:#fff;font-weight:600;font-size:13px;">${dateStr}</td></tr>
                                                <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Time</td><td style="padding:8px 0;color:#a855f7;font-weight:700;font-size:16px;">${timeStr}</td></tr>
                                                <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Department</td><td style="padding:8px 0;color:#fff;font-weight:600;font-size:13px;">${existingApp.primary_dept}</td></tr>
                                            </table>
                                        </div>
                                        <p style="font-size:14px;color:#9ca3af;">Your meeting link will be sent to you before the interview. You can also check it on our portal.</p>
                                        <div style="text-align:center;margin:30px 0;">
                                            <a href="${PORTAL_URL}/apply" style="display:inline-block;background:#7c3aed;color:#fff;padding:14px 28px;text-decoration:none;border-radius:4px;font-weight:600;font-size:14px;">View My Status</a>
                                        </div>
                                        <p style="font-size:13px;color:#6b7280;border-top:1px solid #1a1a1a;padding-top:20px;margin-top:20px;">Please be ready 5 minutes before your scheduled time.<br><strong style="color:#fff;">IEEE SSCS Recruitment Team</strong></p>
                                    </div>
                                </div>`
                            })
                        });
                    } catch (e) {
                        console.warn('Confirmation email failed:', e);
                    }
                }

                // Last-minute check for urgent alerts
                const startTime = parseISO(pendingSlot.start_time);
                const diffMins = (startTime.getTime() - Date.now()) / 60000;
                if (diffMins < 60 && diffMins > -10) {
                    const dateStr = format(startTime, 'yyyy-MM-dd');
                    const { data: assignments } = await supabase
                        .from('panel_assignments')
                        .select('interviewer_email, meeting_link')
                        .eq('panel_id', pendingSlot.panel_id)
                        .eq('date', dateStr);

                    const hasLink = assignments?.some(a => a.meeting_link?.trim());
                    if (!hasLink && GOOGLE_SCRIPT_URL) {
                        const interviewerEmails = assignments?.map(a => a.interviewer_email) || [];
                        const recipients = [...new Set([...interviewerEmails, ...ADMIN_EMAILS])];
                        for (const email of recipients) {
                            await fetch(GOOGLE_SCRIPT_URL, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email,
                                    subject: 'URGENT: Last Minute Interview Booking - IEEE SSCS',
                                    message: `Candidate ${existingApp.full_name} booked Panel ${pendingSlot.panel_id} at ${format(startTime, 'h:mm a')} (${Math.round(diffMins)} min away). No meet link found.`
                                })
                            });
                        }
                    }
                }

                setPendingSlot(null);
                setBookingSuccess(true);
                // Refresh app data after 2s then redirect
                setTimeout(() => {
                    setExistingApp((prev: any) => ({ ...prev, status: 'interview_scheduled' }));
                }, 1800);
            } else {
                setPendingSlot(null);
                setBookingError('This slot was just taken! Please pick another one.');
                fetchSlots();
            }
        } catch {
            setPendingSlot(null);
            setBookingError('Booking failed. Please try again.');
        } finally {
            setIsBooking(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loadingApp || authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    // ── No application found ──────────────────────────────────────────────────
    if (!existingApp) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
                <TechGridBackground />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 max-w-md w-full"
                >
                    <HolographicCard className="p-10 text-center border-red-500/30">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-heading font-bold text-white mb-3">No Application Found</h1>
                        <p className="text-muted-foreground mb-8 leading-relaxed">You need to apply first before scheduling an interview.</p>
                        <Button onClick={() => navigate('/apply')} className="w-full h-12 bg-primary text-white font-bold">
                            Go to Application
                        </Button>
                    </HolographicCard>
                </motion.div>
            </div>
        );
    }

    // ── Already scheduled ─────────────────────────────────────────────────────
    if (existingApp.status === 'interview_scheduled') {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <TechGridBackground />
                <div className="absolute inset-0 bg-purple-950/5 pointer-events-none -z-[5]" />

                <div className="container mx-auto px-4 py-8 relative z-10">
                    <Link to="/apply" className="inline-flex items-center text-muted-foreground hover:text-purple-400 transition-all mb-8 absolute top-8 left-8 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" /> Back
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-lg mx-auto mt-20"
                    >
                        <HolographicCard className="p-12 text-center border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.15)]">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                                className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                            >
                                <Video className="w-12 h-12 text-purple-400" />
                            </motion.div>
                            <h2 className="text-3xl font-heading font-bold mb-3 text-white">Interview Confirmed!</h2>
                            <div className="inline-block px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-6 text-sm font-medium">
                                Slot Booked ✓
                            </div>
                            <p className="text-gray-300 mb-8 leading-relaxed">
                                Your interview slot has been successfully reserved.<br />
                                Meeting details will be sent to your email before the interview.
                            </p>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-8 text-left space-y-2">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Applicant</p>
                                <p className="text-white font-medium">{existingApp.full_name}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-3 mb-1">Primary Choice</p>
                                <p className="text-purple-400 font-medium">{existingApp.primary_dept}</p>
                            </div>
                            <Button onClick={() => navigate('/apply')} className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all">
                                View Application Status
                            </Button>
                        </HolographicCard>
                    </motion.div>
                </div>
            </div>
        );
    }

    // ── Not eligible yet ──────────────────────────────────────────────────────
    if (existingApp.status !== 'shortlisted') {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
                <TechGridBackground />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 max-w-md w-full"
                >
                    <HolographicCard className="p-10 text-center border-yellow-500/20">
                        <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
                            <ShieldAlert className="w-10 h-10 text-yellow-500/70" />
                        </div>
                        <h1 className="text-2xl font-heading font-bold text-white mb-3">Not Yet Eligible</h1>
                        <p className="text-muted-foreground mb-8 leading-relaxed">
                            You can only book an interview slot once your application is shortlisted by our team.
                        </p>
                        <Button onClick={() => navigate('/apply')} variant="outline" className="w-full h-12 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                            Check My Status
                        </Button>
                    </HolographicCard>
                </motion.div>
            </div>
        );
    }

    // ── Success overlay (after booking) ───────────────────────────────────────
    if (bookingSuccess) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
                <TechGridBackground />
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 180 }}
                    className="relative z-10 text-center"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-green-500/50 shadow-[0_0_60px_rgba(34,197,94,0.3)]"
                    >
                        <CheckCircle className="w-16 h-16 text-green-400" />
                    </motion.div>
                    <h2 className="text-4xl font-heading font-bold text-white mb-3">You're In!</h2>
                    <p className="text-green-400 text-lg">Interview slot confirmed.</p>
                    <p className="text-muted-foreground mt-2 text-sm">Redirecting you back…</p>
                </motion.div>
            </div>
        );
    }

    // ── Main Booking UI ───────────────────────────────────────────────────────
    return (
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
            <TechGridBackground />

            {/* Purple accent overlay for shortlisted theme */}
            <div className="fixed inset-0 pointer-events-none -z-[5]">
                <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-600/5 rounded-full blur-[160px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/8 rounded-full blur-[140px]" />
            </div>

            <div className="container mx-auto px-4 py-12 relative z-10 max-w-5xl">
                {/* Back link */}
                <Link
                    to="/apply"
                    className="inline-flex items-center text-muted-foreground hover:text-purple-400 transition-all mb-10 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Back to Application
                </Link>

                {/* ── Header ─────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    {/* Shortlisted badge */}
                    <div className="flex items-center gap-3 mb-6">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-widest uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            Shortlisted
                        </span>
                    </div>

                    <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                        Book Your{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                            Interview Slot
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
                        Congratulations, <span className="text-white font-medium">{existingApp.full_name?.split(' ')[0]}</span>! Select a convenient date and time below.
                    </p>

                    {/* Urgency callout */}
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                        <Zap className="w-4 h-4 shrink-0" />
                        <span><strong>First come, first served.</strong> Slots fill up fast — book now to secure your preferred time.</span>
                    </div>
                </motion.div>

                {/* ── Stats bar ──────────────────────────────────────────── */}
                {slots.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="grid grid-cols-3 gap-3 mb-8"
                    >
                        {[
                            { label: 'Available Slots', value: slots.length, icon: Calendar, color: 'text-purple-400' },
                            { label: 'Interview Panels', value: [...new Set(slots.map(s => s.panel_id))].length, icon: Users, color: 'text-pink-400' },
                            { label: 'Slot Duration', value: '30 min', icon: Clock, color: 'text-cyan-400' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center backdrop-blur-xl">
                                <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* ── Error banner ───────────────────────────────────────── */}
                <AnimatePresence>
                    {bookingError && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3"
                        >
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {bookingError}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Calendar ───────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    {slotsLoading && slots.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <LogoSpinner size="sm" />
                        </div>
                    ) : slots.length === 0 ? (
                        <HolographicCard className="p-16 text-center border-white/5">
                            <Calendar className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                            <h3 className="text-xl font-heading font-bold text-white mb-2">No Slots Available</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                                All interview slots have been booked or none have been created yet. Please contact the SSCS team for further information.
                            </p>
                        </HolographicCard>
                    ) : (
                        <SlotCalendar
                            slots={slots}
                            onSelectSlot={handlePreviewSlot}
                        />
                    )}
                </motion.div>

                {/* ── Footer note ────────────────────────────────────────── */}
                <p className="text-center text-xs text-muted-foreground/50 mt-8">
                    Slots auto-refresh every 30 seconds. Once booked, slots cannot be changed.
                </p>
            </div>

            {/* ── Confirmation Modal ─────────────────────────────────────── */}
            <AnimatePresence>
                {pendingSlot && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPendingSlot(null)}
                            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="pointer-events-auto w-full max-w-md">
                                <div className="relative rounded-3xl bg-[#0a0a0a] border border-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.2)] overflow-hidden">
                                    {/* Gradient header strip */}
                                    <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600" />

                                    <div className="p-8">
                                        {/* Close */}
                                        <button
                                            onClick={() => setPendingSlot(null)}
                                            className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>

                                        {/* Icon */}
                                        <div className="w-16 h-16 bg-purple-500/15 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30">
                                            <Calendar className="w-8 h-8 text-purple-400" />
                                        </div>

                                        <h3 className="text-xl font-heading font-bold text-white mb-1">Confirm Booking?</h3>
                                        <p className="text-muted-foreground text-sm mb-6">
                                            This slot cannot be changed once confirmed.
                                        </p>

                                        {/* Slot details */}
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground uppercase tracking-widest">Date</span>
                                                <span className="text-white font-semibold">
                                                    {format(parseISO(pendingSlot.start_time), 'EEEE, MMM d, yyyy')}
                                                </span>
                                            </div>
                                            <div className="h-px bg-white/5" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground uppercase tracking-widest">Time</span>
                                                <span className="text-purple-300 font-bold text-lg font-mono">
                                                    {format(parseISO(pendingSlot.start_time), 'h:mm a')}
                                                </span>
                                            </div>
                                            <div className="h-px bg-white/5" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground uppercase tracking-widest">Panel</span>
                                                <span className="text-white font-medium">Panel {pendingSlot.panel_id}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-12 border-white/10 hover:bg-white/5 text-muted-foreground"
                                                onClick={() => setPendingSlot(null)}
                                                disabled={isBooking}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all"
                                                onClick={handleConfirmBooking}
                                                disabled={isBooking}
                                                id="confirm-booking-btn"
                                            >
                                                {isBooking ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        Booking…
                                                    </span>
                                                ) : (
                                                    'Confirm Slot'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ScheduleInterview;
