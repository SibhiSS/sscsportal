import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ArrowLeft, User, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';

const coordinators = [
  {
    name: 'Sangeetha R G',
    role: 'Faculty Coordinator',
    image: '/sangeetha.png',
    description: 'Expert mentorship in technical direction and academic excellence for IEEE SSCS.'
  },
  {
    name: 'Hemanth C',
    role: 'Faculty Coordinator',
    image: '/hemanth.png',
    description: 'Guiding innovation and student engagement within the solid-state circuits domain.'
  }
];

const coreTeam = [
  {
    name: 'E Abijay',
    role: 'Chairperson',
    image: '/abijay.png',
    quote: 'Never Settle!'
  },
  {
    name: 'Kiran Kumar',
    role: 'Vice Chairperson',
    image: '/kiran.png',
    quote: 'I create systems that redefine the best.'
  },
  {
    name: 'Manasa Grandhi',
    role: 'General Secretary',
    image: '/manasa.png',
    quote: 'Troubles are just passing clouds.'
  },
  {
    name: 'Mrithubashini',
    role: 'General Secretary',
    image: '/mrithubashini.png',
    quote: "Let's see what happens."
  },
  {
    name: 'Arushi',
    role: 'Treasurer',
    image: '/arushi.png',
    quote: 'Who wishes to fight must first count the cost.'
  }
];

const leads = [
  {
    name: 'Shivaranjani',
    role: 'Technical Lead',
    image: '/shivaranjani.png',
    quote: "Life's a circuit—I'm still meeting setup and hold."
  },
  {
    name: 'Harshan',
    role: 'Technical Lead',
    image: '/harshan.png',
    quote: 'Observe. Plan. Execute.'
  },
  {
    name: 'Ilangkumaran',
    role: 'Operations Lead',
    image: '/ilangkumaran.png',
    quote: "Big ideas don't need noise, they need action."
  },
  {
    name: 'Sibhi S',
    role: 'Operations Lead',
    image: '/sibhi.png',
    quote: 'Click Me!!!'
  },
  {
    name: 'Neyalakshmi',
    role: 'Editorial Lead',
    image: '/neya.png',
    quote: 'PEACE!'
  },
  {
    name: 'Goutham P',
    role: 'Editorial Lead',
    image: '/goutham.png',
    quote: 'SKY IS THE LIMIT'
  },
  {
    name: 'Priyadarshini',
    role: 'Design Lead',
    image: '/priyadharshini.png',
    quote: 'LOST IN A PASTEL SKY'
  },
  {
    name: 'Midhun P',
    role: 'Associate Design Lead',
    image: '/midhun.png',
    quote: 'COOL TONE WARM CORE'
  }
];

const Team = () => {
    const [clicks, setClicks] = useState(0);
    const [isSibhiMode, setIsSibhiMode] = useState(false);
    const [isHoveringSibhi, setIsHoveringSibhi] = useState(false);
    const [showHeart, setShowHeart] = useState(false);

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
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                            <RevealText text="Faculty Coordinators" />
                        </h1>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {coordinators.map((coord, index) => (
                            <motion.div
                                key={coord.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <HolographicCard className="p-8 text-center h-full">
                                    <div className="flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary relative overflow-hidden border border-primary/20 mx-auto">
                                            <img 
                                                src={coord.image} 
                                                alt={coord.name}
                                                className="w-full h-full object-cover block"
                                                loading="lazy"
                                            />
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
                                            {coord.description}
                                        </p>
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        ))}
                    </div>

                    {/* Core Team Section */}
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
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                            <RevealText text="Core Team" />
                        </h1>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mb-24">
                        {coreTeam.map((member, index) => (
                            <motion.div
                                key={member.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)]"
                            >
                                <HolographicCard className="p-6 text-center h-full flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-2xl bg-white/5 grid place-items-center mb-6 relative overflow-hidden border border-white/10 group-hover:border-primary/30 transition-colors mx-auto">
                                        <img 
                                            src={member.image} 
                                            alt={member.name}
                                            className="w-full h-full object-cover block"
                                            loading="lazy"
                                        />
                                    </div>

                                    <div className="mb-4 flex-1">
                                        <span className="inline-block text-[10px] text-primary font-bold tracking-[0.2em] uppercase mb-2">
                                            {member.role}
                                        </span>
                                        <h2 className="font-heading text-xl font-bold text-white mb-3">
                                            {member.name}
                                        </h2>
                                        <p className="text-xs italic text-muted-foreground leading-relaxed">
                                            "{member.quote}"
                                        </p>
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        ))}
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
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                            <RevealText text="Leads" />
                        </h1>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mb-24">
                        {leads.map((member, index) => {
                            const isSibhi = member.name === 'Sibhi S';
                            return (
                                <motion.div
                                    key={member.name}
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
                                            <img 
                                                src={member.image} 
                                                alt={member.name}
                                                className="w-full h-full object-cover block"
                                                loading="lazy"
                                            />
                                            
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
                                            <p className="text-xs italic text-muted-foreground leading-relaxed">
                                                "{member.quote}"
                                            </p>
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
