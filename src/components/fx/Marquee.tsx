import type { CSSProperties } from 'react';

interface MarqueeProps {
  items: string[];
  /** Seconds for one full loop. */
  duration?: number;
  className?: string;
}

/** An endless strip of "/ITEM" labels. Pauses on hover and stops for reduced motion. */
const Marquee = ({ items, duration = 30, className = '' }: MarqueeProps) => {
  // Two identical halves; the strip slides by exactly one half, so the loop is seamless.
  const half = items.map(item => (
    <span key={item} className="px-6 whitespace-nowrap">
      <span className="text-primary">/</span>{item}
    </span>
  ));

  return (
    <div className={`group relative overflow-hidden border-y border-white/5 bg-white/[0.02] ${className}`}>
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none py-4 font-heading text-xs md:text-sm uppercase tracking-[0.25em] text-foreground/70"
        style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
      >
        <div className="flex">{half}</div>
        <div className="flex" aria-hidden="true">{half}</div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#050505] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#050505] to-transparent" />
    </div>
  );
};

export default Marquee;
