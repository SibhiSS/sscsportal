
import { motion } from 'framer-motion';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';

const Team = () => {
    return (
        <div className="min-h-screen relative text-foreground">
            <TechGridBackground />
            <div className="absolute inset-0 bg-background/80 pointer-events-none -z-10" />

            <div className="container mx-auto px-6 py-12 relative z-10">
                <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-12">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Link>
                <div className="text-center mb-16">
                    <span className="text-xs text-primary tracking-widest uppercase mb-2 block animate-in fade-in zoom-in duration-500 delay-300">
                        The Minds Behind IEEE SSCS
                    </span>
                    <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">
                        <RevealText text="Leadership & Faculty" />
                    </h1>
                </div>

                <motion.div
                    className="flex justify-center gap-8 max-w-3xl mx-auto items-center"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >

                    {/* Pradeep Kumar T S - Faculty Coordinator (Center & Highlighted) */}
                    <HolographicCard className="p-10 md:py-16 md:px-12 flex flex-col items-center text-center h-full border-primary/50 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)] hover:border-primary hover:shadow-[0_0_60px_rgba(59,130,246,0.5)] scale-100 md:scale-105 z-10 relative overflow-hidden group ring-1 ring-primary/20 bg-background/50 backdrop-blur-sm">
                        {/* Animated background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-primary/20 flex items-center justify-center mb-8 md:mb-10 text-primary relative shrink-0">
                            <GraduationCap className="w-12 h-12 md:w-14 md:h-14 relative z-10" />
                            <div className="absolute inset-0 rounded-full border border-primary/60 animate-[ping_3s_ease-in-out_infinite] opacity-30" />
                        </div>
                        <h4 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4 relative z-10 leading-tight">
                            Pradeep Kumar T S
                        </h4>
                        <span className="inline-block text-xs md:text-sm text-primary-foreground font-bold tracking-widest uppercase mb-2 bg-primary px-5 md:px-8 py-2.5 rounded-full shadow-lg relative z-10">
                            Faculty Coordinator
                        </span>
                        <p className="text-muted-foreground leading-relaxed text-base md:text-lg relative z-10 mt-6 md:mt-8">
                            Guiding the academic and technical direction of IEEE SSCS with expert mentorship and industry insights.
                        </p>
                    </HolographicCard>
                </motion.div>
            </div>
        </div>
    );
};

export default Team;
