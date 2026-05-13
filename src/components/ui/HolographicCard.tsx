
import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface HolographicCardProps {
    children: React.ReactNode;
    className?: string;
}

const HolographicCard: React.FC<HolographicCardProps> = ({ children, className = '' }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;

        const div = divRef.current;
        const rect = div.getBoundingClientRect();

        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseEnter = () => {
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <motion.div
            ref={divRef}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative group rounded-xl bg-card/40 border border-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 ${className}`}
        >
            <div className="relative z-10 h-full">
                {children}
            </div>

            {/* Mouse-following Spotlight Gradient */}
            <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(234, 179, 8, 0.15), transparent 40%)`
                }}
            />

            {/* Mouse-following Border Glow */}
            <div
                className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(234, 179, 8, 0.3), transparent 40%)`,
                    zIndex: -1
                }}
            />
        </motion.div>
    );
};

export default HolographicCard;
