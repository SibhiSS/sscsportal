import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, LayoutGrid, RotateCcw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

/**
 * Instagram grid maker. Splits one big design into tiles that line up across
 * the profile grid. Everything runs in the browser: the image is never uploaded.
 *
 * Instagram's profile grid shows every post as a 3:4 tile (since Jan 2025), so a
 * 3:4 tile (1080 x 1440) is the only size that joins up without a crop.
 * The grid is always 3 posts wide, and the newest post sits top left, so tiles
 * are posted bottom-right first and top-left last.
 */

type Ratio = '3:4' | '4:5' | '1:1';
const RATIOS: Record<Ratio, { w: number; h: number; note: string }> = {
  '3:4': { w: 1080, h: 1440, note: 'Matches the profile grid exactly. Use this.' },
  '4:5': { w: 1080, h: 1350, note: 'The grid crops the sides, so joins will drift.' },
  '1:1': { w: 1080, h: 1080, note: 'Old square grid. The grid crops ~12.5% each side, joins will not line up.' },
};
const COLS = 3;
const PREVIEW_W = 540;
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function GridMakerPage() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('grid');
  const [rows, setRows] = useState(3);
  const [ratio, setRatio] = useState<Ratio>('3:4');
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // full-res px, relative to centred position
  const [bg, setBg] = useState('#000000');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const tile = RATIOS[ratio];
  const W = COLS * tile.w;
  const H = rows * tile.h;
  const total = COLS * rows;

  /** Where the image lands on the full-size canvas. Cover-fit at zoom 1. */
  const placement = useMemo(() => {
    if (!img) return null;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Keep the canvas covered when the image is bigger than it; allow free movement otherwise.
    const clamp = (v: number, d: number, frame: number) => {
      const lim = Math.abs(d - frame) / 2;
      return Math.max(-lim, Math.min(lim, v));
    };
    const ox = clamp(off.x, dw, W);
    const oy = clamp(off.y, dh, H);
    return { dx: (W - dw) / 2 + ox, dy: (H - dh) / 2 + oy, dw, dh, ox, oy };
  }, [img, W, H, zoom, off]);

  const sizeMismatch = useMemo(() => {
    if (!img) return null;
    const imgR = img.naturalWidth / img.naturalHeight;
    const gridR = W / H;
    return Math.abs(imgR - gridR) / gridR > 0.01;
  }, [img, W, H]);

  // Preview render.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ph = Math.round(PREVIEW_W * (H / W));
    const dpr = window.devicePixelRatio || 1;
    c.width = PREVIEW_W * dpr;
    c.height = ph * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const k = (PREVIEW_W * dpr) / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    if (img && placement) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, placement.dx * k, placement.dy * k, placement.dw * k, placement.dh * k);
    }
  }, [img, placement, bg, W, H]);

  const loadFile = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('That is not an image. Export your design as PNG or JPG.'); return; }
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      setImg(im); setZoom(1); setOff({ x: 0, y: 0 });
      setFileName(f.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'grid');
    };
    im.onerror = () => toast.error('Could not read that image.');
    im.src = url;
  }, []);

  // Pan by dragging the preview.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!img || !placement) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: placement.ox, oy: placement.oy };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const c = canvasRef.current;
    if (!d || !c) return;
    const k = W / c.getBoundingClientRect().width;
    setOff({ x: d.ox + (e.clientX - d.x) * k, y: d.oy + (e.clientY - d.y) * k });
  };
  const onPointerUp = () => { drag.current = null; };

  const renderTile = (r: number, col: number): Promise<Blob> => new Promise((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = tile.w; c.height = tile.h;
    const ctx = c.getContext('2d');
    if (!ctx || !img || !placement) { reject(new Error('Nothing to export')); return; }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, tile.w, tile.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, placement.dx - col * tile.w, placement.dy - r * tile.h, placement.dw, placement.dh);
    c.toBlob(b => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/jpeg', 0.95);
  });

  /** Post order: 1 = bottom-right (post first), total = top-left (post last). */
  const postNo = (r: number, col: number) => total - (r * COLS + col);
  const tileName = (r: number, col: number) => `${pad2(postNo(r, col))}-post-${postNo(r, col) === 1 ? 'first' : postNo(r, col) === total ? 'last' : 'next'}_row${r + 1}-col${col + 1}.jpg`;

  const downloadZip = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (let r = 0; r < rows; r++) for (let col = 0; col < COLS; col++) zip.file(tileName(r, col), await renderTile(r, col));
      zip.file('HOW-TO-POST.txt', [
        `Instagram grid: ${rows} row${rows > 1 ? 's' : ''} x 3, ${total} posts, tiles ${tile.w}x${tile.h} (${ratio}).`,
        '',
        'Post the files in number order: 01 first, ' + pad2(total) + ' last.',
        'Each tile is its own single-image post. Do NOT post them as a carousel (the grid only shows a carousel\'s first image).',
        'When uploading, pick the original/3:4 crop so Instagram does not re-crop the tile.',
        'Post all tiles back to back. Anything posted in between shifts the picture.',
        'Pinned posts sit before the grid and push it along. Unpin, or plan around them.',
        'Later posts should go up in groups of 3 to keep the rows lined up.',
      ].join('\n'));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}-ig-grid-${COLS}x${rows}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      toast.error((err as Error)?.message || 'Export failed.');
    } finally { setBusy(false); }
  };

  const downloadOne = async (r: number, col: number) => {
    try {
      const b = await renderTile(r, col);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${fileName}-${tileName(r, col)}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { toast.error((err as Error)?.message || 'Export failed.'); }
  };

  /** A full-size transparent PNG with tile edges, to drop into Canva as a guide layer. */
  const downloadGuide = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = 'rgba(220,20,60,0.9)';
    ctx.lineWidth = 6;
    for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * tile.w, 0); ctx.lineTo(i * tile.w, H); ctx.stroke(); }
    for (let j = 1; j < rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * tile.h); ctx.lineTo(W, j * tile.h); ctx.stroke(); }
    // Safe margin: keep text ~60px away from tile edges so it is not cut by the gaps between posts.
    ctx.setLineDash([24, 18]);
    ctx.strokeStyle = 'rgba(220,20,60,0.45)';
    ctx.lineWidth = 3;
    const m = 60;
    for (let r = 0; r < rows; r++) for (let col = 0; col < COLS; col++) ctx.strokeRect(col * tile.w + m, r * tile.h + m, tile.w - 2 * m, tile.h - 2 * m);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(220,20,60,0.9)';
    ctx.font = 'bold 64px sans-serif';
    for (let r = 0; r < rows; r++) for (let col = 0; col < COLS; col++) ctx.fillText(`#${postNo(r, col)}`, col * tile.w + m + 10, r * tile.h + m + 70);
    c.toBlob(b => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `canva-guide-${W}x${H}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  };

  const reset = () => { setZoom(1); setOff({ x: 0, y: 0 }); };

  return (
    <>
      <div className="top">
        <div>
          <h1>Grid maker</h1>
          <div className="sub">Split one design into Instagram posts that join up on the profile grid. Runs in your browser; nothing is uploaded.</div>
        </div>
      </div>

      <section className="panel">
        <h3 className="ph" style={{ marginBottom: 14 }}>1 · Set up the grid</h3>
        <div className="gm-controls adm-form">
          <div className="fld"><span className="lbl">Rows (3 posts each)</span>
            <div className="seg" role="radiogroup" aria-label="Rows">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" role="radio" aria-checked={rows === n} className={rows === n ? 'on' : ''} onClick={() => setRows(n)}>{n} · {n * 3} posts</button>
              ))}
            </div>
          </div>
          <div className="fld"><span className="lbl">Tile shape</span>
            <div className="seg" role="radiogroup" aria-label="Tile shape">
              {(Object.keys(RATIOS) as Ratio[]).map(r => (
                <button key={r} type="button" role="radio" aria-checked={ratio === r} className={ratio === r ? 'on' : ''} onClick={() => setRatio(r)}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="note-sm" style={{ marginTop: 12 }}>
          {RATIOS[ratio].note} Make your Canva design exactly <b>{W} × {H} px</b> (each tile {tile.w} × {tile.h}).
        </p>
        <button className="ghost" type="button" onClick={downloadGuide}><LayoutGrid size={15} /> Download Canva guide ({W}×{H} PNG)</button>
        <p className="note-sm" style={{ marginTop: 8 }}>Upload the guide into your Canva design as the top layer, lock it, design under it, then delete it before exporting. Keep text inside the dashed boxes so the gaps between posts don't cut it.</p>
      </section>

      <section className="panel">
        <h3 className="ph" style={{ marginBottom: 14 }}>2 · Add your design and position it</h3>
        <div className="gm-work">
          <div
            className={`gm-stage${dragOver ? ' over' : ''}${img ? '' : ' empty'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files?.[0]); }}
          >
            <div className="gm-frame" style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, calc(72vh * ${W / H}))` }}>
              <canvas
                ref={canvasRef}
                className="gm-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ touchAction: 'none' }}
              />
              <div className="gm-overlay" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }} aria-hidden>
                {Array.from({ length: total }, (_, i) => {
                  const r = Math.floor(i / COLS), col = i % COLS;
                  return <div key={i} className="gm-cell"><span>{postNo(r, col)}</span></div>;
                })}
              </div>
              {!img && (
                <button type="button" className="gm-drop" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={26} />
                  <b>Drop your design here</b>
                  <span>or click to choose a PNG / JPG</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          <div className="gm-side adm-form">
            <button className="ghost" type="button" onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> {img ? 'Replace image' : 'Choose image'}</button>
            {img && (
              <>
                <div className="muted">{img.naturalWidth} × {img.naturalHeight} px</div>
                {sizeMismatch && (
                  <p className="note-sm gm-warn">This image isn't {W}×{H}'s shape, so part of it will be cropped. Drag the preview to choose what stays, or resize the design in Canva.</p>
                )}
                {img.naturalWidth < W && (
                  <p className="note-sm gm-warn">This image is narrower than {W}px, so tiles will be upscaled and look soft. Export from Canva at {W}×{H}.</p>
                )}
                <div className="fld"><label htmlFor="gmZoom">Zoom · {Math.round(zoom * 100)}%</label>
                  <input id="gmZoom" type="range" min={0.5} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} /></div>
                <div className="fld"><label htmlFor="gmBg">Fill colour (shows when zoomed out)</label>
                  <input id="gmBg" type="color" value={bg} onChange={e => setBg(e.target.value)} className="gm-color" /></div>
                <button className="mini-btn" type="button" onClick={reset}><RotateCcw size={13} /> Reset position</button>
              </>
            )}
            <p className="note-sm" style={{ marginTop: 8 }}>Numbers are the posting order. Instagram puts the newest post top left, so <b>1</b> (bottom right) goes up first and <b>{total}</b> (top left) goes up last.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">3 · Download</h3>
          <span className="asof">{total} JPGs · {tile.w}×{tile.h}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="primary" type="button" disabled={!img || busy} onClick={downloadZip}>
            <Download size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />{busy ? 'Building ZIP…' : `Download all ${total} as ZIP`}
          </button>
        </div>
        {img && (
          <div className="gm-singles">
            {Array.from({ length: total }, (_, i) => {
              const r = Math.floor(i / COLS), col = i % COLS;
              return <button key={i} type="button" className="mini-btn" onClick={() => downloadOne(r, col)}>Post {postNo(r, col)}</button>;
            })}
          </div>
        )}
        <ul className="gm-rules">
          <li>Each tile is its own single-image post. A carousel won't work: the grid only shows its first image.</li>
          <li>When uploading, choose the original / 3:4 crop so Instagram doesn't re-crop the tile.</li>
          <li>Post all tiles back to back. Pinned posts sit before the grid and shift it.</li>
          <li>After the grid, post in groups of 3 to keep rows aligned, or use Instagram's Reorder grid.</li>
        </ul>
      </section>
    </>
  );
}
