import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, CheckCircle2, User, Phone, GraduationCap, Building, Link as LinkIcon } from 'lucide-react';
import CircuitBoardBackground from '@/components/ui/CircuitBoardBackground';
import RevealText from '@/components/ui/RevealText';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

const DEPT_QUESTIONS: Record<string, { prompt: string, judges: string }> = {
    'Technical': {
        prompt: "Tell us about the coolest technical thing you've built, learnt, or explored. Explain it as if we're complete beginners. If you haven't worked on anything yet, describe a technical idea or project you'd love to build and why.",
        judges: "Communication, curiosity, technical thinking, passion."
    },
    'Creative': {
        prompt: "Show us your best creative work (poster, artwork, video, writing, photography, etc.) and tell us the story behind it. If you don't have one, vividly describe the most creative dream, idea, or imaginary world you've ever had.",
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
        prompt: "Describe the biggest responsibility you've ever taken. If you haven't had one yet, explain how you would plan and manage your dream college event from start to finish.",
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

const WEEKLY_HOURS = ['2–3', '4–6', '6–8', '8+'];
const YEARS_OF_STUDY = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

// Normal, clean form inputs
const FormInput = ({ label, icon: Icon, ...props }: any) => (
    <div className="space-y-2">
        <label className="text-sm font-medium text-white/90 flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-primary/80" />}
            {label}
        </label>
        <input 
            {...props} 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed" 
        />
    </div>
);

const FormTextarea = ({ label, ...props }: any) => (
    <div className="space-y-2">
        <label className="text-sm font-medium text-white/90 block">
            {label}
        </label>
        <textarea 
            {...props} 
            className="w-full min-h-[120px] bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder:text-white/20 resize-y" 
        />
    </div>
);

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
            <p className="text-xl text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
                Your journey into circuits, code, and creativity starts right here. Let's get to know you better.
            </p>
            <Button 
                onClick={onComplete}
                className="h-14 px-10 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg rounded-full shadow-lg group transition-all"
            >
                Start Application <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
        </motion.div>
    );
};

