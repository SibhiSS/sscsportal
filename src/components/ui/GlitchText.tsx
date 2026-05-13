import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface GlitchTextProps {
    text: string;
    className?: string;
}

const GlitchText: React.FC<GlitchTextProps> = ({ text, className = '' }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [glitchTrigger, setGlitchTrigger] = useState(0);

    // Subtle random glitch effect even without hover
    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.95) { // 5% chance every 3 seconds
                setGlitchTrigger(prev => prev + 1);
                setTimeout(() => setGlitchTrigger(prev => prev + 1), 200);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const isGlitching = isHovered || glitchTrigger % 2 !== 0;

    return (
        <motion.div
            className={`relative inline-block ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            animate={isHovered ? {
                x: [0, -1, 1, -1, 0],
                y: [0, 1, -1, 0]
            } : { x: 0, y: 0 }}
            transition={{
                duration: 0.1,
                repeat: Infinity,
                repeatType: "mirror"
            }}
        >
            {/* Main Text */}
            <span className="relative z-10">{text}</span>

            {/* Red Channel */}
            <span
                className={`absolute top-0 left-0 -z-10 text-red-500 opacity-0 transition-all duration-100 select-none 
          ${isHovered
                        ? 'opacity-100 translate-x-[3px]'
                        : isGlitching
                            ? 'opacity-70 translate-x-[2px]'
                            : ''
                    }`}
                aria-hidden="true"
            >
                {text}
            </span>

            {/* Blue Channel */}
            <span
                className={`absolute top-0 left-0 -z-10 text-cyan-500 opacity-0 transition-all duration-100 select-none 
          ${isHovered
                        ? 'opacity-100 -translate-x-[3px]'
                        : isGlitching
                            ? 'opacity-70 -translate-x-[2px]'
                            : ''
                    }`}
                aria-hidden="true"
            >
                {text}
            </span>
        </motion.div>
    );
};

export default GlitchText;
