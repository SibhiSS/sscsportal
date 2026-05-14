import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

const CustomCursor = () => {
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const mouseX = useMotionValue(-100);
    const mouseY = useMotionValue(-100);

    // Smooth spring physics for the "Silicon Trace" lag effect
    const springConfig = { damping: 25, stiffness: 200 };
    const springX = useSpring(mouseX, springConfig);
    const springY = useSpring(mouseY, springConfig);

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
        <div className="pointer-events-none fixed inset-0 z-[9999] hidden lg:block">
            {/* Primary Sharp Dot */}
            <motion.div
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
            />

            {/* Trace Glow (The "Lagged" Silicon Trail) */}
            <motion.div
                style={{
                    x: springX,
                    y: springY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    scale: isHovering ? 2.2 : 1,
                    backgroundColor: isHovering ? 'rgba(220, 20, 60, 0.3)' : 'rgba(220, 20, 60, 0.05)',
                    borderColor: isHovering ? 'rgba(220, 20, 60, 0.6)' : 'rgba(220, 20, 60, 0.2)',
                }}
                className="absolute h-10 w-10 rounded-full border border-primary/20 backdrop-blur-[1px] transition-colors duration-300"
            />
            
            {/* Inner Core Trace */}
            <motion.div
                style={{
                    x: springX,
                    y: springY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    scale: isHovering ? 1.5 : 1,
                    opacity: isHovering ? 0.8 : 0.4
                }}
                className="absolute h-3 w-3 rounded-full border border-primary/40"
            />

            {/* Silicon Trace Trail Line (Decorative) */}
            <motion.div
                style={{
                    x: springX,
                    y: springY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute h-[1px] w-4 bg-gradient-to-r from-primary/50 to-transparent rotate-45"
            />
            <motion.div
                style={{
                    x: springX,
                    y: springY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute h-[1px] w-4 bg-gradient-to-r from-primary/50 to-transparent -rotate-45"
            />
        </div>
    );
};

export default CustomCursor;
