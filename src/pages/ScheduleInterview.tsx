import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Video } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import HolographicCard from '@/components/ui/HolographicCard';
import TechGridBackground from '@/components/ui/TechGridBackground';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SlotCalendar from '@/components/ui/SlotCalendar';
import LogoSpinner from '@/components/ui/LogoSpinner';

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
const ADMIN_EMAILS = [
    'sibhi.s2024@vitstudent.ac.in',
    'sibhis5223@gmail.com',
    'santhosh.v2024d@vitstudent.ac.in',
    'tspradeepkumar@vit.ac.in'
];

const ScheduleInterview = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [existingApp, setExistingApp] = useState<any>(null);
    const [loadingApp, setLoadingApp] = useState(true);
    const [slots, setSlots] = useState<any[]>([]);
    const [bookingError, setBookingError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/apply');
        } else if (user) {
            fetchApplication();
        }
    }, [user, authLoading, navigate]);

    const fetchApplication = async () => {
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
    };

    const fetchSlots = async () => {
        const { data } = await supabase
            .from('interview_slots')
            .select('*')
            .eq('is_booked', false)
            .order('start_time', { ascending: true });
        if (data) setSlots(data);
    };

    const handleBookSlot = async (slotId: string, slotTime: string, panelId: number) => {
        setBookingError(null);
        try {
            const { data: bookingResult } = await supabase
                .from('interview_slots')
                .update({ is_booked: true, booked_by: existingApp.id })
                .eq('id', slotId)
                .eq('is_booked', false)
                .select();

            if (bookingResult && bookingResult.length > 0) {
                await supabase
                    .from('applications')
                    .update({ status: 'interview_scheduled', shortlisted_at: new Date().toISOString() })
                    .eq('id', existingApp.id);

                // Last minute check
                const startTime = parseISO(slotTime);
                const diffMins = (startTime.getTime() - Date.now()) / 60000;
                if (diffMins < 60 && diffMins > -10) {
                    const dateStr = format(startTime, 'yyyy-MM-dd');
                    const { data: assignments } = await supabase
                        .from('panel_assignments')
                        .select('interviewer_email, meeting_link')
                        .eq('panel_id', panelId)
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
                                    message: `Candidate ${existingApp.full_name} booked Panel ${panelId} at ${format(startTime, 'h:mm a')} (${Math.round(diffMins)} min away). No meet link found.`
                                })
                            });
                        }
                    }
                }

                fetchApplication();
            } else {
                setBookingError('This slot was just taken! Please pick another.');
                fetchSlots();
            }
        } catch {
            setBookingError('Booking failed. Please try again.');
        }
    };

    if (loadingApp || authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    if (!existingApp) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">No Application Found</h1>
                    <p className="text-muted-foreground mb-6">You need to apply first before scheduling an interview.</p>
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
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
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
                            Your interview has been successfully scheduled.<br />
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
                    <CheckCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-yellow-500 mb-2">Not Yet Eligible</h1>
                    <p className="text-muted-foreground mb-6">
                        You can only book an interview slot once your application is shortlisted.
                    </p>
                    <Button onClick={() => navigate('/apply')} variant="outline" className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-950/30">
                        Check My Status
                    </Button>
                </HolographicCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
            <TechGridBackground />
            <div className="absolute inset-0 bg-background/80 pointer-events-none -z-10" />

            <div className="container mx-auto px-4 py-16">
                <Link to="/apply" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-8 absolute top-8 left-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Link>

                <div className="text-center mb-10">
                    <h2 className="text-3xl font-heading font-bold mb-2 text-white">Schedule Your Interview</h2>
                    <p className="text-gray-300 text-sm">
                        Select a date from the calendar, then pick a time slot.
                        <br />
                        <span className="text-yellow-500/80 text-xs">Slots are first come, first served. Cannot be changed once booked.</span>
                    </p>
                </div>

                {bookingError && (
                    <div className="max-w-4xl mx-auto mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                        {bookingError}
                    </div>
                )}

                <SlotCalendar
                    slots={slots}
                    onSelectSlot={handleBookSlot}
                />
            </div>
        </div>
    );
};

export default ScheduleInterview;
