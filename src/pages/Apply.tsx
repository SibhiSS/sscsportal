import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, User, Code, FileText, Phone, ArrowRight, ChevronLeft, LogIn, Trophy, Clock, XOctagon, Calendar as CalendarIcon, Video } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { format, parseISO, isSameDay } from 'date-fns';
import { Link } from 'react-router-dom';
import TechGridBackground from '@/components/ui/TechGridBackground';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { validateRegistrationNumber, RegNoDetails } from '@/utils/validation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ── Interview Scheduled Status Component ──────────────────────────────────────
const InterviewScheduledStatus = ({ app }: { app: any }) => {
    const [slotInfo, setSlotInfo] = useState<{ start_time: string; panel_id: number } | null>(null);
    const [meetingLink, setMeetingLink] = useState<string | null>(null);

    useEffect(() => {
        const fetchSlotInfo = async () => {
            // Get the booked slot for this application
            const { data: slot } = await supabase
                .from('interview_slots')
                .select('start_time, panel_id')
                .eq('booked_by', app.id)
                .single();
            if (slot) {
                setSlotInfo(slot);
                // Get the meeting link from panel_assignments
                const dateStr = format(parseISO(slot.start_time), 'yyyy-MM-dd');
                const { data: assignment } = await supabase
                    .from('panel_assignments')
                    .select('meeting_link')
                    .eq('panel_id', slot.panel_id)
                    .eq('date', dateStr)
                    .not('meeting_link', 'is', null)
                    .limit(1)
                    .single();
                if (assignment?.meeting_link?.trim()) {
                    setMeetingLink(assignment.meeting_link.trim());
                }
            }
        };
        fetchSlotInfo();
    }, [app.id]);

    return (
        <>
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                <Video className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-3xl font-heading font-bold mb-2 text-white">Interview Scheduled</h2>
            <div className="inline-block px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-6 text-sm font-medium">
                ✓ Confirmed
            </div>

            {/* Slot info */}
            <div className="p-5 bg-white/5 rounded-xl border border-white/10 text-left mb-5 max-w-sm mx-auto space-y-3">
                {slotInfo && (
                    <>
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Date</div>
                            <div className="font-medium text-white">{format(parseISO(slotInfo.start_time), 'EEEE, MMMM d, yyyy')}</div>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Time</div>
                            <div className="font-bold text-purple-300 text-lg font-mono">{format(parseISO(slotInfo.start_time), 'h:mm a')}</div>
                        </div>
                        <div className="h-px bg-white/5" />
                    </>
                )}
                <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Department</div>
                    <div className="font-medium text-primary">{app.primary_dept}</div>
                </div>
            </div>

            {/* Meeting link */}
            {meetingLink ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-6 max-w-sm mx-auto">
                    <div className="text-[10px] text-green-400 uppercase tracking-widest mb-2 font-bold">Meeting Link Ready</div>
                    <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors"
                    >
                        <Video className="w-4 h-4" />
                        Join Interview
                    </a>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground mb-6">
                    Your meeting link will appear here and be emailed to you once assigned.
                </p>
            )}
        </>
    );
};

