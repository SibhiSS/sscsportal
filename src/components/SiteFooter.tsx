import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { drawAllTiles, tileLayout } from '@/components/game/tiles';

// The game code only downloads when someone presses PLAY.
const ElectronBreakout = lazy(() => import('@/components/game/ElectronBreakout'));

const LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/ieee_sscs_vitcc/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/ieee-sscs-vitc/' },
  { label: 'WhatsApp', href: 'https://chat.whatsapp.com/Em8uoQtYNPcFTsg3w0dVdo?s=qt&p=a&ilr=1' },
  { label: 'Email', href: 'mailto:ieee.sscs.vitchennai@gmail.com' },
];

/** The tile strip at rest, drawn with the same code and layout the game uses. */
function StaticTiles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const paint = () => {
      const w = Math.round(box.clientWidth), h = Math.round(box.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawAllTiles(ctx, tileLayout(w, h));
    };
    const ro = new ResizeObserver(paint);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}

/**
 * The site footer, after Razorpay's /ai-builders: a big grey wordmark, a dare
 * to PLAY, and a strip of tiles along the bottom edge. Pressing PLAY turns the
 * whole footer into Electron Breakout.
 */
const SiteFooter = () => {
  const [playing, setPlaying] = useState(false);
  const [combo, setCombo] = useState(0);

  const stop = () => { setPlaying(false); setCombo(0); };

  return (
    <footer
      className="relative h-[100svh] min-h-[560px] w-full overflow-hidden border-t border-white/5 bg-[#060606]"
      style={{ backgroundImage: "radial-gradient(60% 50% at 0% 0%, rgba(220,20,60,0.10), transparent 70%), radial-gradient(50% 45% at 100% 40%, rgba(220,20,60,0.07), transparent 70%)" }}
    >
      {playing ? (
        <Suspense fallback={<StaticTiles />}>
          <ElectronBreakout onExit={stop} onCombo={setCombo} />
        </Suspense>
      ) : (
        <StaticTiles />
      )}

      {/* Text sits above the game; only its links and the PLAY/STOP button take clicks */}
      <div className="pointer-events-none relative z-10 mx-auto grid max-w-[1800px] grid-cols-1 gap-x-10 gap-y-6 px-6 pt-12 md:grid-cols-2 md:px-16 md:pt-16">
        <div className="font-body font-medium leading-[0.92] tracking-tight text-white/35 text-[clamp(34px,4.6vw,76px)] select-none">
          <span className="relative">
            <span className="text-primary/85">IEEE</span> <span className="text-white/50">SSCS</span>
            {combo > 1 && (
              <span className="absolute -right-12 top-[0.35em] font-mono text-xs md:text-sm font-bold text-primary">×{combo}</span>
            )}
          </span>
          <br />
          /vit chennai
        </div>

        <div className="text-[#9b9b9f] text-[clamp(20px,2vw,32px)] leading-snug md:text-right">
          <button
            onClick={() => (playing ? stop() : setPlaying(true))}
            className="pointer-events-auto py-1 font-medium text-white underline decoration-primary decoration-2 underline-offset-[6px] hover:text-primary transition-colors"
          >
            {playing ? 'STOP' : 'PLAY'}
          </button>{' '}
          this game,
          <br />
          Bet you can win.
        </div>

        <p className="text-sm md:text-lg text-[#9b9b9f]">
          Copyright © 2026 IEEE SSCS VIT Chennai
          <span aria-hidden="true" className="mx-2 text-[#5a5a5e]">·</span>
          <span className="whitespace-nowrap">
            Built by{' '}
            <a
              href="https://sibhi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto inline-block py-1.5 text-white underline decoration-primary decoration-2 underline-offset-4 hover:text-primary transition-colors"
            >
              Sibhi
            </a>
          </span>
        </p>

        <nav aria-label="Social links" className="flex flex-wrap items-center gap-x-2 text-sm md:text-lg text-[#9b9b9f] md:justify-end">
          {LINKS.map((l, i) => (
            <span key={l.label} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true" className="text-[#5a5a5e]">|</span>}
              <a
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="pointer-events-auto inline-block py-2 hover:text-white transition-colors"
              >
                {l.label}
              </a>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
};

export default SiteFooter;
