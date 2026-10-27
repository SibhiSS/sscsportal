import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  action?: ReactNode;
  className?: string;
}

/** Shared section heading for the public site: mono eyebrow with a rule, display title, optional intro and action. */
const SectionHeader = ({ eyebrow, title, intro, action, className = '' }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${className}`}
  >
    <div>
      <p className="flex items-center font-mono text-[11px] tracking-[0.3em] text-[#0B1726]">
        {eyebrow.toUpperCase()} <span className="ml-4 inline-block h-px w-14 bg-primary" />
      </p>
      <h2 className="mt-4 font-display text-[32px] font-extrabold uppercase leading-[1.02] tracking-tight text-[#0B1726] md:text-[40px]">
        {title}
      </h2>
      {intro && <p className="mt-4 max-w-xl text-[15px] leading-6 text-muted-foreground">{intro}</p>}
    </div>
    {action}
  </motion.div>
);

export default SectionHeader;
