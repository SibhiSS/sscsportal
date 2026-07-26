import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Star, CheckCircle, XCircle, MinusCircle, Trash2, Calendar, Clock, Save, Github, Linkedin, FileText, ExternalLink, Users } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { Application, ApplicationStatus, RecruitmentPhase } from '@/types';
import { canTransition, canPerformAction } from '@/lib/fsm';
import { useAuth } from '@/contexts/AuthContext';
import CandidateTimeline from '@/components/admin/CandidateTimeline';
import MultiInterviewerPanel from '@/components/admin/MultiInterviewerPanel';
import AICopilotPanel from '@/components/admin/AICopilotPanel';
import TeamNotesFeed from '@/components/admin/TeamNotesFeed';

interface ApplicationModalProps {
    application: Application | null;
    open: boolean;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<Application>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    currentPhase?: RecruitmentPhase;
}

const ApplicationModal: React.FC<ApplicationModalProps> = ({
    application,
    open,
    onClose,
    onUpdate,
    onDelete,
    currentPhase = 'APPLICATIONS_OPEN'
}) => {
    const { user } = useAuth();
    // Logic duplicated from Admin.tsx for consistency
    const ADMIN_EMAILS = [
        'sibhi.s2024@vitstudent.ac.in',
        'sibhis5223@gmail.com',
        'santhosh.v2024d@vitstudent.ac.in',
        'tspradeepkumar@vit.ac.in'
    ];
    const isSuperAdmin = user?.role === 'super_admin' || (user?.email && ADMIN_EMAILS.includes(user.email) && !user?.role);

    if (!application) return null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-3xl bg-black/90 border-white/10 text-foreground backdrop-blur-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                <span>{application.fullName}</span>
                                <Badge variant="outline" className="text-base font-normal">{application.rollNumber}</Badge>
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground mt-1 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Applied on {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : 'Unknown Date'}
                                <span className="mx-1">•</span>
                                <Clock className="w-3 h-3" />
                                {application.submittedAt ? new Date(application.submittedAt).toLocaleTimeString() : ''}
                            </DialogDescription>

                            {/* Derived Metadata Badge Block */}
                            <div className="flex gap-2 mt-3">
                                {application.programCode && (
                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                                        {application.programCode}
                                    </Badge>
                                )}
                                {application.batch && (
                                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                                        Batch {application.batch}
                                    </Badge>
                                )}
                                {application.programCategory && (
                                    <Badge variant="secondary" className="bg-white/5 text-muted-foreground border-white/10">
                                        {application.programCategory}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        {/* Status Badge in Header */}
                        <Badge variant="outline" className={`capitalize px-3 py-1 text-sm ${application.status === 'selected' ? 'text-green-500 border-green-500/50 bg-green-500/10' :
                            application.status === 'shortlisted' ? 'text-cyan-500 border-cyan-500/50 bg-cyan-500/10' :
                                application.status === 'rejected' ? 'text-red-500 border-red-500/50 bg-red-500/10' :
                                    application.status === 'rejected_pending' ? 'text-orange-500 border-orange-500/50 bg-orange-500/10' :
                                        application.status === 'neutral' ? 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10' :
                                            'text-blue-500 border-blue-500/50 bg-blue-500/10'
                            }`}>
                            {application.status === 'rejected_pending' ? 'To Reject' : application.status}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-8 mt-4">
                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 gap-4">
                        <div className="flex items-center gap-2">
                        </div>
                        {isSuperAdmin && (
                            <div className="flex gap-2 flex-wrap justify-end">
                                <Button
                                    size="sm"
                                    variant={application.status === 'rejected_pending' ? 'destructive' : 'outline'}
                                    onClick={() => onUpdate(application.id, { status: 'rejected_pending' })}
                                    disabled={!canTransition(application.status, 'rejected_pending') || !canPerformAction(currentPhase, 'canReview')}
                                    className={application.status === 'rejected_pending' ? '' : 'border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500'}
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    {application.status === 'rejected_pending' ? 'Marked to Reject' : 'Reject'}
                                </Button>

                                <Button
                                    size="sm"
                                    variant={application.status === 'shortlisted' ? 'default' : 'outline'}
                                    onClick={() => onUpdate(application.id, { status: 'shortlisted' })}
                                    disabled={!canTransition(application.status, 'shortlisted') || !canPerformAction(currentPhase, 'canReview')}
                                    className={application.status === 'shortlisted'
                                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                        : 'border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10 hover:border-cyan-500'
                                    }
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    {application.status === 'shortlisted' ? 'Shortlisted' : 'Shortlist'}
                                </Button>
                            </div>
                        )}
                        
                        {isSuperAdmin && ['interview_scheduled', 'interviewed', 'waitlisted', 'selected', 'rejected'].includes(application.status) && (
                            <div className="flex gap-2 flex-wrap justify-end mt-2 sm:mt-0 w-full sm:w-auto">
                                <Button
                                    size="sm"
                                    variant={application.status === 'rejected' ? 'destructive' : 'outline'}
                                    onClick={() => onUpdate(application.id, { status: 'rejected' })}
                                    disabled={!canTransition(application.status, 'rejected') || !canPerformAction(currentPhase, 'canDecide')}
                                    className={application.status === 'rejected' ? '' : 'border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500'}
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant={application.status === 'waitlisted' ? 'secondary' : 'outline'}
                                    onClick={() => onUpdate(application.id, { status: 'waitlisted' })}
                                    disabled={!canTransition(application.status, 'waitlisted') || !canPerformAction(currentPhase, 'canDecide')}
                                    className={application.status === 'waitlisted' ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500'}
                                >
                                    <MinusCircle className="w-4 h-4 mr-2" />
                                    Waitlist
                                </Button>
                                <Button
                                    size="sm"
                                    variant={application.status === 'selected' ? 'default' : 'outline'}
                                    onClick={() => onUpdate(application.id, { status: 'selected' })}
                                    disabled={!canTransition(application.status, 'selected') || !canPerformAction(currentPhase, 'canDecide')}
                                    className={application.status === 'selected'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'border-green-500/50 text-green-500 hover:bg-green-500/10 hover:border-green-500'
                                    }
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Select
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* AI Copilot Panel */}
                    <AICopilotPanel application={application} />

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-primary border-b border-primary/20 pb-2">Personal Details</h3>
                            <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-4 text-sm">
                                <span className="text-muted-foreground">Email:</span>
                                <span className="break-all">{application.email}</span>
                                <span className="text-muted-foreground">Phone:</span>
                                <span>{application.phone}</span>
                                <span className="text-muted-foreground">Department:</span>
                                <span>{application.programName || application.department || 'Unknown'}</span>
                                <span className="text-muted-foreground">Year:</span>
                                <span>{application.batch || application.admissionYear || application.year || 'Unknown'}</span>
                                <span className="text-muted-foreground">Residence:</span>
                                <span>{application.hostelDay || 'Unknown'}</span>
                                <span className="text-muted-foreground">Availability:</span>
                                <span>{application.weeklyHours ? `${application.weeklyHours} hours/week` : 'Unknown'}</span>
                            </div>
                        </div>

                        {/* Primary Choice */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-primary border-b border-primary/20 pb-2">Primary Choice</h3>
                            <div>
                                <Badge className="bg-primary hover:bg-primary/90 mb-2">{application.primaryDept}</Badge>
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {application.domains.map(d => (
                                        <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">1st Preference Answer</span>
                                        <p className="text-sm bg-white/5 p-3 rounded-md border border-white/5 leading-relaxed whitespace-pre-wrap">{application.skills || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">Why Join SSCS?</span>
                                        <p className="text-sm bg-white/5 p-3 rounded-md border border-white/5 max-h-[150px] overflow-y-auto leading-relaxed whitespace-pre-wrap">{application.reason || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Secondary Choice */}
                        {application.secondaryDept && (
                            <div className="space-y-4 md:col-span-2">
                                <h3 className="text-lg font-semibold text-primary/70 border-b border-primary/20 pb-2">Secondary Choice</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <Badge variant="secondary" className="mb-2">{application.secondaryDept}</Badge>
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {application.secondaryDomains.map(d => (
                                                <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">2nd Preference Answer</span>
                                            <p className="text-sm bg-white/5 p-3 rounded-md border border-white/5 whitespace-pre-wrap">{application.secondarySkills || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">Why these departments?</span>
                                            <p className="text-sm bg-white/5 p-3 rounded-md border border-white/5 max-h-[150px] overflow-y-auto leading-relaxed whitespace-pre-wrap">{application.secondaryReason || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Committee Discussion Feed (@mentions enabled) */}
                        <div className="md:col-span-2 border-t border-dashed border-white/10 pt-6 mt-2">
                            <TeamNotesFeed applicationId={application.id} />
                        </div>

                        {/* Social Links */}
                        {(application.githubUrl || application.linkedinUrl || application.portfolioUrl) && (
                            <div className="md:col-span-2 border-t border-dashed border-white/10 pt-6 mt-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Links</h4>
                                <div className="flex flex-wrap gap-2">
                                    {application.githubUrl && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-muted-foreground hover:text-white text-xs"
                                            onClick={() => window.open(application.githubUrl, '_blank')}
                                        >
                                            <Github className="w-3 h-3 mr-1.5" /> GitHub
                                            <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                                        </Button>
                                    )}
                                    {application.linkedinUrl && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-muted-foreground hover:text-white text-xs"
                                            onClick={() => window.open(application.linkedinUrl, '_blank')}
                                        >
                                            <Linkedin className="w-3 h-3 mr-1.5" /> LinkedIn
                                            <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                                        </Button>
                                    )}
                                    {application.portfolioUrl && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-muted-foreground hover:text-white text-xs"
                                            onClick={() => window.open(application.portfolioUrl, '_blank')}
                                        >
                                            <ExternalLink className="w-3 h-3 mr-1.5" /> Portfolio
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Candidate Timeline */}
                        <div className="md:col-span-2 border-t border-dashed border-white/10 pt-6 mt-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Application Timeline</h4>
                            <CandidateTimeline application={application} />
                        </div>

                        {/* Multi-Interviewer Panel */}
                        {['interview_scheduled', 'interviewed', 'selected', 'waitlisted', 'rejected'].includes(application.status) && (
                            <div className="md:col-span-2 border-t border-dashed border-white/10 pt-6 mt-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" />
                                    Interview Evaluations
                                </h4>
                                <MultiInterviewerPanel applicationId={application.id} />
                            </div>
                        )}

                        {/* Delete Action */}
                        <div className="md:col-span-2 pt-4 border-t border-white/10 flex justify-end">
                            <Button
                                variant="destructive"
                                onClick={() => onDelete(application.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Application
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ApplicationModal;
