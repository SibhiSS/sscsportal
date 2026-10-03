import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const GLYPHS = '0123456789ABCDEF';
const scramble = (s: string) => s.replace(/\S/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);

interface RotatingWordProps {
  words: string[];
  className?: string;
  /** Time each word stays, in ms. */
  interval?: number;
}

/**
 * Cycles through `words`, decoding each new one from hex noise. Every word is
 * stacked invisibly in the same grid cell, so the slot is always as wide as the
 * longest word and the line around it never moves.
 */
const RotatingWord = ({ words, className = '', interval = 2600 }: RotatingWordProps) => {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(words[0]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex(i => (i + 1) % words.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  // Decode the new word: ~350 ms, glyphs change every 50 ms.
  useEffect(() => {
    const word = words[index];
    if (reduceMotion || index === 0 && shown === word) { setShown(word); return; }
    const start = performance.now();
    const id = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / 350);
      const locked = Math.floor(progress * word.length);
      setShown(word.slice(0, locked) + scramble(word.slice(locked)));
      if (progress >= 1) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per word change
  }, [index, reduceMotion]);

  return (
    <span className={`inline-grid text-left align-baseline ${className}`}>
      {words.map(w => (
        <span key={w} aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">{w}</span>
      ))}
      <span aria-live="off" className="col-start-1 row-start-1 whitespace-nowrap">
        <span className="sr-only">{words[index]}</span>
        <span aria-hidden="true">{shown}</span>
      </span>
    </span>
  );
};

export default RotatingWord;
