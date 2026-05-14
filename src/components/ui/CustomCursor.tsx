import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';

const CustomCursor = () => {
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Primary mouse position
    const mouseX = useMotionValue(-100);
    const mouseY = useMotionValue(-100);

    // Lagged positions for the "Trace" joints
    const springConfig = { damping: 30, stiffness: 150 };
    const trailX = useSpring(mouseX, springConfig);
    const trailY = useSpring(mouseY, springConfig);

    useEffect(() => {
        const moveMouse = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
            if (!isVisible) setIsVisible(true);
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isSelectable = 
                target.tagName === 'A' || 
                target.tagName === 'BUTTON' || 
                target.closest('button') ||
                target.closest('a') ||
                target.getAttribute('role') === 'button';
            setIsHovering(!!isSelectable);
        };

        window.addEventListener('mousemove', moveMouse);
        window.addEventListener('mouseover', handleMouseOver);

        return () => {
            window.removeEventListener('mousemove', moveMouse);
            window.removeEventListener('mouseover', handleMouseOver);
        };
    }, [isVisible]);

    // Construct the path string using a transform
    const pathData = useTransform(
        [mouseX, mouseY, trailX, trailY],
        ([mx, my, tx, ty]) => {
            const dx = (mx as number) - (tx as number);
            const dy = (my as number) - (ty as number);
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            
            let cornerX = tx as number;
            let cornerY = ty as number;
            
            if (absDx > absDy) {
                cornerX = (mx as number) - ((dy as number) > 0 ? absDy : -absDy);
                cornerY = my as number;
            } else {
                cornerX = mx as number;
                cornerY = (my as number) - ((dx as number) > 0 ? absDx : -absDx);
            }

            return `M ${tx} ${ty} L ${cornerX} ${cornerY} L ${mx} ${my}`;
        }
    );

    if (!isVisible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[9999] hidden lg:block overflow-hidden">
            <svg className="absolute inset-0 h-full w-full">
                <defs>
                    <filter id="cursorGlow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="traceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(220, 20, 60, 0)" />
                        <stop offset="50%" stopColor="rgba(220, 20, 60, 0.8)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 1)" />
                    </linearGradient>
                </defs>
                
                <motion.path
                    d={pathData}
                    fill="none"
                    stroke="url(#traceGradient)"
                    strokeWidth={isHovering ? "2" : "1.5"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#cursorGlow)"
                />
            </svg>

            <motion.div
                style={{
                    x: trailX,
                    y: trailY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute h-2 w-2 border border-primary/40 bg-background shadow-[0_0_8px_rgba(220,20,60,0.5)]"
            >
                <div className="absolute inset-0.5 bg-primary/20" />
            </motion.div>

            <motion.div
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    scale: isHovering ? 2 : 1,
                }}
                className="absolute flex items-center justify-center"
            >
                <div className="absolute h-4 w-4 rounded-full border border-white/20" />
                <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)]" />
                
                {isHovering && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute left-6 top-6 flex flex-col gap-0.5 font-mono text-[8px] text-primary"
                    >
                        <span>NODE_ACTIVE</span>
                        <span className="text-white/40">SIGNAL_HIGH</span>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default CustomCursor;
