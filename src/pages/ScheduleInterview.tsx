import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Video, Calendar, Clock, Users, ShieldAlert, Zap, X, CalendarClock } from 'lucide-react';
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
import WhatsAppGroupCard from '@/components/ui/WhatsAppGroupCard';

import { sendEmail } from '@/lib/email';
import { WHATSAPP_GROUP_URL, WHATSAPP_GROUP_NOTICE } from '@/lib/community';

/**
 * Shared club mailbox for operational alerts.
 *
 * This page is applicant-facing, so it cannot read the `admins` table — RLS restricts
 * that to the admin's own row or a super_admin. Personal admin addresses were hardcoded
 * here previously, which published them in the public JS bundle and the public repo.
 * A shared org address avoids that without needing a DB lookup.
 */
const ADMIN_ALERT_EMAIL = import.meta.env.VITE_ADMIN_ALERT_EMAIL || 'ieee.sscs.vitchennai@gmail.com';

/**
 * A slot the applicant has picked but not yet confirmed. Only the time is held —
 * which panel they end up on is decided server-side by book_interview_slot(), so
 * the panel number never exists in this page's state at all.
 */
interface PendingSlot {
    start_time: string;
}

/**
 * How many times an applicant may move a booked slot. Mirrors slot_change_limit()
 * in migration_slot_reschedule.sql — this copy only decides what the UI offers;
 * reschedule_interview_slot() is what actually enforces it.
 */
const SLOT_CHANGE_LIMIT = 1;

/**
 * How close to the interview the change button stops being offered. Mirrors
 * c_lead_time in reschedule_interview_slot(), which rejects the call regardless.
 */
const SLOT_CHANGE_LEAD_TIME_MS = 60 * 60 * 1000;

/** The applicant's own booking, once they have one. */
interface BookedSlot {
    start_time: string;
    end_time: string | null;
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

