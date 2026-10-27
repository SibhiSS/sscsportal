import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ShieldAlert, Eye, Star, ArrowUpDown, LayoutGrid, List, BarChart3, Settings2, UploadCloud, Video, Trophy, Sparkles, Activity } from 'lucide-react';
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
import AutoShortlistDialog from '@/components/admin/AutoShortlistDialog';
import AdminSettings from '@/components/admin/AdminSettings';
import InterviewScheduler from '@/components/admin/InterviewScheduler';
import KanbanBoard from '@/components/admin/KanbanBoard';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import DeptWeightsEditor from '@/components/admin/DeptWeightsEditor';
import ImportApplications from '@/components/admin/ImportApplications';
import RankingPanel from '@/components/admin/RankingPanel';
import CommitteeDraftBoard from '@/components/admin/CommitteeDraftBoard';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import { logAction } from '@/services/auditService';
import TechGridBackground from '@/components/ui/TechGridBackground';
import '../admin.css';
import { ArrowLeft, LayoutDashboard, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { parseApplicationText } from '@/utils/resumeParser';



// Roles that may open the admin dashboard. The `admins` table is the single source of
// truth — AuthContext resolves the role from it on sign-in, and RLS enforces the same
// thing server-side. There is deliberately no hardcoded email fallback here.
const ALLOWED_ROLES = ['super_admin', 'admin', 'interviewer'];

type ViewMode = 'table' | 'kanban';

const Admin = () => {
    const { user, loading: authLoading, loginAsLocalAdmin } = useAuth();
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

    const [isAutoShortlistOpen, setIsAutoShortlistOpen] = useState(false);



    useEffect(() => {
        if (!authLoading && !user) return;
        // Note: AuthContext assigns every signed-in user a role, defaulting to 'viewer',
        // so `user?.role` alone is always truthy and gated nothing. Check the role value.
        const hasAccess = !!user?.role && ALLOWED_ROLES.includes(user.role);
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
                    skills: doc.dept_answer || doc.skills || '',
                    reason: doc.why_join_sscs || doc.reason || '',
                    secondaryDept: doc.secondary_dept || '',
                    secondaryDomains: doc.secondary_domains || [],
                    secondarySkills: doc.secondary_dept_answer || doc.secondary_skills || '',
                    secondaryReason: doc.why_these_depts || doc.secondary_reason || '',
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
                    portfolioUrl: doc.portfolio_website || '',
                    parsedSkills: doc.parsed_skills?.length ? doc.parsed_skills : parsed.skills,
                    // Additional
                    weeklyHours: doc.weekly_hours || '',
                    hostelDay: doc.hostel_day || '',
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
                    // AI Copilot cache
                    aiAnalysis: doc.ai_analysis || undefined,
                    aiAnalyzedAt: doc.ai_analyzed_at || undefined,
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
            // Walking a candidate back below 'shortlisted' un-shortlists them: the
            // booking email is revoked so the applicant stops seeing "Book Interview
            // Slot", and re-shortlisting later will send a fresh mail rather than
            // silently re-granting access.
            //
            // 'shortlisted' itself is NOT in this list on purpose. Moving someone from
            // interview_scheduled back to shortlisted means "let them pick a different
            // time" — clearing the flag there would lock them out until an admin
            // re-sent the mail.
            const REVOKES_BOOKING_ACCESS = ['applied', 'under_review', 'waitlisted', 'rejected', 'rejected_pending'];
            const revokeAccess = !!updates.status && REVOKES_BOOKING_ACCESS.includes(updates.status);

            const localUpdates = revokeAccess ? { ...updates, shortlistNotified: false } : updates;
            setApplications(prev => prev.map(app => app.id === id ? { ...app, ...localUpdates } : app));
            if (selectedApp?.id === id) {
                setSelectedApp(prev => prev ? { ...prev, ...localUpdates } : null);
            }

            const dbUpdates: any = {};
            if (revokeAccess) dbUpdates.shortlist_notified = false;
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

    // AI Copilot writes its own cache row directly (aiService.saveAnalysisToDb) —
    // this just mirrors that into local state so the UI doesn't need a refetch.
    // Deliberately bypasses updateApplication: that path also fires an audit log
    // entry per call, and batch auto-shortlist can trigger dozens of these back to
    // back, which would flood the audit trail with AI payloads.
    const applyLocalAiAnalysis = (id: string, analysis: Application['aiAnalysis']) => {
        const aiAnalyzedAt = new Date().toISOString();
        setApplications(prev => prev.map(app => app.id === id ? { ...app, aiAnalysis: analysis, aiAnalyzedAt } : app));
        setSelectedApp(prev => prev && prev.id === id ? { ...prev, aiAnalysis: analysis, aiAnalyzedAt } : prev);
    };

    const bulkShortlist = async (ids: string[]) => {
        for (const id of ids) {
            await updateApplication(id, { status: 'shortlisted' });
        }
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
        // selected_pending = admin draft; selected = already published
        const draftApps = applications.filter(app => app.status === 'selected_pending' || app.status === 'selected');
        const rejectedPendingApps = applications.filter(app => app.status === 'rejected_pending');
        const waitlistedApps = applications.filter(app => app.status === 'waitlisted');
        
        if (draftApps.length === 0 && rejectedPendingApps.length === 0 && waitlistedApps.length === 0) {
            alert("No applications pending publication. Move candidates to the 'Selected (Draft)' column first.");
            return;
        }
        setPublishConfirm1('');
        setPublishConfirm2('');
        setIsPublishDialogOpen(true);
    };

    const executePublishResults = async () => {
        setIsPublishDialogOpen(false);
        setIsPublishing(true);
        // Publish any app that is in the internal draft bucket (selected_pending)
        // or was already selected but email not yet sent (selected).
        const selectedApps = applications.filter(app => app.status === 'selected_pending' || app.status === 'selected');
        const rejectedPendingApps = applications.filter(app => app.status === 'rejected_pending');
        const waitlistedApps = applications.filter(app => app.status === 'waitlisted');
        try {
            let emailCount = 0;
            let statusWriteFailures = 0;

            for (const app of selectedApps) {
                try {
                    const displayPosition = app.assignedPosition?.replace(/ \d -/, ' -');
                    const positionText = displayPosition 
                        ? `the position of <strong>${displayPosition}</strong>`
                        : `a position in the <strong>${app.primaryDept}</strong> department`;
                    const portalUrl = window.location.origin;
                    const ok = await sendEmail(
                        app.email,
                        'Congratulations! You\'re in - AI Club',
                        `<p>Dear <strong>${app.fullName}</strong>,</p>
                        <p>We are pleased to offer you ${positionText} at AI Club.</p>
                        <p style="margin: 20px 0;">
                            <a href="${portalUrl}/status" style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Your Selection Status</a>
                        </p>
                        <p>Direct link: <a href="${portalUrl}/status">${portalUrl}/status</a></p>
                        <p>Our team will contact you shortly regarding onboarding.</p>
                        <p>Regards,<br>AI Club Executive Committee</p>`
                    );
                    if (ok) {
                        emailCount++;
                        // If this write fails the candidate keeps a pre-publish status, so the
                        // next publish mails them again. A silent failure here is a duplicate
                        // email later — count it and warn at the end.
                        const { error: statusError } = await supabase
                            .from('applications')
                            .update({ status: 'active_member', decided_at: new Date().toISOString() })
                            .eq('id', app.id);
                        if (statusError) {
                            console.error('[Admin] Selection email sent but status was NOT updated:', statusError.message);
                            statusWriteFailures++;
                        }
                    } else {
                        // FIX #14: Never log raw PII — mask the email address.
                        const masked = app.email.replace(/(\w{2})\w+@/, '$1***@');
                        console.warn(`[Admin] Selection email failed for ${masked} — status NOT updated.`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit protection
                } catch (err) {
                    console.error('[Admin] Unexpected error during selection email send.');
                }
            }

            const rejectedAppsToEmail = [...rejectedPendingApps, ...waitlistedApps];
            for (const app of rejectedAppsToEmail) {
                try {
                    const ok = await sendEmail(
                        app.email,
                        'Update on your AI Club Application',
                        `<p>Dear <strong>${app.fullName}</strong>,</p>
                        <p>Thank you for applying and interviewing with AI Club. We deeply appreciate the effort you put into the process.</p>
                        <p>After careful consideration, we regret to inform you that we are unable to offer you a position at this time. We had a highly competitive pool of applicants this year.</p>
                        <p>We encourage you to stay connected and apply again in the future.</p>
                        <p>Best wishes,<br>AI Club Executive Committee</p>`
                    );
                    if (ok) {
                        emailCount++;
                        const { error: statusError } = await supabase
                            .from('applications')
                            .update({ status: 'rejected', decided_at: new Date().toISOString() })
                            .eq('id', app.id);
                        if (statusError) {
                            console.error('[Admin] Rejection email sent but status was NOT updated:', statusError.message);
                            statusWriteFailures++;
                        }
                    } else {
                        // FIX #14: Never log raw PII — mask the email address.
                        const masked = app.email.replace(/(\w{2})\w+@/, '$1***@');
                        console.warn(`[Admin] Rejection email failed for ${masked} — status NOT updated.`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit protection
                } catch (err) {
                    console.error('[Admin] Unexpected error during rejection email send.');
                }
            }

            alert(
                `Results published!\n\n${emailCount} emails sent\n${selectedApps.length} accepted\n${rejectedPendingApps.length + waitlistedApps.length} rejected` +
                (statusWriteFailures > 0
                    ? `\n\nWarning: ${statusWriteFailures} candidate(s) were emailed but their status could not be saved. Fix those rows before publishing again, or they will receive the same email twice.`
                    : '')
            );
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

    /**
     * FIX #15 (Privacy) — This export contains full applicant PII (name, email, phone,
     * roll number, GitHub, LinkedIn). Admin responsibilities:
     *  1. Store the file only on an encrypted drive — never a shared or cloud folder.
     *  2. Delete the file securely after use (do not leave it in Downloads).
     *  3. Per the data-retention policy, all copies must be deleted 60 days after
     *     recruitment ends.
     */
    const downloadExcel = () => {
        const data = applications.map(app => ({
            'Full Name': app.fullName,
            'Email': app.email,
            'Roll Number': app.rollNumber,
            'Phone': app.phone,
            'Year': app.year,
            'Primary Choice': app.primaryDept,
            '1st Preference Answer': app.skills || '',
            'Why Join AI Club?': app.reason || '',
            'Secondary Choice': app.secondaryDept || 'None',
            '2nd Preference Answer': app.secondarySkills || '',
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
        XLSX.writeFile(wb, "AI_Club_Applications.csv", { bookType: 'csv' });
    };

    // ── Filter Logic ────────────────────────────────────────────────────────
    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchesSearch =
                app.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDept = deptFilter === 'ALL' || app.primaryDept === deptFilter || app.secondaryDept === deptFilter;
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

    // ── Modal Next/Prev navigation ──────────────────────────────────────────
    // Walks through whatever list is currently on screen (respects active
    // filters/sort/search) so "Next" always matches what the admin was browsing.
    const selectedIndex = selectedApp ? sortedApps.findIndex(a => a.id === selectedApp.id) : -1;
    const goToNextApp = () => {
        if (selectedIndex >= 0 && selectedIndex < sortedApps.length - 1) setSelectedApp(sortedApps[selectedIndex + 1]);
    };
    const goToPrevApp = () => {
        if (selectedIndex > 0) setSelectedApp(sortedApps[selectedIndex - 1]);
    };

    const requestSort = (key: keyof Application) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'selected': return 'text-green-600 bg-green-500/10 border-green-500/20';
            case 'shortlisted': return 'text-primary bg-cyan-500/10 border-cyan-500/20';
            case 'rejected': return 'text-destructive bg-red-500/10 border-red-500/20';
            case 'rejected_pending': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'under_review': return 'text-amber-600 bg-yellow-500/10 border-yellow-500/20';
            case 'interview_scheduled': return 'text-primary bg-purple-500/10 border-purple-500/20';
            case 'interviewed': return 'text-orange-300 bg-orange-500/10 border-orange-500/20';
            case 'waitlisted': return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
            default: return 'text-primary bg-blue-500/10 border-blue-500/20';
        }
    };

    const hasAccess = !!user?.role && ALLOWED_ROLES.includes(user.role);
    const isSuperAdmin = user?.role === 'super_admin';
    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><LogoSpinner size="md" /></div>;

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">Restricted to administrators only.</p>
                    <div className="space-y-3">
                        <Button onClick={() => navigate('/')} variant="outline" className="w-full border-red-500/50 text-destructive hover:bg-red-950/30">Return Home</Button>
                        {import.meta.env.DEV && (
                            <div className="pt-4 border-t border-red-500/20">
                                <p className="text-[11px] text-amber-600 font-mono mb-2">⚡ Local Dev Environment Detected</p>
                                <Button 
                                    onClick={() => {
                                        loginAsLocalAdmin();
                                        window.location.reload();
                                    }} 
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20 text-xs"
                                >
                                    🚀 Bypass OAuth (Login as Super Admin)
                                </Button>
                            </div>
                        )}
                    </div>
                </HolographicCard>
            </div>
        );
    }

    return (
        <div className="adm adm-rec">
            <TechGridBackground />

            <div className="adm-page relative z-10 mx-auto max-w-[1600px]">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Header */}
                    <div className="top">
                        <div>
                            <div className="adm-crumbs" style={{ marginBottom: 10 }}>
                                <Link to="/admin">Admin</Link><span className="sep">/</span><span className="last">Recruitment</span>
                            </div>
                            <h1>Recruitment</h1>
                            <div className="sub">Applicant tracking · {applications.length} applicants</div>
                        </div>
                        <div className="form-acts">
                            <Link to="/" className="ghost" style={{ textDecoration: 'none' }}>
                                <ArrowLeft className="w-3.5 h-3.5" style={{ display: 'inline', marginRight: 6 }} />Website
                            </Link>
                            <button type="button" className="ghost" onClick={() => navigate('/interviewer')}>
                                <Video className="w-3.5 h-3.5" style={{ display: 'inline', marginRight: 6 }} />Interviewer portal
                            </button>
                            <span className="tag approved">{isSuperAdmin ? 'Super admin' : user?.role === 'admin' ? 'Admin' : 'Interviewer'}</span>
                            <span className="tag pending" style={{ textTransform: 'capitalize' }}>{currentPhase.replace(/_/g, ' ')}</span>
                        </div>
                    </div>

                    {/* ── Main Tabs ─────────────────────────────────────────── */}
                    <Tabs defaultValue="dashboard" className="w-full">
                        <div className="flex justify-between items-center mb-8 overflow-x-auto pb-2 scrollbar-hide">
                            <TabsList className="h-auto flex-wrap gap-2 rounded-none bg-transparent p-0">
                                <TabsTrigger value="dashboard" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                    <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />DASHBOARD
                                </TabsTrigger>
                                {isAdmin && (
                                    <>
                                        <TabsTrigger value="analytics" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />ANALYTICS
                                        </TabsTrigger>
                                    </>
                                )}
                                <TabsTrigger value="schedule" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5" />SCHEDULE
                                </TabsTrigger>
                                {isSuperAdmin && (
                                    <>
                                        <TabsTrigger value="rankings" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                            <Trophy className="w-3.5 h-3.5 mr-1.5" />RANKINGS
                                        </TabsTrigger>
                                        <TabsTrigger value="committees" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />COMMITTEES & DRAFT
                                        </TabsTrigger>
                                        <TabsTrigger value="activity" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                            <Activity className="w-3.5 h-3.5 mr-1.5" />ACTIVITY
                                        </TabsTrigger>
                                        <TabsTrigger value="import" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
                                            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />IMPORT
                                        </TabsTrigger>
                                    </>
                                )}
                                {isAdmin && (
                                    <>
                                        <TabsTrigger value="settings" className="rounded-[6px] border border-[#C9D8EA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4A5A6E] shadow-none transition-colors data-[state=active]:border-[#3187E8] data-[state=active]:bg-[#3187E8] data-[state=active]:bg-none data-[state=active]:text-white data-[state=active]:shadow-none">
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
                                        canPublish={isSuperAdmin}
                                        onAutoShortlist={() => setIsAutoShortlistOpen(true)}
                                        canAutoShortlist={isSuperAdmin}
                                    />

                                    {/* View Toggle */}
                                    <div className="flex items-center gap-1 bg-white border border-border rounded-md p-1">
                                        <button
                                            onClick={() => switchView('table')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <List className="w-3.5 h-3.5" /> Table
                                        </button>
                                        <button
                                            onClick={() => switchView('kanban')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'}`}
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
                                        </button>
                                    </div>
                                </div>

                                {/* Table View */}
                                {viewMode === 'table' && (
                                    <HolographicCard className="p-0 border-border overflow-hidden">
                                        <div className="max-h-[70vh] overflow-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                            <Table>
                                                <TableHeader className="bg-white sticky top-0 z-10 backdrop-blur-2xl border-b border-border">
                                                    <TableRow className="hover:bg-transparent border-border">
                                                        <TableHead onClick={() => requestSort('fullName')} className="cursor-pointer hover:text-primary transition-colors text-[11px] font-semibold tracking-[0.08em] uppercase py-3">
                                                            <div className="flex items-center gap-2">Name <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead className="text-[11px] font-semibold tracking-[0.08em] uppercase py-3 text-muted-foreground">Dept</TableHead>
                                                        <TableHead onClick={() => requestSort('primaryDept')} className="cursor-pointer hover:text-primary transition-colors text-[11px] font-semibold tracking-[0.08em] uppercase py-3">
                                                            <div className="flex items-center gap-2">Choice 1 <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead onClick={() => requestSort('secondaryDept')} className="cursor-pointer hover:text-primary transition-colors text-[11px] font-semibold tracking-[0.08em] uppercase py-3">
                                                            <div className="flex items-center gap-2">Choice 2 <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead onClick={() => requestSort('finalScore')} className="cursor-pointer hover:text-primary transition-colors text-[11px] font-semibold tracking-[0.08em] uppercase py-3">
                                                            <div className="flex items-center gap-2">Score <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:text-primary transition-colors text-[11px] font-semibold tracking-[0.08em] uppercase py-3 text-center">
                                                            <div className="flex items-center justify-center gap-2">Status <ArrowUpDown className="w-3 h-3" /></div>
                                                        </TableHead>
                                                        <TableHead className="text-[11px] font-semibold tracking-[0.08em] uppercase py-3 text-right pr-5">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="h-64 text-center">
                                                                <LogoSpinner size="md" className="mx-auto" />
                                                                <p className="text-xs text-muted-foreground mt-4">Loading applicants…</p>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : sortedApps.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="h-64 text-center">
                                                                <div className="max-w-xs mx-auto space-y-3">
                                                                    <p className="text-sm font-medium text-foreground">No matches found</p>
                                                                    <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        sortedApps.map((app) => (
                                                            <TableRow
                                                                key={app.id}
                                                                className="hover:bg-white border-border transition-all cursor-pointer group/row"
                                                                onClick={() => setSelectedApp(app)}
                                                            >
                                                                <TableCell className="py-3 pl-5">
                                                                    <div className="font-heading text-sm text-foreground group-hover/row:text-primary transition-colors duration-300">{app.fullName}</div>
                                                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 tracking-tighter opacity-70">{app.rollNumber}</div>
                                                                    {app.programName && (
                                                                        <div className="flex items-center gap-1.5 mt-2">
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-white border border-border text-muted-foreground font-bold tracking-wider uppercase">{app.programCode}</span>
                                                                            <span className="text-[9px] text-primary/50 font-bold tracking-widest uppercase">Batch {app.batch}</span>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="text-xs font-medium text-muted-foreground">{app.programName || app.department || 'Unknown'}</div>
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
                                                                    {app.secondaryDept ? (
                                                                        <>
                                                                            <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-primary text-[10px] font-bold tracking-wider rounded-md">
                                                                                {app.secondaryDept}
                                                                            </Badge>
                                                                            <div className="text-[10px] text-muted-foreground mt-2 font-medium truncate max-w-[150px] opacity-60">
                                                                                {app.secondaryDomains?.join(' · ') || ''}
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground/50 italic">None</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {app.finalScore && app.finalScore > 0 ? (
                                                                        <span className={`font-mono text-sm font-bold ${app.finalScore >= 7 ? 'text-green-600' : app.finalScore >= 5 ? 'text-amber-600' : 'text-destructive'}`}>
                                                                            {app.finalScore.toFixed(1)}
                                                                        </span>
                                                                    ) : app.interviewScore && app.interviewScore > 0 ? (
                                                                        <span className={`font-mono text-sm font-bold ${app.interviewScore >= 7 ? 'text-green-600' : app.interviewScore >= 5 ? 'text-amber-600' : 'text-destructive'}`}>
                                                                            {app.interviewScore.toFixed(1)}
                                                                        </span>
                                                                    ) : (
                                                                        <div className="flex gap-0.5">
                                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                                <Star key={star} className={`w-3 h-3 ${star <= (app.rating || 0) ? 'text-primary fill-primary' : 'text-muted-foreground/30'}`} />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Badge variant="outline" className={`capitalize text-[9px] font-bold tracking-[0.15em] py-0.5 px-2 rounded-[3px] border ${getStatusColor(app.status)} shadow-lg`}>
                                                                        {app.status === 'rejected_pending' ? 'To Reject' : app.status.replace(/_/g, ' ')}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right pr-5">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="w-10 h-10 rounded-md bg-white hover:bg-primary hover:text-white transition-all duration-300 opacity-0 group-hover/row:opacity-100"
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
                                        <div className="px-8 py-3 border-t border-border flex justify-between text-[10px] text-muted-foreground">
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
                                <TabsContent value="rankings" className="outline-none">
                                    <RankingPanel
                                        applications={applications}
                                        onUpdateTaskScore={(id, score) => updateApplication(id, { taskScore: score })}
                                        userEmail={user?.email || ''}
                                    />
                                </TabsContent>

                                <TabsContent value="committees" className="outline-none">
                                    <CommitteeDraftBoard
                                        applications={applications}
                                        onUpdate={updateApplication}
                                    />
                                </TabsContent>

                                <TabsContent value="activity" className="outline-none">
                                    <AuditLogViewer />
                                </TabsContent>

                                <TabsContent value="import" className="outline-none">
                                    <ImportApplications applications={applications} onShortlist={bulkShortlist} />
                                </TabsContent>
                            </>
                        )}

                        {/* ── SCHEDULE TAB ────────────────────────────────── */}
                        <TabsContent value="schedule" className="outline-none">
                            <InterviewScheduler />
                        </TabsContent>

                        {/* ── SETTINGS TAB ─────────────────────────────────── */}
                        {isAdmin && (
                            <TabsContent value="settings" className="space-y-12 outline-none">
                                <AdminSettings />
                            </TabsContent>
                        )}
                    </Tabs>

                    {/* Footer */}
                    <div className="pt-12 pb-6 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold">
                        <span>AI Club · Recruitment</span>
                        <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-green-500" />
                            All systems normal
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
                        currentPhase={currentPhase}
                        onNext={goToNextApp}
                        onPrev={goToPrevApp}
                        hasNext={selectedIndex >= 0 && selectedIndex < sortedApps.length - 1}
                        hasPrev={selectedIndex > 0}
                        currentIndex={selectedIndex}
                        totalCount={sortedApps.length}
                        onAiAnalysisComplete={applyLocalAiAnalysis}
                    />
                )}

                <AutoShortlistDialog
                    open={isAutoShortlistOpen}
                    onClose={() => setIsAutoShortlistOpen(false)}
                    applications={applications}
                    onAnalysisCached={applyLocalAiAnalysis}
                    onShortlist={bulkShortlist}
                />

                <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
                    <DialogContent className="bg-white border-border text-foreground">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-destructive flex items-center gap-2">
                                <ShieldAlert className="w-6 h-6" /> Publish Results
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground pt-4">
                                You are about to publish the final results and send out decision emails to all pending candidates. This action CANNOT be undone.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/80">
                                    Type 'CONFIRM' below to proceed:
                                </label>
                                <Input 
                                    value={publishConfirm1}
                                    onChange={(e) => setPublishConfirm1(e.target.value)}
                                    className="bg-white border-border font-mono tracking-widest uppercase"
                                    placeholder="CONFIRM"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/80">
                                    Type 'CONFIRM' again to double-verify:
                                </label>
                                <Input 
                                    value={publishConfirm2}
                                    onChange={(e) => setPublishConfirm2(e.target.value)}
                                    className="bg-white border-border font-mono tracking-widest uppercase"
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
                                className="bg-red-500/20 text-destructive border border-red-500/50 hover:bg-red-500 hover:text-white"
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
