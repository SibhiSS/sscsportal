import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ArrowLeft, User, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { fetchTeam, siteMediaUrl, teamTenures } from '@/lib/club';
import type { TeamMember } from '@/types/club';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';
import Navigation from '@/components/Navigation';

const ProfileImage = ({ src: ref, alt }: { src: string | null, alt: string }) => {
    const [error, setError] = useState(false);
    const src = siteMediaUrl(ref);

    if (error || !src) {
        return (
            <div className="w-full h-full bg-white flex items-center justify-center">
                <User className="w-10 h-10 text-primary drop-shadow-[0_0_12px_rgba(49,135,232,0.8)]" />
            </div>
        );
    }
    
    return (
        <img 
            src={src} 
            alt={alt}
            className="w-full h-full object-cover block"
            loading="lazy"
            onError={() => setError(true)}
        />
    );
};

/** Shows the photo; with a second photo, clicking flips the card between the two. */
const FlipPhoto = ({ member }: { member: TeamMember }) => {
    const [flipped, setFlipped] = useState(false);
    if (!member.image2) return <ProfileImage src={member.image} alt={member.name} />;
    return (
        <button
            type="button"
            onClick={() => setFlipped(f => !f)}
            aria-label={`Show the other photo of ${member.name}`}
            className="w-full h-full [perspective:600px]"
        >
            <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
                <div className="absolute inset-0 [backface-visibility:hidden]">
                    <ProfileImage src={member.image} alt={member.name} />
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <ProfileImage src={member.image2} alt={member.name} />
                </div>
            </motion.div>
        </button>
    );
};

const coordinators = [
  {
    name: 'Dr. Dhavakumar P',
    role: 'Faculty Coordinator',
    image: '/dhavakumar.jpg',
    description: "Guiding the club's direction and student growth in artificial intelligence."
  },
  {
    name: 'Dr. M. Sivabalakrishnan',
    role: 'Faculty Coordinator',
    image: '/sivabalakrishnan.jpg',
    description: 'Mentoring projects, research and innovation across the AI Club community.'
  }
];

const TENURE = '2026-27';

// Placeholders: replace the name, quote and photo from Admin > Team once the people are confirmed.
const PLACEHOLDER = { image: null as string | null, quote: '"Your quote goes here."' };

const coreTeam2026: { name: string; role: string; image: string | null; quote: string }[] = [
  { name: 'Santhosh V', role: 'Chairperson', image: '/santhosh.jpg', quote: '' },
  { name: 'Hemasri Chamarthi', role: 'Vice Chairperson', image: '/hemasri.jpg', quote: '' },
  { name: 'Daksha Boredekar', role: 'General Secretary', image: '/daksha.jpg', quote: '' },
  { name: '"Treasurer Name"', role: 'Treasurer', ...PLACEHOLDER },
];

const leads2026: { name: string; role: string; image: string | null; quote: string }[] = [
  { name: '"Technical Lead Name"', role: 'Technical Lead', ...PLACEHOLDER },
  { name: '"Associate Technical Lead Name"', role: 'Associate Technical Lead', ...PLACEHOLDER },
  { name: '"Management Lead Name"', role: 'Management Lead', ...PLACEHOLDER },
  { name: '"Associate Management Lead Name"', role: 'Associate Management Lead', ...PLACEHOLDER },
  { name: '"Event Operations Lead Name"', role: 'Event Operations Lead', ...PLACEHOLDER },
  { name: '"Associate Event Operations Lead Name"', role: 'Associate Event Operations Lead', ...PLACEHOLDER },
  { name: '"Creative Lead Name"', role: 'Creative Lead', ...PLACEHOLDER },
  { name: '"Associate Creative Lead Name"', role: 'Associate Creative Lead', ...PLACEHOLDER },
  { name: '"Outreach Lead Name"', role: 'Outreach & Partnerships Lead', ...PLACEHOLDER },
  { name: '"Associate Outreach Lead Name"', role: 'Associate Outreach & Partnerships Lead', ...PLACEHOLDER },
  { name: '"HR Lead Name"', role: 'Human Resource Lead', ...PLACEHOLDER },
  { name: '"Associate HR Lead Name"', role: 'Associate Human Resource Lead', ...PLACEHOLDER },
];

