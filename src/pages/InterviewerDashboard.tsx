
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Application, InterviewFeedback } from '@/types';
import { format, parseISO, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Video, Save, User, ShieldAlert } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';

const InterviewerDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [mySlots, setMySlots] = useState<any[]>([]);
    const [evalApp, setEvalApp] = useState<Application | null>(null);
    const [feedbacks, setFeedbacks] = useState<InterviewFeedback[]>([]);
    const [evalForm, setEvalForm] = useState({ score: 0, comments: '', recommends_committee: false });

    // STRICT ACCESS CONTROL - Only allow authorized roles
    const ALLOWED_ROLES = ['super_admin', 'admin', 'interviewer'];
    const hasAccess = user?.role && ALLOWED_ROLES.includes(user.role);

    useEffect(() => {
        if (!authLoading && user && hasAccess) {
            fetchMySlots();
            fetchFeedbacks();
        }
    }, [user, authLoading, hasAccess]);

    const fetchMySlots = async () => {
        // Find panel assignments for this user
        const { data: assignments } = await supabase
            .from('panel_assignments')
            .select('panel_id, date')
            .eq('interviewer_email', user?.email);

        if (!assignments || assignments.length === 0) return;

        // Fetch slots matching those panels and dates
        const { data: slots, error } = await supabase
            .from('interview_slots')
            .select('*, applications(*)')
            .order('start_time', { ascending: true });

        if (slots) {
            const filtered = slots.filter(slot => {
                const slotDate = format(parseISO(slot.start_time), 'yyyy-MM-dd');
                return assignments.some(a => a.panel_id === slot.panel_id && a.date === slotDate);
            });
            setMySlots(filtered);
        }
    };

    const fetchFeedbacks = async () => {
        const { data } = await supabase.from('interview_feedback').select('*').eq('interviewer_email', user?.email);
        if (data) setFeedbacks(data);
    };

    const submitFeedback = async () => {
        if (!evalApp || !user?.email) return;
        try {
            const payload = {
                application_id: evalApp.id,
                interviewer_email: user.email,
                score: evalForm.score,
                comments: evalForm.comments,
                recommends_committee: evalForm.recommends_committee
            };

            const { error } = await supabase.from('interview_feedback').upsert(payload, { onConflict: 'application_id, interviewer_email' });
            if (error) throw error;

            alert("Feedback saved successfully!");
            setEvalApp(null);
            fetchFeedbacks();
        } catch (error) {
            console.error(error);
            alert("Failed to save feedback.");
        }
    };

    // Group unique dates
    const uniqueDates = Array.from(new Set(mySlots.map(s => format(parseISO(s.start_time), 'yyyy-MM-dd')))).sort();

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    // ACCESS DENIED - Block unauthorized users
    if (!user || !hasAccess) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center p-8 border border-red-500/50 rounded-xl bg-black/40 backdrop-blur-xl">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">
                        You do not have permission to view this page. This area is restricted to authorized interviewers only.
                    </p>
                    <Button onClick={() => navigate('/')} variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-950/30">
                        Return Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-foreground p-6 md:p-12 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold font-heading text-primary bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                            Interviewer Dashboard
                        </h1>
                        <p className="text-muted-foreground">Welcome back, {user?.email}</p>
                    </div>
                </div>

                {uniqueDates.length === 0 ? (
                    <div className="text-center p-12 border border-dashed border-white/10 rounded-xl">
                        <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No Interviews Assigned</h3>
                        <p className="text-muted-foreground">
                            You currently have no interview panels assigned. Please check back later or contact the SuperAdmin.
                        </p>
                    </div>
                ) : (
                    uniqueDates.map(date => (
                        <div key={date} className="space-y-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-purple-500" />
                                {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                            </h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {mySlots.filter(s => isSameDay(parseISO(s.start_time), parseISO(date))).map(slot => {
                                    const app = slot.applications;
                                    const existingFeedback = app ? feedbacks.find(f => f.application_id === app.id) : null;

                                    return (
                                        <Card key={slot.id} className="bg-white/5 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:border-purple-500/50 transition-colors">
                                            <CardHeader className="bg-purple-500/10 border-b border-purple-500/20 pb-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-sm font-bold text-purple-300">
                                                        {format(parseISO(slot.start_time), 'HH:mm')} - {format(parseISO(slot.end_time), 'HH:mm')}
                                                    </span>
                                                    <Badge variant="outline" className="bg-black/40 border-purple-500/30">Panel {slot.panel_id}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-4">
                                                {slot.is_booked && app ? (
                                                    <>
                                                        <div>
                                                            <div className="font-bold text-white text-lg">{app.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{app.roll_number} • {app.primary_dept}</div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            {app.resume_link && (
                                                                <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(app.resume_link, '_blank')}>
                                                                    Resume
                                                                </Button>
                                                            )}
                                                            {/* Gmeet Link Placeholder - usually dynamic or static per interviewer */}
                                                            <Button variant="outline" size="sm" className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                                                <Video className="w-3 h-3 mr-2" /> Join
                                                            </Button>
                                                        </div>

                                                        <Button
                                                            className={`w-full ${existingFeedback ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                                                            onClick={() => {
                                                                setEvalApp({
                                                                    ...app,
                                                                    fullName: app.full_name, // Mapping for compatibility
                                                                    rollNumber: app.roll_number,
                                                                    primaryDept: app.primary_dept
                                                                } as Application);
                                                                setEvalForm({
                                                                    score: existingFeedback?.score || 0,
                                                                    comments: existingFeedback?.comments || '',
                                                                    recommends_committee: existingFeedback?.recommends_committee || false
                                                                });
                                                            }}
                                                        >
                                                            {existingFeedback ? 'Update Feedback' : 'Evaluate Candidate'}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50 border-2 border-dashed border-white/5 rounded-lg">
                                                        <Clock className="w-8 h-8 mb-2 opacity-50" />
                                                        <span className="text-sm">Slot Available</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* EVALUATION DIALOG */}
            <Dialog open={!!evalApp} onOpenChange={(open) => !open && setEvalApp(null)}>
                <DialogContent className="max-w-xl bg-black/90 border-white/10 text-white backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Evaluate Candidate</DialogTitle>
                    </DialogHeader>
                    {evalApp && (
                        <div className="space-y-6">
                            <div className="bg-white/5 p-4 rounded-lg">
                                <h3 className="font-bold text-lg">{evalApp.fullName}</h3>
                                <p className="text-muted-foreground">{evalApp.rollNumber} • {evalApp.primaryDept}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Score (0-10)</label>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="10"
                                            value={evalForm.score}
                                            onChange={e => setEvalForm({ ...evalForm, score: parseInt(e.target.value) })}
                                            className="bg-black/20 w-24 border-white/10"
                                        />
                                        <span className="text-sm text-muted-foreground">/ 10 Points</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Comments & Observations</label>
                                    <Textarea
                                        value={evalForm.comments}
                                        onChange={e => setEvalForm({ ...evalForm, comments: e.target.value })}
                                        className="bg-black/20 border-white/10 min-h-[100px]"
                                        placeholder="Enter key observations..."
                                    />
                                </div>

                                <div className="flex items-center space-x-2 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                                    <Checkbox
                                        id="committee"
                                        checked={evalForm.recommends_committee}
                                        onCheckedChange={(checked) => setEvalForm({ ...evalForm, recommends_committee: checked as boolean })}
                                        className="border-white/20 data-[state=checked]:bg-purple-600"
                                    />
                                    <label
                                        htmlFor="committee"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        Recommend for Committee Member?
                                    </label>
                                </div>
                            </div>

                            <Button onClick={submitFeedback} className="w-full bg-purple-600 hover:bg-purple-700">
                                <Save className="w-4 h-4 mr-2" /> Save Feedback
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InterviewerDashboard;
