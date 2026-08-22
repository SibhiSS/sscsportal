import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, CheckCircle2, GraduationCap, Building, Link as LinkIcon, User, Code, Phone, ArrowRight, ChevronLeft, LogIn, Trophy, Clock, XOctagon, Calendar as CalendarIcon, Video, Sparkles, Target, Zap, Briefcase, CalendarClock } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import WhatsAppGroupCard from '@/components/ui/WhatsAppGroupCard';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import CircuitBoardBackground from '@/components/ui/CircuitBoardBackground';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { validateRegistrationNumber, RegNoDetails } from '@/utils/validation';
import { useRecruitmentWindow, formatCountdown } from '@/hooks/useRecruitmentWindow';
import confetti from 'canvas-confetti';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const DEPT_QUESTIONS: Record<string, { prompt: string, judges: string }> = {
    'Technical': {
        prompt: "Which of these three areas, Hands-on Hardware Projects, IEEE Research or Web Development do you feel most confident in right now, and which one are you most eager to learn this year? Tell me about a small project or script you've built in any of these areas.If you haven't explored much yet, tell us about a problem you'd love to solve or an idea you find exciting..",
        judges: "Communication, curiosity, technical thinking, passion."
    },
    'Creative': {
        prompt: "1. Imagine you're designing an eye-catching poster for an IEEE SSCS event. Describe your creative approach, including the theme, colours, layout, visuals, and how you'd make it stand out while keeping it professional. 2.Show us your best creative work (poster, artwork, video, writing, photography, etc.)",
        judges: "Creativity, storytelling, imagination."
    },
    'Human Resources': {
        prompt: "Tell us about a time you helped someone, resolved a conflict, or made someone feel included. If you haven't experienced something like this, describe exactly how you would handle such a situation.",
        judges: "Empathy, maturity, communication."
    },
    'Outreach & Partnerships': {
        prompt: "Convince us to try, join, or believe in something you genuinely like. It could be a club, hobby, app, movie, place, or even your favourite food. You have one chance to persuade us.",
        judges: "Persuasion, confidence, communication, originality."
    },
    'Management': {
        prompt: "Imagine the club is host to a major tech event tomorrow. The Event operation team suddenly comes to you asking for an extra  budget for last-minute event improvement, but your approved finance budget is completely maxed out. How do you handle their request without stalling the event or breaking budget compliance?",
        judges: "Ownership, planning, organization."
    },
    'Event Operations': {
        prompt: "Imagine an event starts in 10 minutes. The projector isn't working, two volunteers are missing, and the speaker is late. Walk us through exactly what you would do.",
        judges: "Presence of mind, prioritization, crisis management."
    }
};

const DEPARTMENTS = [
    { name: 'Technical', desc: 'Build, code, and innovate.' },
    { name: 'Management', desc: 'Lead, plan, and execute.' },
    { name: 'Event Operations', desc: 'Organize, manage, and deliver.' },
    { name: 'Creative', desc: 'Design, write, and imagine.' },
    { name: 'Outreach & Partnerships', desc: 'Connect, pitch, and network.' },
    { name: 'Human Resources', desc: 'Empower, resolve, and support.' }
];

const DEPT_DESCRIPTIONS: Record<string, string> = {
    'Technical': 'Build, code, and innovate.',
    'Creative': 'Design, write, and imagine.',
    'Management': 'Lead, plan, and execute.',
    'Outreach & Partnerships': 'Connect, pitch, and network.',
    'Human Resources': 'Empower, resolve, and support.',
    'Event Operations': 'Organize, manage, and deliver.'
};

const WEEKLY_HOURS = ['2–3', '4–6', '6–8', '8+'];
const YEARS_OF_STUDY = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

/** Mirrors slot_change_limit() in migration_slot_reschedule.sql. */
const SLOT_CHANGE_LIMIT = 1;
/** Mirrors c_lead_time in reschedule_interview_slot(). */
const SLOT_CHANGE_LEAD_TIME_MS = 60 * 60 * 1000;

