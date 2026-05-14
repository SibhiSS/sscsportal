import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Calendar as CalendarIcon, Video, AlertTriangle } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import HolographicCard from '@/components/ui/HolographicCard';
import TechGridBackground from '@/components/ui/TechGridBackground';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const ScheduleInterview = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [existingApp, setExistingApp] = useState<any>(null);
    const [loadingApp, setLoadingApp] = useState(true);

    const [slots, setSlots] = useState<any[]>([]);
    const [bookingDate, setBookingDate] = useState<Date | null>(null);
    const [bookingLoading, setBookingLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/apply'); // Redirect if not logged in
        } else if (user) {
            fetchApplication();
        }
    }, [user, authLoading, navigate]);

    const fetchApplication = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching application:", error);
                setLoadingApp(false);
                return;
            }

            if (data && data.length > 0) {
                const app = data[0];
                setExistingApp(app);
                if (app.status === 'shortlisted') {
                    fetchSlots();
                }
            }
        } catch (err) {
            console.error("Fetch application error:", err);
        } finally {
            setLoadingApp(false);
        }
    };

    const fetchSlots = async () => {
        const { data } = await supabase
            .from('interview_slots')
            .select('*')
            .eq('is_booked', false)
            .order('start_time', { ascending: true });

        if (data) setSlots(data);
    };

    const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    const ADMIN_EMAILS = [
        'sibhi.s2024@vitstudent.ac.in',
        'sibhis5223@gmail.com',
        'santhosh.v2024d@vitstudent.ac.in',
        'tspradeepkumar@vit.ac.in'
    ];

    const handleBookSlot = async (slotId: string, slotTime: string, panelId: number) => {
        if (!confirm(`Confirm booking for ${format(parseISO(slotTime), 'MMM d, h:mm a')}?`)) return;

        setBookingLoading(true);
        try {
            const { data: bookingResult, error } = await supabase
                .from('interview_slots')
                .update({ is_booked: true, booked_by: existingApp.id })
                .eq('id', slotId)
                .eq('is_booked', false)
                .select();

            if (bookingResult && bookingResult.length > 0) {
                await supabase.from('applications').update({ status: 'interview_scheduled' }).eq('id', existingApp.id);

                // --- LAST MINUTE CHECK (< 1HR) ---
                const startTime = parseISO(slotTime);
                const now = new Date();
                const diffMs = startTime.getTime() - now.getTime();
                const diffMins = diffMs / (1000 * 60);

                if (diffMins < 60 && diffMins > -10) { // Within 1 hour (and not too far in the past)
                    // Check for meeting link
                    const dateStr = format(startTime, 'yyyy-MM-dd');
                    const { data: assignments } = await supabase
                        .from('panel_assignments')
                        .select('interviewer_email, meeting_link')
                        .eq('panel_id', panelId)
                        .eq('date', dateStr);

                    const hasLink = assignments?.some(a => a.meeting_link && a.meeting_link.trim().length > 0);

                    if (!hasLink) {
                        const interviewerEmails = assignments?.map(a => a.interviewer_email) || [];
                        const recipients = [...new Set([...interviewerEmails, ...ADMIN_EMAILS])];

                        for (const email of recipients) {
                            await fetch(GOOGLE_SCRIPT_URL, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: email,
                                    subject: "URGENT: Last Minute Interview Booking - IEEE SSCS",
                                    message: `
                                        <div style="font-family: 'Inter', sans-serif; background-color: #050505; color: #ffffff; max-width: 600px; margin: 0 auto; border: 1px solid #dc2626; border-radius: 12px; overflow: hidden;">
                                            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                                            
                                            <div style="background-color: #000000; padding: 30px 20px; border-bottom: 1px solid #dc2626; text-align: center;">
                                                <h1 style="color: #dc2626; font-family: 'Inter', sans-serif; margin: 0; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; font-weight: 600;">Priority System Alert</h1>
                                            </div>
                                            <div style="padding: 40px;">
                                                <h2 style="color: #dc2626; font-family: 'Inter', sans-serif; margin-top: 0; font-size: 20px; font-weight: 700;">Urgent: Interview Booking</h2>
                                                <p style="font-size: 15px; line-height: 1.6; color: #d1d5db;">A candidate has booked a last-minute interview slot that begins in <strong>${Math.round(diffMins)} minutes</strong>.</p>
                                                
                                                <div style="background-color: #0a0a0a; border: 1px solid #3b0707; padding: 25px; border-radius: 8px; margin: 25px 0;">
                                                    <table style="width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 14px;">
                                                        <tr>
                                                            <td style="color: #9ca3af; padding-bottom: 12px; width: 100px;">Candidate:</td>
                                                            <td style="color: #ffffff; padding-bottom: 12px; font-weight: 500;">${existingApp.full_name}</td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #9ca3af; padding-bottom: 12px;">Panel:</td>
                                                            <td style="color: #ffffff; padding-bottom: 12px; font-weight: 500;">${panelId}</td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #9ca3af;">Time:</td>
                                                            <td style="color: #ffffff; font-weight: 500;">${format(startTime, 'h:mm a')}</td>
                                                        </tr>
                                                    </table>
                                                </div>

                                                <p style="color: #dc2626; font-weight: 600; font-size: 14px;">Immediate action required: No Google Meet link provided.</p>
                                                
                                                <div style="text-align: center; margin: 35px 0;">
                                                    <a href="https://IEEESSCS.vercel.app/admin" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">Resolve via Dashboard</a>
                                                </div>
                                            </div>
                                            <div style="background-color: #000000; padding: 20px; text-align: center; border-top: 1px solid #1a1a1a;">
                                                <p style="color: #4b5563; font-size: 10px; margin: 0; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 1px;">Automated Administrative System</p>
                                            </div>
                                        </div>
                                    `
                                })
                            });
                        }
                    }
                }
                // ---------------------------------

                alert("Interview Scheduled Successfully!");
                fetchApplication(); // Refresh state
            } else {
                alert("This slot was just taken! Please pick another.");
                fetchSlots(); // Refresh
            }
        } catch (err) {
            console.error(err);
            alert("Booking failed.");
        } finally {
            setBookingLoading(false);
        }
    };

    if (loadingApp || authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!existingApp) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">No Application Found</h1>
                    <p className="text-muted-foreground mb-6">
                        You need to apply first before scheduling an interview.
                    </p>
                    <Button onClick={() => navigate('/apply')} variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-950/30">
                        Go to Application
                    </Button>
                </HolographicCard>
            </div>
        );
    }

    if (existingApp.status === 'interview_scheduled') {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
                <TechGridBackground />
                <div className="absolute inset-0 bg-background/80 pointer-events-none -z-10" />

                <div className="container mx-auto px-4 py-8">
                    <Link to="/apply" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-8 absolute top-8 left-8">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Application Status
                    </Link>

                    <HolographicCard className="p-12 max-w-lg w-full text-center mx-auto mt-12 bg-black/40 backdrop-blur-xl border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                        <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/50">
                            <Video className="w-12 h-12 text-purple-500" />
                        </div>
                        <h2 className="text-3xl font-heading font-bold mb-2 text-white">Interview Confirmed</h2>
                        <div className="inline-block px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-6 text-sm font-medium">
                            Slot Booked
                        </div>
                        <p className="text-gray-300 mb-8 leading-relaxed">
                            Your interview has been successfully scheduled. You cannot change this slot now.
                            <br />
                            We will send meeting details to your email.
                        </p>
                        <Button onClick={() => navigate('/apply')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12">
                            View Application Status
                        </Button>
                    </HolographicCard>
                </div>
            </div>
        );
    }

    if (existingApp.status !== 'shortlisted') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-yellow-500/50">
                    <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-yellow-500 mb-2">Not Eligible</h1>
                    <p className="text-muted-foreground mb-6">
                        You can only book an interview if your application is shortlisted.
                    </p>
                    <Button onClick={() => navigate('/apply')} variant="outline" className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-950/30">
                        Check Status
                    </Button>
                </HolographicCard>
            </div>
        );
    }

    // Booking UI for Shortlisted Candidates
    const groupedSlots: Record<string, any[]> = {};
    slots.forEach(slot => {
        const dateKey = format(parseISO(slot.start_time), 'yyyy-MM-dd');
        if (!groupedSlots[dateKey]) groupedSlots[dateKey] = [];
        groupedSlots[dateKey].push(slot);
    });
    const distinctDates = Object.keys(groupedSlots).sort();

    const slotsForDate = bookingDate ? groupedSlots[format(bookingDate, 'yyyy-MM-dd')] || [] : [];
    const slotsByTime: Record<string, any[]> = {};
    slotsForDate.forEach(slot => {
        const timeKey = format(parseISO(slot.start_time), 'HH:mm');
        if (!slotsByTime[timeKey]) slotsByTime[timeKey] = [];
        slotsByTime[timeKey].push(slot);
    });

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
            <TechGridBackground />
            <div className="absolute inset-0 bg-background/80 pointer-events-none -z-10" />

            <div className="container mx-auto px-4 py-8">
                <Link to="/apply" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-8 absolute top-8 left-8">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Link>

                <div className="text-center mb-8 mt-12">
                    <h2 className="text-3xl font-heading font-bold mb-2 text-white">Schedule Your Interview</h2>
                    <p className="text-gray-300">
                        Select a suitable date and time for your interview.
                        <br />
                        <span className="text-sm text-yellow-500/80">Slots are First Come First Serve. Once booked, it cannot be changed.</span>
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 h-[500px] max-w-4xl mx-auto">
                    {/* Date Selection */}
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 overflow-auto backdrop-blur-xl">
                        <h3 className="text-sm font-bold text-muted-foreground mb-3 sticky top-0 bg-transparent uppercase tracking-wider">Select Date</h3>
                        <div className="space-y-2">
                            {distinctDates.length === 0 && <div className="text-sm text-muted-foreground italic">No slots available currently.</div>}
                            {distinctDates.map(date => {
                                const d = parseISO(date);
                                const isSelected = bookingDate && isSameDay(d, bookingDate);
                                return (
                                    <button
                                        key={date}
                                        onClick={() => setBookingDate(d)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? 'bg-purple-600/20 border-purple-500 text-purple-200' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                                    >
                                        <div className="font-bold">{format(d, 'MMM d, yyyy')}</div>
                                        <div className="text-xs opacity-70">{format(d, 'EEEE')}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Time Selection */}
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 overflow-auto backdrop-blur-xl">
                        <h3 className="text-sm font-bold text-muted-foreground mb-3 sticky top-0 bg-transparent uppercase tracking-wider">
                            {bookingDate ? `Select Time (${format(bookingDate, 'MMM d')})` : 'Select a Date first'}
                        </h3>
                        {!bookingDate && <div className="text-sm text-muted-foreground italic mt-10 text-center">← Choose a date from the left panel</div>}

                        {bookingDate && (
                            <div className="grid grid-cols-2 gap-2">
                                {Object.keys(slotsByTime).sort().map(time => {
                                    const slotToBook = slotsByTime[time][0];
                                    return (
                                        <button
                                            key={time}
                                            onClick={() => handleBookSlot(slotToBook.id, slotToBook.start_time, slotToBook.panel_id)}
                                            disabled={bookingLoading}
                                            className="p-3 bg-black/40 border border-white/10 rounded hover:border-purple-500 hover:text-purple-400 disabled:opacity-50 transition-colors"
                                        >
                                            {format(parseISO(slotToBook.start_time), 'h:mm a')}
                                        </button>
                                    )
                                })}
                                {Object.keys(slotsByTime).length === 0 && bookingDate && (
                                    <div className="col-span-2 text-sm text-muted-foreground text-center italic">No slots left for this date.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleInterview;
