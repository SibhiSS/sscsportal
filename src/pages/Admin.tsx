import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ShieldAlert, Eye, Star, ArrowUpDown, LayoutGrid, List, Trophy, BarChart3, Settings2, UploadCloud } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { sendEmail } from '@/lib/email';

import { Application, RecruitmentPhase } from '@/types';
import AdminStats from '@/components/admin/AdminStats';
import AdminToolbar from '@/components/admin/AdminToolbar';
import ApplicationModal from '@/components/admin/ApplicationModal';
import AdminSettings from '@/components/admin/AdminSettings';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import InterviewScheduler from '@/components/admin/InterviewScheduler';
import PositionManager from '@/components/admin/PositionManager';
import KanbanBoard from '@/components/admin/KanbanBoard';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import RankingPanel from '@/components/admin/RankingPanel';
import DeptWeightsEditor from '@/components/admin/DeptWeightsEditor';
import ImportApplications from '@/components/admin/ImportApplications';
import { logAction } from '@/services/auditService';
import CircuitBoardBackground from '@/components/ui/CircuitBoardBackground';
import { ArrowLeft, LayoutDashboard, Calendar, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { parseApplicationText } from '@/utils/resumeParser';



const ADMIN_EMAILS = [
    'sibhi.s2024@vitstudent.ac.in',
    'sibhis5223@gmail.com'
];

type ViewMode = 'table' | 'kanban';

const Admin = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // View mode: table or kanban
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        return (localStorage.getItem('sscs_admin_view') as ViewMode) || 'table';
    });

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [programFilter, setProgramFilter] = useState('ALL');
    const [yearFilter, setYearFilter] = useState('ALL');
    const [skillFilter, setSkillFilter] = useState('');
    const [currentPhase, setCurrentPhase] = useState<RecruitmentPhase>('APPLICATIONS_OPEN');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Application; direction: 'asc' | 'desc' } | null>(null);

    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // Publish Dialog State
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [publishConfirm1, setPublishConfirm1] = useState('');
    const [publishConfirm2, setPublishConfirm2] = useState('');



    useEffect(() => {
        if (!authLoading && !user) return;
        const hasAccess = user?.role || (user?.email && ADMIN_EMAILS.includes(user.email));
        if (hasAccess) {
            fetchApplications();
            fetchPhase();
        }
    }, [user, authLoading]);

    const switchView = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('sscs_admin_view', mode);
    };

    const fetchPhase = async () => {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'recruitment_status').single();
        if (data?.value?.currentPhase) {
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

            const apps: Application[] = (data || []).map((doc: any) => {
                // Auto-parse skills on load
                const parsed = parseApplicationText(doc.skills || '', doc.reason || '');
                return {
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
                    status: doc.status || 'applied',
                    rating: doc.rating || 0,
                    notes: doc.notes || '',
                    admissionYear: doc.admission_year,
                    programCode: doc.program_code,
                    programName: doc.program_name,
                    batch: doc.batch,
                    programCategory: doc.program_category,
                    // Social
                    githubUrl: parsed.githubUrl || doc.github_url || '',
                    linkedinUrl: parsed.linkedinUrl || doc.linkedin_url || '',
                    parsedSkills: doc.parsed_skills?.length ? doc.parsed_skills : parsed.skills,
                    // Scoring
                    taskScore: doc.task_score || 0,
                    interviewScore: doc.interview_score || 0,
                    finalScore: doc.final_score || 0,
                    rankInDept: doc.rank_in_dept,
                    // Timeline
                    shortlistedAt: doc.shortlisted_at,
                    interviewedAt: doc.interviewed_at,
                    decidedAt: doc.decided_at,
                    // Post-Selection Position
                    assignedPosition: doc.assigned_position,
                };
            });

            setApplications(apps);
        } catch (error) {
            console.error("Error fetching applications: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateApplication = async (id: string, updates: Partial<Application>) => {
        try {
            setApplications(prev => prev.map(app => app.id === id ? { ...app, ...updates } : app));
            if (selectedApp?.id === id) {
                setSelectedApp(prev => prev ? { ...prev, ...updates } : null);
            }

            const dbUpdates: any = {};
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
            if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
            if (updates.taskScore !== undefined) dbUpdates.task_score = updates.taskScore;
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.githubUrl !== undefined) dbUpdates.github_url = updates.githubUrl;
            if (updates.linkedinUrl !== undefined) dbUpdates.linkedin_url = updates.linkedinUrl;
            if (updates.assignedPosition !== undefined) dbUpdates.assigned_position = updates.assignedPosition;

            const { error } = await supabase.from('applications').update(dbUpdates).eq('id', id);
            if (error) throw error;

            if (updates.status && ['shortlisted', 'waitlisted', 'rejected', 'rejected_pending', 'applied', 'under_review'].includes(updates.status)) {
                // Free up any booked slots if the candidate is downgraded/rejected
                await supabase.from('interview_slots').update({ is_booked: false, booked_by: null }).eq('booked_by', id);
            }

            if (user?.email) {
                await logAction(user.email, 'UPDATE_APPLICATION', id, updates);
            }
        } catch (error) {
            console.error("Error updating application:", error);
            fetchApplications();
        }
    };

    const updateTaskScore = async (id: string, score: number) => {
        await updateApplication(id, { taskScore: score });
    };

    const deleteApplication = async (id: string) => {
        const isSuperAdmin = user?.role === 'super_admin';
        if (!isSuperAdmin) { alert("Only Super Admins can delete applications."); return; }
        if (!confirm("Are you sure you want to delete this application? This cannot be undone.")) return;

        try {
            // Free up any booked slots before deleting
            await supabase.from('interview_slots').update({ is_booked: false, booked_by: null }).eq('booked_by', id);
            
            const { error } = await supabase.from('applications').delete().eq('id', id);
            if (error) throw error;
            setApplications(prev => prev.filter(app => app.id !== id));
            if (selectedApp?.id === id) setSelectedApp(null);
            if (user?.email) await logAction(user.email, 'DELETE_APPLICATION', id, { deleted: true });
        } catch (error) {
            console.error("Error deleting application:", error);
        }
    };

    const handlePublishClick = () => {
        const selectedApps = applications.filter(app => app.status === 'selected');
        const rejectedPendingApps = applications.filter(app => app.status === 'rejected_pending');
        const waitlistedApps = applications.filter(app => app.status === 'waitlisted');
        
        if (selectedApps.length === 0 && rejectedPendingApps.length === 0 && waitlistedApps.length === 0) {
            alert("No applications pending publication.");
            return;
        }
        setPublishConfirm1('');
        setPublishConfirm2('');
        setIsPublishDialogOpen(true);
    };

    const executePublishResults = async () => {
        setIsPublishDialogOpen(false);
        setIsPublishing(true);
        const selectedApps = applications.filter(app => app.status === 'selected');
        const rejectedPendingApps = applications.filter(app => app.status === 'rejected_pending');
        const waitlistedApps = applications.filter(app => app.status === 'waitlisted');
        try {
            let emailCount = 0;

            for (const app of selectedApps) {
                try {
                    const positionText = app.assignedPosition 
                        ? `the position of <strong>${app.assignedPosition}</strong>`
                        : `a position in the <strong>${app.primaryDept}</strong> department`;
                        
                    await sendEmail(
                        app.email,
                        'Congratulations! You\'re in - IEEE SSCS',
                        `<p>Dear <strong>${app.fullName}</strong>,</p>
                        <p>We are pleased to offer you ${positionText} at IEEE SSCS.</p>
                        <p>Our team will contact you shortly regarding onboarding.</p>
                        <p>Regards,<br>IEEE SSCS Executive Committee</p>`
                    );
                    emailCount++;
                    await supabase.from('applications').update({ status: 'active_member', decided_at: new Date().toISOString() }).eq('id', app.id);
                } catch (err) {
                    console.error(`Failed for ${app.email}:`, err);
                }
            }

            const rejectedAppsToEmail = [...rejectedPendingApps, ...waitlistedApps];
            for (const app of rejectedAppsToEmail) {
                try {
                    await sendEmail(
                        app.email,
                        'Update on your IEEE SSCS Application',
                        `<p>Dear <strong>${app.fullName}</strong>,</p>
                        <p>Thank you for applying and interviewing with IEEE SSCS. We deeply appreciate the effort you put into the process.</p>
                        <p>After careful consideration, we regret to inform you that we are unable to offer you a position at this time. We had a highly competitive pool of applicants this year.</p>
                        <p>We encourage you to stay connected and apply again in the future.</p>
                        <p>Best wishes,<br>IEEE SSCS Executive Committee</p>`
                    );
                    emailCount++;
                    await supabase.from('applications').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', app.id);
                } catch (err) {
                    console.error(`Failed for ${app.email}:`, err);
                }
            }

            alert(`Results published!\n\n${emailCount} emails sent\n${selectedApps.length} accepted\n${rejectedPendingApps.length + waitlistedApps.length} rejected`);
            if (user?.email) {
                await logAction(user.email, 'PUBLISHED_RESULTS', 'BATCH_OPERATION', {
                    selectedCount: selectedApps.length,
                    rejectedCount: rejectedPendingApps.length + waitlistedApps.length,
                });
            }
            fetchApplications();
        } catch (error) {
            console.error("Error publishing results:", error);
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
            'Primary Choice': app.primaryDept,
            'Skills': app.skills,
            'Final Score': app.finalScore || '',
            'Rank in Dept': app.rankInDept || '',
            'Status': app.status,
            'Rating': app.rating,
            'GitHub': app.githubUrl || '',
            'LinkedIn': app.linkedinUrl || '',
            'Submitted At': app.submittedAt ? new Date(app.submittedAt).toLocaleString() : '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Applications");
        XLSX.writeFile(wb, "IEEE_SSCS_Applications.xlsx");
    };

    // ── Filter Logic ────────────────────────────────────────────────────────
    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchesSearch =
                app.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDept = deptFilter === 'ALL' || app.primaryDept === deptFilter;
            const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
            const matchesProgram = programFilter === 'ALL' || app.programName === programFilter;
            const matchesYear = yearFilter === 'ALL' || (app.admissionYear ? app.admissionYear.toString() === yearFilter : false);
            const matchesSkill = !skillFilter || app.skills.toLowerCase().includes(skillFilter.toLowerCase()) ||
                app.parsedSkills?.some(s => s.toLowerCase().includes(skillFilter.toLowerCase()));
            return matchesSearch && matchesDept && matchesStatus && matchesProgram && matchesYear && matchesSkill;
        });
    }, [applications, searchTerm, deptFilter, statusFilter, programFilter, yearFilter, skillFilter]);

    // ── Sort Logic ───────────────────────────────────────────────────────────
    const sortedApps = useMemo(() => {
        if (!sortConfig) return filteredApps;
        return [...filteredApps].sort((a, b) => {
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
        if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'selected': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'shortlisted': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
            case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'rejected_pending': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'under_review': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'interview_scheduled': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'interviewed': return 'text-orange-300 bg-orange-500/10 border-orange-500/20';
            case 'waitlisted': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
    };

    const ALLOWED_ROLES = ['super_admin', 'admin', 'interviewer'];
    const hasAccess = (user?.role && ALLOWED_ROLES.includes(user.role)) ||
        (user?.email && ADMIN_EMAILS.includes(user.email));
    const isSuperAdmin = user?.role === 'super_admin';
    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>;

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">Restricted to administrators only.</p>
                    <Button onClick={() => navigate('/')} variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-950/30">Return Home</Button>
                </HolographicCard>
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
                    className="max-w-[1600px] mx-auto space-y-8"
                >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-4">
                            <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-xs tracking-widest uppercase">
                                <ArrowLeft className="w-3 h-3 mr-2 transition-transform group-hover:-translate-x-1" />
                                Portal Home
                            </Link>
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight mb-2">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-primary/50">
                                        Admin Dashboard
                                    </span>
                                </h1>
                                <p className="text-muted-foreground flex items-center gap-2">
                                    <LayoutDashboard className="w-4 h-4 text-primary/50" />
                                    Applicant Tracking System · {applications.length} Applicants
                                </p>
                            </div>
                        </div>

                        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-xl shadow-lg transition-all duration-500 ${isSuperAdmin ? 'text-primary bg-primary/10 border-primary/20' :
                            user?.role === 'admin' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                                'text-zinc-400 bg-zinc-500/10 border-white/10'
                            }`}>
                            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isSuperAdmin ? 'bg-primary' : user?.role === 'admin' ? 'bg-blue-400' : 'bg-zinc-400'}`} />
                            <span className="text-xs font-bold tracking-widest uppercase">
                                {isSuperAdmin ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Interviewer'}
                            </span>
                            <span className="text-[10px] opacity-50 font-mono px-2 py-0.5 rounded-md bg-white/10 ml-1">
                                {currentPhase.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    {/* ── Main Tabs ─────────────────────────────────────────── */}
                    <Tabs defaultValue="dashboard" className="w-full">
                        <div className="flex justify-between items-center mb-8 overflow-x-auto pb-2 scrollbar-hide">
                            <TabsList className="bg-white/5 border border-white/10 p-1 h-auto backdrop-blur-xl rounded-2xl flex-wrap gap-1">
                                <TabsTrigger value="dashboard" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                    <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />DASHBOARD
                                </TabsTrigger>
                                {isAdmin && (
                                    <>
                                        <TabsTrigger value="analytics" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />ANALYTICS
                                        </TabsTrigger>
                                        <TabsTrigger value="rankings" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                            <Trophy className="w-3.5 h-3.5 mr-1.5" />RANKINGS
                                        </TabsTrigger>
                                    </>
                                )}
                                <TabsTrigger value="interviews" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5" />INTERVIEWS
                                </TabsTrigger>
                                {isSuperAdmin && (
                                    <>
                                        <TabsTrigger value="positions" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                            <Trophy className="w-3.5 h-3.5 mr-1.5" />POSITIONS
                                        </TabsTrigger>
                                        <TabsTrigger value="import" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />IMPORT
                                        </TabsTrigger>
                                    </>
                                )}
                                {isAdmin && (
                                    <>
                                        <TabsTrigger value="activity" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                            <History className="w-3.5 h-3.5 mr-1.5" />ACTIVITY
                                        </TabsTrigger>
                                        <TabsTrigger value="settings" className="px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold tracking-wider">
                                            <Settings2 className="w-3.5 h-3.5 mr-1.5" />SETTINGS
                                        </TabsTrigger>
                                    </>
                                )}
                            </TabsList>
                        </div>

                        {/* ── DASHBOARD TAB ──────────────────────────────────── */}
                        <TabsContent value="dashboard" className="space-y-8 outline-none">
                            {isAdmin && <AdminStats applications={applications} />}

                            <div className="space-y-6">
                                <div className="flex items-center justify-between flex-wrap gap-4">
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
                                        onPublish={handlePublishClick}
                                        onExport={downloadExcel}
                                        currentPhase={currentPhase}
                                        canPublish={isSuperAdmin}
                                    />

                                    {/* View Toggle */}
                                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                                        <button
                                            onClick={() => switchView('table')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'}`}
                                        >
                                            <List className="w-3.5 h-3.5" /> Table
                                        </button>
                                        <button
                                            onClick={() => switchView('kanban')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'}`}
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
                                        </button>
                                    </div>
                                </div>

                                {/* Table View */}
                                {viewMode === 'table' && (
                                    <HolographicCard className="p-0 border-white/5 overflow-hidden shadow-2xl">
                                        <div className="max-h-[70vh] overflow-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                            <Table>
                                                <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-2xl border-b border-white/10">
                                                    <TableRow className="hover:bg-transparent border-white/10">
                                                        <TableHead onClick={() => requestSort('fullName')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-bold tracking-[0.2em] uppercase py-5">
                                                            <div className="flex items-center gap-2">Name <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead className="text-[10px] font-bold tracking-[0.2em] uppercase py-5 text-primary/70">Dept</TableHead>
                                                        <TableHead onClick={() => requestSort('primaryDept')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-bold tracking-[0.2em] uppercase py-5">
                                                            <div className="flex items-center gap-2">Choice 1 <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead onClick={() => requestSort('interviewScore')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-bold tracking-[0.2em] uppercase py-5">
                                                            <div className="flex items-center gap-2">Int. Score <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-bold tracking-[0.2em] uppercase py-5 text-center">
                                                            <div className="flex items-center justify-center gap-2">Status <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead className="text-[10px] font-bold tracking-[0.2em] uppercase py-5 text-right pr-8">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="h-64 text-center">
                                                                <LogoSpinner size="md" className="mx-auto" />
                                                                <p className="text-xs tracking-widest text-muted-foreground mt-4 uppercase animate-pulse">Syncing Database...</p>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : sortedApps.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="h-64 text-center">
                                                                <div className="max-w-xs mx-auto space-y-3">
                                                                    <p className="text-sm font-medium text-white">No matches found</p>
                                                                    <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        sortedApps.map((app) => (
                                                            <TableRow
                                                                key={app.id}
                                                                className="hover:bg-white/5 border-white/5 transition-all cursor-pointer group/row"
                                                                onClick={() => setSelectedApp(app)}
                                                            >
                                                                <TableCell className="py-6 pl-8">
                                                                    <div className="font-heading text-sm text-white group-hover/row:text-primary transition-colors duration-300">{app.fullName}</div>
                                                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 tracking-tighter opacity-70">{app.rollNumber}</div>
                                                                    {app.programName && (
                                                                        <div className="flex items-center gap-1.5 mt-2">
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-muted-foreground font-bold tracking-wider uppercase">{app.programCode}</span>
                                                                            <span className="text-[9px] text-primary/50 font-bold tracking-widest uppercase">Batch {app.batch}</span>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="text-xs font-medium text-zinc-400">{app.programName || app.department || 'Unknown'}</div>
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest">{app.batch ? `Batch ${app.batch}` : `Year ${app.admissionYear || app.year || 'Unknown'}`}</div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[10px] font-bold tracking-wider rounded-md">
                                                                        {app.primaryDept}
                                                                    </Badge>
                                                                    <div className="text-[10px] text-muted-foreground mt-2 font-medium truncate max-w-[150px] opacity-60">
                                                                        {app.domains.join(' · ')}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {app.interviewScore && app.interviewScore > 0 ? (
                                                                        <span className={`font-mono text-sm font-bold ${app.interviewScore >= 7 ? 'text-green-400' : app.interviewScore >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                            {app.interviewScore.toFixed(1)}
                                                                        </span>
                                                                    ) : app.finalScore && app.finalScore > 0 ? (
                                                                        <span className={`font-mono text-sm font-bold ${app.finalScore >= 7 ? 'text-green-400' : app.finalScore >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                            {app.finalScore.toFixed(1)}
                                                                        </span>
                                                                    ) : (
                                                                        <div className="flex gap-0.5">
                                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                                <Star key={star} className={`w-3 h-3 ${star <= (app.rating || 0) ? 'text-primary fill-primary' : 'text-zinc-800'}`} />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Badge variant="outline" className={`capitalize text-[9px] font-bold tracking-[0.15em] py-1 px-2.5 rounded-full border-2 ${getStatusColor(app.status)} shadow-lg`}>
                                                                        {app.status === 'rejected_pending' ? 'To Reject' : app.status.replace(/_/g, ' ')}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right pr-8">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-primary hover:text-white transition-all duration-300 opacity-0 group-hover/row:opacity-100"
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="px-8 py-3 border-t border-white/5 flex justify-between text-[10px] text-muted-foreground">
                                            <span>Showing {sortedApps.length} of {applications.length}</span>
                                            <span>Click any row to view details</span>
                                        </div>
                                    </HolographicCard>
                                )}

                                {/* Kanban View */}
                                {viewMode === 'kanban' && (
                                    <KanbanBoard
                                        applications={filteredApps}
                                        onUpdate={updateApplication}
                                        onCardClick={setSelectedApp}
                                    />
                                )}
                            </div>
                        </TabsContent>

                        {/* ── ANALYTICS TAB ────────────────────────────────── */}
                        {isAdmin && (
                            <TabsContent value="analytics" className="outline-none">
                                <AnalyticsDashboard applications={applications} />
                            </TabsContent>
                        )}
                        
                        {/* ── SUPER ADMIN TABS ────────────────────────────────── */}
                        {isSuperAdmin && (
                            <>
                                <TabsContent value="positions" className="outline-none">
                                    <PositionManager applications={applications} />
                                </TabsContent>
                                <TabsContent value="import" className="outline-none">
                                    <ImportApplications />
                                </TabsContent>
                            </>
                        )}

                        {/* ── RANKINGS TAB ─────────────────────────────────── */}
                        {isAdmin && (
                            <TabsContent value="rankings" className="outline-none">
                                <RankingPanel
                                    applications={applications}
                                    onUpdateTaskScore={updateTaskScore}
                                    userEmail={user?.email || ''}
                                />
                            </TabsContent>
                        )}

                        {/* ── INTERVIEWS TAB ────────────────────────────────── */}
                        <TabsContent value="interviews" className="outline-none">
                            <InterviewScheduler />
                        </TabsContent>

                        {/* ── POSITIONS TAB ─────────────────────────────────── */}
                        {isSuperAdmin && (
                            <TabsContent value="positions" className="outline-none">
                                <PositionManager applications={applications} onUpdate={updateApplication} />
                            </TabsContent>
                        )}

                        {/* ── ACTIVITY LOG TAB ──────────────────────────────── */}
                        {isAdmin && (
                            <TabsContent value="activity" className="outline-none">
                                <AuditLogViewer />
                            </TabsContent>
                        )}

                        {/* ── SETTINGS TAB ─────────────────────────────────── */}
                        {isAdmin && (
                            <TabsContent value="settings" className="space-y-12 outline-none">
                                <AdminSettings />
                                <div className="border-t border-white/10 pt-10">
                                    <DeptWeightsEditor userEmail={user?.email || ''} />
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>

                    {/* Footer */}
                    <div className="pt-12 pb-6 border-t border-white/5 flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold">
                        <span>IEEE SSCS Portal v3.0</span>
                        <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-green-500" />
                            System Operational
                        </span>
                    </div>
                </motion.div>

                {/* Application Detail Modal */}
                {selectedApp && (
                    <ApplicationModal
                        application={selectedApp}
                        open={!!selectedApp}
                        onClose={() => setSelectedApp(null)}
                        onUpdate={updateApplication}
                        onDelete={deleteApplication}
                        currentPhase={currentPhase}
                    />
                )}

                <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
                    <DialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl text-white">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-red-500 flex items-center gap-2">
                                <ShieldAlert className="w-6 h-6" /> Publish Results
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground pt-4">
                                You are about to publish the final results and send out decision emails to all pending candidates. This action CANNOT be undone.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-white/70">
                                    Type 'CONFIRM' below to proceed:
                                </label>
                                <Input 
                                    value={publishConfirm1}
                                    onChange={(e) => setPublishConfirm1(e.target.value)}
                                    className="bg-white/5 border-white/10 font-mono tracking-widest uppercase"
                                    placeholder="CONFIRM"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-white/70">
                                    Type 'CONFIRM' again to double-verify:
                                </label>
                                <Input 
                                    value={publishConfirm2}
                                    onChange={(e) => setPublishConfirm2(e.target.value)}
                                    className="bg-white/5 border-white/10 font-mono tracking-widest uppercase"
                                    placeholder="CONFIRM"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsPublishDialogOpen(false)}>Cancel</Button>
                            <Button 
                                variant="destructive" 
                                disabled={publishConfirm1 !== 'CONFIRM' || publishConfirm2 !== 'CONFIRM'}
                                onClick={executePublishResults}
                                className="bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white"
                            >
                                Launch Emails
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default Admin;
