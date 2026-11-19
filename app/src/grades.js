// grades.js — the five colour grades of Neon Coast Cover Studio.
//
// A grade is two things the renderer applies in order: a canvas filter
// string used while each photo is drawn, and a short list of full-canvas
// gradient overlays painted afterwards with a blend mode. No per-pixel
// loops anywhere, so an export at 1920 x 1080 stays fast. `strength`
// (0..1) scales the overlays; the filter itself is always applied at full
// strength because a half-applied filter looks washed out.
//
// Each overlay is { kind: 'linear' | 'radial', stops: [[offset, color]],
// blend: 'overlay' | 'soft-light' | 'screen' | 'multiply', alpha, geom }.
// For a linear overlay geom is { x0, y0, x1, y1 } in fractions of the
// canvas; for a radial one it is { cx, cy, r0, r1 } in fractions.

export const GRADES = {
  'sunset-vice': {
    label: 'Sunset Vice',
    describe: 'Warm orange-to-magenta sunset, the classic Vice City glow.',
    filter: 'saturate(1.45) contrast(1.12) brightness(1.04) sepia(0.22) hue-rotate(-12deg)',
    overlays: [
      {
        kind: 'linear', blend: 'soft-light', alpha: 0.55,
        geom: { x0: 0, y0: 0, x1: 1, y1: 1 },
        stops: [[0, '#ff9a3c'], [0.55, '#ff5e7a'], [1, '#b537f2']],
      },
      {
        kind: 'radial', blend: 'overlay', alpha: 0.3,
        geom: { cx: 0.5, cy: 0.85, r0: 0.1, r1: 0.9 },
        stops: [[0, '#ffd166'], [1, 'rgba(255,209,102,0)']],
      },
    ],
  },

  'neon-night': {
    label: 'Neon Night',
    describe: 'Teal shadows, pink highlights — the city after dark.',
    filter: 'saturate(1.5) contrast(1.18) brightness(0.94) hue-rotate(8deg)',
    overlays: [
      {
        kind: 'linear', blend: 'overlay', alpha: 0.5,
        geom: { x0: 0, y0: 1, x1: 0, y1: 0 },
        stops: [[0, '#00e5c0'], [1, '#ff2e88']],
      },
      {
        kind: 'radial', blend: 'soft-light', alpha: 0.4,
        geom: { cx: 0.5, cy: 0.15, r0: 0.05, r1: 0.8 },
        stops: [[0, '#ff7ad9'], [1, 'rgba(255,122,217,0)']],
      },
    ],
  },

  'palm-gold': {
    label: 'Palm Gold',
    describe: 'Golden-hour warmth, honeyed highlights, soft shadows.',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.07) sepia(0.35)',
    overlays: [
      {
        kind: 'linear', blend: 'soft-light', alpha: 0.5,
        geom: { x0: 0, y0: 0, x1: 0, y1: 1 },
        stops: [[0, '#ffe08a'], [0.6, '#f5a623'], [1, '#7a4a12']],
      },
      {
        kind: 'radial', blend: 'screen', alpha: 0.18,
        geom: { cx: 0.5, cy: 0.5, r0: 0.1, r1: 0.75 },
        stops: [[0, '#fff3c4'], [1, 'rgba(255,243,196,0)']],
      },
    ],
  },

  'teal-coast': {
    label: 'Teal Coast',
    describe: 'Cool coastal teal, crisp and clean.',
    filter: 'saturate(1.25) contrast(1.1) brightness(1.0) hue-rotate(18deg) sepia(0.08)',
    overlays: [
      {
        kind: 'linear', blend: 'overlay', alpha: 0.42,
        geom: { x0: 0, y0: 0, x1: 1, y1: 1 },
        stops: [[0, '#19c2b8'], [1, '#0b3d5c']],
      },
      {
        kind: 'linear', blend: 'soft-light', alpha: 0.3,
        geom: { x0: 0, y0: 1, x1: 0, y1: 0 },
        stops: [[0, '#e8fff9'], [1, 'rgba(232,255,249,0)']],
      },
    ],
  },

  'mono-noir': {
    label: 'Mono Noir',
    describe: 'High-contrast black and white, hard shadows.',
    filter: 'grayscale(1) contrast(1.35) brightness(1.05)',
    overlays: [
      {
        kind: 'linear', blend: 'soft-light', alpha: 0.25,
        geom: { x0: 0, y0: 0, x1: 0, y1: 1 },
        stops: [[0, '#ffffff'], [1, '#000000']],
      },
    ],
  },
};

export const GRADE_IDS = Object.keys(GRADES);

export function getGrade(id) {
  return GRADES[id] || GRADES['sunset-vice'];
}

// Paint one grade overlay onto ctx at the given strength (0..1).
export function paintOverlay(ctx, W, H, overlay, strength) {
  const g = overlay.geom;
  let gradient;
  if (overlay.kind === 'linear') {
    gradient = ctx.createLinearGradient(g.x0 * W, g.y0 * H, g.x1 * W, g.y1 * H);
  } else {
    gradient = ctx.createRadialGradient(
      g.cx * W, g.cy * H, g.r0 * Math.max(W, H),
      g.cx * W, g.cy * H, g.r1 * Math.max(W, H),
    );
  }
  for (const [offset, color] of overlay.stops) gradient.addColorStop(offset, color);
  ctx.save();
  ctx.globalCompositeOperation = overlay.blend;
  ctx.globalAlpha = overlay.alpha * strength;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
