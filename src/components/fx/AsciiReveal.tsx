import { useEffect, useRef } from 'react';

// Dense → sparse. Dark parts of the photo (hair, clothes) get the dense glyphs,
// so people read as figures and bright walls fall away to dots.
const RAMP = '@%#&8$Ww0oa*+=~-:. ';
// Luminance window mapped across the ramp: darker than LO is fully dense,
// brighter than HI (walls, ceiling) is blank.
const LO = 0.12;
const HI = 0.62;
const ROW_PX = 10;           // character row height
const COL_PX = ROW_PX * 0.6; // monospace advance
const BLOCK = 64;            // reveal block size, px
const LIFE_MS = 900;         // how long a revealed block takes to fade

type Block = { bx: number; by: number; life: number; kind: 'photo' | 'tint' };

interface AsciiRevealProps {
  src: string;
  /** Vertical focus of the crop, 0 (top) – 1 (bottom). */
  focusY?: number;
  className?: string;
}

/**
 * A photo drawn as ASCII art. Moving the pointer (or tapping) reveals the real
 * photo in grid blocks, with red-tinted neighbours, that fade out behind it.
 * Listens on the enclosing <section>, so content layered on top doesn't block it.
 */
const AsciiReveal = ({ src, focusY = 0.6, className = '' }: AsciiRevealProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.closest('section') ?? canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const img = new Image();
    img.src = src;

    let w = 0, h = 0, dpr = 1;
    let crop = { sx: 0, sy: 0, sw: 1, sh: 1 };
    let ascii: HTMLCanvasElement | null = null;   // pre-rendered ASCII layer
    let cells: { ch: string[]; cols: number; rows: number } | null = null;
    const blocks = new Map<string, Block>();
    let raf = 0;
    let last = 0;
    let lastKey = '';

    const primary = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      return v ? `hsl(${v})` : '#dc143c';
    };

    /** "object-fit: cover" crop of the photo for the current canvas size. */
    const computeCrop = () => {
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale, sh = h / scale;
      crop = {
        sx: (img.width - sw) / 2,
        sy: Math.min(img.height - sh, Math.max(0, (img.height - sh) * focusY)),
        sw, sh,
      };
    };

    /** Sample the photo once per resize into characters, and paint them to an offscreen layer. */
    const buildAscii = () => {
      const cols = Math.ceil(w / COL_PX), rows = Math.ceil(h / ROW_PX);
      const sample = document.createElement('canvas');
      sample.width = cols; sample.height = rows;
      const sctx = sample.getContext('2d', { willReadFrequently: true })!;
      sctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cols, rows);
      const data = sctx.getImageData(0, 0, cols, rows).data;

      const ch: string[] = new Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const lum = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
        const t = Math.min(1, Math.max(0, (lum - LO) / (HI - LO)));
        ch[i] = RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
      }
      cells = { ch, cols, rows };

      ascii = document.createElement('canvas');
      ascii.width = w * dpr; ascii.height = h * dpr;
      const actx = ascii.getContext('2d')!;
      actx.scale(dpr, dpr);
      actx.font = `${ROW_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      actx.textBaseline = 'top';
      actx.fillStyle = 'rgba(255,255,255,0.26)';
      for (let r = 0; r < rows; r++) {
        let line = '';
        for (let c = 0; c < cols; c++) line += ch[r * cols + c];
        actx.fillText(line, 0, r * ROW_PX);
      }
    };

    const draw = (now: number) => {
      raf = 0;
      const dt = last ? now - last : 16;
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (ascii) ctx.drawImage(ascii, 0, 0, w, h);

      const red = primary();
      for (const [key, b] of blocks) {
        b.life -= reduceMotion ? 0 : dt / LIFE_MS;
        if (b.life <= 0) { blocks.delete(key); continue; }
        const x = b.bx * BLOCK, y = b.by * BLOCK;
        ctx.globalAlpha = Math.min(1, b.life * 1.4);
        if (b.kind === 'photo') {
          // Matching slice of the photo: canvas px → photo px through the crop.
          const k = crop.sw / w;
          ctx.drawImage(img, crop.sx + x * k, crop.sy + y * k, BLOCK * k, BLOCK * k, x, y, BLOCK, BLOCK);
        } else if (cells) {
          ctx.fillStyle = red;
          ctx.fillRect(x, y, BLOCK, BLOCK);
          // The block's own characters, knocked out in black.
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.font = `${ROW_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
          ctx.textBaseline = 'top';
          const c0 = Math.floor(x / COL_PX), r0 = Math.floor(y / ROW_PX);
          for (let r = r0; r < Math.min(cells.rows, r0 + Math.ceil(BLOCK / ROW_PX)); r++) {
            ctx.save();
            ctx.beginPath(); ctx.rect(x, y, BLOCK, BLOCK); ctx.clip();
            let line = '';
            for (let c = c0; c < Math.min(cells.cols, c0 + Math.ceil(BLOCK / COL_PX) + 1); c++) line += cells.ch[r * cells.cols + c];
            ctx.fillText(line, c0 * COL_PX, r * ROW_PX);
            ctx.restore();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (blocks.size && !reduceMotion) raf = requestAnimationFrame(draw);
      else last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

    const reveal = (x: number, y: number) => {
      const bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
      const key = `${bx},${by}`;
      blocks.set(key, { bx, by, life: 1, kind: 'photo' });
      // Entering a new block flashes one or two tinted neighbours, like a scanner settling.
      if (key !== lastKey) {
        lastKey = key;
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const nx = bx + Math.floor(Math.random() * 3) - 1, ny = by + Math.floor(Math.random() * 3) - 1;
          const nk = `${nx},${ny}`;
          if (!blocks.has(nk)) blocks.set(nk, { bx: nx, by: ny, life: 0.8, kind: 'tint' });
        }
      }
      kick();
    };

    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      reveal(x, y);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      if (!img.complete || !img.naturalWidth) return;
      computeCrop();
      buildAscii();
      kick();
    };

    img.onload = resize;
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    host.addEventListener('pointermove', onPointer);
    host.addEventListener('pointerdown', onPointer);

    // Touch screens can't hover: reveal a random spot every so often.
    let idle = 0;
    if (window.matchMedia('(hover: none)').matches && !reduceMotion) {
      idle = window.setInterval(() => {
        if (!document.hidden && w) reveal(Math.random() * w, h * (0.3 + Math.random() * 0.6));
      }, 1400);
    }

    return () => {
      ro.disconnect();
      host.removeEventListener('pointermove', onPointer);
      host.removeEventListener('pointerdown', onPointer);
      window.clearInterval(idle);
      cancelAnimationFrame(raf);
      img.onload = null;
    };
  }, [src, focusY]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none ${className}`} />;
};

export default AsciiReveal;
