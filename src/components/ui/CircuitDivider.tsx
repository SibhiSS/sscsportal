
import { motion } from 'framer-motion';

const CircuitDivider = () => {
    return (
        <div className="relative w-full h-[60px] overflow-hidden -my-5 pointer-events-none z-10">
            <svg
                className="w-full h-full text-primary/10"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
            >
                <path d="M0,5 L40,5 L42,9 L44,5 L56,5 L58,1 L60,5 L100,5" fill="none" stroke="currentColor" strokeWidth="0.2" />
                <path d="M0,6 L30,6 L32,8 L34,6 L66,6 L68,2 L70,6 L100,6" fill="none" stroke="currentColor" strokeWidth="0.1" opacity="0.5" />
            </svg>

            {/* Animated Pulse on the line */}
            <motion.div
                className="absolute top-[50%] left-0 w-8 h-[2px] bg-primary rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)]"
                animate={{ left: ['-10%', '110%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
        </div>
    );
};

export default CircuitDivider;
