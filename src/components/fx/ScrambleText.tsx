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
  // How many characters have locked in; the rest show noise.
  const [locked, setLocked] = useState(() => (reduceMotion ? text.length : 0));
  const [, setFrame] = useState(0);

  useEffect(() => {
    if (reduceMotion) { setLocked(text.length); return; }
    setLocked(0);
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let timeout = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        setLocked(Math.floor(progress * text.length));
        setFrame(f => f + 1); // fresh noise every frame
        if (progress < 1) frame = requestAnimationFrame(tick);
        else setLocked(text.length);
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

  // The real text is always laid out, so the heading wraps exactly as it will
  // when decoded and never jumps to an extra line. Each unlocked letter is made
  // transparent and a noise glyph is drawn centred over its own slot. Words stay
  // unbreakable, so a line only breaks at a space, as it does in the final text.
  let i = 0;
  const words = text.split(/(\s+)/).map((part, w) => {
    if (/^\s+$/.test(part)) { i += part.length; return part; }
    return (
      <span key={w} className="whitespace-nowrap">
        {part.split('').map(ch => {
          const idx = i++;
          if (idx < locked) return <span key={idx}>{ch}</span>;
          return (
            <span key={idx} className="relative">
              <span className="text-transparent">{ch}</span>
              <span className="absolute left-1/2 top-0 -translate-x-1/2">{randomGlyph()}</span>
            </span>
          );
        })}
      </span>
    );
  });

  return (
    <span ref={ref} className={`max-w-full ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{words}</span>
    </span>
  );
};

export default ScrambleText;
