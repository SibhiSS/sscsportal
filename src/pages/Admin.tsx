import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ShieldAlert, Eye, Star, ArrowUpDown } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { useAuth } from '@/contexts/AuthContext';
import HolographicCard from '@/components/ui/HolographicCard';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';

import { Application, RecruitmentPhase } from '@/types';
import AdminStats from '@/components/admin/AdminStats';
import AdminToolbar from '@/components/admin/AdminToolbar';
import ApplicationModal from '@/components/admin/ApplicationModal';
import AdminSettings from '@/components/admin/AdminSettings';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import InterviewScheduler from '@/components/admin/InterviewScheduler';
import { logAction } from '@/services/auditService';

// EMAILJS CONFIGURATION - PLEASE REPLACE WITH YOUR ACTUAL CREDENTIALS
const EMAILJS_SERVICE_ID = "service_32a77yo";
const EMAILJS_TEMPLATE_ID = "template_5p399mj";
const EMAILJS_PUBLIC_KEY = "bj3DbINQas11jOWqr";

// GOOGLE SCRIPT CONFIGURATION (New SMTP Method)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwsz5EIGmR_a6Wa1m01Z56DcWefUuZla_rsVI_8ma6N_T90eM3v9CQ89E712zt939oH5w/exec";

const Admin = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [programFilter, setProgramFilter] = useState('ALL');
    const [yearFilter, setYearFilter] = useState('ALL');
    const [currentPhase, setCurrentPhase] = useState<RecruitmentPhase>('APPLICATIONS_OPEN');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Application; direction: 'asc' | 'desc' } | null>(null);

    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const ADMIN_EMAILS = [
        'sibhi.s2024@vitstudent.ac.in',
        'sibhis5223@gmail.com',
        'santhosh.v2024d@vitstudent.ac.in',
        'tspradeepkumar@vit.ac.in'
    ];

    useEffect(() => {
        // Initialize EmailJS
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            return;
        }

        // Allow access if user has a role OR is in the legacy email list (fallback)
        const hasAccess = user?.role || (user?.email && ADMIN_EMAILS.includes(user.email));

        if (hasAccess) {
            fetchApplications();
            fetchPhase();
        }
    }, [user, authLoading]);

    const fetchPhase = async () => {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'recruitment_status').single();
        if (data && data.value.currentPhase) {
            setCurrentPhase(data.value.currentPhase);
        }
    };

    const fetchApplications = async () => {
        try {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const apps: Application[] = (data || []).map((doc: any) => ({
                id: doc.id,
                fullName: doc.full_name,
                email: doc.email,
                rollNumber: doc.roll_number,
                phone: doc.phone,
                year: doc.year,
                department: doc.department,

                primaryDept: doc.primary_dept,
                domains: doc.domains || [],
                skills: doc.skills || '',
                reason: doc.reason || '',

                secondaryDept: doc.secondary_dept || '',
                secondaryDomains: doc.secondary_domains || [],
                secondarySkills: doc.secondary_skills || '',
                secondaryReason: doc.secondary_reason || '',

                submittedAt: doc.created_at,
                status: doc.status || 'pending',
                rating: doc.rating || 0,
                notes: doc.notes || '',

                // Derived
                admissionYear: doc.admission_year,
                programCode: doc.program_code,
                programName: doc.program_name,
                batch: doc.batch,
                programCategory: doc.program_category
            }));

            setApplications(apps);
        } catch (error) {
            console.error("Error fetching documents: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateApplication = async (id: string, updates: Partial<Application>) => {
        try {
            // Optimistic update
            setApplications(prev => prev.map(app =>
                app.id === id ? { ...app, ...updates } : app
            ));
            if (selectedApp && selectedApp.id === id) {
                setSelectedApp(prev => prev ? { ...prev, ...updates } : null);
            }

            const dbUpdates: any = {};
            if (updates.status) dbUpdates.status = updates.status;
            if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
            if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

            const { error } = await supabase
                .from('applications')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;

            // Log the action
            if (user?.email) {
                await logAction(user.email, 'UPDATE_APPLICATION', id, updates);
            }
        } catch (error) {
            console.error("Error updating application:", error);
            alert("Failed to update application. Please try again.");
            fetchApplications(); // Revert
        }
    };

    const deleteApplication = async (id: string) => {
        // Double check for safety
        const isSuperAdmin = user?.role === 'super_admin' || (user?.email && ADMIN_EMAILS.includes(user.email) && !user?.role);
        if (!isSuperAdmin) {
            alert("Only Super Admins can delete applications.");
            return;
        }

        if (!confirm("Are you sure you want to delete this application? This action cannot be undone.")) {
            return;
        }

        try {
            const { error } = await supabase
                .from('applications')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setApplications(prev => prev.filter(app => app.id !== id));
            if (selectedApp?.id === id) {
                setSelectedApp(null);
            }

            if (user?.email) {
                await logAction(user.email, 'DELETE_APPLICATION', id, { deleted: true });
            }
        } catch (error) {
            console.error("Error deleting application:", error);
            alert("Failed to delete application. Please try again.");
        }
    };

    const publishResults = async () => {
        const shortlistedApps = applications.filter(app => app.status === 'shortlisted');
        const rejectedPendingApps = applications.filter(app => app.status === 'rejected_pending');

        if (shortlistedApps.length === 0 && rejectedPendingApps.length === 0) {
            alert("No applications are pending publication (Shortlisted or Rejected Pending).");
            return;
        }

        if (!confirm(`Are you sure you want to publish results?\n\nThis will:\n- Send acceptance emails to ${shortlistedApps.length} shortlisted applicants\n- Update status to 'Selected' for ${shortlistedApps.length} applicants\n- Mark ${rejectedPendingApps.length} applicants as 'Rejected' (no email)`)) {
            return;
        }

        setIsPublishing(true);

        try {
            let emailCount = 0;
            const isEmailJsConfigured = (EMAILJS_SERVICE_ID as string) !== "service_id" && (EMAILJS_PUBLIC_KEY as string) !== "public_key";
            const isGoogleScriptConfigured = (GOOGLE_SCRIPT_URL as string) !== "";

            if (!isEmailJsConfigured && !isGoogleScriptConfigured) {
                alert("No email service configured! Please set up Google Script (Recommended) or EmailJS.");
            }

            for (const app of shortlistedApps) {
                try {
                    console.log(`Processing ${app.email}...`);
                    if (isGoogleScriptConfigured) {
                        await fetch(GOOGLE_SCRIPT_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: app.email,
                                subject: "Congratulations! You're in - IEEE SSCS",
                                message: `
                                    <div style="font-family: 'Raleway', sans-serif; background-color: #0a0a0a; color: #e5e5e5; max-width: 600px; margin: 0 auto; border: 1px solid #333; border-radius: 8px; overflow: hidden;">
                                        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Raleway:wght@400;600&display=swap" rel="stylesheet">
                                        <div style="background-color: #000000; padding: 40px 20px; border-bottom: 2px solid #FFE100; text-align: center;">
                                            <img src="https://bqtqhtpbyunzcwxyxdhx.supabase.co/storage/v1/object/public/asset/IEEE%20SSCS%20Logo.png" alt="IEEE SSCS Logo" style="height: 120px; width: auto; display: block; margin: 0 auto;">
                                        </div>
                                        <div style="padding: 40px 30px;">
                                            <h2 style="color: #FFE100; font-family: 'Orbitron', sans-serif; margin-top: 0; text-transform: uppercase; letter-spacing: 2px;">Congratulations!</h2>
                                            <p style="font-size: 18px;">Hi <strong>${app.fullName}</strong>,</p>
                                            <p>We are thrilled to inform you that you have been selected to join the <strong style="color: #FFE100;">${app.primaryDept}</strong> team at IEEE SSCS!</p>
                                            
                                            <div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FFE100;">
                                                <p style="margin: 0; font-size: 14px; color: #fff;"><strong>Role:</strong> Committee Member</p>
                                                <p style="margin: 8px 0 0; font-size: 14px; color: #fff;"><strong>Department:</strong> ${app.primaryDept}</p>
                                            </div>

                                            <p>We were highly impressed by your profile and your enthusiasm for Cyber-Physical Systems. We believe you will be a valuable addition to our community.</p>
                                            
                                            <p>Our team will reach out to you shortly regarding the onboarding process and the next steps.</p>

                                            <p style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">Welcome to the future,<br><strong>IEEE SSCS Team</strong></p>
                                        </div>
                                        <div style="background-color: #000000; padding: 30px 20px; text-align: center; border-top: 1px solid #333;">
                                            <div style="margin-bottom: 20px;">
                                                <span style="color: #FFE100; font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 16px; letter-spacing: 2px;">IEEE SSCS</span>
                                                <span style="color: #333; margin: 0 15px;">|</span>
                                                <span style="color: #e5e5e5; font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 16px;">VIT Chennai</span>
                                            </div>
                                            <p style="color: #555; font-size: 11px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                                                Official Selection Notification
                                            </p>
                                        </div>
                                    </div>
                                `
                            })
                        });
                    } else if (isEmailJsConfigured) {
                        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                            to_name: app.fullName,
                            to_email: app.email,
                            department: app.primaryDept,
                            message: "Congratulations! You have been selected for IEEE SSCS."
                        });
                    }
                    emailCount++;
                    const { error } = await supabase.from('applications').update({ status: 'selected' }).eq('id', app.id);
                    if (error) throw error;
                } catch (err: any) {
                    console.error(`Failed to process ${app.email}:`, err);
                }
            }

            for (const app of rejectedPendingApps) {
                await supabase.from('applications').update({ status: 'rejected' }).eq('id', app.id);
            }

            alert(`Results published!\n\n- ${emailCount} Emails sent\n- ${shortlistedApps.length} apps marked Selected\n- ${rejectedPendingApps.length} apps marked Rejected`);

            if (user?.email) {
                await logAction(user.email, 'PUBLISHED_RESULTS', 'BATCH_OPERATION', {
                    selectedCount: shortlistedApps.length,
                    rejectedCount: rejectedPendingApps.length,
                    emailsSent: emailCount
                });
            }

            fetchApplications();

        } catch (error) {
            console.error("Error publishing results:", error);
            alert("An error occurred while publishing results. Check console.");
        } finally {
            setIsPublishing(false);
        }
    };

    const downloadExcel = () => {
        const data = applications.map(app => ({
            'Full Name': app.fullName,
            'Email': app.email,
            'Roll Number': app.rollNumber,
            'Phone': app.phone,
            'Year': app.year,
            'Department': app.department,
            'Primary Choice': app.primaryDept,
            'Primary Domains': app.domains.join(', '),
            'Primary Skills': app.skills,
            'Primary Reason': app.reason,
            'Secondary Choice': app.secondaryDept,
            'Secondary Domains': app.secondaryDomains.join(', '),
            'Secondary Skills': app.secondarySkills,
            'Secondary Reason': app.secondaryReason,
            'Status': app.status,
            'Rating': app.rating,
            'Submitted At': app.submittedAt ? new Date(app.submittedAt).toLocaleString() : ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Applications");
        XLSX.writeFile(wb, "IEEE_applications.xlsx");
    };

    // Filter Logic
    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchesSearch =
                app.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDept = deptFilter === 'ALL' || app.primaryDept === deptFilter;
            const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
            const matchesProgram = programFilter === 'ALL' || app.programName === programFilter;
            // Year filter: handle number vs string comparison carefully
            const matchesYear = yearFilter === 'ALL' || (app.admissionYear ? app.admissionYear.toString() === yearFilter : false);

            return matchesSearch && matchesDept && matchesStatus && matchesProgram && matchesYear;
        });
    }, [applications, searchTerm, deptFilter, statusFilter, programFilter, yearFilter]);

    // Sort Logic
    const sortedApps = useMemo(() => {
        if (!sortConfig) return filteredApps;

        return [...filteredApps].sort((a, b) => {
            // Handle potentially undefined values safely
            const aVal = a[sortConfig.key] ?? '';
            const bVal = b[sortConfig.key] ?? '';

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                if (aVal.toLowerCase() < bVal.toLowerCase()) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal.toLowerCase() > bVal.toLowerCase()) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredApps, sortConfig]);

    const requestSort = (key: keyof Application) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'selected': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'shortlisted': return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20';
            case 'rejected': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'rejected_pending': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'neutral': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        }
    };

    // Allowed roles for admin panel access
    const ALLOWED_ROLES = ['super_admin', 'admin', 'interviewer'];

    // Check access: must have an allowed role OR be in legacy email list
    const hasAccess = (user?.role && ALLOWED_ROLES.includes(user.role)) ||
        (user?.email && ADMIN_EMAILS.includes(user.email));

    // Derived permissions - use ONLY the database role, no fallback confusion
    const isSuperAdmin = user?.role === 'super_admin';
    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>;

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">
                        You do not have permission to view this page. This area is restricted to administrators only.
                    </p>
                    <Button onClick={() => navigate('/')} variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-950/30">
                        Return Home
                    </Button>
                </HolographicCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-foreground p-6 md:p-12 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-heading text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">
                            Admin Dashboard
                        </h1>
                        <p className="text-muted-foreground">Managing {applications.length} applications</p>
                    </div>
                </div>

                <Tabs defaultValue="dashboard" className="w-full">
                    <div className="flex justify-between items-center mb-6">
                        <TabsList className="bg-white/5 border border-white/10">
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            {isAdmin && (
                                <>
                                    <TabsTrigger value="interviews">Interviews</TabsTrigger>
                                    <TabsTrigger value="activity">Activity Log</TabsTrigger>
                                    <TabsTrigger value="settings">Settings</TabsTrigger>
                                </>
                            )}
                        </TabsList>
                        <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full border ${isSuperAdmin ? 'text-yellow-500/80 bg-yellow-500/10 border-yellow-500/20' : 'text-blue-500/80 bg-blue-500/10 border-blue-500/20'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isSuperAdmin ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                            {isSuperAdmin ? 'Super Admin Mode' : 'Interviewer Mode'} ({currentPhase.replace('_', ' ')})
                        </div>
                    </div>

                    <TabsContent value="dashboard" className="space-y-8">
                        {/* Step 1: Analytics Check */}
                        {isAdmin && <AdminStats applications={applications} />}

                        {/* Step 2: Advanced Filtering & Sorting */}
                        <AdminToolbar
                            applications={applications}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            deptFilter={deptFilter}
                            onDeptFilterChange={setDeptFilter}
                            statusFilter={statusFilter}
                            onStatusFilterChange={setStatusFilter}
                            programFilter={programFilter}
                            onProgramFilterChange={setProgramFilter}
                            yearFilter={yearFilter}
                            onYearFilterChange={setYearFilter}
                            isPublishing={isPublishing}
                            onPublish={publishResults}
                            onExport={downloadExcel}
                            canPublish={isSuperAdmin}
                        />

                        {/* Main Table */}
                        <HolographicCard className="p-0 overflow-hidden">
                            <div className="max-h-[70vh] overflow-auto">
                                <Table>
                                    <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                                        <TableRow className="hover:bg-white/5 border-white/10">
                                            <TableHead onClick={() => requestSort('fullName')} className="cursor-pointer hover:text-white transition-colors">
                                                <div className="flex items-center gap-2">Name <ArrowUpDown className="w-3 h-3" /></div>
                                            </TableHead>
                                            <TableHead className="text-primary">Dept</TableHead>
                                            <TableHead onClick={() => requestSort('primaryDept')} className="cursor-pointer hover:text-white transition-colors">
                                                <div className="flex items-center gap-2">Choice 1 <ArrowUpDown className="w-3 h-3" /></div>
                                            </TableHead>
                                            <TableHead onClick={() => requestSort('rating')} className="cursor-pointer hover:text-white transition-colors">
                                                <div className="flex items-center gap-2">Rating <ArrowUpDown className="w-3 h-3" /></div>
                                            </TableHead>
                                            <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:text-white transition-colors text-center">
                                                <div className="flex items-center justify-center gap-2">Status <ArrowUpDown className="w-3 h-3" /></div>
                                            </TableHead>
                                            <TableHead className="text-primary text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-32 text-center">
                                                    <LogoSpinner size="sm" className="mx-auto" />
                                                </TableCell>
                                            </TableRow>
                                        ) : sortedApps.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                                    No applications found matching your criteria.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sortedApps.map((app) => (
                                                <TableRow key={app.id} className="hover:bg-white/5 border-white/10 transition-colors cursor-pointer group" onClick={() => setSelectedApp(app)}>
                                                    <TableCell>
                                                        <div className="font-medium text-white group-hover:text-primary transition-colors">{app.fullName}</div>
                                                        <div className="text-xs text-muted-foreground">{app.rollNumber}</div>
                                                        {app.programName && (
                                                            <div className="text-[10px] text-primary/70 uppercase tracking-wider">{app.programCode} • {app.batch}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{app.department}</div>
                                                        <div className="text-xs text-muted-foreground">Year {app.year}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                                                            {app.primaryDept}
                                                        </Badge>
                                                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                                                            {app.domains.join(', ')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Star
                                                                    key={star}
                                                                    className={`w-4 h-4 ${star <= (app.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-700'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={`capitalize ${getStatusColor(app.status)}`}>
                                                            {app.status === 'rejected_pending' ? 'To Reject' : app.status === 'shortlisted' ? 'Shortlisted' : app.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}>
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </HolographicCard>
                    </TabsContent>

                    {isAdmin && (
                        <>
                            <TabsContent value="interviews">
                                <InterviewScheduler />
                            </TabsContent>

                            <TabsContent value="activity">
                                <AuditLogViewer />
                            </TabsContent>

                            <TabsContent value="settings">
                                <AdminSettings />
                            </TabsContent>
                        </>
                    )}
                </Tabs>

                {/* Step 6: Refactored Modal (includes Step 5 History) */}
                <ApplicationModal
                    application={selectedApp}
                    open={!!selectedApp}
                    onClose={() => setSelectedApp(null)}
                    onUpdate={updateApplication}
                    onDelete={deleteApplication}
                />
            </div>
        </div>
    );
};

export default Admin;
