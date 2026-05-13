
import { motion } from 'framer-motion';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';

const Team = () => {
    return (
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
            <TechGridBackground />
            
            {/* Glass Background Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        x: [0, 80, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.3, 1],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[10%] left-[5%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        x: [0, -100, 0],
                        y: [0, 50, 0],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[10%] right-[5%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]"
                />
            </div>

            <div className="container mx-auto px-6 py-12 relative z-10">
                <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-12 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group">
                    <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Back to Home
                </Link>

                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4"
                    >
                        <span className="text-xs text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                            Leadership
                        </span>
                    </motion.div>
                    <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight">
                        <RevealText text="Mentorship" />
                    </h1>
                </div>

                <motion.div
                    className="flex justify-center max-w-4xl mx-auto"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                >
                    <HolographicCard className="p-12 md:p-20 text-center relative">
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-primary/10 flex items-center justify-center mb-10 text-primary relative group-hover:rotate-6 transition-transform duration-500 overflow-hidden shadow-2xl">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                                <GraduationCap className="w-16 h-16 md:w-20 md:h-20 relative z-10" />
                                <div className="absolute inset-0 border border-primary/30 rounded-3xl scale-90 group-hover:scale-100 transition-transform duration-500" />
                            </div>

                            <div className="mb-6">
                                <span className="inline-block text-xs md:text-sm text-primary font-bold tracking-[0.3em] uppercase mb-4 px-6 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-xl">
                                    Faculty Coordinator
                                </span>
                                <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-6">
                                    Pradeep Kumar T S
                                </h2>
                            </div>

                            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
                                Guiding the academic and technical direction of IEEE SSCS with expert mentorship and deep industry insights.
                            </p>
                        </div>
                    </HolographicCard>
                </motion.div>
            </div>
        </div>
    );
};

export default Team;
