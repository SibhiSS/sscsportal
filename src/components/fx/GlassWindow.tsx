import { useState, type ReactNode, type RefObject } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Shared across windows so the one you last touched sits on top.
let topZ = 10;

interface GlassWindowProps {
  title: string;
  children: ReactNode;
  /** The element windows may be dragged around inside. */
  bounds?: RefObject<HTMLElement>;
  className?: string;
  /** Start closed, showing only the dock chip. */
  startClosed?: boolean;
}

/**
 * A fake desktop window in the site's glass style: drag it by the title bar,
 * close it with the red dot, bring it back from its dock chip.
 */
const GlassWindow = ({ title, children, bounds, className = '', startClosed = false }: GlassWindowProps) => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(!startClosed);
  const [z, setZ] = useState(() => ++topZ);
  const raise = () => setZ(++topZ);

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); raise(); }}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-xl hover:border-primary/40 hover:text-foreground transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-primary/70" />
        {title}
      </button>
    );
  }

  return (
    <motion.div
      drag={!reduceMotion}
      dragConstraints={bounds}
      dragMomentum={false}
      dragElastic={0.08}
      onPointerDown={raise}
      style={{ zIndex: z }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-xl border border-white/10 bg-[#0b0b0b]/70 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl ${className}`}
    >
      <div className="flex cursor-grab items-center gap-2 border-b border-white/5 px-3 py-2 active:cursor-grabbing select-none">
        <button
          aria-label={`Close ${title}`}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setOpen(false)}
          className="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-125"
        />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]/80" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]/80" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
};

export default GlassWindow;
