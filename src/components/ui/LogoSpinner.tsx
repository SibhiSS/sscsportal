import React from 'react';
import { motion } from 'framer-motion';
import logoIcon from '@/assets/logo-icon.png';
import { cn } from '@/lib/utils';

interface LogoSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const LogoSpinner = ({ size = 'md', className }: LogoSpinnerProps) => {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24'
    };

    return (
        <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
            {/* Rotating Logo Icon */}
            <motion.img
                src="/logo.png"
                alt="Loading..."
                className="w-full h-full object-contain relative z-20 select-none"
                animate={{ rotate: 360 }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear"
                }}
            />

            {/* Outer Holographic Ring */}
            <motion.div
                animate={{ rotate: -360 }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute rounded-full border border-primary/30 z-10"
                style={{ width: '140%', height: '140%' }}
            >
                {/* Glowing focal point */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(220,20,60,0.8)]" />
            </motion.div>
        </div>
    );
};

export default LogoSpinner;
