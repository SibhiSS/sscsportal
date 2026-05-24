
import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface HolographicCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

const HolographicCard: React.FC<HolographicCardProps> = ({ children, className = '', ...props }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);
    const rafRef = useRef<number | null>(null);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;
        // Cancel any pending RAF before scheduling a new one
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
        }
        const clientX = e.clientX;
        const clientY = e.clientY;
        rafRef.current = requestAnimationFrame(() => {
            if (!divRef.current) return;
            const rect = divRef.current.getBoundingClientRect();
            setPosition({ x: clientX - rect.left, y: clientY - rect.top });
        });
    }, []);

    const handleMouseEnter = useCallback(() => {
        setOpacity(1);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setOpacity(0);
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    return (
        <motion.div
            {...props}
            ref={divRef}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onMouseMove={handleMouseMove}
            onMouseEnter={(e) => {
                handleMouseEnter();
                props.onMouseEnter?.(e);
            }}
            onMouseLeave={(e) => {
                handleMouseLeave();
                props.onMouseLeave?.(e);
            }}
            className={`relative group rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-2xl overflow-hidden transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_8px_32px_0_rgba(220,20,60,0.15)] ${className}`}
        >
            {/* Glass Inner Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10 h-full">
                {children}
            </div>

            {/* Mouse-following Spotlight Gradient */}
            <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(220, 20, 60, 0.15), transparent 40%)`
                }}
            />

            {/* Mouse-following Border Glow */}
            <div
                className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(220, 20, 60, 0.4), transparent 40%)`,
                    zIndex: -1
                }}
            />
        </motion.div>
    );
};

export default HolographicCard;
