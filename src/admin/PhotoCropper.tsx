import { useEffect, useRef, useState } from 'react';

const VIEW = 280;   // on-screen crop square, px
const OUT = 512;    // saved photo, px
const MAX_ZOOM = 4;

type Props = {
  /** An object URL or a public image URL (needs CORS for canvas export). */
  src: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void | Promise<void>;
  busy?: boolean;
};

/** Square face crop: drag to move, slider or scroll wheel to zoom. */
export default function PhotoCropper({ src, onCancel, onDone, busy }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => { setImg(el); setZoom(1); setPos({ x: 0, y: 0 }); };
    el.onerror = () => setFailed(true);
    el.src = src;
  }, [src]);

  // Scale that makes the image just cover the square, times the zoom.
  const scale = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) * zoom : 1;
  const w = img ? img.naturalWidth * scale : 0;
  const h = img ? img.naturalHeight * scale : 0;
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.max(-(w - VIEW) / 2, Math.min((w - VIEW) / 2, p.x)),
    y: Math.max(-(h - VIEW) / 2, Math.min((h - VIEW) / 2, p.y)),
  });
  const at = clamp(pos);

  const setZoomClamped = (z: number) => setZoom(Math.max(1, Math.min(MAX_ZOOM, z)));

  const save = () => {
    if (!img) return;
    const left = VIEW / 2 - w / 2 + at.x;
    const top = VIEW / 2 - h / 2 + at.y;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUT;
    canvas.getContext('2d')!.drawImage(img, -left / scale, -top / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT);
    canvas.toBlob(b => { if (b) onDone(b); }, 'image/jpeg', 0.9);
  };

  return (
    <div className="crop">
      <div
        className="crop-view"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, ...at };
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (d) setPos(clamp({ x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={e => setZoomClamped(zoom - e.deltaY * 0.002)}
      >
        {img && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ width: w, height: h, transform: `translate(${VIEW / 2 - w / 2 + at.x}px, ${VIEW / 2 - h / 2 + at.y}px)` }}
          />
        )}
        {!img && <span className="muted">{failed ? "This image can't be loaded for cropping." : 'Loading…'}</span>}
        <div className="crop-frame" aria-hidden />
      </div>

      <label className="crop-zoom">
        <span className="muted">Zoom</span>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!img}
          onChange={e => setZoomClamped(Number(e.target.value))} />
      </label>
      <div className="note-sm">Drag to position the face. The rounded square is what the team page shows.</div>

      <div className="modal-foot">
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="primary" onClick={save} disabled={!img || busy}>{busy ? 'Saving…' : 'Use photo'}</button>
      </div>
    </div>
  );
}
