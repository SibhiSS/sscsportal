import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import logoIcon from '@/assets/logo-icon.png';
import logoWordmark from '@/assets/logo-wordmark.png';

const StartupPreloader = ({ onComplete }: { onComplete: () => void }) => {
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        // Exact 750ms active duration
        const timer = setTimeout(() => {
            setIsDone(true);
            setTimeout(onComplete, 300);
        }, 750);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isDone ? 0 : 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
        >
            <div className="relative flex items-center justify-center w-full max-w-2xl px-12">
                {/* LOGO WORDMARK - Slides behind the icon */}
                <motion.div
                    initial={{ opacity: 1, x: 60, clipPath: 'inset(0 0 0 0%)', filter: 'blur(0px)' }}
                    animate={{
                        x: -140,
                        clipPath: 'inset(0 0 0 100%)',
                        opacity: [1, 0.8, 0],
                        filter: ['blur(0px)', 'blur(4px)', 'blur(12px)'],
                    }}
                    transition={{
                        delay: 0,
                        duration: 0.55,
                        ease: "easeInOut",
                    }}
                    className="absolute z-0 w-32 md:w-48"
                >
                    <img
                        src={logoWordmark}
                        alt="IEEE SSCS"
                        className="w-full h-auto object-contain select-none"
                    />
                </motion.div>

                {/* LOGO ICON - Centers and Scales */}
                <motion.div
                    initial={{ scale: 1, rotate: 0, x: -100 }}
                    animate={{
                        x: 0,
                        scale: [1, 1, 1.4],
                        rotate: [0, 0, 360],
                    }}
                    transition={{
                        x: { delay: 0, duration: 0.55, ease: "easeOut" },
                        scale: { delay: 0.4, duration: 0.35, ease: "easeInOut" },
                        rotate: {
                            delay: 0.4,
                            duration: 0.35,
                            ease: "easeInOut",
                        }
                    }}
                    className="relative z-10 w-24 h-24 md:w-32 md:h-32 flex items-center justify-center"
                >
                    <img
                        src={logoIcon}
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
                            opacity: { delay: 0.55, duration: 0.2 },
                            scale: { delay: 0.55, duration: 0.2 },
                            rotate: {
                                delay: 0.55,
                                duration: 2,
                                repeat: Infinity,
                                ease: "linear"
                            }
                        }}
                        className="absolute rounded-full border border-primary/30 z-10"
                        style={{ width: '130%', height: '130%' }}
                    >
                        {/* Spinning focal point on the ring */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full shadow-[0_0_15px_rgba(220,20,60,0.8)]" />
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default StartupPreloader;
