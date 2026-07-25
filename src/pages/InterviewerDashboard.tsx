import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Application, InterviewFeedback, EvaluationRecommendation } from '@/types';
import { format, parseISO, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Video, User, ShieldAlert, CheckCircle, FileText, ExternalLink, BarChart2, Send } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import EvaluationForm from '@/components/interviewer/EvaluationForm';
import { submitEvaluation, fetchFeedbacksForApplication } from '@/services/interviewService';
import { motion, AnimatePresence } from 'framer-motion';
import CircuitBoardBackground from '@/components/ui/CircuitBoardBackground';
import { sendEmail } from '@/lib/email';

const InterviewerDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [mySlots, setMySlots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [evalApp, setEvalApp] = useState<Application | null>(null);
    const [existingFeedback, setExistingFeedback] = useState<InterviewFeedback | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [meetingLinks, setMeetingLinks] = useState<Record<number, string>>({});
    const [stats, setStats] = useState({ evaluated: 0, pending: 0, total: 0 });

    const ALLOWED_ROLES = ['super_admin', 'admin', 'interviewer'];
    const hasAccess = user?.role && ALLOWED_ROLES.includes(user.role);

    useEffect(() => {
        if (!authLoading && user && hasAccess) {
            fetchMySlots();
        }
    }, [user, authLoading, hasAccess]);

    const fetchMySlots = async () => {
        setIsLoading(true);
        const { data: assignments } = await supabase
            .from('panel_assignments')
            .select('panel_id, date, meeting_link')
            .eq('interviewer_email', user?.email);

        if (!assignments || assignments.length === 0) {
            setIsLoading(false);
            return;
        }

        // Build meeting link map
        const linkMap: Record<number, string> = {};
        assignments.forEach(a => { if (a.meeting_link) linkMap[a.panel_id] = a.meeting_link; });
        setMeetingLinks(linkMap);

        const { data: slots } = await supabase
            .from('interview_slots')
            .select('*, applications(*)')
            .order('start_time', { ascending: true });

        if (slots) {
            const filtered = slots.filter(slot => {
                const slotDate = format(parseISO(slot.start_time), 'yyyy-MM-dd');
                return assignments.some(a => a.panel_id === slot.panel_id && a.date === slotDate);
            });
            setMySlots(filtered);

            // Compute stats
            const booked = filtered.filter(s => s.is_booked && s.applications);
            // Fetch feedbacks for all booked slots
            const feedbackChecks = await Promise.all(
                booked.map(s => fetchFeedbacksForApplication(s.applications?.id || ''))
            );
            const evaluated = feedbackChecks.filter(fb =>
                fb.some(f => f.interviewer_email === user?.email)
            ).length;

            setStats({ total: booked.length, evaluated, pending: booked.length - evaluated });
        }
        setIsLoading(false);
    };

    const handleOpenEval = async (slot: any) => {
        const app = slot.applications;
        if (!app) return;

        const mappedApp: Application = {
            ...app,
            fullName: app.full_name,
            rollNumber: app.roll_number,
            primaryDept: app.primary_dept,
            domains: app.domains || [],
            skills: app.skills || '',
            reason: app.reason || '',
            secondaryDept: app.secondary_dept || '',
            secondaryDomains: app.secondary_domains || [],
            secondarySkills: app.secondary_skills || '',
            secondaryReason: app.secondary_reason || '',
            submittedAt: app.created_at,
            rating: app.rating || 0,
            resumeUrl: app.resume_url,
            linkedinUrl: app.linkedin_url,
            githubUrl: app.github_url,
            portfolioUrl: app.portfolio_url,
            parsedSkills: app.parsed_skills || [],
        };
        setEvalApp(mappedApp);

        // Load existing feedback
        const feedbacks = await fetchFeedbacksForApplication(app.id);
        const mine = feedbacks.find(f => f.interviewer_email === user?.email) ?? null;
        setExistingFeedback(mine);
    };

    const handleSubmitEval = async (payload: {
        score_communication: number;
        score_technical: number;
        score_enthusiasm: number;
        score_leadership: number;
        score_team_fit: number;
        recommendation: EvaluationRecommendation;
        interviewer_remarks: string;
    }) => {
        if (!evalApp || !user?.email) return;
        setIsSubmitting(true);
        const { error } = await submitEvaluation({
            application_id: evalApp.id,
            interviewer_email: user.email,
            ...payload,
        });

        if (!error) {
            setSuccessMsg(`Evaluation saved for ${evalApp.fullName}`);
            setTimeout(() => setSuccessMsg(null), 4000);
            setEvalApp(null);
            setExistingFeedback(null);
            fetchMySlots();
        } else {
            alert(`Error saving evaluation: ${error}`);
        }
        setIsSubmitting(false);
    };

    const handleMarkStatus = async (app: any, slotId: string, status: 'interviewed' | 'shortlisted') => {
        setIsLoading(true);
        if (status === 'shortlisted') {
            // Unbook slot and mark as shortlisted (No Show / Unselect)
            await supabase.from('interview_slots').update({ is_booked: false, booked_by: null }).eq('id', slotId);
            await supabase.from('applications').update({ status }).eq('id', app.id);
            
            // Send No Show Email
            sendEmail(
                app.email,
                'Missed Interview - Please Rebook - IEEE SSCS',
                `<p>Dear <strong>${app.full_name || app.fullName}</strong>,</p>
                <p>You were marked as a "No Show" for your scheduled interview slot.</p>
                <p>Your application has been moved back to the shortlisting queue. If you still wish to be considered, please log in to the portal and re-book a new slot immediately.</p>
                <p>Slots are limited and available on a first-come, first-served basis. Failure to attend a re-booked interview may result in disqualification.</p>
                <p>Regards,<br>IEEE SSCS HR Team</p>`
            ).catch(err => console.warn('[Dashboard] No-show email failed:', err));
            
            setSuccessMsg('Candidate marked as No Show, slot freed.');
        } else {
            // Mark as interviewed
            await supabase.from('applications').update({ status }).eq('id', app.id);
            setSuccessMsg('Interview marked as finished.');
        }
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchMySlots();
    };

    const uniqueDates = Array.from(
        new Set(mySlots.map(s => format(parseISO(s.start_time), 'yyyy-MM-dd')))
    ).sort();

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    if (!user || !hasAccess) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center p-8 border border-red-500/50 rounded-xl bg-black/40 backdrop-blur-xl">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">This area is restricted to authorized interviewers only.</p>
                    <Button onClick={() => navigate('/')} variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-950/30">
                        Return Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
            <CircuitBoardBackground />
            <div className="relative z-10 p-6 md:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-7xl mx-auto space-y-8"
                >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                        <div>
                            <h1 className="text-3xl font-bold font-heading bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-primary">
                                Interviewer Dashboard
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                {user?.email} · {user?.role?.replace('_', ' ').toUpperCase()}
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-4">
                            <div className="text-center px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                                <div className="text-2xl font-bold text-white">{stats.total}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned</div>
                            </div>
                            <div className="text-center px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                                <div className="text-2xl font-bold text-green-400">{stats.evaluated}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Evaluated</div>
                            </div>
                            <div className="text-center px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</div>
                            </div>
                        </div>
                    </div>

                    {/* Success message */}
                    <AnimatePresence>
                        {successMsg && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {successMsg}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Slots by Date */}
                    {uniqueDates.length === 0 ? (
                        <div className="text-center p-16 border border-dashed border-white/10 rounded-2xl">
                            <User className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No Interviews Assigned</h3>
                            <p className="text-muted-foreground text-sm">
                                You currently have no interview panels assigned. Contact the SuperAdmin.
                            </p>
                        </div>
                    ) : (
                        uniqueDates.map(date => (
                            <motion.div
                                key={date}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-purple-400" />
                                    {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                                </h2>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {mySlots
                                        .filter(s => isSameDay(parseISO(s.start_time), parseISO(date)))
                                        .map(slot => {
                                            const app = slot.applications;
                                            const hasLink = !!meetingLinks[slot.panel_id];
                                            const timeDiffMins = (parseISO(slot.start_time).getTime() - new Date().getTime()) / 60000;
                                            const isUrgent = timeDiffMins > 0 && timeDiffMins <= 15;
                                            const isMissingLink = timeDiffMins > 0 && timeDiffMins <= 60 && !hasLink;

                                            return (
                                                <Card key={slot.id} className={`bg-white/5 transition-all ${isUrgent ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse-slow' : 'border-purple-500/20 hover:border-purple-500/40'}`}>
                                                    <CardHeader className={`${isUrgent ? 'bg-red-500/20 border-red-500/30' : 'bg-purple-500/10 border-purple-500/20'} border-b pb-3 pt-4 px-4`}>
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-mono text-sm font-bold text-purple-300">
                                                                {format(parseISO(slot.start_time), 'h:mm a')}
                                                                {slot.end_time && ` – ${format(parseISO(slot.end_time), 'h:mm a')}`}
                                                            </span>
                                                            <Badge variant="outline" className="bg-black/40 border-purple-500/30 text-purple-400 text-[10px]">
                                                                Panel {slot.panel_id}
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-4 space-y-3">
                                                        {slot.is_booked && app ? (
                                                            <>
                                                                <div>
                                                                    <div className="font-bold text-white flex items-center gap-2">
                                                                        {app.full_name}
                                                                        {isUrgent && <Badge className="bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 text-[10px] uppercase">Starting Soon</Badge>}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                                        {app.roll_number} · {app.primary_dept}
                                                                    </div>
                                                                </div>

                                                                {isMissingLink && (
                                                                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-400 flex items-start gap-2">
                                                                        <ShieldAlert className="w-4 h-4 shrink-0" />
                                                                        <span>Add Meeting Link in Admin Panel!</span>
                                                                    </div>
                                                                )}

                                                                <div className="flex gap-2">
                                                                    {app.resume_url && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-xs border-white/10 text-muted-foreground hover:text-white"
                                                                            onClick={() => window.open(app.resume_url, '_blank')}
                                                                        >
                                                                            <FileText className="w-3 h-3 mr-1" />
                                                                            Resume
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className={`flex-1 text-xs ${hasLink
                                                                            ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                                                                            : 'border-white/10 text-muted-foreground opacity-50'}`}
                                                                        disabled={!hasLink}
                                                                        onClick={() => hasLink && window.open(meetingLinks[slot.panel_id], '_blank')}
                                                                    >
                                                                        <Video className="w-3 h-3 mr-1" />
                                                                        {hasLink ? 'Join Meet' : 'No Link'}
                                                                    </Button>
                                                                    {hasLink && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                                                                            onClick={async () => {
                                                                                const link = meetingLinks[slot.panel_id];
                                                                                const slotTime = format(parseISO(slot.start_time), 'h:mm a');
                                                                                const slotDate = format(parseISO(slot.start_time), 'EEEE, MMMM d, yyyy');
                                                                                const portalUrl = window.location.origin;
                                                                                const ok = await sendEmail(
                                                                                    app.email,
                                                                                    'Your Interview Meeting Link - IEEE SSCS',
                                                                                    `<p>Dear <strong>${app.full_name || app.fullName}</strong>,</p>
                                                                                    <p>Your interview meeting link is ready.</p>
                                                                                    <p><strong>Date:</strong> ${slotDate}<br>
                                                                                    <strong>Time:</strong> ${slotTime}<br>
                                                                                    <strong>Department:</strong> ${app.primary_dept}</p>
                                                                                    <p><strong>Join your interview:</strong> <a href="${link}">${link}</a></p>
                                                                                    <p>You can also check your status at: <a href="${portalUrl}/apply">${portalUrl}/apply</a></p>
                                                                                    <p>Please join 5 minutes before your slot.<br>IEEE SSCS HR Team</p>`
                                                                                );
                                                                                if (ok) {
                                                                                    alert(`Meeting link email sent to ${app.full_name || app.fullName}!`);
                                                                                } else {
                                                                                    alert(`Failed to send email to ${app.full_name || app.fullName}. Check console for details.`);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Send className="w-3 h-3 mr-1" />
                                                                            Send Mail
                                                                        </Button>
                                                                    )}
                                                                </div>

                                                                <Button
                                                                    className="w-full text-xs"
                                                                    style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
                                                                    onClick={() => handleOpenEval(slot)}
                                                                >
                                                                    <BarChart2 className="w-3 h-3 mr-2" />
                                                                    Evaluate Candidate
                                                                </Button>
                                                                
                                                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                                                    {app.status === 'interview_scheduled' && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="flex-1 text-[10px] h-7 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                                                            onClick={() => handleMarkStatus(app, slot.id, 'interviewed')}
                                                                        >
                                                                            Mark Interviewed
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="flex-1 text-[10px] h-7 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                                        onClick={() => {
                                                                            if (confirm('Mark as No Show? This will cancel the booking.')) {
                                                                                handleMarkStatus(app, slot.id, 'shortlisted');
                                                                            }
                                                                        }}
                                                                    >
                                                                        No Show / Unselect
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground/40 border-2 border-dashed border-white/5 rounded-lg">
                                                                <Clock className="w-8 h-8 mb-2 opacity-40" />
                                                                <span className="text-xs">Slot Available</span>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                </div>
                            </motion.div>
                        ))
                    )}
                </motion.div>
            </div>

            {/* Evaluation Dialog */}
            <Dialog open={!!evalApp} onOpenChange={(open) => { if (!open) { setEvalApp(null); setExistingFeedback(null); } }}>
                <DialogContent className="max-w-2xl bg-transparent border-none p-0 shadow-none">
                    {evalApp && (
                        <EvaluationForm
                            application={evalApp}
                            existingFeedback={existingFeedback}
                            onSubmit={handleSubmitEval}
                            onClose={() => { setEvalApp(null); setExistingFeedback(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InterviewerDashboard;
