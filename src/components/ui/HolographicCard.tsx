import React from 'react';
import { motion } from 'framer-motion';

interface HolographicCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

/**
 * The site's standard card: white surface, hairline border, soft blue shadow.
 * (The name is kept from the old glass-card effect so existing screens pick up the new look.)
 */
const HolographicCard: React.FC<HolographicCardProps> = ({ children, className = '', ...props }) => (
    <motion.div
        {...props}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className={`relative rounded-md border border-border bg-white/85 shadow-[0_8px_24px_-18px_rgba(15,58,107,0.3)] transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-[0_14px_30px_-18px_rgba(49,135,232,0.35)] ${className}`}
    >
        {children}
    </motion.div>
);

export default HolographicCard;
