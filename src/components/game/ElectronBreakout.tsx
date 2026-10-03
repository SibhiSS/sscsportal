import { useEffect, useRef, useState } from 'react';
import { drawBinary, drawTile, tileLayout, TILE_ROWS, type TileLayout } from './tiles';

/**
 * Electron Breakout, played across the whole footer, upside down like the
 * footer it lives in: the tiles line the bottom edge and the gate hovers in
 * the upper part of the footer.
 *
 * There are no lives and no ending. The electron is very fast (at one fixed
 * speed); if it gets past the gate it bounces off the top of the footer and
 * comes back down, which only costs you your combo. Tiles keep regrowing and
 * the wall can never be cleared. Every 25 hits (then every 50) without a miss
 * sets off FEVER MODE.
 *
 * Controls: pointer / touch drag, or ←/→ (A/D). Space launches and pauses,
 * Esc quits. Pauses itself when scrolled away or the tab is hidden.
 */

type Phase = 'ready' | 'playing' | 'paused';
type PowerKind = 'wide' | 'laser' | 'multi';

const POWER_LABEL: Record<PowerKind, string> = { wide: 'WIDE', laser: 'LASER', multi: 'MULTI' };
const POWER_SECONDS: Record<PowerKind, number> = { wide: 9, laser: 5, multi: 7 };
const POWER_KINDS: PowerKind[] = ['wide', 'laser', 'multi'];
const POWER_DROP_CHANCE = 0.16;

// The site's crimson family, used everywhere colour shows up.
const ACCENT = '#dc143c';
const PALETTE = ['#dc143c', '#ff3b5c', '#ff6b81', '#ff8a65', '#ffb199', '#ff4d9a'];
// Fever runs hotter: crimson through magenta, orange and gold.
const FEVER_PALETTE = ['#ff1744', '#f50057', '#ff4081', '#ff6e40', '#ffab40', '#ffd166'];
const POWER_COLOR: Record<PowerKind, string> = { wide: '#ff6b81', laser: '#dc143c', multi: '#ffb199' };
const TRAIL_COLOR = '#ff4d6d';

const TILE_POINTS = 10;
const FEVER_COMBO = 25;      // first fever; then again every FEVER_EVERY hits
const FEVER_EVERY = 50;
const FEVER_SECONDS = 8;
const FEVER_MULT = 3;
const MIN_ALIVE = 0.35;      // the wall never drops below this share of tiles
const MAX_BALLS = 6;
const TRAIL = 18;
const BEST_KEY = 'sscs-breakout-best';

const readBest = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const saveBest = (n: number) => {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode: best score just isn't kept */ }
};
const randomBits = () => Array.from({ length: 28 }, () => (Math.random() < 0.5 ? '0' : '1')).join('');
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
/** Colour for a regrown tile: a crimson → coral sweep across the strip. */
const sweepColor = (col: number, cols: number) => PALETTE[Math.min(4, Math.floor((col / Math.max(1, cols - 1)) * 4.999))];
const praise = (combo: number) =>
  combo >= 100 ? 'UNREAL!' : combo >= 50 ? 'INSANE!' : combo >= 25 ? 'GREAT!' : combo >= 10 ? 'NICE' : '';

interface Ball { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[]; hue: number }
interface Tile { row: number; col: number; alive: boolean; fade: number; bits: string; tint?: string }
interface Capsule { x: number; y: number; kind: PowerKind }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string; big: boolean }
interface Ring { x: number; y: number; life: number; max: number; color: string }
interface Mote { x: number; y: number; vy: number; size: number; color: string }

interface ElectronBreakoutProps {
  onScore?: (score: number, best: number) => void;
  /** Current combo (tiles broken since the last miss), for the "×N" beside the wordmark. */
  onCombo?: (combo: number) => void;
  onExit: () => void;
}

