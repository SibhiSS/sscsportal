import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import logoIcon from '@/assets/logo-icon.png';
import logoWordmark from '@/assets/logo-wordmark.png';

const StartupPreloader = ({ onComplete }: { onComplete: () => void }) => {
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsDone(true);
            setTimeout(onComplete, 300);
        }, 1000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isDone ? 0 : 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
        >
            <div className="relative flex items-center justify-center">
                {/* LOGO ICON - Centers and Scales */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{
                        scale: isDone ? 1.4 : 1,
                        opacity: 1,
                        rotate: isDone ? 360 : 0,
                    }}
                    transition={{
                        duration: 0.8,
                        ease: "easeInOut",
                    }}
                    className="relative z-10 w-32 h-32 md:w-48 md:h-48 flex items-center justify-center"
                >
                    <img
                        src="/logo.png"
                        alt="IEEE SSCS Logo"
                        className="w-full h-full object-contain relative z-20 select-none"
                    />

                    {/* Subtle Outer Glow / Ring Spinner */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            rotate: 360
                        }}
                        transition={{
                            opacity: { duration: 0.5 },
                            scale: { duration: 0.5 },
                            rotate: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "linear"
                            }
                        }}
                        className="absolute rounded-full border border-primary/30 z-10"
                        style={{ width: '130%', height: '130%' }}
                    >
                        {/* Spinning focal point on the ring */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-[0_0_15px_rgba(220,20,60,0.8)]" />
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default StartupPreloader;