// ── Interview Scheduled Status Component ──────────────────────────────────────
const InterviewScheduledStatus = ({ app }: { app: any }) => {
    const [slotInfo, setSlotInfo] = useState<{ start_time: string } | null>(null);
    const [meetingLink, setMeetingLink] = useState<string | null>(null);

    // One RPC for both. panel_assignments is admin-only under RLS, so the old
    // two-step read of that table returned nothing to an applicant and the link
    // never appeared here — my_interview_details() is SECURITY DEFINER and hands
    // back the caller's own slot and link without exposing the interviewer roster.
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const { data, error } = await supabase.rpc('my_interview_details');
            if (cancelled || error) return;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) return;
            setSlotInfo({ start_time: row.start_time });
            setMeetingLink(row.meeting_link?.trim() || null);
        };

        load();
        // Admins often paste the link minutes before the interview, with the
        // candidate already sitting on this page. Poll so it turns up on its own.
        const interval = setInterval(load, 60000);
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        return () => {
            cancelled = true;
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [app.id]);

    // Mirrors slot_change_limit() and c_lead_time in migration_slot_reschedule.sql.
    // reschedule_interview_slot() re-checks both; this only decides what to offer.
    const changesLeft = SLOT_CHANGE_LIMIT - (app.slot_changes_used ?? 0);
    const canChangeSlot =
        changesLeft > 0 &&
        !!slotInfo &&
        parseISO(slotInfo.start_time).getTime() > Date.now() + SLOT_CHANGE_LEAD_TIME_MS;

    return (
        <>

            <h2 className="text-3xl  font-bold mb-2 text-white">Interview Scheduled</h2>
            <div className="inline-block px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-6 text-sm font-medium">
                ✓ Confirmed
            </div>
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
            {meetingLink ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-5 max-w-sm mx-auto">
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
                <p className="text-sm text-muted-foreground mb-5">
                    Your meeting link will appear here and be emailed to you once assigned.
                </p>
            )}

            {/* Reaching this component already means the applicant holds a slot,
                which is the only condition under which the invite may be shown. */}
            <WhatsAppGroupCard className="mb-5 max-w-sm mx-auto" />

            {canChangeSlot ? (
                <Link
                    to="/schedule"
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-sm font-bold transition-colors mb-6 max-w-sm w-full mx-auto"
                >
                    <CalendarClock className="w-4 h-4" />
                    Change My Slot (once)
                </Link>
            ) : (
                <p className="text-[11px] text-muted-foreground mb-6 max-w-sm mx-auto">
                    {changesLeft <= 0
                        ? 'You have already used your one slot change, so this time is final.'
                        : 'Your interview is too close to be moved. Contact the SSCS team if you cannot attend.'}
                </p>
            )}
        </>
    );
};

const DUMMY_USER = { uid: 'dev-test-123', email: 'dev@vitstudent.ac.in', displayName: '24BCE9999 Developer Test' };

// Normal, clean form inputs
const FormInput = ({ label, icon: Icon, error, ...props }: any) => (
    <div className="space-y-2">
        <label className="text-sm font-medium text-white/90 flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-primary/80" />}
            {label}
        </label>
        <input
            {...props}
            className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white text-base focus:ring-2 outline-none transition-all placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-red-500 focus:ring-red-500/50' : 'border-white/10 focus:ring-primary/50 focus:border-primary/50'}`}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
);

const FormTextarea = ({ label, error, maxLength, ...props }: any) => {
    const currentLength = (props.value || '').length;
    const isNearLimit = maxLength && currentLength >= maxLength * 0.9;
    const isAtLimit = maxLength && currentLength >= maxLength;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white/90 block">
                    {label}
                </label>
                {maxLength && (
                    <span className={`text-xs tabular-nums transition-colors ${
                        isAtLimit ? 'text-red-400 font-bold' : isNearLimit ? 'text-yellow-400' : 'text-white/30'
                    }`}>
                        {currentLength}/{maxLength}
                    </span>
                )}
            </div>
            <textarea
                {...props}
                maxLength={maxLength}
                className={`w-full min-h-[120px] bg-black/40 border rounded-xl px-4 py-3 text-white text-base focus:ring-2 outline-none transition-all placeholder:text-white/20 resize-y ${
                    isAtLimit ? 'border-red-500/70' : error ? 'border-red-500 focus:ring-red-500/50' : 'border-white/10 focus:ring-primary/50 focus:border-primary/50'
                }`}
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            {isAtLimit && !error && <p className="text-xs text-red-400 mt-1">Character limit reached.</p>}
        </div>
    );
};

// ── Welcome Splash Component ──────────────────────────────────────
const WelcomeSplash = ({ onComplete }: { onComplete: () => void }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center relative z-10"
        >
            <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 text-white tracking-tight">
                Welcome to SSCS
            </h1>
            <p className="text-xl text-white/70 max-w-xl mx-auto mb-10 leading-relaxed font-heading font-light tracking-wide italic">
                Your journey into circuits, code, and creativity starts right here. Let's get to know you better.
            </p>
            <Button
                onClick={onComplete}
                className="h-14 px-10 bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-bold text-lg rounded-full shadow-[0_0_20px_rgba(220,20,60,0.3)] group transition-all"
            >
                Start Application <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
        </motion.div>
    );
};


/**
 * Live countdown to the submission deadline.
 *
 * Ticks against the SERVER clock (serverNow) rather than the device clock, so a
 * skewed laptop still sees the instant the database will actually stop accepting
 * inserts. Renders nothing when no deadline is scheduled.
 */