// Used if the database can't be reached (e.g. before the website_team
// migration has been run), so the page is never empty.
const FALLBACK: TeamMember[] = [
    ...coordinators.map(c => ({ ...c, quote: c.description, section: 'faculty' as const, tenure: null })),
    ...coreTeam2026.map(m => ({ ...m, section: 'core' as const, tenure: TENURE })),
    ...leads2026.map(m => ({ ...m, section: 'lead' as const, tenure: TENURE })),
].map((m, i) => ({ id: `fallback-${i}`, sort_order: i, name: m.name, role: m.role, quote: m.quote || null, image: m.image, image2: null, section: m.section, tenure: m.tenure }));

const Team = () => {
    const [clicks, setClicks] = useState(0);
    const [isSibhiMode, setIsSibhiMode] = useState(false);
    const [isHoveringSibhi, setIsHoveringSibhi] = useState(false);
    const [showHeart, setShowHeart] = useState(false);
    const [team, setTeam] = useState<TeamMember[] | null>(null);
    const [coreTeamYear, setCoreTeamYear] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        fetchTeam()
            .then(rows => { if (active) setTeam(rows); })
            .catch(err => { console.warn('[team] Using built-in team:', err); if (active) setTeam(FALLBACK); });
        return () => { active = false; };
    }, []);

    const tenures = useMemo(() => teamTenures(team ?? []), [team]);
    const year = coreTeamYear ?? tenures[0] ?? null;
    const facultyList = (team ?? []).filter(m => m.section === 'faculty');
    const activeCoreTeam = (team ?? []).filter(m => m.section === 'core' && m.tenure === year);
    const activeLeads = (team ?? []).filter(m => m.section === 'lead' && m.tenure === year);

    useEffect(() => {
        if (clicks === 3) {
            setIsSibhiMode(true);
            setTimeout(() => setIsSibhiMode(false), 5000);
        } else if (clicks === 5) {
            window.open('https://sibhi.com', '_blank');
            setClicks(0);
        }
    }, [clicks]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isHoveringSibhi) {
            timer = setTimeout(() => setShowHeart(true), 2000);
        } else {
            setShowHeart(false);
        }
        return () => clearTimeout(timer);
    }, [isHoveringSibhi]);

    return (
        <div className="min-h-screen relative text-foreground bg-background overflow-hidden">
            <TechGridBackground />
<Navigation />
            
            {/* Sibhi Mode Background Pulse */}
            <AnimatePresence>
                {isSibhiMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-20 bg-primary/20 pointer-events-none blur-[100px]"
                    >
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-full h-full bg-primary/30"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Welcome Message */}
            <AnimatePresence>
                {isSibhiMode && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-2xl text-primary font-bold tracking-widest text-xs uppercase"
                    >
                        Welcome back, Lead.
                    </motion.div>
                )}
            </AnimatePresence>
            
            <div className="container mx-auto px-6 pt-28 pb-16 relative z-10">
                <div className="max-w-6xl mx-auto">
                    <Link to="/" className="group inline-flex items-center text-[13px] font-medium text-muted-foreground hover:text-primary transition-colors mb-12">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>

                    <div className="mb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4"
                        >
                            <span className="inline-flex items-center font-mono text-[11px] font-normal tracking-[0.3em] text-[#0B1726] uppercase">
                                Leadership
                            <span className="ml-4 inline-block h-px w-14 bg-primary" /></span>
                        </motion.div>
                        <h1 className="font-display text-[36px] md:text-[48px] font-extrabold uppercase leading-[1.02] tracking-tight text-[#0B1726]">
                            <RevealText text="Faculty Coordinators" />
                        </h1>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {facultyList.map((coord, index) => (
                            <motion.div
                                key={coord.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <HolographicCard className="p-8 text-center h-full">
                                    <div className="flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-md bg-primary/10 flex items-center justify-center mb-6 text-primary relative overflow-hidden border border-primary/20 mx-auto">
                                            <FlipPhoto member={coord} />
                                        </div>

                                        <div className="mb-4">
                                            <span className="inline-block text-[10px] text-primary font-bold tracking-[0.3em] uppercase mb-2 px-4 py-1 rounded-[3px] bg-primary/10 border border-primary/20">
                                                {coord.role}
                                            </span>
                                            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
                                                {coord.name}
                                            </h2>
                                        </div>

                                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                                            {coord.quote}
                                        </p>
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        ))}
                    </div>

                    {/* Board Section */}
                    <div className="text-center mt-24 mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="mb-4"
                        >
                            <span className="inline-flex items-center font-mono text-[11px] font-normal tracking-[0.3em] text-[#0B1726] uppercase">
                                Leadership
                            <span className="ml-4 inline-block h-px w-14 bg-primary" /></span>
                        </motion.div>
                        <h1 className="font-display text-[36px] md:text-[48px] font-extrabold uppercase leading-[1.02] tracking-tight text-[#0B1726] mb-8">
                            <RevealText text="Board" />
                        </h1>
                        <div className="flex flex-wrap justify-center gap-4">
                            {tenures.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setCoreTeamYear(t)}
                                    className={`px-6 py-2 rounded-[3px] text-sm font-bold tracking-widest uppercase transition-all ${year === t ? 'bg-primary text-white' : 'bg-white border border-white/10 text-muted-foreground hover:text-white hover:border-white/30'}`}
                                >
                                    AY {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mb-24">
                        {activeCoreTeam.length === 0 ? (
                            <div className="w-full text-center py-12 text-muted-foreground italic">
                                Members to be announced soon...
                            </div>
                        ) : (
                            activeCoreTeam.map((member, index) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)]"
                            >
                                <HolographicCard className="p-6 text-center h-full flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-md bg-white grid place-items-center mb-6 relative overflow-hidden border border-border group-hover:border-primary/30 transition-colors mx-auto">
                                        <FlipPhoto member={member} />
                                    </div>

                                    <div className="mb-4 flex-1">
                                        <span className="inline-block text-[10px] text-primary font-bold tracking-[0.2em] uppercase mb-2">
                                            {member.role}
                                        </span>
                                        <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                                            {member.name}
                                        </h2>
                                        {member.quote && (
                                            <p className="text-xs italic text-muted-foreground leading-relaxed">
                                                "{member.quote}"
                                            </p>
                                        )}
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        )))}
                    </div>

                    {/* Leads Section */}
                    <div className="text-center mt-24 mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="mb-4"
                        >
                            <span className="inline-flex items-center font-mono text-[11px] font-normal tracking-[0.3em] text-[#0B1726] uppercase">
                                Expertise
                            <span className="ml-4 inline-block h-px w-14 bg-primary" /></span>
                        </motion.div>
                        <h1 className="font-display text-[36px] md:text-[48px] font-extrabold uppercase leading-[1.02] tracking-tight text-[#0B1726]">
                            <RevealText text="Leads" />
                        </h1>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mb-24">
                        {activeLeads.map((member, index) => {
                            const isSibhi = member.name === 'Sibhi S';
                            return (
                                <motion.div
                                    key={member.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)]"
                                >
                                    <HolographicCard 
                                        className={`p-6 text-center h-full flex flex-col items-center cursor-pointer transition-all duration-500 ${isSibhi && isSibhiMode ? 'border-primary shadow-[0_0_30px_rgba(49,135,232,0.3)]' : ''}`}
                                        onClick={() => isSibhi && setClicks(c => c + 1)}
                                        onMouseEnter={() => isSibhi && setIsHoveringSibhi(true)}
                                        onMouseLeave={() => isSibhi && setIsHoveringSibhi(false)}
                                    >
                                        <div 
                                            className="w-20 h-20 rounded-md bg-white grid place-items-center mb-6 relative overflow-hidden border border-border group-hover:border-primary/30 transition-colors mx-auto"
                                        >
                                            <FlipPhoto member={member} />
                                            
                                            {/* Idea 3: Pulsing Circuit Heart */}
                                            {isSibhi && (
                                                <AnimatePresence>
                                                    {showHeart && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.5 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.5 }}
                                                            className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center"
                                                        >
                                                            <motion.div
                                                                animate={{ scale: [1, 1.2, 1] }}
                                                                transition={{ duration: 0.8, repeat: Infinity }}
                                                            >
                                                                <Heart className="w-8 h-8 text-primary fill-primary" />
                                                            </motion.div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            )}
                                        </div>

                                        <div className="mb-4 flex-1">
                                            <span className="inline-block text-[10px] text-primary font-bold tracking-[0.2em] uppercase mb-2">
                                                {member.role}
                                            </span>
                                            <h2 className="font-heading text-lg font-bold text-foreground mb-3">
                                                {member.name}
                                            </h2>
                                            {member.quote && (
                                                <p className="text-xs italic text-muted-foreground leading-relaxed">
                                                    "{member.quote}"
                                                </p>
                                            )}
                                        </div>
                                    </HolographicCard>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Team;