    // The slot they already hold, plus whether they are currently moving it.
    const [currentSlot, setCurrentSlot] = useState<BookedSlot | null>(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/apply');
        } else if (user) {
            fetchApplication();
        }
    }, [user, authLoading, navigate]);

    // Booking is unlocked by the shortlist EMAIL, not by the shortlist itself.
    // shortlist_notified is written by the admin Scheduler only after a booking link
    // is confirmed sent. Until then a shortlisted applicant sees the "not eligible"
    // screen here, and no shortlist hint anywhere else in the portal.
    const canBook = existingApp?.status === 'shortlisted' && existingApp?.shortlist_notified === true;

    // ── One allowed change ────────────────────────────────────────────────────
    // Every condition below is re-checked inside reschedule_interview_slot(); these
    // copies only decide whether the button is worth offering.
    const isBooked = existingApp?.status === 'interview_scheduled';
    const changesLeft = SLOT_CHANGE_LIMIT - (existingApp?.slot_changes_used ?? 0);
    const changeWindowOpen = currentSlot
        ? parseISO(currentSlot.start_time).getTime() > Date.now() + SLOT_CHANGE_LEAD_TIME_MS
        : false;
    const canChangeSlot = isBooked && changesLeft > 0 && changeWindowOpen;

    // Both flows render the same calendar, and both need the free-slot list.
    const pickingSlot = canBook || isRescheduling;

    // available_slot_times() returns one row per distinct start time with the panels
    // already collapsed server-side, so panel_id is never sent to the browser. A time
    // whose panels are all taken produces no row and simply vanishes from the list.
    const fetchSlots = useCallback(async () => {
        setSlotsLoading(true);
        const { data, error } = await supabase.rpc('available_slot_times');
        if (error) {
            console.error('[Schedule] Could not load slot times:', error.message);
            setBookingError(
                error.message?.includes('available_slot_times')
                    ? 'Slot booking is not set up yet. Please contact the SSCS team.'
                    : 'Could not load available slots. Please refresh and try again.'
            );
        } else {
            setSlots(data || []);
        }
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
                if (app.status === 'shortlisted' && app.shortlist_notified === true) {
                    fetchSlots();
                } else if (app.status === 'interview_scheduled') {
                    // Needed to show what they booked and to decide whether the
                    // change window is still open. slots_select lets an applicant
                    // read their own booked row.
                    const { data: slot } = await supabase
                        .from('interview_slots')
                        .select('start_time, end_time')
                        .eq('booked_by', app.id)
                        .maybeSingle();
                    if (slot) setCurrentSlot(slot as BookedSlot);
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
        if (!pickingSlot) return;
        const interval = setInterval(fetchSlots, 30000);
        const handleFocus = () => fetchSlots();
        window.addEventListener('focus', handleFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [pickingSlot, fetchSlots]);

    // Called when user picks a time in the calendar — opens confirmation modal
    const handlePreviewSlot = (slotTime: string) => {
        setBookingError(null);
        setPendingSlot({ start_time: slotTime });
    };

    const startReschedule = () => {
        setBookingError(null);
        setIsRescheduling(true);
        fetchSlots();
    };

    const cancelReschedule = () => {
        setBookingError(null);
        setPendingSlot(null);
        setIsRescheduling(false);
    };

    // The group is the only channel the team uses once someone is booked, so the
    // invite rides along with every confirmation rather than being announced
    // separately. Only applicants who hold a slot ever receive one of these mails.
    const whatsappEmailBlock = `
        <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #25D366;">
            <p style="margin:0 0 8px 0;"><strong>Join the official WhatsApp group</strong></p>
            <p style="margin:0 0 10px 0;">${WHATSAPP_GROUP_NOTICE}</p>
            <p style="margin:0;"><a href="${WHATSAPP_GROUP_URL}">${WHATSAPP_GROUP_URL}</a></p>
        </div>`;

    // Called when user confirms in the modal
    const handleConfirmBooking = async () => {
        if (!pendingSlot || !existingApp || !user) return;
        setIsBooking(true);
        setBookingError(null);

        if (parseISO(pendingSlot.start_time).getTime() <= Date.now()) {
            setBookingError("This slot time has already passed. Please select an upcoming slot.");
            setIsBooking(false);
            setPendingSlot(null);
            fetchSlots();
            return;
        }

        try {
            // One server-side call does everything in a single transaction: verify
            // eligibility, verify they have no slot already, pick a free panel for
            // this time with FOR UPDATE SKIP LOCKED, claim it, and move the
            // application to interview_scheduled.
            //
            // Doing it this way removes three problems the old two-write client
            // flow had: two people could pass the "already booked?" check at the
            // same time and end up with a slot each; two people picking the same
            // time collided on the same panel even when others were free; and if
            // the status write failed after the slot write, the slot was consumed
            // with nobody scheduled against it.
            const { data: bookingResult, error: bookingRpcError } = await supabase
                .rpc('book_interview_slot', { p_start_time: pendingSlot.start_time });

            const booked = Array.isArray(bookingResult) ? bookingResult[0] : bookingResult;

            if (bookingRpcError) {
                // Messages come from RAISE EXCEPTION in book_interview_slot() and are
                // already written for the applicant to read.
                setPendingSlot(null);
                setBookingError(
                    bookingRpcError.message?.includes('book_interview_slot')
                        ? 'Slot booking is not set up yet. Please contact the SSCS team.'
                        : (bookingRpcError.message || 'Booking failed. Please try again.')
                );
                fetchSlots();
            } else if (booked) {
                // Send confirmation email to candidate
                const startTime2 = parseISO(pendingSlot.start_time);
                const dateStr2 = format(startTime2, 'EEEE, MMMM d, yyyy');
                const timeStr2 = format(startTime2, 'h:mm a');
                const portalUrl = window.location.origin;
                sendEmail(
                    existingApp.email,
                    `Interview Slot Confirmed - ${dateStr2} - IEEE SSCS`,
                    `<p>Dear <strong>${existingApp.full_name}</strong>,</p>
                    <p>Your interview slot has been successfully booked and confirmed.</p>
                    <div style="background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #dc143c;">
                        <p style="margin:4px 0;"><strong>Date:</strong> ${dateStr2}</p>
                        <p style="margin:4px 0;"><strong>Time:</strong> ${timeStr2}</p>
                        <p style="margin:4px 0;"><strong>Department:</strong> ${existingApp.primary_dept}</p>
                    </div>
                    ${whatsappEmailBlock}
                    <p>Your meeting link will be sent before the interview starts. You can track your status anytime at: <a href="${portalUrl}/apply">${portalUrl}/apply</a></p>
                    <p>Please be ready 5 minutes before your scheduled time slot.</p>
                    <p>You may move this slot <strong>once</strong> from the portal if you need to.</p>
                    <p>Best regards,<br>IEEE SSCS HR Team</p>`
                ).catch(err => console.warn('[Schedule] Booking confirmation email failed:', err));

                // Last-minute check for urgent alerts
                const startTime = parseISO(pendingSlot.start_time);
                const diffMins = (startTime.getTime() - Date.now()) / 60000;
                if (diffMins < 60 && diffMins > -10) {
                    const dateStr = format(startTime, 'yyyy-MM-dd');
                    const { data: assignments } = await supabase
                        .from('panel_assignments')
                        .select('interviewer_email, meeting_link')
                        .eq('panel_id', booked.panel_id)
                        .eq('date', dateStr);

                    const hasLink = assignments?.some(a => a.meeting_link?.trim());
                    if (!hasLink) {
                        // Note: `assignments` is normally empty here — panel_assignments is
                        // admin-only under RLS, so an applicant's query returns nothing. The
                        // club mailbox is the reliable recipient; the Apps Script cron sends
                        // the authoritative "no interviewer assigned" alert server-side.
                        const interviewerEmails = assignments?.map(a => a.interviewer_email) || [];
                        const recipients = [...new Set([...interviewerEmails, ADMIN_ALERT_EMAIL])];
                        for (const alertEmail of recipients) {
                            sendEmail(
                                alertEmail,
                                'URGENT: Last Minute Interview Booking - IEEE SSCS',
                                `<p>Candidate <strong>${existingApp.full_name}</strong> just booked Panel ${booked.panel_id} at ${format(startTime, 'h:mm a')} (${Math.round(diffMins)} min away).</p><p>No meeting link has been set. Please add one immediately.</p>`
                            ).catch(err => console.warn('[Schedule] Urgent alert email failed:', err));
                        }
                    }
                }

                setPendingSlot(null);
                setBookingSuccess(true);
                setCurrentSlot({ start_time: booked.start_time, end_time: booked.end_time ?? null });
                // Refresh app data after 2s then redirect
                setTimeout(() => {
                    setExistingApp((prev: any) => ({ ...prev, status: 'interview_scheduled' }));
                    setBookingSuccess(false);
                }, 1800);
            } else {
                // No error and no row: every panel at this time was claimed between
                // the list refreshing and the confirm click.
                setPendingSlot(null);
                setBookingError('That time was just filled. Please pick another one.');
                fetchSlots();
            }
        } catch {
            setPendingSlot(null);
            setBookingError('Booking failed. Please try again.');
        } finally {
            setIsBooking(false);
        }
    };

    /**
     * The one allowed change.
     *
     * reschedule_interview_slot() frees the old slot and claims the new one in a
     * single transaction, so a "that time just filled up" failure leaves the
     * applicant on the slot they already had rather than on none at all.
     */
    const handleConfirmReschedule = async () => {
        if (!pendingSlot || !existingApp || !user || !currentSlot) return;
        setIsBooking(true);
        setBookingError(null);

        if (parseISO(pendingSlot.start_time).getTime() <= Date.now()) {
            setBookingError('This slot time has already passed. Please select an upcoming slot.');
            setIsBooking(false);
            setPendingSlot(null);
            fetchSlots();
            return;
        }

        try {
            const { data: result, error: rpcError } = await supabase
                .rpc('reschedule_interview_slot', { p_start_time: pendingSlot.start_time });

            const moved = Array.isArray(result) ? result[0] : result;

            if (rpcError) {
                // Messages come from RAISE EXCEPTION in reschedule_interview_slot()
                // and are already written for the applicant to read.
                setPendingSlot(null);
                setBookingError(
                    rpcError.message?.includes('reschedule_interview_slot')
                        ? 'Slot changes are not enabled yet. Please contact the SSCS team.'
                        : (rpcError.message || 'Could not change your slot. Please try again.')
                );
                fetchSlots();
            } else if (moved) {
                const oldStart = parseISO(currentSlot.start_time);
                const newStart = parseISO(moved.start_time);
                const portalUrl = window.location.origin;
                sendEmail(
                    existingApp.email,
                    `Interview Slot Changed - ${format(newStart, 'EEEE, MMMM d, yyyy')} - IEEE SSCS`,
                    `<p>Dear <strong>${existingApp.full_name}</strong>,</p>
                    <p>Your interview slot has been changed. Your <strong>new</strong> slot is:</p>
                    <div style="background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #dc143c;">
                        <p style="margin:4px 0;"><strong>Date:</strong> ${format(newStart, 'EEEE, MMMM d, yyyy')}</p>
                        <p style="margin:4px 0;"><strong>Time:</strong> ${format(newStart, 'h:mm a')}</p>
                        <p style="margin:4px 0;"><strong>Department:</strong> ${existingApp.primary_dept}</p>
                    </div>
                    <p style="color:#71717a;">Your previous slot (${format(oldStart, 'EEEE, MMMM d')} at ${format(oldStart, 'h:mm a')}) has been released.</p>
                    ${whatsappEmailBlock}
                    <p><strong>This was your one allowed slot change</strong> — the new time is final. Track your status anytime at: <a href="${portalUrl}/apply">${portalUrl}/apply</a></p>
                    <p>Best regards,<br>IEEE SSCS HR Team</p>`
                ).catch(err => console.warn('[Schedule] Reschedule confirmation email failed:', err));

                setPendingSlot(null);
                setCurrentSlot({ start_time: moved.start_time, end_time: moved.end_time ?? null });
                setExistingApp(prev => ({
                    ...prev,
                    slot_changes_used: (prev?.slot_changes_used ?? 0) + 1,
                }));
                setBookingSuccess(true);
                setTimeout(() => {
                    setIsRescheduling(false);
                    setBookingSuccess(false);
                }, 1800);
            } else {
                setPendingSlot(null);
                setBookingError('That time was just filled. Please pick another one.');
                fetchSlots();
            }
        } catch {
            setPendingSlot(null);
            setBookingError('Could not change your slot. Please try again.');
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

    // ── Success overlay (after booking or changing) ───────────────────────────
    // Sits above the "already scheduled" screen below, because a reschedule leaves
    // the status at interview_scheduled — that screen would otherwise swallow it.
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
                    <h2 className="text-4xl font-heading font-bold text-white mb-3">
                        {isRescheduling ? 'Slot Changed!' : "You're In!"}
                    </h2>
                    <p className="text-green-400 text-lg">
                        {isRescheduling ? 'Your new interview slot is confirmed.' : 'Interview slot confirmed.'}
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm">Redirecting you back…</p>
                </motion.div>
            </div>
        );
    }

    // ── Already scheduled ─────────────────────────────────────────────────────
    // `isRescheduling` sends them back to the calendar below instead.
    if (existingApp.status === 'interview_scheduled' && !isRescheduling) {
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
                            <p className="text-gray-300 mb-6 leading-relaxed">
                                Your interview slot has been successfully reserved.<br />
                                Meeting details will be sent to your email before the interview.
                            </p>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4 text-left space-y-2">
                                {currentSlot && (
                                    <>
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Date</p>
                                        <p className="text-white font-medium">{format(parseISO(currentSlot.start_time), 'EEEE, MMMM d, yyyy')}</p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-3 mb-1">Time</p>
                                        <p className="text-purple-300 font-bold font-mono text-lg">{format(parseISO(currentSlot.start_time), 'h:mm a')}</p>
                                    </>
                                )}
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-3 mb-1">Applicant</p>
                                <p className="text-white font-medium">{existingApp.full_name}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-3 mb-1">Primary Choice</p>
                                <p className="text-purple-400 font-medium">{existingApp.primary_dept}</p>
                            </div>

                            {/* Only ever rendered for someone who holds a slot — the
                                invite link must not reach anyone else. */}
                            <WhatsAppGroupCard className="mb-4" />

                            {/* ── The one allowed change ── */}
                            {canChangeSlot ? (
                                <div className="mb-6">
                                    <Button
                                        onClick={startReschedule}
                                        variant="outline"
                                        className="w-full h-12 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 font-bold"
                                    >
                                        <CalendarClock className="w-4 h-4 mr-2" />
                                        Change My Slot
                                    </Button>
                                    <p className="text-[11px] text-muted-foreground mt-2">
                                        You can change your slot <strong>once</strong>. After that the time is final.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-muted-foreground mb-6">
                                    {changesLeft <= 0
                                        ? 'You have already used your one slot change, so this time is final. Contact the SSCS team if you cannot attend.'
                                        : !currentSlot
                                            ? 'Loading your slot details…'
                                            : 'Your interview is too close to be moved. Contact the SSCS team if you cannot attend.'}
                                </p>
                            )}

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
    // Covers both "not shortlisted" and "shortlisted but the booking email has not
    // gone out yet" — deliberately the same screen, so a shortlisted applicant who
    // guesses this URL early cannot tell the difference.
    if (!pickingSlot) {
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
                            Interview slots open once our team emails you a booking link.
                            If you have already received one, make sure you are signed in with
                            the same email address you applied with.
                        </p>
                        <Button onClick={() => navigate('/apply')} variant="outline" className="w-full h-12 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                            Check My Status
                        </Button>
                    </HolographicCard>
                </motion.div>
            </div>
        );
    }

    // ── Main Booking UI ───────────────────────────────────────────────────────

    // Plain consts, not useMemo — this sits below the early returns above, and a
    // hook here would not run on every render path.

    // While rescheduling, their current time can still be listed if another panel
    // at it is free. Picking it would spend the one change to land on the same
    // time, so it is dropped here; reschedule_interview_slot() rejects it too.
    //
    // Compared as instants, not strings: the RPC and the table read can serialise
    // the same timestamptz with different offsets or fractional digits.
    const currentSlotMs = currentSlot ? parseISO(currentSlot.start_time).getTime() : null;
    const visibleSlots = isRescheduling && currentSlotMs !== null
        ? slots.filter(s => parseISO(s.start_time).getTime() !== currentSlotMs)
        : slots;

    const uniqueDateCount = new Set(
        visibleSlots.map(s => format(parseISO(s.start_time), 'yyyy-MM-dd'))
    ).size;

    // Read off the real generated slots rather than hardcoding, since the admin
    // picks the duration when generating.
    const firstWithEnd = visibleSlots.find(s => s.end_time);
    const slotDurationLabel = firstWithEnd
        ? `${Math.round(
            (parseISO(firstWithEnd.end_time).getTime() - parseISO(firstWithEnd.start_time).getTime()) / 60000
          )} min`
        : '—';

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
                {isRescheduling ? (
                    // Leaving via this button keeps the slot they already hold — no
                    // change is spent until they confirm one in the modal.
                    <button
                        onClick={cancelReschedule}
                        className="inline-flex items-center text-muted-foreground hover:text-purple-400 transition-all mb-10 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Keep My Current Slot
                    </button>
                ) : (
                    <Link
                        to="/apply"
                        className="inline-flex items-center text-muted-foreground hover:text-purple-400 transition-all mb-10 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Application
                    </Link>
                )}

                {/* ── Header ─────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    {/* Stage badge */}
                    <div className="flex items-center gap-3 mb-6">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-widest uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            {isRescheduling ? 'Changing Your Slot' : 'Shortlisted'}
                        </span>
                    </div>

                    <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                        {isRescheduling ? 'Change Your' : 'Book Your'}{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                            Interview Slot
                        </span>
                    </h1>
                    {isRescheduling ? (
                        <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
                            Pick the new time you want. Your current slot is released only once the new one is confirmed.
                        </p>
                    ) : (
                        <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
                            Congratulations, <span className="text-white font-medium">{existingApp.full_name?.split(' ')[0]}</span>! Select a convenient date and time below.
                        </p>
                    )}

                    {/* Callout */}
                    {isRescheduling ? (
                        <div className="mt-6 flex flex-col gap-3">
                            {currentSlot && (
                                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 self-start">
                                    <Clock className="w-4 h-4 shrink-0 text-purple-400" />
                                    <span>
                                        Current slot:{' '}
                                        <strong className="text-white">
                                            {format(parseISO(currentSlot.start_time), 'EEE, MMM d')} at {format(parseISO(currentSlot.start_time), 'h:mm a')}
                                        </strong>
                                    </span>
                                </div>
                            )}
                            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm self-start">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span><strong>This is your only change.</strong> Once you confirm a new time, the slot is final.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                            <Zap className="w-4 h-4 shrink-0" />
                            <span><strong>First come, first served.</strong> Slots fill up fast — book now to secure your preferred time.</span>
                        </div>
                    )}
                </motion.div>

                {/* ── Stats bar ──────────────────────────────────────────── */}
                {visibleSlots.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="grid grid-cols-3 gap-3 mb-8"
                    >
                        {/* No panel count here — that would give away how many interviews
                            run in parallel. `slots` is one row per distinct time, so its
                            length is a count of times, not of panel seats. */}
                        {[
                            { label: 'Times Available', value: visibleSlots.length, icon: Calendar, color: 'text-purple-400' },
                            { label: 'Dates Open', value: uniqueDateCount, icon: Users, color: 'text-pink-400' },
                            { label: 'Slot Duration', value: slotDurationLabel, icon: Clock, color: 'text-cyan-400' },
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
                    {slotsLoading && visibleSlots.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <LogoSpinner size="sm" />
                        </div>
                    ) : visibleSlots.length === 0 ? (
                        <HolographicCard className="p-16 text-center border-white/5">
                            <Calendar className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                            <h3 className="text-xl font-heading font-bold text-white mb-2">No Slots Available</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                                {isRescheduling
                                    ? 'There is no other free time to move to right now. Your current slot is untouched — check back later or contact the SSCS team.'
                                    : 'All interview slots have been booked or none have been created yet. Please contact the SSCS team for further information.'}
                            </p>
                        </HolographicCard>
                    ) : (
                        <SlotCalendar
                            slots={visibleSlots}
                            onSelectSlot={handlePreviewSlot}
                        />
                    )}
                </motion.div>

                {/* ── Footer note ────────────────────────────────────────── */}
                <p className="text-center text-xs text-muted-foreground/50 mt-8">
                    Slots auto-refresh every 30 seconds.{' '}
                    {isRescheduling
                        ? 'This is your one allowed change — the new slot will be final.'
                        : 'Once booked, you may change your slot only once.'}
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

                                        <h3 className="text-xl font-heading font-bold text-white mb-1">
                                            {isRescheduling ? 'Confirm New Slot?' : 'Confirm Booking?'}
                                        </h3>
                                        <p className="text-muted-foreground text-sm mb-6">
                                            {isRescheduling
                                                ? 'This uses your one allowed change. The new time cannot be changed again.'
                                                : 'You may change this slot once after booking.'}
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
                                            {isRescheduling && currentSlot && (
                                                <>
                                                    <div className="h-px bg-white/5" />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground uppercase tracking-widest">Replaces</span>
                                                        <span className="text-muted-foreground text-sm line-through">
                                                            {format(parseISO(currentSlot.start_time), 'MMM d')} · {format(parseISO(currentSlot.start_time), 'h:mm a')}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            {/* No Panel row: applicants see the time only. Which panel
                                                they are assigned is chosen server-side at booking time. */}
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
                                                onClick={isRescheduling ? handleConfirmReschedule : handleConfirmBooking}
                                                disabled={isBooking}
                                                id="confirm-booking-btn"
                                            >
                                                {isBooking ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        {isRescheduling ? 'Changing…' : 'Booking…'}
                                                    </span>
                                                ) : (
                                                    isRescheduling ? 'Confirm Change' : 'Confirm Slot'
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
