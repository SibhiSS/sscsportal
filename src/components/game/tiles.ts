// The footer's bottom strip: two rows of bevelled grey tiles, edge to edge.
// Shared by the static footer and the game so both draw exactly the same tiles.

export const TILE_ROWS = 2;

export interface TileLayout { cols: number; tileW: number; tileH: number; top: number }

/** Tile grid for a footer `width` × `height` px. */
export function tileLayout(width: number, height: number): TileLayout {
  const cols = Math.min(14, Math.max(6, Math.round(width / 160)));
  const tileH = Math.round(Math.min(48, Math.max(30, width * 0.024)));
  return { cols, tileW: width / cols, tileH, top: height - tileH * TILE_ROWS };
}

/**
 * One tile. Top row: glossy gradient like metal keys. Bottom row: flat,
 * alternating two greys. A `color` makes it a power-up tile (tinted glossy).
 * `alpha` fades regrowing tiles in.
 */
export function drawTile(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  row: number, col: number, alpha = 1, color?: string,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (color) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.12, color);
    g.addColorStop(1, shade(color));
    ctx.fillStyle = g;
  } else if (row === 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#f2f2f3');
    g.addColorStop(0.45, '#c9c9cc');
    g.addColorStop(1, '#a7a7ab');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = col % 2 === 0 ? '#c4c4c6' : '#dadadc';
  }
  ctx.fillRect(x, y, w, h);

  // Bevel: a lit top edge, dark right/bottom seams.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + w - 1.5, y, 1.5, h);
  ctx.fillRect(x, y + h - 1.5, w, 1.5);
  ctx.restore();
}

/** Darker version of a #rrggbb colour, for the bottom of a gradient. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.62);
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/** Where a tile has been broken: a line of binary, as if the circuit underneath shows through. */
export function drawBinary(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bits: string) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.font = `bold ${Math.round(h * 0.62)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const adv = ctx.measureText('0').width;
  for (let i = 0; i * adv < w; i++) {
    const ch = bits[i % bits.length];
    ctx.fillStyle = ch === '1' ? 'rgba(235,235,240,0.85)' : 'rgba(150,150,160,0.6)';
    ctx.fillText(ch, x + i * adv, y + h / 2 + 1);
  }
  ctx.restore();
}

/** The full strip, every tile present (the footer at rest). */
export function drawAllTiles(ctx: CanvasRenderingContext2D, layout: TileLayout) {
  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < layout.cols; col++) {
      drawTile(ctx, col * layout.tileW, layout.top + row * layout.tileH, layout.tileW, layout.tileH, row, col);
    }
  }
}
