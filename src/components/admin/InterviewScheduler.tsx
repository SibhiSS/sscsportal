
import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/lib/supabase';
import { Interview, Application, AdminUser, PanelAssignment, InterviewFeedback } from '@/types';
import { format, addDays, startOfWeek, addMinutes, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Link as LinkIcon, Plus, User, Video, AlertTriangle, Send, Trash2, CheckCircle, Save } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { logAction } from '@/services/auditService';
import { useAuth } from '@/contexts/AuthContext';
import emailjs from '@emailjs/browser';

// CONFIG (Should match Admin.tsx)
const EMAILJS_PUBLIC_KEY = "bj3DbINQas11jOWqr";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwsz5EIGmR_a6Wa1m01Z56DcWefUuZla_rsVI_8ma6N_T90eM3v9CQ89E712zt939oH5w/exec";

const InterviewScheduler = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("my-interviews");

    // Static Admin Emails Fallback (Matches Admin.tsx)
    const ADMIN_EMAILS = [
        'sibhi.s2024@vitstudent.ac.in',
        'sibhis5223@gmail.com',
        'santhosh.v2024d@vitstudent.ac.in',
        'tspradeepkumar@vit.ac.in'
    ];
    const isSuperAdmin = user?.role === 'super_admin' || (user?.email && ADMIN_EMAILS.includes(user.email) && !user?.role);

    // Data State
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [slots, setSlots] = useState<any[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [assignments, setAssignments] = useState<PanelAssignment[]>([]);
    const [feedbacks, setFeedbacks] = useState<InterviewFeedback[]>([]);

    // UI State
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [visiblePanels, setVisiblePanels] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSavingAssignment, setIsSavingAssignment] = useState(false);
    const [isNotifyDialogOpen, setIsNotifyDialogOpen] = useState(false);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

    // Evaluation Modal
    const [evalApp, setEvalApp] = useState<Application | null>(null);
    const [evalForm, setEvalForm] = useState({ score: 0, comments: '', recommends_committee: false });

    // Generator Form
    const [genConfig, setGenConfig] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        duration: 20, // minutes
        panels: 3
    });

    useEffect(() => {
        fetchData();
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }, []);

    const fetchData = async () => {
        fetchCandidates();
        fetchSlots();
        fetchAdmins();
        fetchAssignments();
        fetchFeedbacks();
    };

    const fetchSlots = async () => {
        const { data } = await supabase
            .from('interview_slots')
            .select('*, applications(id, full_name, primary_dept, roll_number)')
            .order('start_time', { ascending: true });
        if (data) setSlots(data);
    };

    const fetchCandidates = async () => {
        const { data } = await supabase
            .from('applications')
            .select('*')
            .in('status', ['shortlisted', 'selected', 'interview_scheduled']);

        if (data) {
            setApplications(data.map((d: any) => ({
                id: d.id,
                fullName: d.full_name,
                primaryDept: d.primary_dept,
                email: d.email,
                rollNumber: d.roll_number,
                phone: d.phone,
                status: d.status,
                domains: d.domains || [],
                shortlistNotified: d.shortlist_notified
            } as Application)));
        }
    };

    const fetchAdmins = async () => {
        const { data } = await supabase.from('admins').select('*');
        if (data) setAdmins(data.map((d: any) => ({ id: d.id, email: d.email, role: d.role } as AdminUser)));
    };

    const fetchAssignments = async () => {
        const { data } = await supabase.from('panel_assignments').select('*');
        if (data) setAssignments(data);
    };

    const fetchFeedbacks = async () => {
        const { data } = await supabase.from('interview_feedback').select('*');
        if (data) setFeedbacks(data);
    };

    // --- Actions ---

    const generateSlots = async () => {
        if (!confirm(`Generate ${genConfig.duration}min slots for ${genConfig.panels} panels from ${genConfig.startTime} to ${genConfig.endTime}? This will add to existing slots.`)) return;

        setIsGenerating(true);
        try {
            const newSlots = [];
            const dateObj = parseISO(genConfig.date);
            let currentTime = setMinutes(setHours(dateObj, parseInt(genConfig.startTime.split(':')[0])), parseInt(genConfig.startTime.split(':')[1]));
            const endTime = setMinutes(setHours(dateObj, parseInt(genConfig.endTime.split(':')[0])), parseInt(genConfig.endTime.split(':')[1]));

            while (addMinutes(currentTime, genConfig.duration) <= endTime) {
                const slotEnd = addMinutes(currentTime, genConfig.duration);
                for (let p = 1; p <= genConfig.panels; p++) {
                    newSlots.push({
                        panel_id: p,
                        start_time: currentTime.toISOString(),
                        end_time: slotEnd.toISOString(),
                        is_booked: false
                    });
                }
                currentTime = slotEnd;
            }

            const { error } = await supabase.from('interview_slots').insert(newSlots);
            if (error) throw error;

            alert(`Successfully generated ${newSlots.length} slots!`);
            fetchSlots();
            if (user?.email) logAction(user.email, 'GENERATE_SLOTS', 'BATCH', { count: newSlots.length, date: genConfig.date });

        } catch (error: any) {
            console.error(error);
            alert("Failed to generate slots.");
        } finally {
            setIsGenerating(false);
        }
    };

    const assignInterviewer = async (panelId: number, email: string) => {
        setIsSavingAssignment(true);
        try {
            // Upsert assignment using uniqueness constraint on (panel_id, date, interviewer_email)?? 
            // Wait, we probably want ONE interviewer per panel per day? Or can multiple exist? 
            // The schema unique constraint I added: UNIQUE(panel_id, date, interviewer_email) allows multiple interviewers per panel. 
            // But usually we assign a specific person. Let's assume M:N is fine.
            // But if we want to "set" the interviewer, we might want to delete previous?
            // For now, let's just insert.
            const { error } = await supabase.from('panel_assignments').upsert({
                panel_id: panelId,
                date: selectedDate,
                interviewer_email: email
            }, { onConflict: 'panel_id, date, interviewer_email' });

            if (error) throw error;
            fetchAssignments();
        } catch (error) {
            console.error("Assignment failed:", error);
            alert("Failed to assign interviewer.");
        } finally {
            setIsSavingAssignment(false);
        }
    };

    const unassignInterviewer = async (id: string) => {
        await supabase.from('panel_assignments').delete().eq('id', id);
        fetchAssignments();
    };

    const updateAssignmentLink = async (id: string, link: string) => {
        try {
            const { error } = await supabase.from('panel_assignments').update({ meeting_link: link }).eq('id', id);
            if (error) throw error;
            fetchAssignments();
        } catch (error) {
            console.error(error);
            alert("Failed to update link.");
        }
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
            setEvalApp(null); // Close modal
            fetchFeedbacks();
        } catch (error) {
            console.error(error);
            alert("Failed to save feedback.");
        }
    };

    const deleteSlot = async (id: string) => {
        if (!confirm("Delete this slot?")) return;
        await supabase.from('interview_slots').delete().eq('id', id);
        fetchSlots();
    };

    const clearAllSlots = async () => {
        if (!confirm("DANGER: This will delete ALL slots. Are you sure?")) return;
        await supabase.from('interview_slots').delete().neq('panel_id', 0);
        fetchSlots();
    };

    const sendBookingLinkBatch = async () => {
        const shortlistedToNotify = applications.filter(app =>
            app.status === 'shortlisted' &&
            selectedCandidateIds.includes(app.id)
        );

        if (shortlistedToNotify.length === 0) {
            alert("No candidates selected to notify.");
            return;
        }

        if (!confirm(`Send interview booking links to ${shortlistedToNotify.length} selected candidates?`)) return;

        setIsSending(true);
        let count = 0;
        try {
            for (const app of shortlistedToNotify) {
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: app.email,
                        subject: "ACTION REQUIRED: Book Your Interview Slot - IEEE SSCS",
                        message: `
                            <div style="font-family: 'Raleway', sans-serif; background-color: #0a0a0a; color: #e5e5e5; max-width: 600px; margin: 0 auto; border: 1px solid #333; border-radius: 8px; overflow: hidden;">
                                <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Raleway:wght@400;600&display=swap" rel="stylesheet">
                                <div style="background-color: #000000; padding: 40px 20px; border-bottom: 2px solid #7c3aed; text-align: center;">
                                    <img src="https://bqtqhtpbyunzcwxyxdhx.supabase.co/storage/v1/object/public/asset/IEEE%20SSCS%20Logo.png" alt="IEEE SSCS Logo" style="height: 100px; width: auto; display: block; margin: 0 auto;">
                                </div>
                                <div style="padding: 40px 30px;">
                                    <h2 style="color: #7c3aed; font-family: 'Orbitron', sans-serif; margin-top: 0; text-transform: uppercase; letter-spacing: 2px;">Shortlisted!</h2>
                                    <p style="font-size: 16px;">Hi <strong>${app.fullName}</strong>,</p>
                                    <p>Congratulations! You have been shortlisted for the next round of IEEE SSCS recruitments.</p>
                                    
                                    <div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #7c3aed;">
                                        <p style="margin: 0; font-size: 14px; color: #fff;"><strong>Next Step:</strong> Book Your Interview Slot</p>
                                        <p style="margin: 5px 0 0; font-size: 13px; color: #888;">Slots are filled on a first-come, first-serve basis.</p>
                                    </div>

                                    <div style="text-align: center; margin: 35px 0;">
                                        <a href="https://IEEESSCS.vercel.app/schedule" style="display: inline-block; background-color: #7c3aed; color: #white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-family: 'Orbitron', sans-serif; text-transform: uppercase;">Book Slot Now</a>
                                    </div>

                                    <p style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">Best regards,<br><strong>IEEE SSCS Team</strong></p>
                                </div>
                                <div style="background-color: #000000; padding: 30px 20px; text-align: center; border-top: 1px solid #333;">
                                    <div style="margin-bottom: 20px;">
                                        <span style="color: #7c3aed; font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 16px; letter-spacing: 2px;">IEEE SSCS</span>
                                        <span style="color: #333; margin: 0 15px;">|</span>
                                        <span style="color: #e5e5e5; font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 16px;">VIT Chennai</span>
                                    </div>
                                </div>
                            </div>
                        `
                    })
                });

                // Update DB flag
                await supabase.from('applications').update({ shortlist_notified: true }).eq('id', app.id);
                count++;
            }
            alert(`Successfully sent booking links to ${count} candidates!`);
            if (user?.email) logAction(user.email, 'SEND_BOOKING_LINKS', 'BATCH', { count, candidateIds: selectedCandidateIds });

            setIsNotifyDialogOpen(false);
            fetchCandidates(); // Refresh list
        } catch (error) {
            console.error(error);
            alert("Failed to send booking emails.");
        } finally {
            setIsSending(false);
        }
    };

    // --- Render Logic ---

    // My Assigned Panels for Selected Date
    const myAssignments = assignments.filter(a =>
        a.interviewer_email === user?.email &&
        isSameDay(parseISO(a.date), parseISO(selectedDate))
    );
    const myPanelIds = myAssignments.map(a => a.panel_id);

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-150px)]">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Interview Management
                </h2>
                <div className="flex items-center gap-4">
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-black/20 border-white/10 text-white w-40"
                    />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="bg-white/5 border border-white/10 w-fit">
                    <TabsTrigger value="my-interviews" className="data-[state=active]:bg-purple-600">My Interviews</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="assignments">Assign Panels</TabsTrigger>}
                    {isSuperAdmin && <TabsTrigger value="slots">Slot Generator</TabsTrigger>}
                </TabsList>

                {/* --- MY INTERVIEWS TAB --- */}
                <TabsContent value="my-interviews" className="flex-1 space-y-6 mt-6 overflow-auto">
                    {myAssignments.length === 0 ? (
                        <div className="text-center p-10 border border-dashed border-white/10 rounded-xl">
                            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No Interviews Scheduled</h3>
                            <p className="text-muted-foreground">
                                You are not assigned to any panels on {format(parseISO(selectedDate), 'MMM d, yyyy')}.
                            </p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myPanelIds.map(panelId => {
                                // Get slots for this panel and date
                                const panelSlots = slots.filter(s =>
                                    s.panel_id === panelId &&
                                    isSameDay(parseISO(s.start_time), parseISO(selectedDate))
                                );

                                return (
                                    <Card key={panelId} className="bg-white/5 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                        <CardHeader className="bg-purple-500/10 border-b border-purple-500/20 pb-3">
                                            <CardTitle className="flex justify-between items-center">
                                                <span>Panel {panelId}</span>
                                                <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                                                    My Panel
                                                </Badge>
                                            </CardTitle>
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Video className="w-3 h-3" />
                                                    <span>Your Meeting Link for Today:</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Enter GMeet Link..."
                                                        className="h-8 bg-black/20 text-xs"
                                                        defaultValue={myAssignments.find(a => a.panel_id === panelId)?.meeting_link || ''}
                                                        onBlur={(e) => {
                                                            const assign = myAssignments.find(a => a.panel_id === panelId);
                                                            if (assign && e.target.value !== (assign.meeting_link || '')) {
                                                                updateAssignmentLink(assign.id, e.target.value);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-white/5">
                                                {panelSlots.length === 0 && <div className="p-4 text-sm text-muted-foreground italic">No slots.</div>}
                                                {panelSlots.map(slot => {
                                                    const app = slot.applications; // joined data
                                                    const existingFeedback = app ? feedbacks.find(f => f.application_id === app.id && f.interviewer_email === user?.email) : null;

                                                    return (
                                                        <div key={slot.id} className="p-4 hover:bg-white/5 transition-colors">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <Badge variant="outline" className="border-white/10 font-mono text-xs">
                                                                    {format(parseISO(slot.start_time), 'HH:mm')}
                                                                </Badge>
                                                                {slot.is_booked ? (
                                                                    <Badge className={`${existingFeedback ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                                        {existingFeedback ? 'Evaluated' : 'Booked'}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="text-muted-foreground opacity-50">Empty</Badge>
                                                                )}
                                                            </div>

                                                            {slot.is_booked && app ? (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <div className="font-bold text-white text-lg">{app.full_name}</div>
                                                                        <div className="text-xs text-muted-foreground">{app.roll_number} • {app.primary_dept}</div>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        className="w-full bg-white/10 hover:bg-white/20 border border-white/10"
                                                                        onClick={() => {
                                                                            setEvalApp(app as Application);
                                                                            setEvalForm({
                                                                                score: existingFeedback?.score || 0,
                                                                                comments: existingFeedback?.comments || '',
                                                                                recommends_committee: existingFeedback?.recommends_committee || false
                                                                            });
                                                                        }}
                                                                    >
                                                                        {existingFeedback ? 'Edit Feedback' : 'Evaluate Candidate'}
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground py-2">Available Slot</div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* --- ASSIGNMENTS TAB (SUPER ADMIN) --- */}
                {isSuperAdmin && (
                    <TabsContent value="assignments" className="flex-1 space-y-6 mt-6">
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>Assign Interviewers</CardTitle>
                                        <CardDescription>Managing assignments for {format(parseISO(selectedDate), 'MMM d, yyyy')}</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                const shortlisted = applications.filter(app => app.status === 'shortlisted');
                                                if (shortlisted.length === 0) {
                                                    alert("No shortlisted candidates found to notify.");
                                                    return;
                                                }
                                                // Default selections: only those NOT already notified
                                                setSelectedCandidateIds(shortlisted.filter(app => !app.shortlistNotified).map(app => app.id));
                                                setIsNotifyDialogOpen(true);
                                            }}
                                            disabled={isSending}
                                            className="bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30"
                                        >
                                            <Send className="w-3 h-3 mr-2" />
                                            Notify Shortlisted
                                        </Button>
                                        <div className="w-[1px] h-6 bg-white/10 mx-2" />
                                        <Button variant="outline" size="sm" onClick={() => setVisiblePanels(Math.max(1, visiblePanels - 1))}><User className="w-3 h-3 mr-2" />Remove Panel</Button>
                                        <Badge variant="secondary" className="text-lg px-4">{visiblePanels} Panels</Badge>
                                        <Button variant="outline" size="sm" onClick={() => setVisiblePanels(visiblePanels + 1)}><Plus className="w-3 h-3 mr-2" />Add Panel</Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Array.from({ length: visiblePanels }, (_, i) => i + 1).map(panelId => {
                                        const panelAssignments = assignments.filter(a =>
                                            a.panel_id === panelId &&
                                            isSameDay(parseISO(a.date), parseISO(selectedDate))
                                        );

                                        return (
                                            <div key={panelId} className="p-4 rounded-xl bg-black/40 border border-white/10">
                                                <h4 className="font-bold text-purple-400 mb-4">PANEL {panelId}</h4>
                                                <div className="space-y-3">
                                                    {panelAssignments.map(assign => (
                                                        <div key={assign.id} className="bg-white/5 p-3 rounded space-y-2">
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="truncate max-w-[150px] font-medium" title={assign.interviewer_email}>{assign.interviewer_email}</span>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10" onClick={() => unassignInterviewer(assign.id)}>
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Video className="w-3 h-3 text-muted-foreground" />
                                                                <Input
                                                                    className="h-7 text-[10px] bg-black/20"
                                                                    placeholder="Link"
                                                                    defaultValue={assign.meeting_link || ''}
                                                                    onBlur={(e) => {
                                                                        if (e.target.value !== (assign.meeting_link || '')) {
                                                                            updateAssignmentLink(assign.id, e.target.value);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="flex gap-2">
                                                        <Select onValueChange={(val) => assignInterviewer(panelId, val)}>
                                                            <SelectTrigger className="h-8 bg-white/5 border-white/10 text-xs">
                                                                <SelectValue placeholder="Add Interviewer" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {admins.length > 0 ? (
                                                                    admins.map(admin => (
                                                                        <SelectItem key={admin.id} value={admin.email}>{admin.email}</SelectItem>
                                                                    ))
                                                                ) : (
                                                                    ADMIN_EMAILS.map(email => (
                                                                        <SelectItem key={email} value={email}>{email}</SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* --- SLOT GENERATOR TAB (SUPER ADMIN) --- */}
                {isSuperAdmin && (
                    <TabsContent value="slots" className="flex-1 space-y-6 mt-6">
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader><CardTitle>Generate Slots</CardTitle></CardHeader>
                            <CardContent className="grid md:grid-cols-5 gap-4 items-end">
                                {/* Generator Inputs */}
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">Date</label>
                                    <Input type="date" value={genConfig.date} onChange={e => setGenConfig({ ...genConfig, date: e.target.value })} className="bg-black/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">Start Time</label>
                                    <Input type="time" value={genConfig.startTime} onChange={e => setGenConfig({ ...genConfig, startTime: e.target.value })} className="bg-black/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">End Time</label>
                                    <Input type="time" value={genConfig.endTime} onChange={e => setGenConfig({ ...genConfig, endTime: e.target.value })} className="bg-black/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">Duration (mins)</label>
                                    <Input type="number" value={genConfig.duration} onChange={e => setGenConfig({ ...genConfig, duration: parseInt(e.target.value) })} className="bg-black/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">No. of Panels</label>
                                    <Input type="number" value={genConfig.panels} onChange={e => setGenConfig({ ...genConfig, panels: parseInt(e.target.value) })} className="bg-black/20" />
                                </div>
                                <Button onClick={generateSlots} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700">
                                    {isGenerating ? <LogoSpinner size="sm" /> : 'Generate'}
                                </Button>
                            </CardContent>
                        </Card>
                        <div className="flex justify-end">
                            <Button variant="destructive" size="sm" onClick={clearAllSlots}><Trash2 className="w-4 h-4 mr-2" />Clear All Slots</Button>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4 overflow-auto max-h-[500px]">
                            {Array.from({ length: visiblePanels }, (_, i) => i + 1).map(panelId => {
                                const panelSlots = slots.filter(s => s.panel_id === panelId && isSameDay(parseISO(s.start_time), new Date(genConfig.date)));
                                return (
                                    <Card key={panelId} className="bg-white/5 border-white/10 h-fit">
                                        <CardHeader className="py-3"><CardTitle className="text-sm font-mono text-purple-400">PANEL {panelId}</CardTitle></CardHeader>
                                        <CardContent className="space-y-1 p-3">
                                            {panelSlots.map(slot => (
                                                <div key={slot.id} className={`flex justify-between p-2 rounded text-xs border ${slot.is_booked ? 'bg-green-900/20 border-green-800' : 'bg-black/20 border-white/5'}`}>
                                                    <span>{format(parseISO(slot.start_time), 'HH:mm')}</span>
                                                    {!slot.is_booked && <Trash2 className="w-3 h-3 text-red-500 cursor-pointer" onClick={() => deleteSlot(slot.id)} />}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </TabsContent>
                )}
            </Tabs>

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

            {/* NOTIFY SHORTLISTED DIALOG */}
            <Dialog open={isNotifyDialogOpen} onOpenChange={setIsNotifyDialogOpen}>
                <DialogContent className="max-w-2xl bg-black border-white/10 text-white max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Send className="w-5 h-5 text-purple-500" />
                            Notify Shortlisted Candidates
                        </DialogTitle>
                        <CardDescription className="text-muted-foreground mt-2">
                            Select the candidates you want to send the interview booking email to.
                            Candidates already notified are unselected by default.
                        </CardDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto my-4 border border-white/5 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5 sticky top-0 z-10 border-b border-white/10">
                                <tr>
                                    <th className="p-3 text-left w-12">
                                        <Checkbox
                                            checked={
                                                selectedCandidateIds.length === applications.filter(app => app.status === 'shortlisted').length &&
                                                selectedCandidateIds.length > 0
                                            }
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedCandidateIds(applications.filter(app => app.status === 'shortlisted').map(app => app.id));
                                                } else {
                                                    setSelectedCandidateIds([]);
                                                }
                                            }}
                                            className="border-white/20 data-[state=checked]:bg-purple-600"
                                        />
                                    </th>
                                    <th className="p-3 text-left font-medium text-muted-foreground">Candidate</th>
                                    <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {applications.filter(app => app.status === 'shortlisted').map(app => (
                                    <tr key={app.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-3">
                                            <Checkbox
                                                checked={selectedCandidateIds.includes(app.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedCandidateIds([...selectedCandidateIds, app.id]);
                                                    } else {
                                                        setSelectedCandidateIds(selectedCandidateIds.filter(id => id !== app.id));
                                                    }
                                                }}
                                                className="border-white/20 data-[state=checked]:bg-purple-600"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="font-medium text-white group-hover:text-purple-400 transition-colors">
                                                {app.fullName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{app.rollNumber} • {app.primaryDept}</div>
                                        </td>
                                        <td className="p-3 text-right">
                                            {app.shortlistNotified ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] uppercase">
                                                    Email Sent
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px] uppercase">
                                                    Not Notified
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10 mt-2">
                        <div className="text-sm text-muted-foreground">
                            <span className="text-purple-400 font-bold">{selectedCandidateIds.length}</span> candidates selected
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setIsNotifyDialogOpen(false)} disabled={isSending}>
                                Cancel
                            </Button>
                            <Button
                                onClick={sendBookingLinkBatch}
                                disabled={isSending || selectedCandidateIds.length === 0}
                                className="bg-purple-600 hover:bg-purple-700 font-bold min-w-[150px]"
                            >
                                {isSending ? (
                                    <>
                                        <LogoSpinner size="sm" className="mr-2" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Send Notification
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InterviewScheduler;