const Apply = () => {
    const { user, signInWithGoogle, loading: authLoading } = useAuth();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: user?.displayName || '',
        rollNumber: '',
        phone: '',
        linkedinUrl: '',
        githubUrl: '',
        primaryDept: '',
        domains: [] as string[],
        skills: '',
        reason: '',
        secondaryDept: '',
        secondaryDomains: [] as string[],
        secondarySkills: '',
        secondaryReason: ''
    });

    useEffect(() => {
        if (user?.uid) {
            const savedData = localStorage.getItem(`sscsFormData_${user.uid}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.formData) {
                        setFormData(prev => ({ ...prev, ...parsed.formData }));
                    }
                } catch (e) {
                    console.error("Failed to parse cached form data");
                }
            }
        }
    }, [user]);

    // Debounced localStorage write — avoids serializing on every keystroke
    useEffect(() => {
        if (!user?.uid) return;
        const timer = setTimeout(() => {
            localStorage.setItem(`sscsFormData_${user.uid}`, JSON.stringify({ formData }));
        }, 400);
        return () => clearTimeout(timer);
    }, [formData, user?.uid]);

    // Validation State
    const [regValidation, setRegValidation] = useState<RegNoDetails | null>(null);
    const [regError, setRegError] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [existingApp, setExistingApp] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [recruitmentStatus, setRecruitmentStatus] = useState<{ isOpen: boolean, message: string }>({ isOpen: true, message: '' });

    useEffect(() => {
        checkRecruitmentStatus();
    }, []);

    const checkRecruitmentStatus = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'recruitment_status').single();
            if (data) {
                setRecruitmentStatus(data.value);
            }
        } catch (error) {
            console.error("Error checking recruitment status:", error);
        }
    };

    useEffect(() => {
        if (user) {
            setCheckingStatus(true);
            checkApplicationStatus();

            // Auto-parse Name and Registration Number from VIT Google Login
            const rawName = user.displayName || '';
            const regMatch = rawName.match(/(\d{2}[A-Z]{3}\d{4})/i);
            
            if (regMatch) {
                const regNo = regMatch[1].toUpperCase();
                const cleanName = rawName.replace(regMatch[0], '').trim();
                
                setFormData(prev => ({
                    ...prev,
                    fullName: cleanName,
                    rollNumber: regNo
                }));

                // Trigger validation for the parsed registration number
                const validation = validateRegistrationNumber(regNo);
                setRegValidation(validation);
                setRegError(validation.isValid ? null : (validation.error || 'Invalid Registration Number'));
            } else {
                setFormData(prev => ({ ...prev, fullName: rawName }));
            }
        } else {
            setCheckingStatus(false);
            setExistingApp(null);
        }
    }, [user]);

    const checkApplicationStatus = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .or(`user_id.eq.${user.uid},email.eq.${user.email}`);

            if (error) {
                console.error("Error fetching application:", error);
                throw error;
            }

            if (data && data.length > 0) {
                const app = data[0];
                setExistingApp(app);
                
                // Populate formData for potential editing
                setFormData({
                    fullName: app.full_name || '',
                    rollNumber: app.roll_number || '',
                    phone: app.phone || '',
                    linkedinUrl: app.linkedin_url || '',
                    githubUrl: app.github_url || '',
                    primaryDept: app.primary_dept || '',
                    domains: app.domains || [],
                    skills: app.skills || '',
                    reason: app.reason || '',
                    secondaryDept: app.secondary_dept || '',
                    secondaryDomains: app.secondary_domains || [],
                    secondarySkills: app.secondary_skills || '',
                    secondaryReason: app.secondary_reason || ''
                });
                
                if (app.roll_number) {
                    const validation = validateRegistrationNumber(app.roll_number);
                    setRegValidation(validation);
                }
            } else {
                setExistingApp(null);
            }
        } catch (error) {
            console.error("Error checking application status:", error);
        } finally {
            setCheckingStatus(false);
        }
    };

    const domainOptions: Record<string, string[]> = {
        'Technical': [
            'Projects',
            'Research',
            'Web Development'
        ],
        'Management': [
            'Finance',
            'Internal Coordination',
            'Documentation'
        ],
        'Creative': [
            'Design',
            'Content — reels & posts',
            'Social Media'
        ],
        'Outreach & Partnerships': [
            'Industry Relations',
            'Speaker Acquisition',
            'Sponsorships'
        ],
        'Human Resources': [
            'Recruitment',
            'Member Engagement',
            'Conflict Resolution'
        ],
        'Event Operations': [
            'Event Planning',
            'Event Execution',
            'On-ground Operations'
        ]
    };

    const skillLabels: Record<string, string> = {
        'Technical': 'Technical Skills',
        'Creative': 'Creative Tools & Portfolio',
        'Management': 'Management Experience',
        'Human Resources': 'HR & Communication Skills',
        'Event Operations': 'Execution & Logistics Skills',
        'Outreach & Partnerships': 'Negotiation & Communication',
        'default': 'Relevant Skills'
    };

    const skillPlaceholders: Record<string, string> = {
        'Technical': 'e.g. Python, C++, PCB Design, React, ML...',
        'Creative': 'e.g. Photoshop, Premiere Pro, Copywriting...',
        'Management': 'e.g. Finance, Documentation, Team Leadership...',
        'Human Resources': 'e.g. Recruitment, Conflict Management, People Skills...',
        'Event Operations': 'e.g. Event Logistics, Planning, Execution...',
        'Outreach & Partnerships': 'e.g. Negotiation, PR, Industry Outreach...',
        'default': 'List your relevant skills here...'
    };

    const reasonPlaceholders: Record<string, string> = {
        'Technical': 'Tell us about your projects or what you want to research...',
        'Creative': 'Share your design style or portfolio links...',
        'Management': 'Describe your interest in finance or documentation...',
        'Human Resources': 'How would you help manage member engagement?',
        'Event Operations': 'What makes you good at on-ground execution?',
        'Outreach & Partnerships': 'How would you connect us with industry partners?',
        'default': 'Tell us about your motivation...'
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            const val = value.replace(/\D/g, '').slice(0, 10);
            setFormData(prev => ({ ...prev, phone: val }));
            return;
        }

        if (name === 'primaryDept') {
            setFormData(prev => ({ ...prev, primaryDept: value, domains: [] }));
        } else if (name === 'secondaryDept') {
            setFormData(prev => ({ ...prev, secondaryDept: value, secondaryDomains: [] }));
        } else if (name === 'rollNumber') {
            const normalized = value.toUpperCase();
            setFormData(prev => ({ ...prev, rollNumber: normalized }));

            // Validate Logic
            const validation = validateRegistrationNumber(normalized);
            setRegValidation(validation);

            if (!validation.isValid) {
                setRegError(validation.error || 'Invalid Registration Number');
            } else {
                setRegError(null);
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleDomainToggle = (domain: string, isSecondary = false) => {
        setFormData(prev => {
            return isSecondary
                ? { ...prev, secondaryDomains: [domain] }
                : { ...prev, domains: [domain] };
        });
    };

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.fullName.trim()) {
            alert("Please enter your Full Name.");
            return;
        }

        if (regError || !regValidation?.isValid) {
            alert("Please enter a valid Registration Number.");
            return;
        }

        if (!formData.phone || formData.phone.length !== 10) {
            alert("Please enter a valid 10-digit phone number.");
            return;
        }

        if (!formData.primaryDept) {
            alert("Please select a Primary Department.");
            return;
        }

        if (!formData.domains || formData.domains.length === 0) {
            alert("Please select at least one role for your Primary Department.");
            return;
        }

        if (!formData.skills.trim()) {
            alert("Please fill in your relevant skills.");
            return;
        }

        if (!formData.reason.trim()) {
            alert("Please tell us why you want to join this department.");
            return;
        }

        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrevStep = () => {
        setStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Final safety check to prevent double submission if not editing
        if (existingApp && !isEditing) {
            alert("You have already submitted an application!");
            return;
        }

        if (formData.phone.length !== 10) {
            alert("Phone number must be exactly 10 digits.");
            return;
        }

        setIsSubmitting(true);

        try {
            const applicationData = {
                user_id: user.uid,
                email: user.email,
                full_name: formData.fullName,
                roll_number: formData.rollNumber,
                phone: formData.phone,
                linkedin_url: formData.linkedinUrl,
                github_url: formData.githubUrl,

                primary_dept: formData.primaryDept,
                domains: formData.domains,
                skills: formData.skills,
                reason: formData.reason,
                secondary_dept: formData.secondaryDept,
                secondary_domains: formData.secondaryDomains,
                secondary_skills: formData.secondarySkills,
                secondary_reason: formData.secondaryReason,
                status: existingApp ? existingApp.status : 'applied',

                // Derived Metadata
                admission_year: regValidation?.admissionYear,
                program_code: regValidation?.programCode,
                program_name: regValidation?.programName,
                batch: regValidation?.batch,
                program_category: regValidation?.programCategory
            };

            let error;
            if (existingApp && isEditing) {
                const { error: updateError } = await supabase.from('applications').update(applicationData).eq('id', existingApp.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase.from('applications').insert(applicationData);
                error = insertError;
            }

            if (error) throw error;

            console.log("Application saved to Supabase successfully");
            
            if (user?.uid) {
                localStorage.removeItem(`sscsFormData_${user.uid}`);
            }

            // --- SEND CONFIRMATION EMAIL ONLY FOR NEW APPLICATIONS ---
            if (!isEditing) {
                try {
                    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSuKNXGi-08iJ_NgkEeh_wpt0AUu3Hjy4CXMTZNMe417idYTviLKK97NBPU1kJbpqTMA/exec";

                    await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        subject: "Application Confirmation - IEEE SSCS Recruitment",
                        message: `
                            <div style="font-family: 'Raleway', sans-serif; background-color: #050505; color: #e5e5e5; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                                
                                <div style="background-color: #000000; padding: 40px 20px; text-align: center; border-bottom: 1px solid #1a1a1a;">
                                    <h1 style="color: #ffffff; font-family: 'Inter', sans-serif; margin: 0; text-transform: uppercase; letter-spacing: 2px; font-size: 16px; font-weight: 600;">IEEE Solid-State Circuits Society</h1>
                                </div>

                                <div style="padding: 45px 40px;">
                                    <h2 style="color: #FFE100; font-family: 'Inter', sans-serif; margin-top: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Application Confirmation</h2>
                                    <p style="font-size: 15px; line-height: 1.6; color: #d1d5db;">Dear <strong>${formData.fullName}</strong>,</p>
                                    <p style="font-size: 15px; line-height: 1.6; color: #d1d5db;">Thank you for your interest in joining the IEEE SSCS. Your application has been successfully received and is now under review by our recruitment committee.</p>
                                    
                                    <div style="background-color: #0a0a0a; border: 1px solid #1f2937; padding: 25px; border-radius: 8px; margin: 30px 0;">
                                        <table style="width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 14px;">
                                            <tr>
                                                <td style="color: #9ca3af; padding-bottom: 12px; width: 120px;">Registration:</td>
                                                <td style="color: #ffffff; padding-bottom: 12px; font-weight: 500;">${formData.rollNumber}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #9ca3af; padding-bottom: 12px;">Department:</td>
                                                <td style="color: #ffffff; padding-bottom: 12px; font-weight: 500;">${formData.primaryDept}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #9ca3af;">Status:</td>
                                                <td style="color: #FFE100; font-weight: 500;">Under Review</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <p style="font-size: 14px; line-height: 1.6; color: #9ca3af;">Our team will evaluate your submission. Please stay updated via our official communication channels.</p>

                                    <div style="text-align: center; margin: 40px 0;">
                                        <a href="https://chat.whatsapp.com/FDMlBGlnzrc7qlwqSp2hDe" style="display: inline-block; background-color: #FFE100; color: #000000; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 14px;">Join Official WhatsApp Group</a>
                                    </div>

                                    <p style="margin-top: 45px; border-top: 1px solid #1a1a1a; padding-top: 25px; font-size: 14px; color: #6b7280;">
                                        Regards,<br>
                                        <strong style="color: #ffffff; font-family: 'Inter', sans-serif;">IEEE SSCS Recruitment Team</strong>
                                    </p>
                                </div>

                                <div style="background-color: #000000; padding: 30px 25px; text-align: center; border-top: 1px solid #1a1a1a;">
                                    <img src="${window.location.origin}/ieee-sscs-logo.png" alt="SSCS" style="height: 25px; margin-bottom: 15px;">
                                    <p style="color: #4b5563; font-size: 11px; margin: 0; font-family: 'Inter', sans-serif;">
                                        IEEE Solid-State Circuits Society | VIT Chennai Campus
                                    </p>
                                </div>
                            </div>
                        `
                    })
                });
                console.log("Confirmation email sent");
            } catch (emailErr) {
                console.error("Failed to send email", emailErr);
            }
            } // Close if (!isEditing)
            // -------------------------------


            setIsSubmitting(false);
            setExistingApp({
                ...formData,
                full_name: formData.fullName,
                primary_dept: formData.primaryDept,
                status: 'pending'
            });
            setIsEditing(false);
            setStep(1);
            setSubmitted(true);
        } catch (error: any) {
            console.error('Error submitting application:', error);
            if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
                console.log("Duplicate application detected. Fetching existing record...");
                const { data } = await supabase
                    .from('applications')
                    .select('*')
                    .eq('user_id', user.uid);

                if (data && data.length > 0) {
                    setExistingApp(data[0]);
                } else {
                    setExistingApp({
                        ...formData,
                        full_name: formData.fullName,
                        primary_dept: formData.primaryDept,
                        status: 'pending'
                    });
                }
                setIsSubmitting(false);
                return;
            }
            alert("Warning: Application could not be saved to the database. Please check console/admin settings.");
            setIsSubmitting(false);
        }
    };

    const currentDomains = formData.primaryDept ? domainOptions[formData.primaryDept] || [] : [];
    const currentSkillLabel = formData.primaryDept ? (skillLabels[formData.primaryDept] || skillLabels['default']) : skillLabels['default'];
    const currentSkillPlaceholder = formData.primaryDept ? (skillPlaceholders[formData.primaryDept] || skillPlaceholders['default']) : skillPlaceholders['default'];
    const currentReasonPlaceholder = formData.primaryDept ? (reasonPlaceholders[formData.primaryDept] || reasonPlaceholders['default']) : reasonPlaceholders['default'];

    const secondaryDomainsList = formData.secondaryDept 
        ? (domainOptions[formData.secondaryDept] || []).filter(d => 
            !(formData.primaryDept === formData.secondaryDept && (formData.domains || []).includes(d))
          ) 
        : [];
    const secondarySkillLabel = formData.secondaryDept ? (skillLabels[formData.secondaryDept] || skillLabels['default']) : skillLabels['default'];
    const secondarySkillPlaceholder = formData.secondaryDept ? (skillPlaceholders[formData.secondaryDept] || skillPlaceholders['default']) : skillPlaceholders['default'];
    const secondaryReasonPlaceholder = formData.secondaryDept ? (reasonPlaceholders[formData.secondaryDept] || reasonPlaceholders['default']) : reasonPlaceholders['default'];

    if (authLoading || checkingStatus) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    if (user && !existingApp && !recruitmentStatus.isOpen) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <TechGridBackground />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none -z-10" />
                
                <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20">
                    <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
                </div>

                <div className="container mx-auto px-4 py-8 relative z-10">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-8 absolute top-8 left-8 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>

                    <HolographicCard className="p-16 max-w-xl w-full text-center mx-auto mt-12 relative overflow-hidden">
                        <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/30 rotate-12">
                            <Clock className="w-12 h-12 text-red-500 -rotate-12" />
                        </div>
                        <h2 className="text-4xl font-heading font-bold mb-6 text-white tracking-tight">Recruitments will open soon</h2>
                        <p className="text-muted-foreground/80 mb-10 leading-relaxed text-lg font-medium">
                            We are currently not accepting new applications. Please check back later for our next recruitment cycle.
                        </p>
                        <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-white/10 hover:bg-white/10 transition-all font-bold">
                            <Link to="/">Return to Home</Link>
                        </Button>
                    </HolographicCard>
                </div>
            </div>
        );
    }

    if (existingApp && !isEditing) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <TechGridBackground />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none -z-10" />
                
                <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20">
                    <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[10%] right-[20%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
                </div>

                <div className="container mx-auto px-4 py-8 relative z-10">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-8 absolute top-8 left-8 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>

                    <HolographicCard className="p-12 max-w-3xl w-full text-center mx-auto mt-12 relative overflow-hidden">
                        {existingApp.status === 'selected' ? (
                            <>
                                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                    <Trophy className="w-12 h-12 text-green-500" />
                                </div>
                                <h2 className="text-3xl font-heading font-bold mb-2 text-white">Congratulations!</h2>
                                <div className="inline-block px-4 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 mb-6 text-sm font-medium">
                                    Application Selected
                                </div>
                                <p className="text-gray-300 mb-8 leading-relaxed">
                                    We are thrilled to welcome you to the team! Your application stood out, and we can't wait to see what you'll build with us.
                                </p>
                                <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-lg shadow-lg">
                                    Join the Community
                                </Button>
                            </>
                        ) : existingApp.status === 'rejected' ? (
                            <>
                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <XOctagon className="w-10 h-10 text-red-500/70" />
                                </div>
                                <h2 className="text-2xl font-heading font-bold mb-2 text-white">Application Status</h2>
                                <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 text-red-500/80 border border-red-500/20 mb-6 text-xs uppercase tracking-wider">
                                    Not Selected
                                </div>
                                <p className="text-muted-foreground mb-6 text-sm">
                                    Thank you for your interest in IEEE SSCS. Due to the high volume of applications, we are unfortunately unable to offer you a position at this time.
                                </p>
                                <p className="text-muted-foreground mb-8 text-sm">
                                    We encourage you to keep building and apply again in our next recruitment cycle.
                                </p>
                            </>
                        ) : existingApp.status === 'shortlisted' ? (
                            <div className="text-center animate-in fade-in duration-500">
                                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/40 animate-pulse">
                                    <CalendarIcon className="w-10 h-10 text-purple-400" />
                                </div>
                                <h2 className="text-3xl font-heading font-bold mb-2 text-white">Application Shortlisted!</h2>
                                <p className="text-gray-300 mb-8">
                                    You've moved to the next round. Please book an interview slot immediately.
                                    <br />
                                    <span className="text-sm text-yellow-500/80">Slots are First Come First Serve.</span>
                                </p>

                                <Button asChild className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 text-lg shadow-lg animate-bounce">
                                    <Link to="/schedule">Book Interview Slot</Link>
                                </Button>
                            </div>
                        ) : existingApp.status === 'interview_scheduled' ? (
                            <InterviewScheduledStatus app={existingApp} />
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <Clock className="w-10 h-10 text-primary" />
                                </div>
                                <h2 className="text-3xl font-heading font-bold mb-2 text-white">Under Review</h2>
                                <div className="inline-block px-4 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 mb-6 text-sm font-medium">
                                    Status: Pending
                                </div>
                                <p className="text-gray-300 mb-8 leading-relaxed">
                                    We have received your application and it is currently being reviewed by our team.
                                    Hold tight! We will update you soon.
                                </p>
                                <div className="p-4 bg-white/5 rounded-lg border border-white/5 text-left mb-6">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Applicant</div>
                                    <div className="font-medium text-white">{existingApp.full_name}</div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 mt-3">Primary Choice</div>
                                    <div className="font-medium text-primary">{existingApp.primary_dept}</div>
                                </div>
                                
                                {recruitmentStatus.isOpen && (
                                    <Button
                                        onClick={() => {
                                            setFormData({
                                                fullName: existingApp.full_name,
                                                rollNumber: existingApp.roll_number,
                                                phone: existingApp.phone,
                                                linkedinUrl: existingApp.linkedin_url || '',
                                                githubUrl: existingApp.github_url || '',
                                                primaryDept: existingApp.primary_dept,
                                                domains: existingApp.domains,
                                                skills: existingApp.skills,
                                                reason: existingApp.reason,
                                                secondaryDept: existingApp.secondary_dept || '',
                                                secondaryDomains: existingApp.secondary_domains || [],
                                                secondarySkills: existingApp.secondary_skills || '',
                                                secondaryReason: existingApp.secondary_reason || ''
                                            });
                                            setIsEditing(true);
                                        }}
                                        className="w-full bg-white/10 hover:bg-white/20 text-white font-bold h-12 text-lg shadow-lg mb-8"
                                    >
                                        Edit Application
                                    </Button>
                                )}

                                <div className="bg-white/5 p-6 rounded-xl border border-white/10 mb-8 flex flex-col items-center">
                                    <img
                                        src="/whatsapp-qr.jpg"
                                        alt="WhatsApp Group QR Code"
                                        className="w-48 h-48 rounded-lg mb-4 border border-white/10"
                                    />
                                    <p className="text-sm text-muted-foreground mb-4">Please join our WhatsApp group for updates.</p>

                                    <a
                                        href="https://chat.whatsapp.com/FDMlBGlnzrc7qlwqSp2hDe"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-[#25D366] text-white font-bold hover:bg-[#128C7E] transition-colors w-full"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-0.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        Join WhatsApp Group
                                    </a>
                                </div>
                            </>
                        )}

                        <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5">
                            <Link to="/">Return to Home</Link>
                        </Button>
                    </HolographicCard>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
                <TechGridBackground />
                <div className="absolute inset-0 bg-background/80 pointer-events-none -z-10" />

                <HolographicCard className="p-10 max-w-lg w-full text-center">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Send className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-heading font-bold mb-2">Application Received</h2>
                    <p className="text-muted-foreground mb-6">
                        Thank you for applying to IEEE SSCS. Please join our WhatsApp group for further updates.
                    </p>

                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 mb-8 flex flex-col items-center">
                        <img
                            src="/whatsapp-qr.png"
                            alt="WhatsApp Group QR Code"
                            className="w-48 h-48 rounded-lg mb-4 border border-white/10"
                        />
                        <p className="text-sm text-muted-foreground mb-4">Scan the QR code or click the button below to join.</p>

                        <a
                            href="https://chat.whatsapp.com/FDMlBGlnzrc7qlwqSp2hDe"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-[#25D366] text-white font-bold hover:bg-[#128C7E] transition-colors w-full"
                        >
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-0.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Join WhatsApp Group
                        </a>
                    </div>

                    <Button
                        onClick={() => window.location.reload()}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-bold mb-3"
                    >
                        <Clock className="w-4 h-4 mr-2" />
                        Check Application Status
                    </Button>

                    <Button asChild variant="outline" className="border-white/10 hover:bg-white/5 w-full">
                        <Link to="/">Return to Home</Link>
                    </Button>
                </HolographicCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
            <TechGridBackground />

            <div className="container mx-auto px-6 py-12 relative z-10">
                <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-8 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                    <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Back to Home
                </Link>

                {authLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <LogoSpinner size="md" />
                    </div>
                ) : !user ? (
                    <div className="max-w-lg mx-auto mt-20">
                        <HolographicCard className="p-10 text-center">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                                <User className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-heading font-bold mb-4">Authentication Required</h2>
                            <p className="text-muted-foreground mb-8">
                                To apply for IEEE SSCS, you must sign in with your VIT Student email address (@vitstudent.ac.in).
                            </p>
                            <Button
                                onClick={() => signInWithGoogle()}
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-bold"
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                Sign In with Google
                            </Button>
                        </HolographicCard>
                    </div>
                ) : (

                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: step === 1 ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-4xl mx-auto"
                    >
                        <div className="text-center mb-12">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mb-4"
                            >
                                <span className="text-xs text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                    Join the Team
                                </span>
                            </motion.div>
                            <h1 className="font-heading text-5xl md:text-6xl font-bold tracking-tight mb-4">
                                <RevealText text={step === 1 ? "Membership" : "Backup Choice"} />
                            </h1>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium">
                                {step === 1
                                    ? "Step 1: Personal Details & Primary Choice"
                                    : "Step 2: Second Preference (Optional)"}
                            </p>
                            {/* Step Indicator */}
                            <div className="flex justify-center gap-2 mt-4">
                                <div className={`h-2 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-primary' : 'w-2 bg-primary/30'}`} />
                                <div className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-primary' : 'w-2 bg-primary/30'}`} />
                            </div>
                        </div>

                        <HolographicCard className="p-8 md:p-10">
                            <form onSubmit={step === 1 ? handleNextStep : handleSubmit} noValidate className="space-y-8">
                                {step === 1 && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-heading font-semibold flex items-center gap-2 text-primary/80">
                                                <User className="w-5 h-5" /> Personal Details
                                            </h3>
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                                                    <input
                                                        type="text"
                                                        name="fullName"
                                                        value={formData.fullName}
                                                        onChange={handleInputChange}
                                                        className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                                        placeholder=""
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">Registration Number</label>
                                                    <input
                                                        type="text"
                                                        name="rollNumber"
                                                        value={formData.rollNumber}
                                                        onChange={handleInputChange}
                                                        className={`w-full bg-background/50 border rounded-lg px-4 py-3 outline-none transition-all focus:ring-1 focus:border-primary/50 focus:ring-primary/50 ${regError ? 'border-red-500' :
                                                            regValidation?.isValid ? 'border-green-500/50' :
                                                                'border-white/10'
                                                            }`}
                                                        placeholder="e.g. 24BPS1104"
                                                    />
                                                    {regError && (
                                                        <div className="text-xs text-red-500 mt-1 flex items-center animate-in slide-in-from-top-1">
                                                            <XOctagon className="w-3 h-3 mr-1" /> {regError}
                                                        </div>
                                                    )}
                                                    {regValidation?.isValid && (
                                                        <div className="text-xs text-green-500 mt-1 flex flex-col gap-1 animate-in slide-in-from-top-1">
                                                            <div className="pl-0 text-green-400/70">
                                                                {regValidation.programName} • {regValidation.batch}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                                        <input
                                                            type="tel"
                                                            name="phone"
                                                            value={formData.phone}
                                                            onChange={handleInputChange}
                                                            className="w-full bg-background/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                                            placeholder="98765 43210"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">LinkedIn URL</label>
                                                    <input
                                                        type="url"
                                                        name="linkedinUrl"
                                                        value={formData.linkedinUrl}
                                                        onChange={handleInputChange}
                                                        className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                                        placeholder="https://linkedin.com/in/username"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">GitHub URL <span className="text-white/30 text-xs">(Optional)</span></label>
                                                    <input
                                                        type="url"
                                                        name="githubUrl"
                                                        value={formData.githubUrl}
                                                        onChange={handleInputChange}
                                                        className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                                        placeholder="https://github.com/username"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6 pt-6 border-t border-white/10">
                                            <h3 className="text-xl font-heading font-semibold flex items-center gap-2 text-primary">
                                                <Code className="w-5 h-5" /> Primary Choice (Dept 1)
                                            </h3>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Department of Interest</label>
                                                <Select
                                                    value={formData.primaryDept}
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, primaryDept: value, domains: [] }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Primary Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Technical">Technical</SelectItem>
                                                        <SelectItem value="Management">Management</SelectItem>
                                                        <SelectItem value="Creative">Creative</SelectItem>
                                                        <SelectItem value="Outreach & Partnerships">Outreach & Partnerships</SelectItem>
                                                        <SelectItem value="Human Resources">Human Resources</SelectItem>
                                                        <SelectItem value="Event Operations">Event Operations</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-muted-foreground">
                                                    {formData.primaryDept ? `Specific Roles for ${formData.primaryDept}` : 'Select a Department above to see roles'}
                                                </label>

                                                {currentDomains.length > 0 ? (
                                                    <div className="grid sm:grid-cols-2 gap-3">
                                                        {currentDomains.map(domain => (
                                                            <div
                                                                key={domain}
                                                                onClick={() => handleDomainToggle(domain)}
                                                                className={`cursor-pointer px-4 py-3 rounded-lg border transition-all duration-200 flex items-center gap-3
                                    ${(formData.domains || []).includes(domain)
                                                                        ? 'bg-primary/20 border-primary text-primary'
                                                                        : 'bg-background/30 border-white/5 hover:border-white/20 text-muted-foreground'
                                                                    }`}
                                                            >
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                                    ${(formData.domains || []).includes(domain) ? 'border-primary bg-primary' : 'border-current'}
            `}>
                                                                    {(formData.domains || []).includes(domain) && <div className="w-2 h-2 bg-background rounded-sm" />}
                                                                </div>
                                                                <span className="text-sm font-medium">{domain}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center text-muted-foreground text-sm italic">
                                                        Please select a Department of Interest first.
                                                    </div>
                                                )}

                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">{currentSkillLabel}</label>
                                                <input
                                                    type="text"
                                                    name="skills"
                                                    value={formData.skills}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                                    placeholder={currentSkillPlaceholder}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Why do you want to join this department?</label>
                                                <textarea
                                                    name="reason"
                                                    value={formData.reason}
                                                    onChange={handleInputChange}
                                                    rows={4}
                                                    className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all resize-none"
                                                    placeholder={currentReasonPlaceholder}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <Button
                                                type="submit"
                                                className="h-12 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg group"
                                            >
                                                Next Step
                                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">


                                        <div className="space-y-6">
                                            <h3 className="text-xl font-heading font-semibold flex items-center gap-2 text-primary">
                                                <Code className="w-5 h-5" /> Secondary Choice (Dept 2)
                                            </h3>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Department of Interest</label>
                                                <Select
                                                    value={formData.secondaryDept}
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, secondaryDept: value, secondaryDomains: [] }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Secondary Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Technical">Technical</SelectItem>
                                                        <SelectItem value="Management">Management</SelectItem>
                                                        <SelectItem value="Creative">Creative</SelectItem>
                                                        <SelectItem value="Outreach & Partnerships">Outreach & Partnerships</SelectItem>
                                                        <SelectItem value="Human Resources">Human Resources</SelectItem>
                                                        <SelectItem value="Event Operations">Event Operations</SelectItem>
                                                    </SelectContent>
                                                </Select>

                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-muted-foreground">
                                                    {formData.secondaryDept ? `Specific Roles for ${formData.secondaryDept}` : 'Select a Department above to see roles'}
                                                </label>

                                                {secondaryDomainsList.length > 0 ? (
                                                    <div className="grid sm:grid-cols-2 gap-3">
                                                        {secondaryDomainsList.map(domain => (
                                                            <div
                                                                key={domain}
                                                                onClick={() => handleDomainToggle(domain, true)}
                                                                className={`cursor-pointer px-4 py-3 rounded-lg border transition-all duration-200 flex items-center gap-3
                                    ${(formData.secondaryDomains || []).includes(domain)
                                                                        ? 'bg-primary/20 border-primary text-primary'
                                                                        : 'bg-background/30 border-white/5 hover:border-white/20 text-muted-foreground'
                                                                    }`}
                                                            >
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                                    ${(formData.secondaryDomains || []).includes(domain) ? 'border-primary bg-primary' : 'border-current'}
            `}>
                                                                    {(formData.secondaryDomains || []).includes(domain) && <div className="w-2 h-2 bg-background rounded-sm" />}
                                                                </div>
                                                                <span className="text-sm font-medium">{domain}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center text-muted-foreground text-sm italic">
                                                        Please select a Secondary Department of Interest first.
                                                    </div>
                                                )}

                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">{secondarySkillLabel}</label>
                                                <input
                                                    type="text"
                                                    name="secondarySkills"
                                                    value={formData.secondarySkills}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                                    placeholder={secondarySkillPlaceholder}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Why this secondary choice?</label>
                                                <textarea
                                                    name="secondaryReason"
                                                    value={formData.secondaryReason}
                                                    onChange={handleInputChange}
                                                    rows={4}
                                                    className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all resize-none"
                                                    placeholder={secondaryReasonPlaceholder}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 flex gap-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handlePrevStep}
                                                className="h-12 px-6 border-white/10 hover:bg-white/5"
                                            >
                                                <ChevronLeft className="w-4 h-4 mr-2" />
                                                Back
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg"
                                            >
                                                {isSubmitting ? (
                                                    <span className="flex items-center">
                                                        <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                                                        Submitting...
                                                    </span>
                                                ) : (
                                                    'Submit Application'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </HolographicCard>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Apply;
