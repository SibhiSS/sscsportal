import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';

const CustomCursor = () => {
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const mouseX = useMotionValue(-100);
    const mouseY = useMotionValue(-100);

    // Ultra-high tension spring for a "micro" trace
    const springConfig = { damping: 40, stiffness: 1200, mass: 0.5 };
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
            let t_x = tx as number;
            let t_y = ty as number;

            let dx = m_x - t_x;
            let dy = m_y - t_y;
            
            // Limit the distance mathematically to ensure it's ALWAYS short
            const maxLen = 20; 
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxLen) {
                const ratio = maxLen / dist;
                t_x = m_x - (dx * ratio);
                t_y = m_y - (dy * ratio);
                dx = m_x - t_x;
                dy = m_y - t_y;
            }

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            
            // PCB-style 45-degree routing logic
            let cornerX = t_x;
            let cornerY = t_y;
            
            if (absDx > absDy) {
                cornerX = m_x - (dy > 0 ? absDy : -absDy);
                cornerY = m_y;
            } else {
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
                    <filter id="microGlow">
                        <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="shortTraceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(220, 20, 60, 0)" />
                        <stop offset="80%" stopColor="rgba(220, 20, 60, 1)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 1)" />
                    </linearGradient>
                </defs>
                
                {/* Ultra-Short PCB Trace */}
                <motion.path
                    d={pathData}
                    fill="none"
                    stroke="url(#shortTraceGradient)"
                    strokeWidth={isHovering ? "2.2" : "1.5"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#microGlow)"
                />
            </svg>

            {/* Precision Micro-Via */}
            <motion.div
                style={{
                    x: trailX,
                    y: trailY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute h-1 w-1 bg-primary/80 shadow-[0_0_4px_rgba(220,20,60,0.6)]"
            />

            {/* Active Core Cursor */}
            <motion.div
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    scale: isHovering ? 1.4 : 1,
                }}
                className="absolute flex items-center justify-center"
            >
                <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
                
                {isHovering && (
                    <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute left-3 top-3 font-mono text-[6px] font-bold text-primary uppercase"
                    >
                        locked
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default CustomCursor;
