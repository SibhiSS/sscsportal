import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ArrowLeft, User, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { fetchTeam, siteMediaUrl, teamTenures } from '@/lib/club';
import type { TeamMember } from '@/types/club';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';

const ProfileImage = ({ src: ref, alt }: { src: string | null, alt: string }) => {
    const [error, setError] = useState(false);
    const src = siteMediaUrl(ref);

    if (error || !src) {
        return (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                <User className="w-10 h-10 text-primary drop-shadow-[0_0_12px_rgba(220,20,60,0.8)]" />
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

const coordinators = [
  {
    name: 'Sangeetha R G',
    role: 'Faculty Coordinator',
    image: '/sangeetha.webp',
    description: 'Expert mentorship in technical direction and academic excellence for IEEE SSCS.'
  },
  {
    name: 'Hemanth C',
    role: 'Faculty Coordinator',
    image: '/hemanth.webp',
    description: 'Guiding innovation and student engagement within the solid-state circuits domain.'
  }
];

const coreTeam2025 = [
  {
    name: 'E Abijay',
    role: 'Chairperson',
    image: '/abijay.webp',
    quote: 'Never Settle!'
  },
  {
    name: 'Kiran Kumar',
    role: 'Vice Chairperson',
    image: '/kiran.webp',
    quote: 'I create systems that redefine the best.'
  },
  {
    name: 'Manasa Grandhi',
    role: 'General Secretary',
    image: '/manasa.webp',
    quote: 'Troubles are just passing clouds.'
  },
  {
    name: 'Mrithubashini',
    role: 'General Secretary',
    image: '/mrithubashini.webp',
    quote: "Let's see what happens."
  },
  {
    name: 'Arushi',
    role: 'Treasurer',
    image: '/arushi.webp',
    quote: 'Who wishes to fight must first count the cost.'
  }
];

const coreTeam2026: { name: string; role: string; image: string; quote: string; }[] = [
  {
    name: 'Sibhi',
    role: 'Chairperson',
    image: '/sibhi.webp',
    quote: 'Click Me!!!'
  },
  {
    name: 'Goutham P',
    role: 'Vice Chairperson',
    image: '/goutham.webp',
    quote: 'SKY IS THE LIMIT'
  },
  {
    name: 'Ilangkumaran',
    role: 'General Secretary',
    image: '/ilangkumaran.webp',
    quote: "Big ideas don't need noise, they need action."
  },
  {
    name: 'Neyalakshmi',
    role: 'Treasurer',
    image: '/neya.webp',
    quote: 'PEACE!'
  },
  {
    name: 'Sarweshwari',
    role: 'Women in SSCS (Chairperson)',
    image: '/sarweshwari.png',
    quote: 'Empowering women in circuits.'
  },
  {
    name: 'Shree Devi',
    role: 'Women in SSCS (Vice-Chairperson)',
    image: '/shreedevi.png',
    quote: 'Breaking barriers.'
  }
];

const leads2025 = [
  {
    name: 'Shivaranjani',
    role: 'Technical Lead',
    image: '/shivaranjani.webp',
    quote: "Life's a circuit—I'm still meeting setup and hold."
  },
  {
    name: 'Harshan',
    role: 'Technical Lead',
    image: '/harshan.webp',
    quote: 'Observe. Plan. Execute.'
  },
  {
    name: 'Ilangkumaran',
    role: 'Operations Lead',
    image: '/ilangkumaran.webp',
    quote: "Big ideas don't need noise, they need action."
  },
  {
    name: 'Sibhi S',
    role: 'Operations Lead',
    image: '/sibhi.webp',
    quote: 'Click Me!!!'
  },
  {
    name: 'Neyalakshmi',
    role: 'Editorial Lead',
    image: '/neya.webp',
    quote: 'PEACE!'
  },
  {
    name: 'Goutham P',
    role: 'Editorial Lead',
    image: '/goutham.webp',
    quote: 'SKY IS THE LIMIT'
  },
  {
    name: 'Priyadarshini',
    role: 'Design Lead',
    image: '/priyadharshini.webp',
    quote: 'LOST IN A PASTEL SKY'
  },
  {
    name: 'Midhun P',
    role: 'Associate Design Lead',
    image: '/midhun.webp',
    quote: 'COOL TONE WARM CORE'
  }
];

const leads2026 = [
  { name: 'S Jai Akaash', role: 'Technical Lead', image: '/jai.png', quote: '' },
  { name: 'Pranav J', role: 'Associate Technical Lead', image: '/pranav.png', quote: '' },
  { name: 'Hitesh V S', role: 'Associate Technical Lead', image: '/hitesh.png', quote: '' },
  { name: 'M Varshinee', role: 'Management Lead', image: '/varshinee.png', quote: '' },
  { name: 'Adriza Banerji', role: 'Associate Management Lead', image: '/adriza.png', quote: '' },
  { name: 'C S Tejasvini', role: 'Event Operations Lead', image: '/tejasvini.png', quote: '' },
  { name: 'Aariya Manikandan', role: 'Associate Event Operations Lead', image: '/aariya.png', quote: '' },
  { name: 'Rohith M', role: 'Creative Lead', image: '/rohith.png', quote: '' },
  { name: 'Tharun S', role: 'Associate Creative Lead', image: '/tharun.png', quote: '' },
  { name: 'Anjana Varma', role: 'Outreach & Partnerships Lead', image: '/anjana.png', quote: '' },
  { name: 'Karthikeyan D', role: 'Associate Outreach & Partnerships Lead', image: '/karthikeyan.png', quote: '' },
  { name: 'P Midhun', role: 'Human Resource Lead', image: '/midhun.webp', quote: 'COOL TONE WARM CORE' },
  { name: 'K Srishtithaa', role: 'Associate Human Resource Lead', image: '/srishtithaa.png', quote: '' }
];

// Used if the database can't be reached (e.g. before the website_team
// migration has been run), so the page is never empty.
const FALLBACK: TeamMember[] = [
    ...coordinators.map(c => ({ ...c, quote: c.description, section: 'faculty' as const, tenure: null })),
    ...coreTeam2025.map(m => ({ ...m, section: 'core' as const, tenure: '2025-26' })),
    ...leads2025.map(m => ({ ...m, section: 'lead' as const, tenure: '2025-26' })),
    ...coreTeam2026.map(m => ({ ...m, section: 'core' as const, tenure: '2026-27' })),
    ...leads2026.map(m => ({ ...m, section: 'lead' as const, tenure: '2026-27' })),
].map((m, i) => ({ id: `fallback-${i}`, sort_order: i, name: m.name, role: m.role, quote: m.quote || null, image: m.image, section: m.section, tenure: m.tenure }));

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
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
            <TechGridBackground />
            
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
            
            <div className="container mx-auto px-6 py-12 relative z-10">
                <div className="max-w-6xl mx-auto">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-12 px-6 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>

                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4"
                        >
                            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                Leadership
                            </span>
                        </motion.div>
                        <h1 className="font-heading text-[1.75rem] leading-tight sm:text-4xl md:text-5xl font-bold tracking-tight">
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
                                        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary relative overflow-hidden border border-primary/20 mx-auto">
                                            <ProfileImage src={coord.image} alt={coord.name} />
                                        </div>

                                        <div className="mb-4">
                                            <span className="inline-block text-[10px] text-primary font-bold tracking-[0.3em] uppercase mb-2 px-4 py-1 rounded-full bg-primary/10 border border-primary/20">
                                                {coord.role}
                                            </span>
                                            <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-4">
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
                            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                Leadership
                            </span>
                        </motion.div>
                        <h1 className="font-heading text-[1.75rem] leading-tight sm:text-4xl md:text-5xl font-bold tracking-tight mb-8">
                            <RevealText text="Board" />
                        </h1>
                        <div className="flex flex-wrap justify-center gap-4">
                            {tenures.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setCoreTeamYear(t)}
                                    className={`px-6 py-2 rounded-full text-sm font-bold tracking-widest uppercase transition-all ${year === t ? 'bg-primary text-white' : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:border-white/30'}`}
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
                                    <div className="w-24 h-24 rounded-2xl bg-white/5 grid place-items-center mb-6 relative overflow-hidden border border-white/10 group-hover:border-primary/30 transition-colors mx-auto">
                                        <ProfileImage src={member.image} alt={member.name} />
                                    </div>

                                    <div className="mb-4 flex-1">
                                        <span className="inline-block text-[10px] text-primary font-bold tracking-[0.2em] uppercase mb-2">
                                            {member.role}
                                        </span>
                                        <h2 className="font-heading text-xl font-bold text-white mb-3">
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
                            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                Expertise
                            </span>
                        </motion.div>
                        <h1 className="font-heading text-[1.75rem] leading-tight sm:text-4xl md:text-5xl font-bold tracking-tight">
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
                                        className={`p-6 text-center h-full flex flex-col items-center cursor-pointer transition-all duration-500 ${isSibhi && isSibhiMode ? 'border-primary shadow-[0_0_30px_rgba(220,20,60,0.3)]' : ''}`}
                                        onClick={() => isSibhi && setClicks(c => c + 1)}
                                        onMouseEnter={() => isSibhi && setIsHoveringSibhi(true)}
                                        onMouseLeave={() => isSibhi && setIsHoveringSibhi(false)}
                                    >
                                        <div 
                                            className="w-20 h-20 rounded-2xl bg-white/5 grid place-items-center mb-6 relative overflow-hidden border border-white/10 group-hover:border-primary/30 transition-colors mx-auto"
                                        >
                                            <ProfileImage src={member.image} alt={member.name} />
                                            
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
                                            <h2 className="font-heading text-lg font-bold text-white mb-3">
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
