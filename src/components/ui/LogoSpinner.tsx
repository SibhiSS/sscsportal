import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LogoSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const LogoSpinner = ({ size = 'md', className }: LogoSpinnerProps) => {
    // Sizes are slightly smaller than original to accommodate the absolute positioned pins
    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-14 h-14',
        xl: 'w-20 h-20'
    };

    const pinCount = 3;
    const pins = Array.from({ length: pinCount });
    
    // Each pin flashes sequentially in a clockwise loop
    const getPinAnimation = (index: number) => ({
        backgroundColor: ['#27272a', '#dc143c', '#27272a'],
        boxShadow: ['0 0 0px rgba(220,20,60,0)', '0 0 6px rgba(220,20,60,0.8)', '0 0 0px rgba(220,20,60,0)'],
        transition: {
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.1,
            ease: "easeInOut"
        }
    });

    return (
        <div className={cn("relative flex items-center justify-center m-1", sizeClasses[size], className)}>
            <div className="relative w-full h-full flex items-center justify-center">
                
                {/* Top Pins */}
                <div className="absolute -top-[15%] left-0 w-full flex justify-evenly">
                    {pins.map((_, i) => (
                        <motion.div key={`top-${i}`} animate={getPinAnimation(i)} className="w-[18%] h-[15%] rounded-t-sm" />
                    ))}
                </div>
                {/* Right Pins */}
                <div className="absolute top-0 -right-[15%] h-full flex flex-col justify-evenly">
                    {pins.map((_, i) => (
                        <motion.div key={`right-${i}`} animate={getPinAnimation(i + 3)} className="w-[15%] h-[18%] rounded-r-sm" />
                    ))}
                </div>
                {/* Bottom Pins */}
                <div className="absolute -bottom-[15%] left-0 w-full flex justify-evenly">
                    {pins.map((_, i) => (
                        <motion.div key={`bottom-${i}`} animate={getPinAnimation(i + 6)} className="w-[18%] h-[15%] rounded-b-sm" />
                    ))}
                </div>
                {/* Left Pins */}
                <div className="absolute top-0 -left-[15%] h-full flex flex-col justify-evenly">
                    {pins.map((_, i) => (
                        <motion.div key={`left-${i}`} animate={getPinAnimation(i + 9)} className="w-[15%] h-[18%] rounded-l-sm" />
                    ))}
                </div>

                {/* Core */}
                <motion.div 
                    className="relative z-10 w-full h-full bg-[#050505] border border-primary/30 rounded-[2px] flex items-center justify-center overflow-hidden"
                    animate={{
                        borderColor: ['rgba(220,20,60,0.2)', 'rgba(220,20,60,0.8)', 'rgba(220,20,60,0.2)'],
                        boxShadow: ['0 0 2px rgba(220,20,60,0.1)', '0 0 12px rgba(220,20,60,0.5)', '0 0 2px rgba(220,20,60,0.1)']
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Size sm is too small for the logo to look good, so only show it on md+ */}
                    {size !== 'sm' && (
                        <img
                            src="/logo.png"
                            alt="Loading"
                            className="w-[70%] h-[70%] object-contain opacity-80"
                        />
                    )}
                    <motion.div 
                        className="absolute left-0 right-0 h-[150%] w-full bg-gradient-to-b from-transparent via-primary/40 to-transparent z-10"
                        animate={{ top: ['-100%', '100%'] }}
                        transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
                    />
                </motion.div>
                
            </div>
        </div>
    );
};

export default LogoSpinner;
