import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** How long the loader runs before the site appears (ms). */
const DURATION = 3600;

const LETTERS = 'AI CLUB'.split('');
const TICKS = Array.from({ length: 36 }, (_, i) => i);
// Eight glowing "circuit" spurs that grow out of the ring, as angles in degrees.
const SPURS = [20, 65, 110, 155, 200, 245, 290, 335];

/**
 * Intro: the club logo appears inside glowing rings that draw themselves on, a dial of ticks lights
 * up around it, circuit spurs grow out of the ring and carry pulses of light, ripples spread
 * outwards while the wordmark appears and the bar fills. SVG and CSS only, no extra library.
 */
const StartupPreloader = ({ onComplete }: { onComplete: () => void }) => {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const duration = reduce ? 900 : DURATION;

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setTimeout(onComplete, 300);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onComplete, duration]);

  const d = (t: number) => (reduce ? 0 : t);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#F4F8FD]"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <style>{`
        .ldr-grid { background-image: linear-gradient(rgba(49,135,232,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(49,135,232,.07) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(circle at 50% 45%, #000, transparent 70%); -webkit-mask-image: radial-gradient(circle at 50% 45%, #000, transparent 70%); }
        .ldr-halo { animation: ldr-halo 2.6s ease-in-out infinite; }
        .ldr-orbit { animation: ldr-orbit 9s linear infinite; transform-origin: 50% 50%; }
        .ldr-orbit-rev { animation: ldr-orbit 14s linear infinite reverse; transform-origin: 50% 50%; }
        .ldr-ripple { animation: ldr-ripple 2.4s ease-out infinite; }
        .ldr-run { stroke-dasharray: .18 .82; animation: ldr-run 1.6s linear infinite; animation-fill-mode: backwards; }
        .ldr-logo { animation: ldr-float 3.2s ease-in-out infinite; animation-delay: 2s; }
        @keyframes ldr-halo { 0%,100% { opacity: .5; transform: scale(.94); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes ldr-orbit { to { transform: rotate(360deg); } }
        @keyframes ldr-ripple { 0% { transform: scale(.6); opacity: .55; } 100% { transform: scale(1.25); opacity: 0; } }
        @keyframes ldr-run { 0% { stroke-dashoffset: 1; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
        @keyframes ldr-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @media (prefers-reduced-motion: reduce) { .ldr-halo, .ldr-orbit, .ldr-orbit-rev, .ldr-ripple, .ldr-run, .ldr-logo { animation: none !important; } }
      `}</style>

      <div className="ldr-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative h-[300px] w-[300px] sm:h-[380px] sm:w-[380px]">
        <div className="ldr-halo absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(49,135,232,.32),rgba(49,135,232,0)_68%)]" />

        {/* Ripples */}
        {!reduce && [0, 0.8, 1.6].map(delay => (
          <div key={delay} className="ldr-ripple absolute inset-[14%] rounded-full border border-[#3187E8]/50" style={{ animationDelay: `${2 + delay}s`, animationFillMode: 'backwards' }} />
        ))}

        <svg viewBox="0 0 400 400" className="absolute inset-0 overflow-visible" aria-hidden="true">
          <defs>
            <filter id="ldr-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Dial of ticks lighting up in turn */}
          <g stroke="#3187E8" strokeLinecap="round" strokeWidth="2">
            {TICKS.map(i => (
              <motion.line
                key={i}
                x1="200" y1="14" x2="200" y2="24"
                transform={`rotate(${i * 10} 200 200)`}
                initial={{ opacity: reduce ? 0.55 : 0 }}
                animate={{ opacity: [0, 1, 0.45] }}
                transition={{ duration: 0.9, delay: d(0.2 + i * 0.035), times: [0, 0.4, 1] }}
              />
            ))}
          </g>

          {/* Two rings draw themselves on */}
          <g fill="none" filter="url(#ldr-glow)" strokeLinecap="round">
            <motion.circle
              cx="200" cy="200" r="168" stroke="#3187E8" strokeWidth="3" transform="rotate(-90 200 200)"
              initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: d(0.3), ease: 'easeInOut' }}
            />
            <motion.circle
              cx="200" cy="200" r="150" stroke="#69ACFF" strokeWidth="1.6" strokeDasharray="3 7" transform="rotate(-90 200 200)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: d(1) }}
            />
          </g>

          {/* Circuit spurs grow out from the ring and carry a pulse of light */}
          <g fill="none" strokeLinecap="round" filter="url(#ldr-glow)">
            {SPURS.map((deg, i) => (
              <g key={deg} transform={`rotate(${deg} 200 200)`}>
                <motion.path
                  d="M200 32 V10 L212 -2 H236" stroke="#3187E8" strokeWidth="2.4"
                  initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: d(1.2 + i * 0.1) }}
                />
                {!reduce && (
                  <path d="M200 32 V10 L212 -2 H236" pathLength={1} stroke="#CFE6FF" strokeWidth="1.8" className="ldr-run" style={{ animationDelay: `${2.3 + i * 0.15}s` }} />
                )}
                <motion.circle
                  cx="236" cy="-2" r="4" fill="#3187E8" stroke="none"
                  initial={{ scale: reduce ? 1 : 0 }} animate={{ scale: 1 }} style={{ transformOrigin: '236px -2px', transformBox: 'fill-box' }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: d(1.8 + i * 0.1) }}
                />
              </g>
            ))}
          </g>

          {/* Orbiting dots */}
          <g className="ldr-orbit"><circle cx="200" cy="30" r="5" fill="#3187E8" style={{ filter: 'drop-shadow(0 0 8px rgba(49,135,232,.95))' }} /></g>
          <g className="ldr-orbit-rev"><circle cx="200" cy="50" r="3.5" fill="#69ACFF" style={{ filter: 'drop-shadow(0 0 6px rgba(105,172,255,.9))' }} /></g>
        </svg>

        {/* The logo icon */}
        <motion.div
          className="absolute inset-[24%] flex items-center justify-center"
          initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.8, filter: reduce ? 'blur(0px)' : 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, delay: d(0.9), ease: 'easeOut' }}
        >
          <img
            src="/brand/aic-logo-icon.png"
            alt="AI Club VIT Chennai"
            className="ldr-logo h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(49,135,232,0.45)]"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* Wordmark */}
      <div className="mt-2 text-center" aria-hidden="true">
        <div className="flex justify-center font-display text-[34px] font-extrabold uppercase leading-none tracking-tight text-[#0B1726] sm:text-[42px]">
          {LETTERS.map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 14, filter: reduce ? 'blur(0px)' : 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: d(2.2 + i * 0.06) }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </div>
        <motion.p
          className="mt-2 font-heading text-[12px] font-semibold tracking-[0.45em] text-[#0B1726]"
          initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ delay: d(2.7), duration: 0.6 }}
        >
          VIT CHENNAI
        </motion.p>
      </div>

      {/* Progress */}
      <div className="mt-8 h-[3px] w-60 overflow-hidden rounded-full bg-[#14283D]/10">
        <div
          className="h-full origin-left rounded-full bg-[#3187E8] shadow-[0_0_12px_rgba(49,135,232,.9)]"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <p className="mt-3 font-mono text-[11px] tracking-[0.3em] text-[#0B1726]/55">
        {progress < 1 ? 'INITIALISING' : 'READY'} · {Math.round(progress * 100)}%
      </p>
    </motion.div>
  );
};

export default StartupPreloader;
