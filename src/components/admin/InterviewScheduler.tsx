
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
import { Label } from "@/components/ui/label";
import { supabase } from '@/lib/supabase';
import { Interview, Application, AdminUser, PanelAssignment, InterviewFeedback, PanelMetadata } from '@/types';
import { format, addDays, startOfWeek, addMinutes, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Link as LinkIcon, Plus, User, Video, AlertTriangle, Send, Trash2, CheckCircle, Save, ShieldCheck } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { logAction } from '@/services/auditService';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import HolographicCard from '@/components/ui/HolographicCard';
import { motion, AnimatePresence } from 'framer-motion';
import EvaluationForm from '@/components/interviewer/EvaluationForm';
import { submitEvaluation } from '@/services/interviewService';



const InterviewScheduler = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("my-interviews");

    // Static Admin Emails Fallback (Matches Admin.tsx)
    const ADMIN_EMAILS = [
        'sibhi.s2024@vitstudent.ac.in',
        'sibhis5223@gmail.com'
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
    const [panelMetadata, setPanelMetadata] = useState<PanelMetadata[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSavingAssignment, setIsSavingAssignment] = useState(false);
    const [isNotifyDialogOpen, setIsNotifyDialogOpen] = useState(false);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

    // Evaluation Modal
    const [evalApp, setEvalApp] = useState<Application | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
    }, []);

    const fetchData = async () => {
        fetchCandidates();
        fetchSlots();
        fetchAdmins();
        fetchAssignments();
        fetchFeedbacks();
        fetchPanelMetadata();
    };

    const fetchPanelMetadata = async () => {
        const { data } = await supabase.from('panel_metadata').select('*');
        if (data) setPanelMetadata(data as PanelMetadata[]);
    };

    const fetchSlots = async () => {
        const { data } = await supabase
            .from('interview_slots')
            .select('*, applications(*)')
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
            alert("Failed to generate slots: " + (error?.message || JSON.stringify(error)));
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
            // Get assignment details before updating
            const assignment = assignments.find(a => a.id === id);
            const { error } = await supabase.from('panel_assignments').update({ meeting_link: link }).eq('id', id);
            if (error) throw error;
            fetchAssignments();

            // Send meeting link email to any booked candidate on this panel
            if (link.trim() && assignment) {
                const { data: bookedSlots } = await supabase
                    .from('interview_slots')
                    .select('booked_by, start_time, applications(full_name, email, primary_dept)')
                    .eq('panel_id', assignment.panel_id)
                    .eq('is_booked', true)
                    .gte('start_time', `${assignment.date}T00:00:00`)
                    .lte('start_time', `${assignment.date}T23:59:59`);

                if (bookedSlots && bookedSlots.length > 0) {
                    for (const slot of bookedSlots) {
                        const app = (slot as any).applications;
                        if (!app?.email) continue;
                        const slotTime = format(parseISO(slot.start_time), 'h:mm a');
                        const slotDate = format(parseISO(slot.start_time), 'EEEE, MMMM d, yyyy');
                        try {
                            const portalUrl = window.location.origin;
                            await sendEmail(
                                app.email,
                                'Your Interview Meeting Link - IEEE SSCS',
                                `<p>Dear <strong>${app.full_name}</strong>,</p>
                                <p>Your interview meeting link is ready.</p>
                                <p><strong>Date:</strong> ${slotDate}<br>
                                <strong>Time:</strong> ${slotTime}<br>
                                <strong>Department:</strong> ${app.primary_dept}</p>
                                <p><strong>Join your interview:</strong> <a href="${link}">${link}</a></p>
                                <p>You can also check your status at: <a href="${portalUrl}/apply">${portalUrl}/apply</a></p>
                                <p>Please join 5 minutes before your slot.<br>IEEE SSCS Recruitment Team</p>`
                            );
                        } catch (e) {
                            console.warn(`Failed to send link email to ${app.email}:`, e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
            alert('Failed to update link.');
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
                const portalUrl = window.location.origin;
                await sendEmail(
                    app.email,
                    `Action Required: Book Your Interview Slot - IEEE SSCS [${app.fullName}]`,
                    `<p>Dear <strong>${app.fullName}</strong>,</p>
                    <p>Congratulations! Your application for IEEE SSCS has been shortlisted for an interview.</p>
                    <p>Please click the button below to choose your preferred interview time slot:</p>
                    <p style="margin: 20px 0;">
                        <a href="${portalUrl}/schedule" style="background-color: #dc143c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Book Interview Slot</a>
                    </p>
                    <p>Direct Link: <a href="${portalUrl}/schedule">${portalUrl}/schedule</a></p>
                    <p><em>Note: Slots are allocated on a first-come, first-served basis.</em></p>
                    <p>Best regards,<br>IEEE SSCS Recruitment Team</p>`
                );

                // Update DB flag
                await supabase.from('applications').update({ shortlist_notified: true }).eq('id', app.id);
                count++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit protection
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

    // Compute active panels for selected date
    const activePanelIdsForDate = React.useMemo(() => {
        const slotsForDate = slots.filter(s => isSameDay(parseISO(s.start_time), parseISO(selectedDate)));
        return Array.from(new Set(slotsForDate.map(s => s.panel_id))).sort((a, b) => a - b);
    }, [slots, selectedDate]);

    // Compute active panels for generator date
    const activePanelIdsForGenDate = React.useMemo(() => {
        const slotsForDate = slots.filter(s => isSameDay(parseISO(s.start_time), parseISO(genConfig.date)));
        return Array.from(new Set(slotsForDate.map(s => s.panel_id))).sort((a, b) => a - b);
    }, [slots, genConfig.date]);

    const updatePanelName = async (panelId: number, name: string) => {
        if (!name.trim()) return;
        try {
            const { error } = await supabase.from('panel_metadata').upsert({
                panel_id: panelId,
                date: selectedDate,
                panel_name: name.trim()
            }, { onConflict: 'panel_id, date' });
            if (error) throw error;
            fetchPanelMetadata();
        } catch (error) {
            console.error("Failed to update panel name", error);
        }
    };

    return (
        <div className="space-y-10">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-bold font-heading tracking-tight mb-2">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-primary/50">
                            Interview Management
                        </span>
                    </h2>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm uppercase tracking-widest font-bold opacity-60">
                        <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                        Scheduling Engine • {slots.filter(s => s.is_booked).length} Active Sessions
                    </p>
                </div>
                
                <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-xl group">
                    <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                        View Date
                    </div>
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-white/5 border-white/10 text-white w-44 h-10 rounded-xl focus:ring-primary/20 focus:border-primary/40 font-mono text-xs"
                    />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-start mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    <TabsList className="bg-white/5 border border-white/10 p-1 h-auto backdrop-blur-xl rounded-2xl">
                        <TabsTrigger 
                            value="my-interviews" 
                            className="px-6 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all text-xs font-bold tracking-wider"
                        >
                            <User className="w-4 h-4 mr-2" />
                            MY INTERVIEWS
                        </TabsTrigger>
                        {isSuperAdmin && (
                            <>
                                <TabsTrigger 
                                    value="assignments" 
                                    className="px-6 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all text-xs font-bold tracking-wider"
                                >
                                    <ShieldCheck className="w-4 h-4 mr-2" />
                                    ASSIGN PANELS
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="slots" 
                                    className="px-6 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all text-xs font-bold tracking-wider"
                                >
                                    <Clock className="w-4 h-4 mr-2" />
                                    SLOT GENERATOR
                                </TabsTrigger>
                            </>
                        )}
                    </TabsList>
                </div>

                {/* --- MY INTERVIEWS TAB --- */}
                <TabsContent value="my-interviews" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {myAssignments.length === 0 ? (
                        <HolographicCard className="p-20 text-center border-dashed border-white/10">
                            <div className="max-w-xs mx-auto space-y-4">
                                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                                    <CalendarIcon className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-bold text-white tracking-tight">No Interviews Scheduled</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    You have not been assigned to any panels for {format(parseISO(selectedDate), 'MMMM do')}.
                                </p>
                            </div>
                        </HolographicCard>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                            {myPanelIds.map(panelId => {
                                const panelSlots = slots.filter(s =>
                                    s.panel_id === panelId &&
                                    isSameDay(parseISO(s.start_time), parseISO(selectedDate))
                                );

                                return (
                                    <HolographicCard key={panelId} className="flex flex-col border-primary/20 overflow-hidden group">
                                        <div className="p-6 bg-primary/5 border-b border-primary/10 relative overflow-hidden">
                                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 rounded-full blur-3xl"></div>
                                            <div className="flex justify-between items-center relative z-10">
                                                <div>
                                                    <h4 className="text-xl font-heading font-bold text-white mb-1">
                                                        {panelMetadata.find(p => p.panel_id === panelId && isSameDay(parseISO(p.date), parseISO(selectedDate)))?.panel_name || `Panel ${panelId}`}
                                                    </h4>
                                                    <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">{panelSlots.length} Total Slots</p>
                                                </div>
                                                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                                                    ACTIVE
                                                </Badge>
                                            </div>

                                            <div className="mt-6 space-y-2 relative z-10">
                                                <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Session Link</Label>
                                                <div className="flex gap-2 items-center">
                                                    <div className="text-xs font-mono bg-black/40 border border-white/5 px-3 py-2 rounded-lg flex-1 truncate text-zinc-300">
                                                        {myAssignments.find(a => a.panel_id === panelId)?.meeting_link || 'No virtual link assigned yet'}
                                                    </div>
                                                    {myAssignments.find(a => a.panel_id === panelId)?.meeting_link && (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-3 bg-primary text-white hover:bg-primary/90 text-xs font-bold shrink-0"
                                                            onClick={() => {
                                                                const link = myAssignments.find(a => a.panel_id === panelId)?.meeting_link;
                                                                if (link) window.open(link, '_blank');
                                                            }}
                                                        >
                                                            <Video className="w-3.5 h-3.5 mr-1" />
                                                            Join
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-auto max-h-[400px] scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                                            <div className="divide-y divide-white/5">
                                                {panelSlots.length === 0 && <div className="p-10 text-center text-xs text-muted-foreground uppercase tracking-widest font-medium opacity-40">No slots available</div>}
                                                {panelSlots.map(slot => {
                                                    const app = slot.applications;
                                                    const existingFeedback = app ? feedbacks.find(f => f.application_id === app.id && f.interviewer_email === user?.email) : null;

                                                    return (
                                                        <div key={slot.id} className={`p-5 transition-all duration-300 ${slot.is_booked ? 'bg-white/[0.02]' : 'hover:bg-white/[0.04]'}`}>
                                                            <div className="flex justify-between items-center mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(220,20,60,0.5)]"></div>
                                                                    <span className="font-mono text-sm font-bold text-white tracking-tighter">
                                                                        {format(parseISO(slot.start_time), 'HH:mm')} — {format(parseISO(slot.end_time), 'HH:mm')}
                                                                    </span>
                                                                </div>
                                                                {slot.is_booked ? (
                                                                    <Badge className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${existingFeedback ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                                        {existingFeedback ? 'COMPLETED' : 'UPCOMING'}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-muted-foreground tracking-[0.2em] uppercase opacity-40">Available</span>
                                                                )}
                                                            </div>

                                                            {slot.is_booked && app ? (
                                                                <div 
                                                                    className="space-y-4 animate-in slide-in-from-right-2 duration-300 cursor-pointer group-hover:bg-white/5 p-2 rounded-xl transition-all"
                                                                    onClick={() => {
                                                                        const mappedApp: Application = {
                                                                            ...app,
                                                                            fullName: app.full_name || app.fullName,
                                                                            rollNumber: app.roll_number || app.rollNumber,
                                                                            primaryDept: app.primary_dept || app.primaryDept,
                                                                        } as any;
                                                                        setEvalApp(mappedApp);
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div className="font-heading text-sm text-white group-hover:text-primary transition-colors">{app.full_name || app.fullName}</div>
                                                                        <div className="text-[10px] text-muted-foreground font-mono mt-1 opacity-70 uppercase tracking-tighter">{app.roll_number || app.rollNumber} • {app.primary_dept || app.primaryDept}</div>
                                                                        <div className="text-[10px] text-primary mt-2 font-bold tracking-widest uppercase">
                                                                            {existingFeedback ? <><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" /> View/Edit Evaluation</> : 'Click to Evaluate'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="py-2">
                                                                    <div className="h-1 w-full bg-white/5 rounded-full"></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </HolographicCard>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* --- ASSIGNMENTS TAB (SUPER ADMIN) --- */}
                {isSuperAdmin && (
                    <TabsContent value="assignments" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <HolographicCard className="p-8 border-white/5 overflow-visible">
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-10">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold font-heading text-white">Assignment Control</h3>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">Deploying panels for {format(parseISO(selectedDate), 'MMMM do, yyyy')}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={() => {
                                            const shortlisted = applications.filter(app => app.status === 'shortlisted');
                                            if (shortlisted.length === 0) {
                                                alert("No shortlisted candidates found to notify.");
                                                return;
                                            }
                                            setSelectedCandidateIds(shortlisted.filter(app => !app.shortlistNotified).map(app => app.id));
                                            setIsNotifyDialogOpen(true);
                                        }}
                                        disabled={isSending}
                                        className="rounded-2xl bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 h-12 px-6 font-bold tracking-widest text-xs uppercase transition-all shadow-lg shadow-primary/5"
                                    >
                                        <Send className="w-4 h-4 mr-2" />
                                        NOTIFY SHORTLISTED
                                    </Button>
                                    
                                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 h-12">
                                        <div className="px-4 py-2 text-sm font-heading font-bold text-white min-w-[120px] text-center border-white/10">
                                            {activePanelIdsForDate.length} ACTIVE PANELS
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                <AnimatePresence mode="popLayout">
                                    {activePanelIdsForDate.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-2xl">
                                            No slots have been generated for {format(parseISO(selectedDate), 'MMM do')} yet. Generate slots first.
                                        </div>
                                    )}
                                    {activePanelIdsForDate.map(panelId => {
                                        const panelAssignments = assignments.filter(a =>
                                            a.panel_id === panelId &&
                                            isSameDay(parseISO(a.date), parseISO(selectedDate))
                                        );

                                        return (
                                            <motion.div
                                                key={panelId}
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 backdrop-blur-xl relative group/panel hover:border-primary/30 transition-all duration-500"
                                            >
                                                <div className="flex justify-between items-center mb-6">
                                                    <Input
                                                        defaultValue={panelMetadata.find(p => p.panel_id === panelId && isSameDay(parseISO(p.date), parseISO(selectedDate)))?.panel_name || `PANEL ${panelId}`}
                                                        onBlur={(e) => updatePanelName(panelId, e.target.value)}
                                                        className="h-8 w-40 px-2 text-sm font-heading font-bold text-white tracking-widest uppercase bg-transparent border-transparent hover:border-white/20 focus:border-primary/50"
                                                        placeholder={`PANEL ${panelId}`}
                                                    />
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                                        <User className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-6">
                                                    <div className="relative flex-1">
                                                        <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                                        <Input
                                                            className="h-8 pl-8 pr-3 text-[10px] bg-black/40 border-white/5 rounded-lg focus:border-primary/40"
                                                            placeholder="Set Panel Meeting Link..."
                                                            defaultValue={panelAssignments[0]?.meeting_link || ''}
                                                            id={`panel-link-input-${panelId}`}
                                                        />
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 shrink-0 font-bold"
                                                        onClick={async () => {
                                                            const inputEl = document.getElementById(`panel-link-input-${panelId}`) as HTMLInputElement;
                                                            if (inputEl && panelAssignments.length > 0) {
                                                                for (const assign of panelAssignments) {
                                                                    await updateAssignmentLink(assign.id, inputEl.value);
                                                                }
                                                                alert("Panel meeting link saved and emailed to booked candidates!");
                                                            } else if (panelAssignments.length === 0) {
                                                                alert("Please assign an interviewer to this panel first.");
                                                            }
                                                        }}
                                                    >
                                                        <Send className="w-3 h-3 mr-1" />
                                                        Send Link
                                                    </Button>
                                                </div>

                                                <div className="space-y-3">
                                                    {panelAssignments.map(assign => (
                                                        <div key={assign.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center group/assign">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-[11px] font-bold text-white truncate uppercase tracking-tighter" title={assign.interviewer_email}>
                                                                    {assign.interviewer_email.split('@')[0]}
                                                                </div>
                                                                <div className="text-[9px] text-muted-foreground truncate opacity-60">{assign.interviewer_email}</div>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-assign:opacity-100 transition-opacity" 
                                                                onClick={() => unassignInterviewer(assign.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}

                                                    <div className="pt-2">
                                                        <Select onValueChange={(val) => assignInterviewer(panelId, val)}>
                                                            <SelectTrigger className="h-10 bg-white/5 border-dashed border-white/10 hover:border-primary/30 rounded-2xl text-[10px] font-bold tracking-widest transition-all">
                                                                <div className="flex items-center gap-2">
                                                                    <Plus className="w-3 h-3 text-primary" />
                                                                    <span>ADD INTERVIEWER</span>
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-zinc-900 border-white/10 backdrop-blur-xl">
                                                                {admins.length > 0 ? (
                                                                    admins.map(admin => (
                                                                        <SelectItem key={admin.id} value={admin.email} className="text-xs">{admin.email}</SelectItem>
                                                                    ))
                                                                ) : (
                                                                    ADMIN_EMAILS.map(email => (
                                                                        <SelectItem key={email} value={email} className="text-xs">{email}</SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        </HolographicCard>
                    </TabsContent>
                )}

                {/* --- SLOT GENERATOR TAB (SUPER ADMIN) --- */}
                {isSuperAdmin && (
                    <TabsContent value="slots" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <HolographicCard className="p-10 border-white/5">
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10 mb-12">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold font-heading text-white">Batch Generator</h3>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">Automated Slot Allocation Engine</p>
                                </div>
                                <div className="flex gap-4">
                                    <Button variant="outline" onClick={clearAllSlots} className="h-12 px-6 rounded-2xl bg-destructive/5 border-destructive/20 text-destructive hover:bg-destructive/10 font-bold tracking-widest text-xs uppercase">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        PURGE ALL SLOTS
                                    </Button>
                                    <Button onClick={generateSlots} disabled={isGenerating} className="h-12 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold tracking-[0.2em] uppercase text-[10px] shadow-lg shadow-primary/20">
                                        {isGenerating ? <LogoSpinner size="sm" /> : 'GENERATE MATRIX'}
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Target Date</Label>
                                    <Input type="date" value={genConfig.date} onChange={e => setGenConfig({ ...genConfig, date: e.target.value })} className="h-12 bg-white/5 border-white/5 rounded-xl font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Start Time</Label>
                                    <Input type="time" value={genConfig.startTime} onChange={e => setGenConfig({ ...genConfig, startTime: e.target.value })} className="h-12 bg-white/5 border-white/5 rounded-xl font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">End Time</Label>
                                    <Input type="time" value={genConfig.endTime} onChange={e => setGenConfig({ ...genConfig, endTime: e.target.value })} className="h-12 bg-white/5 border-white/5 rounded-xl font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Unit Duration</Label>
                                    <div className="relative">
                                        <Input type="number" value={genConfig.duration} onChange={e => setGenConfig({ ...genConfig, duration: parseInt(e.target.value) })} className="h-12 bg-white/5 border-white/5 rounded-xl font-mono text-xs pr-12" />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">MIN</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Panel Count</Label>
                                    <Input type="number" value={genConfig.panels} onChange={e => setGenConfig({ ...genConfig, panels: parseInt(e.target.value) })} className="h-12 bg-white/5 border-white/5 rounded-xl font-mono text-xs" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 overflow-auto max-h-[600px] p-2 scrollbar-thin scrollbar-thumb-white/10">
                                {activePanelIdsForGenDate.map(panelId => {
                                    const panelSlots = slots.filter(s => s.panel_id === panelId && isSameDay(parseISO(s.start_time), new Date(genConfig.date)));
                                    return (
                                        <div key={panelId} className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[10px] font-heading font-bold text-primary tracking-widest uppercase">
                                                    {panelMetadata.find(p => p.panel_id === panelId && isSameDay(parseISO(p.date), parseISO(genConfig.date)))?.panel_name || `PANEL ${panelId}`}
                                                </div>
                                                <Badge variant="outline" className="text-[8px] border-white/5 text-muted-foreground">{panelSlots.length}</Badge>
                                            </div>
                                            <div className="space-y-2">
                                                {panelSlots.map(slot => (
                                                    <div key={slot.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${slot.is_booked ? 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5' : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
                                                        <span className={`text-[11px] font-mono font-bold ${slot.is_booked ? 'text-primary' : 'text-zinc-400'}`}>{format(parseISO(slot.start_time), 'HH:mm')}</span>
                                                        {!slot.is_booked && (
                                                            <button onClick={() => deleteSlot(slot.id)} className="text-muted-foreground hover:text-primary transition-colors">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {panelSlots.length === 0 && <div className="py-10 text-center text-[9px] text-muted-foreground/30 uppercase tracking-widest font-bold">Matrix Empty</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </HolographicCard>
                    </TabsContent>
                )}
            </Tabs>

            {/* EVALUATION DIALOG */}
            <AnimatePresence>
                {evalApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setEvalApp(null)}
                        />
                        <div className="relative z-10 w-full max-w-2xl">
                            <EvaluationForm
                                application={evalApp}
                                existingFeedback={feedbacks.find(f => f.application_id === evalApp.id && f.interviewer_email === user?.email) || null}
                                onSubmit={async (payload) => {
                                    if (!user?.email) return;
                                    setIsSubmitting(true);
                                    await submitEvaluation({
                                        application_id: evalApp.id,
                                        interviewer_email: user.email,
                                        ...payload,
                                    });
                                    setEvalApp(null);
                                    setIsSubmitting(false);
                                    fetchFeedbacks();
                                }}
                                onClose={() => setEvalApp(null)}
                                readOnly={false}
                            />
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* NOTIFY SHORTLISTED DIALOG */}
            <Dialog open={isNotifyDialogOpen} onOpenChange={setIsNotifyDialogOpen}>
                <DialogContent className="max-w-2xl bg-zinc-950/90 border-white/10 text-white backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex flex-col p-0 h-[85vh]">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-40"></div>
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-bold font-heading flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Send className="w-6 h-6 text-primary" />
                                </div>
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                                    Broadcast Call
                                </span>
                            </DialogTitle>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-bold mt-4 opacity-50 px-1">
                                Selecting candidates for automated interview booking dispatch
                            </p>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-auto mx-8 my-4 border border-white/5 rounded-3xl bg-white/[0.02] backdrop-blur-sm scrollbar-thin scrollbar-thumb-white/10">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 sticky top-0 z-20 backdrop-blur-md">
                                <tr>
                                    <th className="p-5 w-16">
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
                                            className="border-white/20 data-[state=checked]:bg-primary"
                                        />
                                    </th>
                                    <th className="p-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Candidate Profile</th>
                                    <th className="p-5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Transmission Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {applications.filter(app => app.status === 'shortlisted').map(app => (
                                    <tr key={app.id} className="hover:bg-white/[0.03] transition-all group">
                                        <td className="p-5">
                                            <Checkbox
                                                checked={selectedCandidateIds.includes(app.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedCandidateIds([...selectedCandidateIds, app.id]);
                                                    } else {
                                                        setSelectedCandidateIds(selectedCandidateIds.filter(id => id !== app.id));
                                                    }
                                                }}
                                                className="border-white/20 data-[state=checked]:bg-primary"
                                            />
                                        </td>
                                        <td className="p-5">
                                            <div className="font-heading text-sm text-white group-hover:text-primary transition-colors">
                                                {app.fullName}
                                            </div>
                                            <div className="text-[10px] font-mono text-muted-foreground mt-1 opacity-50 uppercase tracking-tighter">
                                                {app.rollNumber} • {app.primaryDept}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            {app.shortlistNotified ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg">
                                                    NOTIFIED
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg">
                                                    PENDING
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {applications.filter(app => app.status === 'shortlisted').length === 0 && (
                            <div className="py-20 text-center space-y-4">
                                <div className="text-muted-foreground/30 font-heading text-xs uppercase tracking-widest">Zero Candidates Found</div>
                                <p className="text-[10px] text-muted-foreground max-w-xs mx-auto opacity-40">No applications currently reside in the "shortlisted" state.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-8 pt-4">
                        <div className="flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 rounded-[2rem] border border-white/5 gap-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-40 mb-1">Queue Size</span>
                                <span className="text-xl font-heading font-bold text-white">
                                    <span className="text-primary">{selectedCandidateIds.length}</span> Ready for dispatch
                                </span>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setIsNotifyDialogOpen(false)} 
                                    disabled={isSending}
                                    className="flex-1 md:flex-none h-14 px-8 rounded-2xl font-bold tracking-widest text-[10px] uppercase hover:bg-white/5"
                                >
                                    ABORT
                                </Button>
                                <Button
                                    onClick={sendBookingLinkBatch}
                                    disabled={isSending || selectedCandidateIds.length === 0}
                                    className="flex-1 md:flex-none h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold tracking-[0.2em] uppercase text-[10px] shadow-xl shadow-primary/30 min-w-[220px]"
                                >
                                    {isSending ? (
                                        <>
                                            <LogoSpinner size="sm" className="mr-3" />
                                            TRANSMITTING...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-3" />
                                            INITIALIZE BROADCAST
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InterviewScheduler;
