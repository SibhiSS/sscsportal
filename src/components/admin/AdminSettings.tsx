import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ShieldAlert, Shield, ShieldCheck, User } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { AdminUser, AppSettings, RecruitmentPhase } from '@/types';
import { logAction } from '@/services/auditService';
import { useAuth } from '@/contexts/AuthContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';

const AdminSettings = () => {
    const { user: currentUser } = useAuth();
    const [settings, setSettings] = useState<AppSettings>({
        isOpen: true,
        message: '',
        currentPhase: 'APPLICATIONS_OPEN'
    });
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    const isSuperAdmin = currentUser?.role === 'super_admin';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Fetch Settings
            const { data: settingsData } = await supabase.from('app_settings').select('value').eq('key', 'recruitment_status').single();
            if (settingsData) setSettings(settingsData.value);

            // 2. Fetch Admins
            const { data: adminsData } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
            if (adminsData) {
                setAdmins(adminsData.map((a: any) => ({
                    id: a.id,
                    email: a.email,
                    role: a.role,
                    createdAt: a.created_at,
                    addedBy: a.added_by
                })));
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAllApplications = async () => {
        if (!confirm("WARNING: Are you sure you want to delete ALL application data for a new recruitment drive? This action CANNOT be undone.")) {
            return;
        }
        const confirmText = prompt("Type DELETE ALL to confirm:");
        if (confirmText !== "DELETE ALL") {
            toast.error("Confirmation failed. Applications were NOT deleted.");
            return;
        }

        try {
            const { error } = await supabase.from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;

            toast.success("All applications have been successfully cleared!");
            logAction(currentUser?.email || 'unknown', 'PURGE_ALL_APPLICATIONS', undefined, {});
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            console.error("Error purging applications:", err);
            toast.error("Failed to delete applications: " + err.message);
        }
    };

    const handleAnonymizeRejected = async () => {
        if (!confirm("Are you sure you want to anonymize all rejected applicants?")) return;
        try {
            const { error } = await supabase
                .from('applications')
                .update({ full_name: 'Anonymized Candidate', phone: '0000000000', email: 'anonymized@sscs.org' })
                .eq('status', 'rejected');

            if (error) throw error;
            toast.success("Rejected applicants anonymized successfully!");
            logAction(currentUser?.email || 'unknown', 'ANONYMIZE_REJECTED_APPLICANTS', undefined, {});
        } catch (err: any) {
            toast.error("Failed to anonymize: " + err.message);
        }
    };

    const handleClearAuditLogs = async () => {
        if (!confirm("Are you sure you want to clear audit logs?")) return;
        try {
            const { error } = await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            toast.success("Audit logs cleared successfully!");
            logAction(currentUser?.email || 'unknown', 'CLEAR_AUDIT_LOGS', undefined, {});
        } catch (err: any) {
            toast.error("Failed to clear audit logs: " + err.message);
        }
    };

    const toggleRecruitment = async (checked: boolean) => {
        const newSettings = { ...settings, isOpen: checked };
        setSettings(newSettings);

        const { error } = await supabase.from('app_settings')
            .update({ value: newSettings })
            .eq('key', 'recruitment_status');

        if (error) {
            console.error("Failed to save recruitment status:", error);
            toast.error("Failed to update status: " + error.message);
        } else {
            toast.success(checked ? "Applications are now OPEN" : "Emergency Stop activated - Form CLOSED");
        }

        logAction(currentUser?.email || 'unknown', 'TOGGLE_RECRUITMENT', undefined, { isOpen: checked });
    };

    const changePhase = async (phase: RecruitmentPhase) => {
        if (phase === 'RESULTS_PUBLISHED' && !isSuperAdmin) {
            toast.error("Restricted: Only Super Admin can publish results.");
            return;
        }

        const newSettings = { ...settings, currentPhase: phase };
        if (phase === 'APPLICATIONS_OPEN') newSettings.isOpen = true;
        else newSettings.isOpen = false;

        setSettings(newSettings);

        const { error } = await supabase.from('app_settings')
            .update({ value: newSettings })
            .eq('key', 'recruitment_status');

        if (error) {
            console.error("Failed to save phase change:", error);
            toast.error("Failed to save phase: " + error.message);
        } else {
            toast.success(`Recruitment phase updated to ${phase.replace(/_/g, ' ')}`);
        }

        logAction(currentUser?.email || 'unknown', 'CHANGE_PHASE', undefined, { phase });
    };

    const saveRecruitmentSettings = async () => {
        setSavingSettings(true);
        try {
            const { error } = await supabase.from('app_settings')
                .update({ value: settings })
                .eq('key', 'recruitment_status');

            if (error) throw error;
            toast.success("All recruitment settings saved successfully!");
            if (currentUser?.email) {
                await logAction(currentUser.email, 'UPDATE_RECRUITMENT_SETTINGS', undefined, settings);
            }
        } catch (err: any) {
            console.error("Error saving recruitment settings:", err);
            toast.error("Failed to save settings: " + (err.message || 'Unknown error'));
        } finally {
            setSavingSettings(false);
        }
    };

    const addAdmin = async () => {
        if (!newAdminEmail) return;
        if (!isSuperAdmin) {
            toast.error("Only Super Admins can add new users.");
            return;
        }

        const newAdmin = {
            email: newAdminEmail,
            role: 'interviewer', // Default role for new additions
            added_by: currentUser?.email
        };

        const { error } = await supabase.from('admins').insert(newAdmin);

        if (error) {
            console.error("Supabase Error adding admin:", error);
            
            // If it's a column missing error, try without added_by as fallback
            if (error.message.includes('added_by') || error.code === '42703') {
                const { error: retryError } = await supabase.from('admins').insert({
                    email: newAdminEmail,
                    role: 'interviewer'
                });
                
                if (retryError) {
                    toast.error(`Database Error: ${retryError.message}`);
                } else {
                    toast.success('Admin added (but database schema needs update).');
                    setNewAdminEmail('');
                    fetchData();
                }
            } else {
                toast.error(`Failed to add admin: ${error.message}`);
            }
        } else {
            toast.success('Admin added successfully.');
            setNewAdminEmail('');
            fetchData();
            logAction(currentUser?.email || 'unknown', 'ADD_ADMIN', newAdminEmail, { role: 'interviewer' });
        }
    };

    const updateAdminRole = async (email: string, newRole: string) => {
        if (!isSuperAdmin) {
            toast.error("Access Denied: Only Super Admin can update roles.");
            return;
        }

        const { error } = await supabase.from('admins').update({ role: newRole }).eq('email', email);
        if (error) {
            toast.error("Failed to update role");
        } else {
            toast.success(`Updated ${email} to ${newRole}`);
            setAdmins(prev => prev.map(a => a.email === email ? { ...a, role: newRole as any } : a));
            logAction(currentUser?.email || 'unknown', 'UPDATE_ADMIN_ROLE', email, { role: newRole });
        }
    };

    const removeAdmin = async (email: string) => {
        if (!isSuperAdmin) {
            toast.error("Access Denied");
            return;
        }
        if (!confirm(`Permanently remove ${email} from the admin team?`)) return;

        await supabase.from('admins').delete().eq('email', email);
        setAdmins(prev => prev.filter(a => a.email !== email));
        toast.success("User removed");
        logAction(currentUser?.email || 'unknown', 'REMOVE_ADMIN', email);
    };

    if (loading) return <div className="flex justify-center p-12"><LogoSpinner size="md" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">System Configuration</h2>
                {!isSuperAdmin && (
                    <span className="px-3 py-1 rounded-full border bg-muted text-muted-foreground text-xs font-medium">
                        Read Only Mode
                    </span>
                )}
            </div>

            <Tabs defaultValue="team" className="w-full">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-2 bg-transparent p-0">
                    <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card hover:bg-muted transition-all">
                        <User className="w-4 h-4 mr-2" />
                        User Management
                    </TabsTrigger>
                    {isSuperAdmin && (
                        <>
                            <TabsTrigger value="recruitment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card hover:bg-muted transition-all">
                                <ShieldAlert className="w-4 h-4 mr-2" />
                                Recruitment Phase
                            </TabsTrigger>
                            <TabsTrigger value="data" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground border bg-card hover:bg-muted transition-all">
                                <Shield className="w-4 h-4 mr-2" />
                                Data Retention
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                {/* --- TEAM MANAGEMENT --- */}
                <TabsContent value="team" className="space-y-6 pt-6">
                    {/* Add User Bar */}
                    {isSuperAdmin && (
                        <div className="flex gap-4 items-center bg-card p-4 border rounded-lg shadow-sm">
                            <Plus className="w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="new_user@email.com"
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                className="border-muted bg-background"
                            />
                            <Button onClick={addAdmin} disabled={!newAdminEmail} size="sm">
                                Grant Access
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {admins.map((admin) => (
                            <div key={admin.id} className="relative group">
                                <Card className="h-full hover:shadow-md transition-shadow">
                                    <CardContent className="p-5 pt-6 flex flex-col justify-between h-full space-y-4">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${admin.role === 'super_admin' ? 'bg-primary/10 text-primary' :
                                                        admin.role === 'admin' ? 'bg-blue-500/10 text-blue-500' :
                                                            'bg-muted text-muted-foreground'
                                                        }`}>
                                                        {admin.email.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm truncate max-w-[160px]" title={admin.email}>{admin.email}</h4>
                                                        <p className="text-xs text-muted-foreground capitalize">
                                                            {admin.role.replace('_', ' ')}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isSuperAdmin && admin.email !== currentUser?.email && (
                                                    <Button size="icon" variant="ghost" onClick={() => removeAdmin(admin.email)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Assigned Role</Label>
                                                <Select
                                                    value={admin.role}
                                                    onValueChange={(val) => updateAdminRole(admin.email, val)}
                                                    disabled={!isSuperAdmin}
                                                >
                                                    <SelectTrigger className="w-full h-9 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="super_admin">Super Admin</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="interviewer">Interviewer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t flex justify-between items-center text-[10px] text-muted-foreground">
                                            <span>Added: {new Date(admin.createdAt).toLocaleDateString()}</span>
                                            <span>By: {admin.addedBy ? admin.addedBy.split('@')[0] : 'System'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* --- RECRUITMENT PHASES --- */}
                <TabsContent value="recruitment" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-primary" />
                                Recruitment Phases
                            </CardTitle>
                            <CardDescription>Manage the lifecycle of the recruitment process.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-muted/50 p-6 rounded-lg border">
                                <Label className="text-lg font-medium mb-2 block">Current Global Phase</Label>
                                <p className="text-sm text-muted-foreground mb-4">Changing this affects what applicants see and what admins can do.</p>
                                <Select value={settings.currentPhase || 'APPLICATIONS_OPEN'} onValueChange={(val: RecruitmentPhase) => changePhase(val)}>
                                    <SelectTrigger className="w-full h-12 bg-background">
                                        <SelectValue placeholder="Select Phase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="APPLICATIONS_OPEN">
                                            <span className="font-semibold text-green-600">Applications Open</span> - Public applies, live data.
                                        </SelectItem>
                                        <SelectItem value="REVIEW_PHASE">
                                            <span className="font-semibold text-yellow-600">Review Phase</span> - Form closed, admins reviewing apps.
                                        </SelectItem>
                                        <SelectItem value="INTERVIEWS_ONGOING">
                                            <span className="font-semibold text-blue-600">Interviews Ongoing</span> - Scheduling & Interviewing candidates.
                                        </SelectItem>
                                        <SelectItem value="RESULTS_PUBLISHED" disabled={!isSuperAdmin}>
                                            <span className="font-semibold text-purple-600">Results Published</span> - Final selection done. {!isSuperAdmin && '(Super Admin Only)'}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between bg-destructive/5 border border-destructive/20 p-6 rounded-lg">
                                <div className="space-y-1">
                                    <Label htmlFor="recruitment-mode" className="text-lg font-medium text-destructive">
                                        Manual Override: Emergency Stop
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Force close the application form regardless of the current phase.
                                    </p>
                                </div>
                                <Switch
                                    id="recruitment-mode"
                                    checked={!settings.isOpen}
                                    onCheckedChange={(checked) => toggleRecruitment(!checked)}
                                />
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button
                                    onClick={saveRecruitmentSettings}
                                    disabled={savingSettings}
                                    className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl shadow-lg"
                                >
                                    {savingSettings ? 'Saving Settings...' : 'Save Recruitment Settings'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- DATA RETENTION --- */}
                <TabsContent value="data" className="space-y-4 pt-4">
                    <Card className="border-destructive/20 bg-destructive/5">
                        <CardHeader>
                            <CardTitle className="text-destructive">Restricted Zone: Data Retention</CardTitle>
                            <CardDescription>Manage sensitive data policies. Actions here are irreversible.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 border border-destructive/40 rounded bg-destructive/10 flex justify-between items-center">
                                <div>
                                    <h4 className="font-medium text-destructive">Purge All Applications (Start Fresh Recruitment)</h4>
                                    <p className="text-sm text-muted-foreground">Delete all previous candidate application records to reset the portal for new recruitments.</p>
                                </div>
                                <Button variant="destructive" onClick={handleClearAllApplications}>
                                    Purge Data
                                </Button>
                            </div>
                            <div className="p-4 border border-destructive/20 rounded bg-background flex justify-between items-center">
                                <div>
                                    <h4 className="font-medium">Anonymize Rejected Applicants</h4>
                                    <p className="text-sm text-muted-foreground">Remove PII (Name, Email, Phone) for rejected applicants.</p>
                                </div>
                                <Button variant="destructive" onClick={handleAnonymizeRejected}>
                                    Execute
                                </Button>
                            </div>
                            <div className="p-4 border border-destructive/20 rounded bg-background flex justify-between items-center">
                                <div>
                                    <h4 className="font-medium">Clear Audit Logs</h4>
                                    <p className="text-sm text-muted-foreground">Delete system audit logs.</p>
                                </div>
                                <Button variant="destructive" onClick={handleClearAuditLogs}>
                                    Execute
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AdminSettings;
