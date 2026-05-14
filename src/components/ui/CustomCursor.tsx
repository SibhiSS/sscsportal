import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';

const CustomCursor = () => {
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const mouseX = useMotionValue(-100);
    const mouseY = useMotionValue(-100);

    // Faster, tighter spring for a "short" snappy trace
    const springConfig = { damping: 35, stiffness: 400 };
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

    const pathData = useTransform(
        [mouseX, mouseY, trailX, trailY],
        ([mx, my, tx, ty]) => {
            const m_x = mx as number;
            const m_y = my as number;
            const t_x = tx as number;
            const t_y = ty as number;

            const dx = m_x - t_x;
            const dy = m_y - t_y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            
            // Routing logic for a sharp 45-degree PCB trace
            let cornerX = t_x;
            let cornerY = t_y;
            
            if (absDx > absDy) {
                // Horizontal dominant: bend at 45 deg
                cornerX = m_x - (dy > 0 ? absDy : -absDy);
                cornerY = m_y;
            } else {
                // Vertical dominant: bend at 45 deg
                cornerX = m_x;
                cornerY = m_y - (dx > 0 ? absDx : -absDx);
            }

            return `M ${t_x} ${t_y} L ${cornerX} ${cornerY} L ${m_x} ${m_y}`;
        }
    );

    if (!isVisible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[9999] hidden lg:block overflow-hidden">
            <svg className="absolute inset-0 h-full w-full">
                <defs>
                    <filter id="traceGlow">
                        <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="traceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(220, 20, 60, 0)" />
                        <stop offset="60%" stopColor="rgba(220, 20, 60, 0.9)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 1)" />
                    </linearGradient>
                </defs>
                
                {/* Snappy Short Trace */}
                <motion.path
                    d={pathData}
                    fill="none"
                    stroke="url(#traceGradient)"
                    strokeWidth={isHovering ? "2.5" : "1.8"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#traceGlow)"
                />
            </svg>

            {/* Small PCB Via (trailing point) */}
            <motion.div
                style={{
                    x: trailX,
                    y: trailY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute h-1.5 w-1.5 border border-primary/60 bg-background shadow-[0_0_5px_rgba(220,20,60,0.4)]"
            />

            {/* Active Cursor Dot */}
            <motion.div
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    scale: isHovering ? 1.5 : 1,
                }}
                className="absolute flex items-center justify-center"
            >
                <div className="absolute h-3 w-3 rounded-full border border-white/10" />
                <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)]" />
                
                {isHovering && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute left-4 top-4 font-mono text-[7px] font-bold text-primary whitespace-nowrap"
                    >
                        [TRACE_LOCKED]
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default CustomCursor;
