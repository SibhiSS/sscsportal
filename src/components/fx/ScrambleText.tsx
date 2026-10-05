import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const GLYPHS = '0123456789ABCDEF';
const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

interface ScrambleTextProps {
  text: string;
  className?: string;
  /** Total time for the whole string to lock in, in ms. */
  duration?: number;
  /** Wait this long after scrolling into view before decoding, in ms. */
  delay?: number;
}

/**
 * Text that starts as hex noise and locks in letter by letter, left to right,
 * the first time it scrolls into view, like a scope locking onto a signal.
 * Screen readers always get the real text.
 */
const ScrambleText = ({ text, className = '', duration = 900, delay = 0 }: ScrambleTextProps) => {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() =>
    reduceMotion ? text : text.replace(/\S/g, randomGlyph),
  );

  useEffect(() => {
    if (reduceMotion) { setDisplay(text); return; }
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let timeout = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const locked = Math.floor(progress * text.length);
        setDisplay(
          text
            .split('')
            .map((ch, i) => (i < locked || ch === ' ' ? ch : randomGlyph()))
            .join(''),
        );
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      timeout = window.setTimeout(run, delay);
    }, { threshold: 0.4 });
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [text, duration, delay, reduceMotion]);

  return (
    <span ref={ref} className={`relative inline-block max-w-full ${className}`}>
      <span className="sr-only">{text}</span>
      {/* The real text, invisible, holds the size; the noise is laid over it and
          clipped, since hex glyphs are wider than letters and would push the
          heading off a phone screen while it decodes. */}
      <span aria-hidden="true" className="invisible">{text}</span>
      <span aria-hidden="true" className="absolute inset-0 overflow-hidden">{display}</span>
    </span>
  );
};

export default ScrambleText;
