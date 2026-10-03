import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const StartupPreloader = ({ onComplete }: { onComplete: () => void }) => {
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        // Run sequence for 2.2 seconds before triggering exit
        const timer = setTimeout(() => {
            setIsDone(true);
            setTimeout(onComplete, 500); // Wait for fade out
        }, 2200);

        return () => clearTimeout(timer);
    }, [onComplete]);

    // 6 pins per side
    const pins = Array.from({ length: 6 });

    // The order of rendering in the DOM defines the stagger order.
    // By keeping them all inside one container, Framer staggerChildren lights them up sequentially.
    const containerVariants = {
        hidden: {},
        visible: {
            transition: { staggerChildren: 0.05 }
        }
    };

    const pinVariants = {
        hidden: { backgroundColor: '#1a1a1a', boxShadow: '0 0 0 rgba(220,20,60,0)' },
        visible: { 
            backgroundColor: '#dc143c', 
            boxShadow: '0 0 10px rgba(220,20,60,0.8)',
            transition: { duration: 0.2 }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isDone ? 0 : 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center overflow-hidden"
        >
            {/* The Microchip */}
            <motion.div 
                className="relative flex items-center justify-center"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ 
                    scale: isDone ? 1.5 : 1, 
                    opacity: 1 
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                {/* Pins Container (Must be absolute and sit behind the core) */}
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="absolute inset-0"
                >
                    {/* Top Pins */}
                    <div className="absolute -top-3 left-0 w-full flex justify-between px-3">
                        {pins.map((_, i) => (
                            <motion.div key={`top-${i}`} variants={pinVariants} className="w-1.5 h-3 bg-zinc-800 rounded-t-sm" />
                        ))}
                    </div>
                    {/* Bottom Pins */}
                    <div className="absolute -bottom-3 left-0 w-full flex justify-between px-3">
                        {pins.map((_, i) => (
                            <motion.div key={`bottom-${i}`} variants={pinVariants} className="w-1.5 h-3 bg-zinc-800 rounded-b-sm" />
                        ))}
                    </div>
                    {/* Left Pins */}
                    <div className="absolute top-0 -left-3 h-full flex flex-col justify-between py-3">
                        {pins.map((_, i) => (
                            <motion.div key={`left-${i}`} variants={pinVariants} className="w-3 h-1.5 bg-zinc-800 rounded-l-sm" />
                        ))}
                    </div>
                    {/* Right Pins */}
                    <div className="absolute top-0 -right-3 h-full flex flex-col justify-between py-3">
                        {pins.map((_, i) => (
                            <motion.div key={`right-${i}`} variants={pinVariants} className="w-3 h-1.5 bg-zinc-800 rounded-r-sm" />
                        ))}
                    </div>
                </motion.div>

                {/* Center Core */}
                <motion.div 
                    className="relative z-10 w-24 h-24 md:w-32 md:h-32 bg-[#0a0a0a] border-2 border-primary/20 rounded-md flex items-center justify-center overflow-hidden"
                    animate={{
                        borderColor: isDone ? 'rgba(220,20,60,1)' : 'rgba(220,20,60,0.3)',
                        boxShadow: isDone ? '0 0 40px rgba(220,20,60,0.6), inset 0 0 20px rgba(220,20,60,0.3)' : '0 0 0px rgba(220,20,60,0)'
                    }}
                    transition={{ delay: 1.2, duration: 0.5 }} // delay roughly until pins finish
                >
                    <img
                        src="/logo.png"
                        alt="IEEE SSCS"
                        className="w-[60%] h-[60%] object-contain opacity-90 relative z-20"
                    />
                    
                    {/* Core scan line */}
                    <motion.div 
                        className="absolute left-0 right-0 h-full w-full bg-gradient-to-b from-transparent via-primary/20 to-transparent z-10"
                        animate={{ top: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
                    />

                    {/* Faint Grid Background inside chip */}
                    <div 
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                            backgroundSize: '8px 8px'
                        }}
                    />
                </motion.div>

                {/* Outer Glow Pulse */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                        opacity: isDone ? [0, 0.5, 0] : 0, 
                        scale: isDone ? 2 : 0.8 
                    }}
                    transition={{ duration: 1, ease: "easeOut", delay: 1.4 }}
                    className="absolute inset-0 -z-10 rounded-full border border-primary/50 shadow-[0_0_50px_rgba(220,20,60,0.5)]"
                />

                {/* Tagline Wipe Animation */}
                <motion.div 
                    className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap"
                    initial={{ clipPath: "polygon(0 0, 0 0, 0 100%, 0% 100%)", opacity: 0 }}
                    animate={{ 
                        clipPath: isDone ? "polygon(0 0, 0 0, 0 100%, 0% 100%)" : "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                        opacity: 1 
                    }}
                    transition={{ duration: 1.2, delay: 0.8, ease: "easeInOut" }}
                >
                    <span className="font-heading text-primary/80 tracking-[0.2em] uppercase text-xs font-bold drop-shadow-[0_0_8px_rgba(220,20,60,0.5)]">
                        Think Silicon. Think SSCS
                    </span>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

export default StartupPreloader;
