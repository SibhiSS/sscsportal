import React, { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';

const CustomCursor = () => {
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const cursorRef = useRef<HTMLDivElement>(null);

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

    if (!isVisible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[9999] hidden lg:block overflow-hidden">
            {/* The SVG Trace Layer */}
            <svg className="absolute inset-0 h-full w-full">
                <defs>
                    <filter id="glow">
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
                
                {/* Dynamic PCB Trace Line */}
                <motion.path
                    d={useTransform(
                        [mouseX, mouseY, trailX, trailY],
                        ([mx, my, tx, ty]) => {
                            // Calculate a 45-degree "routing" path
                            const dx = mx - tx;
                            const dy = my - ty;
                            const absDx = Math.abs(dx);
                            const absDy = Math.abs(dy);
                            
                            // Determine the corner point for PCB-style routing
                            let cornerX = tx;
                            let cornerY = ty;
                            
                            if (absDx > absDy) {
                                cornerX = mx - (dy > 0 ? absDy : -absDy);
                                cornerY = my;
                            } else {
                                cornerX = mx;
                                cornerY = my - (dx > 0 ? absDx : -absDx);
                            }

                            return `M ${tx} ${ty} L ${cornerX} ${cornerY} L ${mx} ${my}`;
                        }
                    )}
                    fill="none"
                    stroke="url(#traceGradient)"
                    strokeWidth={isHovering ? "2" : "1.5"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                />
            </svg>

            {/* Terminal Via (The Connection Dot) */}
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

            {/* Active Node (The Mouse Dot) */}
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
                {/* Outer Ring */}
                <div className="absolute h-4 w-4 rounded-full border border-white/20" />
                {/* Inner Precise Dot */}
                <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)]" />
                
                {/* Coordinate Markers (PCB Grid style) */}
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

            {/* Scanning Grid (Optional subtle pulse) */}
            <motion.div
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    opacity: isHovering ? 0.3 : 0,
                    scale: isHovering ? 1.5 : 1
                }}
                className="absolute h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(220,20,60,0.15)_0%,transparent_70%)]"
            />
        </div>
    );
};

export default CustomCursor;