const DeadlineBanner = ({ closesAt, serverNow }: { closesAt: string | null; serverNow: () => number }) => {
    const [remaining, setRemaining] = useState(() => (closesAt ? new Date(closesAt).getTime() - serverNow() : 0));

    useEffect(() => {
        if (!closesAt) return;
        const deadline = new Date(closesAt).getTime();
        if (!Number.isFinite(deadline)) return;

        const tick = () => setRemaining(deadline - serverNow());
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [closesAt, serverNow]);

    // NaN when closesAt is unparseable — `NaN <= 0` is false, so without the finite
    // check a malformed timestamp would fall through to format() and throw.
    if (!closesAt || !Number.isFinite(remaining) || remaining <= 0) return null;

    const urgent = remaining < 60 * 60 * 1000; // final hour

    return (
        <div className={`mb-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl ${urgent ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className={`w-4 h-4 ${urgent ? 'text-red-400' : 'text-primary'}`} />
                Applications close {format(new Date(closesAt), "d MMM yyyy 'at' h:mm a")}
            </span>
            <span className={`font-mono font-bold tracking-wider ${urgent ? 'text-red-400' : 'text-white'}`}>
                {formatCountdown(remaining)}
            </span>
        </div>
    );
};


// ── Application Form Component ──────────────────────────────────────
const Apply = () => {
    let { user, signInWithGoogle, loading: authLoading } = useAuth();
    let [checkingStatus, setCheckingStatus] = useState(true);
    // Authoritative open/closed verdict, computed by the database from the manual
    // switch and the scheduled window. The same expression gates the INSERT in RLS
    // and in tr_enforce_recruitment_window, so this screen cannot disagree with it.
    const {
        isOpen: recruitmentOpen,
        closesAt,
        message: closedMessage,
        loading: windowLoading,
        unavailable: windowUnavailable,
        serverNow,
    } = useRecruitmentWindow();

    // Application Flow State
    const [step, setStep] = useState(1);
    const [showWelcome, setShowWelcome] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [existingApp, setExistingApp] = useState<any>(null);
    // A lookup that ERRORED is not the same as "no application". Without this the
    // catch below left existingApp null and a signed-in applicant with a perfectly
    // good application was shown the closed-recruitment screen.
    const [statusCheckFailed, setStatusCheckFailed] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

    // --- TEMPORARY DEV BYPASS SO YOU CAN SEE THE FORM ---
    if (!user && import.meta.env.DEV) {
        user = DUMMY_USER as any;
        authLoading = false;
        checkingStatus = false;
    }

    // Validation State
    const [regValidation, setRegValidation] = useState<RegNoDetails | null>(null);
    const [regError, setRegError] = useState<string | null>(null);

    // Form Data State
    const [formData, setFormData] = useState({
        fullName: '',
        rollNumber: '',
        phone: '',
        yearOfStudy: '',
        hostelDay: '',

        primaryDept: '',
        secondaryDept: '',
        whyJoinSscs: '',
        whyTheseDepts: '',

        deptAnswer: '',
        secondaryDeptAnswer: '',

        weeklyHours: '',
        linkedinUrl: '',
        githubUrl: '',        // Fix 1: was missing from initial state
        portfolioWebsite: '', // Fix 1: was missing from initial state
        googleDriveUrl: '',
        anyQuestions: '',
        hp_website: '' // Bot honeypot field
    });

    useEffect(() => {
        if (user) {
            setCheckingStatus(true);
            checkApplicationStatus();

            const rawName = user.displayName || '';
            const regMatch = rawName.match(/(\d{2}[A-Z]{3}\d{4})/i);

            if (regMatch) {
                const regNo = regMatch[1].toUpperCase();
                const cleanName = rawName.replace(regMatch[0], '').trim();

                setFormData(prev => ({
                    ...prev,
                    fullName: prev.fullName || cleanName, // Only set if not already loaded from cache
                    rollNumber: prev.rollNumber || regNo
                }));

                const validation = validateRegistrationNumber(regNo);
                setRegValidation(validation);
                setRegError(validation.isValid ? null : (validation.error || 'Invalid Registration Number'));
            } else {
                setFormData(prev => ({ ...prev, fullName: prev.fullName || rawName }));
            }
        } else {
            setCheckingStatus(false);
            setExistingApp(null);
        }
    }, [user]);

    // Load from local storage
    useEffect(() => {
        if (user?.uid) {
            const savedData = localStorage.getItem(`sscsFormData_v2_${user.uid}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.formData) {
                        setFormData(prev => ({ ...prev, ...parsed.formData }));
                        if (parsed.formData.rollNumber) {
                            const validation = validateRegistrationNumber(parsed.formData.rollNumber);
                            setRegValidation(validation);
                            setRegError(validation.isValid ? null : validation.error);
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse cached form data");
                }
            }
        }
    }, [user]);

    // Save to local storage
    useEffect(() => {
        if (!user?.uid) return;
        const timer = setTimeout(() => {
            localStorage.setItem(`sscsFormData_v2_${user.uid}`, JSON.stringify({ formData }));
        }, 400);
        return () => clearTimeout(timer);
    }, [formData, user?.uid]);

    const checkApplicationStatus = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .or(`user_id.eq.${user.uid},email.eq.${user.email}`);

            if (error) throw error;

            if (data && data.length > 0) {
                const app = data[0];
                setExistingApp(app);
                setFormData({
                    fullName: app.full_name || '',
                    rollNumber: app.roll_number || '',
                    phone: app.phone || '',
                    yearOfStudy: app.year || '',
                    hostelDay: app.hostel_day || '',
                    primaryDept: app.primary_dept || '',
                    secondaryDept: app.secondary_dept || '',
                    whyJoinSscs: app.why_join_sscs || '',
                    whyTheseDepts: app.why_these_depts || '',
                    deptAnswer: app.dept_answer || '',
                    weeklyHours: app.weekly_hours || '',
                    linkedinUrl: app.linkedin_url || '',
                    githubUrl: app.github_url || '',
                    portfolioWebsite: app.portfolio_website || '',
                    googleDriveUrl: ''
                });

                if (app.roll_number) {
                    const validation = validateRegistrationNumber(app.roll_number);
                    setRegValidation(validation);
                }
                setShowWelcome(false); // Skip welcome if already applied
                setStatusCheckFailed(false);
            } else {
                setExistingApp(null);
                setStatusCheckFailed(false);
            }
        } catch (error) {
            console.error("Error checking application status:", error);
            setStatusCheckFailed(true);
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            // Fix 4: Allow up to 12 digits so country-code entries (e.g. 91XXXXXXXXXX) aren't silently truncated to 8 digits
            const val = value.replace(/\D/g, '').slice(0, 12);
            setFormData(prev => ({ ...prev, phone: val }));
            return;
        }

        // Fix A: Auto-prepend https:// to URL fields if user types a bare domain (e.g. linkedin.com/in/...)
        // This prevents the DB check_linkedin_url_format / check_github_url_format constraints from rejecting the row.
        if (name === 'linkedinUrl' || name === 'githubUrl' || name === 'portfolioWebsite' || name === 'googleDriveUrl') {
            // Only auto-correct on non-empty values that don't already start with a protocol
            if (value && !value.startsWith('http://') && !value.startsWith('https://') && value.includes('.')) {
                setFormData(prev => ({ ...prev, [name]: `https://${value}` }));
            } else {
                setFormData(prev => ({ ...prev, [name]: value }));
            }
            return;
        }

        if (name === 'primaryDept') {
            setFormData(prev => ({ ...prev, primaryDept: value, deptAnswer: '' }));
        } else if (name === 'rollNumber') {
            const normalized = value.toUpperCase();
            setFormData(prev => ({ ...prev, rollNumber: normalized }));

            const validation = validateRegistrationNumber(normalized);
            setRegValidation(validation);
            setRegError(validation.isValid ? null : (validation.error || 'Invalid Registration Number'));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleOptionSelect = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleDeptClick = (dept: string) => {
        if (formData.primaryDept === dept) {
            setFormData(prev => ({ ...prev, primaryDept: prev.secondaryDept, secondaryDept: '' }));
        } else if (formData.secondaryDept === dept) {
            setFormData(prev => ({ ...prev, secondaryDept: '' }));
        } else if (!formData.primaryDept) {
            setFormData(prev => ({ ...prev, primaryDept: dept, deptAnswer: '' }));
        } else if (!formData.secondaryDept) {
            setFormData(prev => ({ ...prev, secondaryDept: dept }));
        } else {
            setFormData(prev => ({ ...prev, secondaryDept: dept }));
        }
    };

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        let newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!formData.fullName) newErrors.fullName = 'Full Name is required';
            if (!formData.rollNumber) newErrors.rollNumber = 'Registration Number is required';
            if (!formData.phone) newErrors.phone = 'Phone Number is required';
            if (!formData.yearOfStudy) newErrors.yearOfStudy = 'Year of Study is required';
            if (!formData.hostelDay) newErrors.hostelDay = 'Hostel/Day Scholar is required';
        } else if (step === 2) {
            if (!formData.primaryDept || !formData.secondaryDept) {
                newErrors.dept = 'Please select both 1st and 2nd Preference';
            }
            if (!formData.whyJoinSscs) newErrors.whyJoinSscs = 'This field is required';
            if (!formData.whyTheseDepts) newErrors.whyTheseDepts = 'This field is required';
        } else if (step === 3) {
            if (!formData.deptAnswer) newErrors.deptAnswer = 'This field is required';
            if (!formData.secondaryDeptAnswer) newErrors.secondaryDeptAnswer = 'This field is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            return;
        }

        setFormErrors({});
        if (step < 4) setStep(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrevStep = () => {
        setStep(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Anti-bot Honeypot check: If invisible field is populated, silently drop request
        if (formData.hp_website) {
            console.warn('[Security] Bot detected via honeypot field submission.');
            setIsSubmitting(false);
            return;
        }

        if (!formData.weeklyHours) {
            setFormErrors({ weeklyHours: 'Please select your weekly availability' });
            return;
        }
        setFormErrors({});

        if (!user) return;

        if (existingApp && !isEditing) {
            alert("You have already submitted an application!");
            return;
        }
        if (!formData.weeklyHours) {
            alert("Please select how many hours you can dedicate.");
            return;
        }

        setIsSubmitting(true);

        try {
            const combinedDeptAnswer = formData.deptAnswer + (formData.googleDriveUrl ? `\n\nGoogle Drive Link: ${formData.googleDriveUrl}` : '');

            const applicationData = {
                user_id: user.uid,
                email: user.email,
                full_name: formData.fullName,
                roll_number: formData.rollNumber,
                phone: formData.phone,
                // Fix B: Ensure all URL fields have a protocol prefix before hitting DB CHECK constraints.
                // The DB requires: linkedin_url ~* '^https?://' (check_linkedin_url_format etc.)
                // Users may type bare URLs like 'linkedin.com/in/...' — we normalise here as a safety net.
                linkedin_url: formData.linkedinUrl && !formData.linkedinUrl.startsWith('http') ? `https://${formData.linkedinUrl}` : (formData.linkedinUrl || null),
                github_url: formData.githubUrl && !formData.githubUrl.startsWith('http') ? `https://${formData.githubUrl}` : (formData.githubUrl || null),

                primary_dept: formData.primaryDept,
                secondary_dept: formData.secondaryDept,
                status: existingApp ? existingApp.status : 'applied',

                // New Fields
                hostel_day: formData.hostelDay,
                weekly_hours: formData.weeklyHours,
                portfolio_website: formData.portfolioWebsite && !formData.portfolioWebsite.startsWith('http') ? `https://${formData.portfolioWebsite}` : (formData.portfolioWebsite || null),
                why_join_sscs: formData.whyJoinSscs,
                why_these_depts: formData.whyTheseDepts,
                dept_answer: combinedDeptAnswer,

                // For backward compatibility with existing admin panel
                skills: combinedDeptAnswer,
                reason: formData.whyJoinSscs,
                // Fix 2: secondaryDeptAnswer was collected but never submitted — now correctly mapped
                secondary_skills: formData.secondaryDeptAnswer,
                secondary_reason: formData.whyTheseDepts,
                notes: formData.anyQuestions ? `Questions for us: ${formData.anyQuestions}` : '',
                year: formData.yearOfStudy,

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

            if (user?.uid) {
                localStorage.removeItem(`sscsFormData_v2_${user.uid}`);
            }

            // Throw confetti on success!
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#8B5CF6', '#D946EF', '#3B82F6', '#10B981']
            });

            if (!isEditing) {
                const portalUrl = window.location.origin;
                sendEmail(
                    user.email || '',
                    'Application Received - IEEE SSCS Recruitment',
                    `<p>Dear <strong>${formData.fullName}</strong>,</p>
                    <p>Thank you for applying to IEEE Solid-State Circuits Society (SSCS)! Your application has been successfully received.</p>
                    <p><strong>Registration:</strong> ${formData.rollNumber}<br>
                    <strong>Primary Department:</strong> ${formData.primaryDept}<br>
                    <strong>Status:</strong> Under Review</p>
                    <p>You can check your application status anytime: <a href="${portalUrl}/apply">${portalUrl}/apply</a></p>
                    <p>Join our WhatsApp group for updates: <a href="https://chat.whatsapp.com/Em8uoQtYNPcFTsg3w0dVdo?s=qt&p=a&ilr=1">Join Here</a></p>
                    <p>Best of luck!<br>IEEE SSCS HR Team</p>`
                ).catch(err => console.warn('[Apply] Confirmation email failed silently:', err));
            }

            setIsSubmitting(false);
            setExistingApp({
                ...applicationData,
                id: existingApp?.id || 'new'
            });
            setIsEditing(false);
            setStep(1);
            setIsSubmitted(true);
            setShowWelcome(false);
        } catch (error: any) {
            // Fix 5: Log full error for debugging and map Postgres codes to friendly messages
            console.error('[Apply] Submission error — full details:', JSON.stringify(error, null, 2));

            const code = error?.code || '';
            const msg = error?.message || '';

            if (code === '23505') {
                alert("It looks like you've already submitted an application. Please refresh and check your status.");
            } else if (code === '23514') {
                // CHECK constraint violation — answer too long, invalid phone, or invalid roll number
                if (msg.includes('phone')) {
                    alert("Your phone number format is invalid. Please enter a 10-digit mobile number (without +91 or dashes).");
                } else if (msg.includes('roll_number')) {
                    alert("Your registration number format is invalid. It must be in the format 24BCE1234.");
                } else if (msg.includes('reason') || msg.includes('skills')) {
                    alert("One of your answers exceeds the 4000-character limit. Please shorten it and try again.");
                } else if (msg.includes('full_name')) {
                    alert("Your full name exceeds 100 characters. Please shorten it.");
                } else {
                    alert(`A validation constraint was violated: ${msg}\n\nPlease check your inputs and try again.`);
                }
            } else if (msg.includes('RECRUITMENT_CLOSED')) {
                // Raised by tr_enforce_recruitment_window when the deadline passed
                // mid-session (the form was open when this tab loaded).
                alert("Applications have closed. The deadline passed while you were filling this in, so this submission could not be accepted.");
                window.location.reload();
            } else if (code === '42501' || msg.includes('row-level security') || msg.includes('policy')) {
                alert("Submission blocked by a security policy. Please sign out, sign back in, and try again. If the problem persists, contact the SSCS team.");
            } else if (code?.startsWith('PGRST') || msg.includes('fetch') || msg.includes('network')) {
                alert("A network error occurred. Please check your internet connection and try again.");
            } else {
                alert(`Something went wrong saving your application.\n\nError: ${msg || 'Unknown error'}\n\nPlease try again or contact us if this persists.`);
            }
            setIsSubmitting(false);
        }
    };

    if (authLoading || checkingStatus || windowLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    // Sign-in comes BEFORE the closed-window screen below.
    //
    // A signed-out visitor always has existingApp === null, so while this sat
    // *after* the closed screen every signed-out visitor was told "Recruitments
    // are closed" with no way to sign in — including shortlisted candidates
    // opening their booking link on a phone that does not carry the session.
    // Whether someone already has an application is unknowable until they are
    // signed in, so the closed screen must not be the thing that answers it.
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center relative text-foreground bg-[#050505] overflow-hidden">
                <CircuitBoardBackground />
                <div className="container mx-auto px-6 py-12 relative z-10">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-8 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>
                    <div className="max-w-lg mx-auto mt-20">
                        <div className="relative p-10 text-center border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl">

                            <h2 className="text-2xl  font-bold mb-4 text-white">Authentication Required</h2>
                            <p className="text-muted-foreground mb-8">
                                To apply for IEEE SSCS, you must sign in with your VIT Student email address (@vitstudent.ac.in).
                            </p>
                            <Button
                                onClick={() => signInWithGoogle()}
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-bold rounded-lg"
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                Sign In with Google
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // The stored message is meant to be closed-screen copy, but databases seeded
    // before migration_recruitment_window.sql still carry schema.sql's placeholder
    // "Recruitment is currently open." — which rendered *under* the "Recruitments
    // are closed" heading and read as a contradiction. Ignore anything that talks
    // about being open; migration_fix_stale_recruitment_message.sql clears it at
    // the source, and this keeps the screen honest on a database that has not run
    // the migration yet.
    const closedNotice =
        closedMessage && !/\bopen\b/i.test(closedMessage)
            ? closedMessage
            : 'Applications are closed for this cycle. If you have already applied, sign in to see your status and your interview slot.';

    // `statusCheckFailed` routes here too, so a broken lookup reads as "we could
    // not check" rather than as a closed window the applicant cannot argue with.
    if (!existingApp && (!recruitmentOpen || statusCheckFailed)) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <CircuitBoardBackground />
                <div className="container mx-auto px-4 py-8 relative z-10 text-center">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-8 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>
                    <div className="relative p-12 md:p-16 max-w-xl mx-auto border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl">

                        <h2 className="text-4xl font-heading font-bold mb-6 text-white tracking-tight">
                            {windowUnavailable || statusCheckFailed ? 'Unable to verify status' : 'Recruitments are closed'}
                        </h2>
                        <p className="text-muted-foreground/80 mb-10 leading-relaxed text-lg font-medium">
                            {windowUnavailable || statusCheckFailed
                                ? 'We could not reach the server to check your application. Please reload, or sign out and back in. If you have been shortlisted, your interview booking link still works once this clears.'
                                : closedNotice}
                        </p>
                        <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-white/10 hover:bg-white/10 font-bold">
                            <Link to="/">Return to Home</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (existingApp && !isEditing) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <CircuitBoardBackground />
                <div className="container mx-auto px-4 py-8 relative z-10">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-8 absolute top-8 left-8 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>

                    <div className="relative p-10 md:p-12 max-w-3xl w-full text-center mx-auto mt-12 border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl">
                        {existingApp.status === 'selected' ? (
                            <>

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

                                <h2 className="text-2xl font-heading font-bold mb-2 text-white">Application Status</h2>
                                <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 text-red-500/80 border border-red-500/20 mb-6 text-xs uppercase tracking-wider">
                                    Not Selected
                                </div>
                                <p className="text-muted-foreground mb-6 text-sm">
                                    Thank you for your interest in IEEE SSCS. Due to the high volume of applications, we are unfortunately unable to offer you a position at this time.
                                </p>
                            </>
                        ) : existingApp.status === 'shortlisted' && existingApp.shortlist_notified ? (
                            /* Shortlisting stays invisible until the Scheduler confirms the booking
                               email was sent (shortlist_notified). Until then this falls through to
                               the "Under Review" branch below — the applicant sees no change. */
                            <div className="text-center animate-in fade-in duration-500">

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

                                <h2 className="text-3xl  font-bold mb-2 text-white">Under Review</h2>
                                <div className="inline-block px-4 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 mb-6 text-sm font-medium">
                                    Status: Pending
                                </div>
                                <p className="text-gray-300 mb-8 leading-relaxed">
                                    We have received your application and it is currently being reviewed by our team.
                                    Hold tight! We will update you soon.
                                </p>

                                <div className="bg-white/5 p-6 rounded-xl border border-white/10 mb-8 flex flex-col items-center gap-3">
                                    <p className="text-sm text-muted-foreground mb-2">Connect with us for updates:</p>
                                    <a
                                        href="https://chat.whatsapp.com/Em8uoQtYNPcFTsg3w0dVdo?s=qt&p=a&ilr=1"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-[#25D366] text-white font-bold hover:bg-[#128C7E] transition-colors w-full"
                                    >
                                        Join WhatsApp Group
                                    </a>
                                    <a
                                        href="https://www.instagram.com/ieee_sscs_vitcc"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold hover:opacity-90 transition-opacity w-full"
                                    >
                                        Follow on Instagram
                                    </a>
                                    <a
                                        href="https://www.linkedin.com/company/ieee-sscs-vitc/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-[#0A66C2] text-white font-bold hover:bg-[#004182] transition-colors w-full"
                                    >
                                        Follow on LinkedIn
                                    </a>
                                </div>
                            </>
                        )}
                        <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 mt-4">
                            <Link to="/">Return to Home</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <CircuitBoardBackground />
                <div className="relative p-10 max-w-lg w-full text-center z-10 border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl">

                    <h2 className="text-4xl  font-bold mb-3 text-white">Application Submitted Successfully!</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        We've received your application. Keep an eye on your email and our WhatsApp group!
                    </p>
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 mb-8 flex flex-col items-center gap-3">
                        <p className="text-sm text-muted-foreground mb-2">Connect with us for updates:</p>
                        <a
                            href="https://chat.whatsapp.com/Em8uoQtYNPcFTsg3w0dVdo?s=qt&p=a&ilr=1"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-[#25D366] text-white font-bold hover:bg-[#128C7E] transition-colors w-full"
                        >
                            Join our WhatsApp Group
                        </a>
                        <a
                            href="https://www.instagram.com/ieee_sscs_vitcc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold hover:opacity-90 transition-opacity w-full"
                        >
                            Follow us on Instagram
                        </a>
                        <a
                            href="https://www.linkedin.com/company/ieee-sscs-vitc/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-[#0A66C2] text-white font-bold hover:bg-[#004182] transition-colors w-full"
                        >
                            Follow us on LinkedIn
                        </a>
                    </div>
                    <Button
                        onClick={() => window.location.reload()}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-bold mb-3 rounded-lg"
                    >
                        <Clock className="w-4 h-4 mr-2" />
                        Check Status
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden selection:bg-primary/30">
            <CircuitBoardBackground />

            {showWelcome ? (
                <div className="container mx-auto px-6 py-12 relative z-10 flex items-center justify-center min-h-screen">
                    <WelcomeSplash onComplete={() => setShowWelcome(false)} />
                </div>
            ) : (
                <div className="container mx-auto px-4 md:px-6 py-12 relative z-10">
                    <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-4xl mx-auto">

                        <div className="text-center mb-10">
                            <span className="inline-block text-sm text-primary font-bold px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 mb-4">
                                Step {step} of 4
                            </span>
                            <h1 className=" text-3xl md:text-5xl font-heading font-bold mb-6 text-white tracking-tight">
                                <RevealText text={
                                    step === 1 ? "Basic Details" :
                                        step === 2 ? "Department Preferences" :
                                            step === 3 ? "Short Questions" :
                                                "Final Details"
                                } />
                            </h1>

                            {/* Simple Step Indicator */}
                            <div className="flex items-center justify-center gap-2 mt-8 max-w-sm mx-auto">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-center flex-1">
                                        <div className={`w-full h-2 rounded-full transition-all duration-500 ${step >= i ? 'bg-primary' : 'bg-white/10'}`} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DeadlineBanner closesAt={closesAt} serverNow={serverNow} />

                        {/* Main Form Container - Clean and Modern */}
                        <div className="relative p-6 md:p-10 border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl">
                            <form onSubmit={step === 4 ? handleSubmit : handleNextStep} noValidate className="space-y-8">

                                {step === 1 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <FormInput label="Full Name" error={formErrors.fullName} icon={User} type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="e.g. Tony Stark" />
                                            <FormInput label="Registration Number" error={formErrors.rollNumber} type="text" name="rollNumber" value={formData.rollNumber} onChange={handleInputChange} placeholder="e.g. 24BCE1234" />
                                            <FormInput label="Email" type="email" value={user?.email || ''} disabled />
                                            <FormInput label="Phone Number" error={formErrors.phone} icon={Phone} type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="WhatsApp number" />
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                                    <GraduationCap className="w-4 h-4 text-primary/80" /> Year of Study
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {YEARS_OF_STUDY.map(year => (
                                                        <div key={year} onClick={() => handleOptionSelect('yearOfStudy', year)}
                                                            className={`cursor-pointer px-4 py-3 border rounded-xl text-center text-sm font-medium transition-all duration-200 ${formData.yearOfStudy === year ? 'bg-primary/20 border-primary text-primary shadow-sm' : formErrors.yearOfStudy ? 'border-red-500 bg-red-500/5 text-red-400' : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70 hover:text-white'}`}>
                                                            {year}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                                    <Building className="w-4 h-4 text-primary/80" /> Hostel / Day Scholar
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['Hosteller', 'Day Scholar'].map(type => (
                                                        <div key={type} onClick={() => handleOptionSelect('hostelDay', type)}
                                                            className={`cursor-pointer px-4 py-3 border rounded-xl text-center text-sm font-medium transition-all duration-200 ${formData.hostelDay === type ? 'bg-primary/20 border-primary text-primary shadow-sm' : formErrors.hostelDay ? 'border-red-500 bg-red-500/5 text-red-400' : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70 hover:text-white'}`}>
                                                            {type}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="mb-6 text-center">
                                            <p className="text-sm text-white/70">
                                                Select your <span className="text-primary font-bold">1st Preference</span> and <span className="text-blue-400 font-bold">2nd Preference</span>.
                                            </p>
                                        </div>
                                        {formErrors.dept && <p className="text-center text-red-400 text-sm mb-4 bg-red-500/10 py-2 rounded-lg border border-red-500/20">{formErrors.dept}</p>}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                            {DEPARTMENTS.map(dept => {
                                                const isPrimary = formData.primaryDept === dept.name;
                                                const hasDeptError = !!formErrors.dept;
                                                const isSecondary = formData.secondaryDept === dept.name;

                                                let cardClass = "relative p-5 rounded-2xl cursor-pointer transition-all duration-200 border flex flex-col ";
                                                if (isPrimary) {
                                                    cardClass += "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.15)]";
                                                } else if (isSecondary) {
                                                    cardClass += "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]";
                                                } else {
                                                    cardClass += hasDeptError ? "border-red-500 bg-red-500/5 hover:bg-red-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30";
                                                }

                                                return (
                                                    <div key={dept.name} className={cardClass} onClick={() => handleDeptClick(dept.name)}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <h4 className={`text-base font-bold transition-colors ${isPrimary ? 'text-primary' : isSecondary ? 'text-blue-400' : 'text-white'}`}>
                                                                {dept.name}
                                                            </h4>
                                                            {isPrimary && <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">1</span>}
                                                            {isSecondary && <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">2</span>}
                                                        </div>
                                                        <p className="text-sm text-white/60 leading-relaxed">{dept.desc}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                            <FormTextarea error={formErrors.whyJoinSscs} maxLength={4000} label="Why do you want to join IEEE SSCS?" name="whyJoinSscs" value={formData.whyJoinSscs} onChange={handleInputChange} placeholder="Explain your motivation for joining SSCS..." />
                                            <FormTextarea error={formErrors.whyTheseDepts} maxLength={4000} label="Why did you choose these departments?" name="whyTheseDepts" value={formData.whyTheseDepts} onChange={handleInputChange} placeholder="What draws you to this specific role?" />
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="mb-2 text-center border-b border-white/5 pb-4 inline-block mx-auto w-full">
                                            <p className="text-xs text-white/50 italic">
                                                Please write your own answers. Do not copy/paste AI-generated text. We value authenticity over perfection!
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 text-center">
                                                <p className="text-sm text-primary font-heading font-bold mb-2 uppercase tracking-wider">1st Preference: {formData.primaryDept}</p>
                                                <p className="text-lg md:text-xl font-medium text-white leading-relaxed">
                                                    {DEPT_QUESTIONS[formData.primaryDept]?.prompt || "Tell us something amazing about yourself."}
                                                </p>
                                            </div>
                                            <FormTextarea error={formErrors.deptAnswer} maxLength={4000} label="Your Answer" name="deptAnswer" value={formData.deptAnswer} onChange={handleInputChange} placeholder="Type your answer here..." style={{ minHeight: '150px' }} />
                                            {formData.primaryDept === 'Creative' && (
                                                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                                    <FormInput label="Portfolio / Drive Link (Optional)" type="url" name="googleDriveUrl" value={formData.googleDriveUrl} onChange={handleInputChange} placeholder="https://drive.google.com/..." />
                                                    <p className="text-xs text-white/50 mt-2 italic">Please upload your work to Google Drive, ensure link access is set to 'Anyone with the link', and paste it here.</p>
                                                </div>
                                            )}
                                        </div>

                                        {formData.secondaryDept && (
                                            <div className="space-y-4 pt-6 border-t border-white/10">
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 text-center">
                                                    <p className="text-sm text-blue-400 font-heading font-bold mb-2 uppercase tracking-wider">2nd Preference: {formData.secondaryDept}</p>
                                                    <p className="text-lg md:text-xl font-medium text-white leading-relaxed">
                                                        {DEPT_QUESTIONS[formData.secondaryDept]?.prompt || "Tell us something amazing about yourself."}
                                                    </p>
                                                </div>
                                                <FormTextarea error={formErrors.secondaryDeptAnswer} maxLength={4000} label="Your Answer" name="secondaryDeptAnswer" value={formData.secondaryDeptAnswer} onChange={handleInputChange} placeholder="Type your answer here..." style={{ minHeight: '150px' }} />
                                                {formData.secondaryDept === 'Creative' && (
                                                    <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                                        <FormInput label="Portfolio / Drive Link (Optional)" type="url" name="googleDriveUrl" value={formData.googleDriveUrl} onChange={handleInputChange} placeholder="https://drive.google.com/..." />
                                                        <p className="text-xs text-white/50 mt-2 italic">Please upload your work to Google Drive, ensure link access is set to 'Anyone with the link', and paste it here.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-heading font-bold text-white mb-4">Availability</h3>
                                            <p className="text-sm text-white/70 mb-3">How many hours can you dedicate every week?</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {WEEKLY_HOURS.map(hrs => (
                                                    <div key={hrs} onClick={() => handleOptionSelect('weeklyHours', hrs)}
                                                        className={`cursor-pointer px-4 py-4 border rounded-xl text-center font-bold text-base transition-all duration-200 ${formData.weeklyHours === hrs ? 'bg-primary/20 border-primary text-primary shadow-sm' : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70 hover:text-white'}`}>
                                                        {hrs}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-8 border-t border-white/10">
                                            <h3 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
                                                <LinkIcon className="w-5 h-5 text-primary" /> Links (Optional)
                                            </h3>
                                            <div className="grid md:grid-cols-1 gap-6">
                                                <FormInput label="LinkedIn Profile" type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleInputChange} placeholder="https://" />
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-8 border-t border-white/10">
                                            <h3 className="text-lg font-heading font-bold text-white mb-4">Any Questions for Us?</h3>
                                            <FormTextarea label="If you have any doubts about the club, the role, or the recruitment process, ask away! (Optional)" name="anyQuestions" value={formData.anyQuestions} onChange={handleInputChange} placeholder="Type your question here..." style={{ minHeight: '100px' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Navigation Bar */}
                                <div className="pt-8 flex gap-4 mt-8 border-t border-white/10">
                                    {step > 1 && (
                                        <Button type="button" variant="outline" onClick={handlePrevStep} className="h-14 px-6 md:px-8 border-white/10 bg-transparent hover:bg-white/5 text-white font-heading font-medium text-base rounded-xl transition-all">
                                            <ChevronLeft className="w-5 h-5 mr-2" /> Back
                                        </Button>
                                    )}
                                    <Button type="submit" disabled={isSubmitting} className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(220,20,60,0.3)] transition-all group hover:scale-[1.02]">
                                        {isSubmitting ? (
                                            <span className="flex items-center"><div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin mr-3" /> Submitting...</span>
                                        ) : step < 4 ? (
                                            <span className="flex items-center">Next Step <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" /></span>
                                        ) : (
                                            <span className="flex items-center">Submit Application</span>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default Apply;