// ── Application Form Component (UI ONLY) ──────────────────────────────────────
const TestApply = () => {
    const [step, setStep] = useState(1);
    const [showWelcome, setShowWelcome] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const [formData, setFormData] = useState({
        fullName: 'Test User',
        rollNumber: '24BCE1234',
        phone: '1234567890',
        yearOfStudy: '1st Year',
        hostelDay: 'Hostel',
        primaryDept: 'Technical',
        secondaryDept: '',
        whyJoinSscs: 'Test reason',
        whyTheseDepts: 'Test reason',
        deptAnswer: 'Test answer',
        secondaryDeptAnswer: 'Test answer 2',
        weeklyHours: '4-6',
        linkedinUrl: '',
        googleDriveUrl: '',
        anyQuestions: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
        if (step === 2 && (!formData.primaryDept || !formData.secondaryDept)) {
            alert("Please select both a 1st and 2nd Preference to continue.");
            return;
        }
        if (step < 4) setStep(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrevStep = () => {
        setStep(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#8B5CF6', '#D946EF', '#3B82F6', '#10B981']
            });
            setIsSubmitting(false);
            setIsSubmitted(true);
        }, 1500);
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-foreground bg-[#050505]">
                <CircuitBoardBackground />
                <div className="p-10 max-w-lg w-full text-center relative z-10 bg-black/60 border border-green-500/30 rounded-3xl backdrop-blur-xl shadow-2xl">
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                        <CheckCircle2 className="w-12 h-12 text-green-400" />
                    </div>
                    <h2 className="text-3xl font-heading font-bold mb-4 text-white">Application Submitted!</h2>
                    <p className="text-white/70 mb-8 text-lg">
                        We've received your application. Keep an eye on your email and WhatsApp for updates.
                    </p>
                    <Button onClick={() => window.location.reload()} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 font-bold text-lg rounded-xl">
                        Done
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
                                Step {step} of 4 (UI TEST)
                            </span>
                            <h1 className="font-heading text-3xl md:text-5xl font-bold mb-6 text-white tracking-tight">
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

                        {/* Main Form Container - Clean and Modern */}
                        <div className="relative p-6 md:p-10 border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl">
                            <form onSubmit={step === 4 ? handleSubmit : handleNextStep} noValidate className="space-y-8">
                                
                                {step === 1 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <FormInput label="Full Name" icon={User} type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="e.g. Tony Stark" />
                                            <FormInput label="Registration Number" type="text" name="rollNumber" value={formData.rollNumber} onChange={handleInputChange} placeholder="e.g. 24BCE1234" />
                                            <FormInput label="Email" type="email" value="test@vitstudent.ac.in" disabled />
                                            <FormInput label="Phone Number" icon={Phone} type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="WhatsApp number" />
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                                    <GraduationCap className="w-4 h-4 text-primary/80" /> Year of Study
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {YEARS_OF_STUDY.map(year => (
                                                        <div key={year} onClick={() => handleOptionSelect('yearOfStudy', year)} 
                                                            className={`cursor-pointer px-4 py-3 border rounded-xl text-center text-sm font-medium transition-all duration-200 ${formData.yearOfStudy === year ? 'bg-primary/20 border-primary text-primary shadow-sm' : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70 hover:text-white'}`}>
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
                                                    {['Hostel', 'Day Scholar'].map(type => (
                                                        <div key={type} onClick={() => handleOptionSelect('hostelDay', type)} 
                                                            className={`cursor-pointer px-4 py-3 border rounded-xl text-center text-sm font-medium transition-all duration-200 ${formData.hostelDay === type ? 'bg-primary/20 border-primary text-primary shadow-sm' : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70 hover:text-white'}`}>
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                            {DEPARTMENTS.map(dept => {
                                                const isPrimary = formData.primaryDept === dept.name;
                                                const isSecondary = formData.secondaryDept === dept.name;
                                                
                                                let cardClass = "relative p-5 rounded-2xl cursor-pointer transition-all duration-200 border flex flex-col ";
                                                if (isPrimary) {
                                                    cardClass += "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.15)]";
                                                } else if (isSecondary) {
                                                    cardClass += "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]";
                                                } else {
                                                    cardClass += "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30";
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
                                            <FormTextarea label="Why do you want to join IEEE SSCS?" name="whyJoinSscs" value={formData.whyJoinSscs} onChange={handleInputChange} placeholder="Explain your motivation for joining SSCS..." />
                                            <FormTextarea label="Why did you choose these departments?" name="whyTheseDepts" value={formData.whyTheseDepts} onChange={handleInputChange} placeholder="What draws you to this specific role?" />
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
                                                <p className="text-sm text-primary font-bold mb-2 uppercase tracking-wider">1st Preference: {formData.primaryDept}</p>
                                                <p className="text-lg md:text-xl font-medium text-white leading-relaxed">
                                                    {DEPT_QUESTIONS[formData.primaryDept]?.prompt || "Tell us something amazing about yourself."}
                                                </p>
                                            </div>
                                            <FormTextarea label="Your Answer" name="deptAnswer" value={formData.deptAnswer} onChange={handleInputChange} placeholder="Type your answer here..." style={{ minHeight: '150px' }} />
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
                                                    <p className="text-sm text-blue-400 font-bold mb-2 uppercase tracking-wider">2nd Preference: {formData.secondaryDept}</p>
                                                    <p className="text-lg md:text-xl font-medium text-white leading-relaxed">
                                                        {DEPT_QUESTIONS[formData.secondaryDept]?.prompt || "Tell us something amazing about yourself."}
                                                    </p>
                                                </div>
                                                <FormTextarea label="Your Answer" name="secondaryDeptAnswer" value={formData.secondaryDeptAnswer} onChange={handleInputChange} placeholder="Type your answer here..." style={{ minHeight: '150px' }} />
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
                                            <h3 className="text-lg font-bold text-white mb-4">Availability</h3>
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
                                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                <LinkIcon className="w-5 h-5 text-primary" /> Links (Optional)
                                            </h3>
                                            <div className="grid md:grid-cols-1 gap-6">
                                                <FormInput label="LinkedIn Profile" type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleInputChange} placeholder="https://" />
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-8 border-t border-white/10">
                                            <h3 className="text-lg font-bold text-white mb-4">Any Questions for Us?</h3>
                                            <FormTextarea label="If you have any doubts about the club, the role, or the recruitment process, ask away! (Optional)" name="anyQuestions" value={formData.anyQuestions} onChange={handleInputChange} placeholder="Type your question here..." style={{ minHeight: '100px' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Navigation Bar */}
                                <div className="pt-8 flex gap-4 mt-8 border-t border-white/10">
                                    {step > 1 && (
                                        <Button type="button" variant="outline" onClick={handlePrevStep} className="h-14 px-6 md:px-8 border-white/10 bg-transparent hover:bg-white/5 text-white font-medium text-base rounded-xl transition-all">
                                            <ChevronLeft className="w-5 h-5 mr-2" /> Back
                                        </Button>
                                    )}
                                    <Button type="submit" disabled={isSubmitting} className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg rounded-xl shadow-lg transition-all group">
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

export default TestApply;