const ElectronBreakout = ({ onScore, onCombo, onExit }: ElectronBreakoutProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const cb = useRef({ onScore, onCombo, onExit });
  cb.current = { onScore, onCombo, onExit };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !wrap || !ctx) return;

    // ---- geometry ----
    let W = 0, H = 0, dpr = 1;
    let tl: TileLayout = { cols: 12, tileW: 100, tileH: 40, top: 0 };
    let r = 8;
    let baseSpeed = 1300;
    const paddle = { cx: 0, y: 0, h: 16 };

    const tileRect = (t: Tile) => ({ x: t.col * tl.tileW, y: tl.top + t.row * tl.tileH, w: tl.tileW, h: tl.tileH });

    // ---- state ----
    let state: Phase = 'ready';
    let pts = 0;
    let combo = 0;
    let fever = 0;             // seconds of FEVER MODE left
    let feverTitle = 0;        // seconds left on the big title
    let clock = 0;
    let regrowIn = 0;
    let bitFlipIn = 0;
    let feverSparkIn = 0;
    let flash = 0;
    let flashColor = ACCENT;
    let beamTick = 0;
    const timers: Record<PowerKind, number> = { wide: 0, laser: 0, multi: 0 };
    let tiles: Tile[] = [];
    let balls: Ball[] = [];
    let capsules: Capsule[] = [];
    let sparks: Spark[] = [];
    let popups: Popup[] = [];
    let rings: Ring[] = [];
    let motes: Mote[] = [];
    const keys = { left: false, right: false };

    // One fixed, very fast speed. Nothing changes it.
    const speed = () => baseSpeed;
    const paddleW = () => {
      const w = Math.min(190, Math.max(100, W * 0.14));
      return timers.wide > 0 ? w * 1.6 : w;
    };
    const activeKinds = () => POWER_KINDS.filter(k => timers[k] > 0);
    const colors = () => (fever > 0 ? FEVER_PALETTE : PALETTE);
    const newBall = (x: number, y: number, vx: number, vy: number): Ball =>
      ({ x, y, vx, vy, trail: [], hue: Math.floor(Math.random() * FEVER_PALETTE.length) });
    /** One electron, plus two while Multi runs and one more during fever. */
    const wantedBalls = () => Math.min(MAX_BALLS, 1 + (timers.multi > 0 ? 2 : 0) + (fever > 0 ? 1 : 0));

    const buildWall = () => {
      tiles = [];
      for (let row = 0; row < TILE_ROWS; row++) {
        for (let col = 0; col < tl.cols; col++) tiles.push({ row, col, alive: true, fade: 1, bits: randomBits() });
      }
    };
    const seedMotes = () => {
      motes = Array.from({ length: Math.round(W / 36) }, () => ({
        x: Math.random() * W, y: Math.random() * tl.top, vy: 6 + Math.random() * 14,
        size: 1 + Math.random() * 2, color: Math.random() < 0.65 ? PALETTE[Math.floor(Math.random() * 3)] : '#ffffff',
      }));
    };

    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      const colsBefore = tl.cols;
      W = Math.max(280, Math.round(rect.width));
      H = Math.max(320, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      tl = tileLayout(W, H);
      r = W < 600 ? 7 : 9;
      paddle.h = W < 600 ? 13 : 16;
      baseSpeed = Math.min(1700, Math.max(1200, H * 2));
      // Gate just below the footer text: a big field below it, and room behind it for the electron to bounce back.
      paddle.y = Math.min(Math.max(H * 0.34, 260), tl.top - 180);
      paddle.cx = Math.min(Math.max(paddle.cx || W / 2, paddleW() / 2), W - paddleW() / 2);
      if (tl.cols !== colsBefore || !tiles.length) buildWall();
      seedMotes();
    };

    const setStatePhase = (p: Phase) => { state = p; setPhase(p); };
    const setCombo = (n: number) => { combo = n; cb.current.onCombo?.(n); };
    const addPoints = (n: number) => {
      pts += n;
      const b = Math.max(readBest(), pts);
      if (pts >= b) saveBest(pts);
      cb.current.onScore?.(pts, b);
    };

    const launch = () => {
      if (state === 'ready') {
        const a = Math.random() * 0.6 - 0.3;
        balls[0].vx = speed() * Math.sin(a);
        balls[0].vy = speed() * Math.cos(a); // downward, into the tiles
        regrowIn = 0.4;
        setStatePhase('playing');
      } else if (state === 'paused') {
        setStatePhase('playing');
      }
    };
    const pause = () => { if (state === 'playing') setStatePhase('paused'); };

    const spray = (x: number, y: number, color: string, count = 10, up = 80) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 240;
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: 0.7, color });
      }
    };
    const popup = (x: number, y: number, text: string, color: string, big = false) =>
      popups.push({ x, y, text, life: big ? 1.4 : 1, color, big });

    const startFever = () => {
      fever = FEVER_SECONDS;
      feverTitle = 1.8;
      flash = 1; flashColor = '#ff1744';
      // A shockwave from every electron.
      for (const b of balls) rings.push({ x: b.x, y: b.y, life: 1.2, max: Math.max(W, H), color: '#ffd166' });
    };

    /** Bring one broken tile back, never on top of an electron. Regrown tiles carry the sweep colour. */
    const regrowOne = () => {
      const dead = tiles.filter(t => !t.alive && !balls.some(b => {
        const rc = tileRect(t);
        return b.x > rc.x - r * 3 && b.x < rc.x + rc.w + r * 3 && b.y > rc.y - r * 3 && b.y < rc.y + rc.h + r * 3;
      }));
      if (!dead.length) return false;
      const t = pick(dead);
      t.alive = true; t.fade = 0;
      t.tint = t.row === 0 ? sweepColor(t.col, tl.cols) : undefined;
      return true;
    };
    /** The wall can't be cleared: below the floor, tiles come straight back. */
    const keepWallUp = () => {
      const floor = Math.ceil(tiles.length * MIN_ALIVE);
      let guard = tiles.length;
      while (tiles.filter(t => t.alive).length < floor && guard-- > 0) if (!regrowOne()) break;
    };

    const breakTile = (t: Tile) => {
      t.alive = false;
      t.bits = randomBits();
      const rc = tileRect(t);
      const cx = rc.x + rc.w / 2;
      spray(cx, rc.y + rc.h / 2, fever > 0 ? pick(FEVER_PALETTE) : t.tint ?? TRAIL_COLOR);
      if (Math.random() < POWER_DROP_CHANCE) capsules.push({ x: cx, y: rc.y, kind: pick(POWER_KINDS) });

      setCombo(combo + 1);
      if (combo >= FEVER_COMBO && (combo - FEVER_COMBO) % FEVER_EVERY === 0) startFever();
      const gained = TILE_POINTS * combo * (fever > 0 ? FEVER_MULT : 1);
      addPoints(gained);
      const word = praise(combo);
      if (word) popup(cx, rc.y - 10, `+${gained} ${word}`, fever > 0 ? pick(FEVER_PALETTE) : '#ff6b81');
      if (combo >= 20 && combo % 10 === 0) {
        rings.push({ x: cx, y: rc.y, life: 0.9, max: 110, color: '#ff4d9a' });
        popup(cx + (Math.random() - 0.5) * 120, (paddle.y + tl.top) / 2 + (Math.random() - 0.5) * 60, `×${combo}`, '#ff4d9a');
      }
      keepWallUp();
    };

    const activate = (kind: PowerKind) => {
      timers[kind] = POWER_SECONDS[kind];
      flash = 0.9; flashColor = POWER_COLOR[kind];
      spray(paddle.cx, paddle.y, POWER_COLOR[kind], 18);
      popup(paddle.cx, paddle.y + 44, POWER_LABEL[kind], POWER_COLOR[kind]);
    };

    /** Keep every ball at the fixed speed, and never too flat. */
    const normalise = (b: Ball) => {
      const len = Math.hypot(b.vx, b.vy) || 1;
      const s = speed();
      b.vx = (b.vx / len) * s;
      b.vy = (b.vy / len) * s;
      if (Math.abs(b.vy) < s * 0.3) {
        b.vy = Math.sign(b.vy || 1) * s * 0.3;
        b.vx = Math.sign(b.vx || 1) * Math.sqrt(s * s - b.vy * b.vy);
      }
    };

    // The gate's span this frame: everything it swept through since the last frame, so a fast
    // swipe (or a pointer jump) can't slide the gate past an electron without catching it.
    let gateL = 0, gateR = 0, prevGateCx = -1;

    const stepBall = (b: Ball, dt: number) => {
      const prevY = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
      if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx); }
      if (b.y > H - r) { b.y = H - r; b.vy = -Math.abs(b.vy); } // floor, only reachable through gaps
      // Got past the gate: bounce off the top of the footer and come back. Costs the combo.
      if (b.y < r) {
        b.y = r; b.vy = Math.abs(b.vy);
        if (combo > 0) { if (combo >= 10) popup(b.x, 40, 'MISS', 'rgba(255,255,255,0.6)'); setCombo(0); }
      }

      // Gate: only its underside bounces (so an electron coming back down from the top passes through).
      // Catches an electron anywhere in the gate's thickness, or one that crossed its underside
      // during this step, while it's heading up.
      const pw = paddleW();
      const bottom = paddle.y + paddle.h;
      const overlaps = b.y - r <= bottom && b.y + r >= paddle.y;
      const crossed = prevY - r > bottom && b.y - r <= bottom;
      if (b.vy < 0 && (overlaps || crossed) && b.x >= gateL - r && b.x <= gateR + r) {
        const off = Math.max(-1, Math.min(1, (b.x - paddle.cx) / (pw / 2)));
        // A few degrees of jitter so a dead-centre hit can't lock into a vertical loop.
        const a = off * (Math.PI / 3) + (Math.random() - 0.5) * 0.1;
        const s = speed();
        b.vx = s * Math.sin(a); b.vy = s * Math.cos(a);
        b.y = paddle.y + paddle.h + r;
      }

      // Tiles: circle vs box, bounce off the face it hit.
      for (const t of tiles) {
        if (!t.alive) continue;
        const rc = tileRect(t);
        const cx = Math.max(rc.x, Math.min(b.x, rc.x + rc.w));
        const cy = Math.max(rc.y, Math.min(b.y, rc.y + rc.h));
        const dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        if (cx === b.x) {
          const below = b.y > rc.y + rc.h / 2;
          b.vy = below ? Math.abs(b.vy) : -Math.abs(b.vy);
          b.y = below ? rc.y + rc.h + r : rc.y - r;
        } else if (cy === b.y) {
          const right = b.x > rc.x + rc.w / 2;
          b.vx = right ? Math.abs(b.vx) : -Math.abs(b.vx);
          b.x = right ? rc.x + rc.w + r : rc.x - r;
        } else {
          b.vx = Math.sign(dx) * Math.abs(b.vx);
          b.vy = Math.sign(dy) * Math.abs(b.vy);
        }
        breakTile(t);
        break;
      }
    };

    /** The first live tile straight below x, top row first: what the laser beam is burning. */
    const tileUnder = (x: number) => {
      const col = Math.floor(x / tl.tileW);
      for (let row = 0; row < TILE_ROWS; row++) {
        const t = tiles.find(tt => tt.alive && tt.col === col && tt.row === row);
        if (t) return t;
      }
      return null;
    };

    const parkBall = () => { balls = [newBall(paddle.cx, paddle.y + paddle.h + r + 2, 0, 0)]; };

    const update = (dt: number) => {
      clock += dt;
      const pv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (pv) paddle.cx += pv * W * 1.6 * dt;
      const pw = paddleW();
      paddle.cx = Math.min(Math.max(paddle.cx, pw / 2), W - pw / 2);

      for (const t of tiles) if (t.alive && t.fade < 1) t.fade = Math.min(1, t.fade + dt / 0.3);
      for (const m of motes) { m.y -= m.vy * dt * (fever > 0 ? 4 : 1); if (m.y < -4) { m.y = tl.top; m.x = Math.random() * W; } }

      if (state !== 'playing') prevGateCx = paddle.cx;
      if (state === 'ready') { balls[0].x = paddle.cx; balls[0].y = paddle.y + paddle.h + r + 2; return; }
      if (state !== 'playing') return;

      flash = Math.max(0, flash - dt * 1.4);
      fever = Math.max(0, fever - dt);
      feverTitle = Math.max(0, feverTitle - dt);
      for (const k of POWER_KINDS) timers[k] = Math.max(0, timers[k] - dt);

      // Electron count follows Multi and fever: add copies of the first, drop extras when they end.
      const want = wantedBalls();
      while (balls.length < want) {
        const src = balls[0];
        const turn = (balls.length % 2 ? -1 : 1) * 0.5;
        const c = Math.cos(turn), s = Math.sin(turn);
        balls.push(newBall(src.x, src.y, src.vx * c - src.vy * s, src.vx * s + src.vy * c));
      }
      if (balls.length > want) balls = balls.slice(0, want);

      // Steady regrowth on top of the floor; quicker during fever so there's always something to hit.
      regrowIn -= dt;
      if (regrowIn <= 0) { regrowOne(); regrowIn = fever > 0 ? 0.25 : 0.45; }

      bitFlipIn -= dt;
      if (bitFlipIn <= 0) {
        bitFlipIn = 0.06;
        const dead = tiles.filter(t => !t.alive);
        const t = dead[Math.floor(Math.random() * dead.length)];
        if (t) { const i = Math.floor(Math.random() * t.bits.length); t.bits = t.bits.slice(0, i) + (t.bits[i] === '0' ? '1' : '0') + t.bits.slice(i + 1); }
      }

      // Fever: sparks keep shooting up out of the tiles.
      if (fever > 0) {
        feverSparkIn -= dt;
        if (feverSparkIn <= 0) {
          feverSparkIn = 0.05;
          const x = Math.random() * W;
          sparks.push({ x, y: tl.top, vx: (Math.random() - 0.5) * 60, vy: -260 - Math.random() * 260, life: 1, color: pick(FEVER_PALETTE) });
        }
      }

      if (prevGateCx < 0) prevGateCx = paddle.cx;
      gateL = Math.min(prevGateCx, paddle.cx) - pw / 2;
      gateR = Math.max(prevGateCx, paddle.cx) + pw / 2;
      prevGateCx = paddle.cx;

      const steps = Math.max(1, Math.ceil((speed() * dt) / (r * 0.7)));
      const h = dt / steps;
      for (const b of balls) {
        normalise(b);
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > TRAIL) b.trail.shift();
      }
      for (let s = 0; s < steps; s++) for (const b of balls) stepBall(b, h);

      // Power-up bars float up from broken tiles; the gate catches them.
      const pL = paddle.cx - pw / 2, pR = paddle.cx + pw / 2;
      capsules = capsules.filter(c => {
        c.y -= 180 * dt;
        if (c.y - 4 <= paddle.y + paddle.h && c.y + 4 >= paddle.y && c.x + 14 >= pL && c.x - 14 <= pR) { activate(c.kind); return false; }
        return c.y > 0;
      });

      // Laser: one continuous beam that burns through whatever tile is beneath the gate.
      if (timers.laser > 0) {
        beamTick -= dt;
        if (beamTick <= 0) {
          beamTick = 0.1;
          const t = tileUnder(paddle.cx);
          if (t) breakTile(t);
        }
      }

      sparks = sparks.filter(sp => {
        sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 340 * dt; sp.life -= dt;
        return sp.life > 0;
      });
      popups = popups.filter(p => { p.life -= dt; p.y -= (p.big ? 10 : 34) * dt; return p.life > 0; });
      rings = rings.filter(rg => { rg.life -= dt; return rg.life > 0; });
    };

    const ballTrailColor = (b: Ball, i: number) =>
      fever > 0 ? FEVER_PALETTE[(b.hue + Math.floor(clock * 10) + i) % FEVER_PALETTE.length] : TRAIL_COLOR;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // ---- the room lights up: a soft red edge glow while playing; in fever, orbiting heat ----
      if (state !== 'ready') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (fever > 0) {
          const pulse = 0.32 + 0.12 * Math.sin(clock * 7);
          for (let i = 0; i < 3; i++) {
            const a = clock * 0.9 + (i * Math.PI * 2) / 3;
            const gx = W / 2 + Math.cos(a) * W * 0.42, gy = H * 0.5 + Math.sin(a) * H * 0.38;
            const col = FEVER_PALETTE[(i * 2 + Math.floor(clock * 1.5)) % FEVER_PALETTE.length];
            const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.55);
            g.addColorStop(0, hexA(col, pulse));
            g.addColorStop(1, hexA(col, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
          }
          ctx.fillStyle = hexA('#ff1744', 0.07);
          ctx.fillRect(0, 0, W, H);
        } else {
          for (const [gx, gy, rad] of [[0, H * 0.5, W * 0.45], [W, H * 0.4, W * 0.45]] as const) {
            const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
            g.addColorStop(0, hexA(ACCENT, 0.12));
            g.addColorStop(1, hexA(ACCENT, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
          }
        }
        ctx.restore();
      }
      for (const k of activeKinds()) {
        const g = ctx.createRadialGradient(paddle.cx, paddle.y, 0, paddle.cx, paddle.y, W * 0.4);
        g.addColorStop(0, hexA(POWER_COLOR[k], Math.min(1, timers[k] / 1.5) * 0.14));
        g.addColorStop(1, hexA(POWER_COLOR[k], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      if (flash > 0) {
        ctx.fillStyle = hexA(flashColor, 0.25 * flash);
        ctx.fillRect(0, 0, W, H);
      }

      // Floating motes
      for (const m of motes) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = fever > 0 ? FEVER_PALETTE[Math.floor(m.x + clock * 3) % FEVER_PALETTE.length] : m.color;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.size * (fever > 0 ? 1.5 : 1), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Tiles, binary where they've been broken. In fever the whole strip becomes a moving heat wave.
      for (const t of tiles) {
        const rc = tileRect(t);
        if (!t.alive || t.fade < 1) drawBinary(ctx, rc.x, rc.y, rc.w, rc.h, t.bits);
        if (!t.alive) continue;
        const tint = fever > 0
          ? FEVER_PALETTE[(t.col + t.row * 2 + Math.floor(clock * 9)) % FEVER_PALETTE.length]
          : t.tint;
        drawTile(ctx, rc.x, rc.y, rc.w, rc.h, t.row, t.col, t.fade, tint);
      }

      // Laser beam
      const pw = paddleW();
      if (timers.laser > 0) {
        const t = tileUnder(paddle.cx);
        const endY = t ? tileRect(t).y : H;
        ctx.save();
        ctx.shadowColor = ACCENT; ctx.shadowBlur = 20;
        ctx.strokeStyle = hexA(ACCENT, 0.9); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(paddle.cx, paddle.y + paddle.h); ctx.lineTo(paddle.cx, endY); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(paddle.cx, paddle.y + paddle.h); ctx.lineTo(paddle.cx, endY); ctx.stroke();
        ctx.restore();
      }

      for (const sp of sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 1.5);
        ctx.fillStyle = sp.color;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Power-up bars
      for (const c of capsules) {
        const col = POWER_COLOR[c.kind];
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        ctx.fillStyle = col;
        ctx.fillRect(c.x - 16, c.y - 5, 32, 10);
        ctx.shadowBlur = 0;
      }

      // Gate: a bold, glowing bar. Red under the laser, rose when wide, hot colours in fever.
      const gateColor = timers.laser > 0 ? ACCENT
        : fever > 0 ? FEVER_PALETTE[Math.floor(clock * 6) % FEVER_PALETTE.length]
        : timers.wide > 0 ? POWER_COLOR.wide : '#ffffff';
      ctx.shadowColor = gateColor === '#ffffff' ? 'rgba(255,255,255,0.9)' : gateColor;
      ctx.shadowBlur = 24;
      ctx.fillStyle = gateColor;
      ctx.beginPath(); ctx.roundRect(paddle.cx - pw / 2, paddle.y, pw, paddle.h, 3); ctx.fill();
      ctx.shadowBlur = 0;
      // A thin lit edge along the top makes it read as a solid bar.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(paddle.cx - pw / 2 + 3, paddle.y + 1, pw - 6, 2);

      // Electrons: a coloured comet streak behind a big white core with a glow
      balls.forEach((b, bi) => {
        const col = ballTrailColor(b, bi);
        ctx.lineCap = 'round';
        for (let i = 1; i < b.trail.length; i++) {
          const k = i / b.trail.length;
          ctx.strokeStyle = hexA(col, k * 0.75);
          ctx.lineWidth = r * 1.7 * k;
          ctx.beginPath();
          ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
          ctx.lineTo(b.trail[i].x, b.trail[i].y);
          ctx.stroke();
        }
        const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 5);
        halo.addColorStop(0, hexA(col, 0.55));
        halo.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(b.x, b.y, r * 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Rings: combo milestones, and fever's big shockwave
      for (const rg of rings) {
        const total = rg.max > 200 ? 1.2 : 0.9;
        const p = 1 - rg.life / total;
        ctx.globalAlpha = Math.max(0, 1 - p);
        ctx.strokeStyle = rg.color; ctx.lineWidth = rg.max > 200 ? 4 : 1.5;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, 10 + p * rg.max, 0, Math.PI * 2); ctx.stroke();
        if (rg.max <= 200) {
          ctx.strokeStyle = TRAIL_COLOR;
          ctx.beginPath(); ctx.arc(rg.x, rg.y, 6 + p * rg.max * 0.6, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Floating popups ("+250 NICE", "×40", "MISS")
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of popups) {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.font = `bold ${p.big ? (W < 600 ? 18 : 26) : 13}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;

      // FEVER MODE title: each letter in its own hot colour, bouncing on a wave
      if (feverTitle > 0) {
        const p = 1 - feverTitle / 1.8;
        const size = Math.round((W < 600 ? 30 : 68) * (0.85 + 0.15 * Math.min(1, p * 5)));
        ctx.globalAlpha = Math.min(1, feverTitle / 0.4);
        ctx.font = `900 ${size}px Michroma, ui-sans-serif, sans-serif`;
        const text = 'FEVER MODE';
        const total = ctx.measureText(text).width;
        let x = W / 2 - total / 2;
        const y = (paddle.y + tl.top) / 2;
        ctx.textAlign = 'left';
        text.split('').forEach((ch, i) => {
          const col = FEVER_PALETTE[(i + Math.floor(clock * 12)) % FEVER_PALETTE.length];
          ctx.shadowColor = col; ctx.shadowBlur = 30;
          ctx.fillStyle = col;
          ctx.fillText(ch, x, y + Math.sin(clock * 10 + i * 0.6) * size * 0.08);
          x += ctx.measureText(ch).width;
        });
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
      }

      // Active power-ups and fever, side by side just below the gate, each in its colour
      ctx.font = 'bold 10px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'left';
      let lx = paddle.cx - pw / 2;
      const labels = [...activeKinds().map(k => ({ text: `${POWER_LABEL[k]} ${timers[k].toFixed(1)}s`, color: POWER_COLOR[k] })),
        ...(fever > 0 ? [{ text: `FEVER ${fever.toFixed(1)}s`, color: pick(FEVER_PALETTE) }] : [])];
      for (const l of labels) {
        ctx.fillStyle = l.color;
        ctx.fillText(l.text, lx, paddle.y + paddle.h + 14);
        lx += ctx.measureText(l.text).width + 14;
      }

      // Score, right-aligned above the tiles
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`SCORE ${pts}`, W - 16, tl.top - 16);
    };

    // ---- loop ----
    let raf = 0, last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, last ? (now - last) / 1000 : 0.016);
      last = now;
      update(dt);
      draw();
    };

    // ---- input ----
    const onPointerMove = (e: PointerEvent) => {
      paddle.cx = e.clientX - canvas.getBoundingClientRect().left;
    };
    const onPointerDown = (e: PointerEvent) => {
      onPointerMove(e);
      if (state === 'ready' || state === 'paused') launch();
    };
    const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D', ' ', 'Escape'];
    let onScreen = true;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (!GAME_KEYS.includes(e.key)) return;
      // Only steal keys while the game is on screen and nothing else is focused.
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || !onScreen) return;
      e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.left = down;
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = down;
      else if (down && e.key === ' ') {
        if (state === 'playing') pause(); else launch();
      } else if (down && e.key === 'Escape') cb.current.onExit();
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.intersectionRatio >= 0.4;
      if (!onScreen) pause();
    }, { threshold: [0, 0.4, 1] });
    io.observe(wrap);
    const onVisibility = () => { if (document.hidden) pause(); };
    const ro = new ResizeObserver(() => layout());

    layout();
    paddle.cx = W / 2;
    parkBall();
    cb.current.onScore?.(0, readBest());
    ro.observe(wrap);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const overlay =
    phase === 'ready' ? { title: 'Electron Breakout', hint: 'Click, tap or press Space to launch. Esc to quit.' }
    : phase === 'paused' ? { title: 'Paused', hint: 'Click, tap or press Space to resume.' }
    : null;

  return (
    <div ref={wrapRef} className="absolute inset-0 select-none">
      <canvas ref={canvasRef} className="block touch-none cursor-none" aria-label="Electron Breakout game" role="img" />
      {overlay && (
        <div className="pointer-events-none absolute inset-x-0 top-[62%] flex flex-col items-center gap-2 px-6 text-center">
          <p className="font-heading text-xl md:text-2xl font-bold text-foreground drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">{overlay.title}</p>
          <p className="max-w-sm text-xs text-muted-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{overlay.hint}</p>
        </div>
      )}
    </div>
  );
};

export default ElectronBreakout;
