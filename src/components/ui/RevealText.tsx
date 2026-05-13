
import { motion } from 'framer-motion';

interface RevealTextProps {
    text: string;
    className?: string;
    delay?: number;
}

const RevealText: React.FC<RevealTextProps> = ({ text, className = "", delay = 0 }) => {
    return (
        <div className={`overflow-hidden inline-block align-bottom ${className}`}>
            <motion.div
                initial={{ y: "100%" }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
            >
                {text}
            </motion.div>
        </div>
    );
};

export default RevealText;
