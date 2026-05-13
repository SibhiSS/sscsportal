import { motion } from 'framer-motion';
import { useMemo } from 'react';

const TechGridBackground = () => {
    // Memoize particles to prevent regeneration on each render
    const particles = useMemo(() => {
        return [...Array(15)].map(() => ({
            initialX: Math.random() * 100,
            initialY: Math.random() * 100,
            duration: 10 + Math.random() * 15, // Faster to verify movement
            size: 100 + Math.random() * 100,
        }));
    }, []);

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#020202]">
            {/* 1. Global Animated Blobs for "Smooth Red Blend" feel */}
            <div className="absolute inset-0 pointer-events-none">
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 20, 0],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-primary/10 rounded-full blur-[180px]"
                />
                <motion.div
                    animate={{
                        x: [0, -60, 0],
                        y: [0, 40, 0],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[-20%] right-[-10%] w-[55vw] h-[55vw] bg-primary/8 rounded-full blur-[160px]"
                />
            </div>

            {/* 2. Red Tech Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, rgba(220, 20, 60, 0.1) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(220, 20, 60, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                    maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 90%)'
                }}
            />

            {/* 3. Subtle Glowing Dots & Flying Particles */}
            <div className="absolute inset-0">
                {/* Static Pulsing Dots */}
                {[
                    { t: '15%', l: '20%', d: '3s', de: '0s' },
                    { t: '45%', l: '80%', d: '4s', de: '1s' },
                    { t: '75%', l: '30%', d: '5s', de: '2s' },
                    { t: '25%', l: '70%', d: '6s', de: '0.5s' },
                ].map((dot, i) => (
                    <div 
                        key={i}
                        className="absolute w-1 h-1 bg-primary/40 rounded-full animate-pulse" 
                        style={{ 
                            top: dot.t, 
                            left: dot.l, 
                            animationDuration: dot.d,
                            animationDelay: dot.de
                        }} 
                    />
                ))}

                {/* Flying Red Particles (Subtle Blurs) */}
                {particles.map((p, i) => (
                    <motion.div
                        key={`particle-${i}`}
                        initial={{ 
                            left: p.initialX + '%', 
                            top: p.initialY + '%',
                            x: 0,
                            y: 0,
                            scale: 0.8,
                            opacity: 0 
                        }}
                        animate={{
                            x: [0, 50, -50, 25, 0], // Drift distance in pixels
                            y: [0, -50, 50, -25, 0],
                            scale: [0.8, 1.1, 0.9, 1.1, 0.8],
                            opacity: [0, 0.5, 0.5, 0]
                        }}
                        transition={{
                            duration: p.duration,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute bg-primary/20 rounded-full blur-[60px] pointer-events-none"
                        style={{ width: p.size, height: p.size }}
                    />
                ))}
            </div>

            {/* 4. Global Noise Overlay (Integrated) */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />
            {/* 5. Fixed Vignette for consistent "Hero" feel */}
            <div className="absolute inset-0 pointer-events-none" 
                style={{ 
                    background: 'radial-gradient(circle at center, transparent 0%, rgba(5, 5, 5, 0.4) 100%)' 
                }} 
            />
        </div>
    );
};

export default TechGridBackground;
