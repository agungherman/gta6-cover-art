// layouts.js — the six cover layouts of Neon Coast Cover Studio.
//
// Every layout is a pure function of the canvas size (W, H). It returns the
// panel rectangles the photos fill plus the zone the title block lives in,
// so the renderer and the editor share one source of truth. A panel rect is
// {x, y, w, h, rot} in pixels; rot is a clockwise rotation in radians about
// the panel centre (0 for the grid layouts). The title zone is
// {x, y, w, h, align}: the band the title and subtitle are fitted into.
// Title zones sit in a bottom band for the grid layouts so lettering never
// covers the faces in the middle of the collage.

export const LAYOUTS = {
  nine: {
    label: 'Nine Grid',
    describe: 'Classic 3 x 3 poster collage with a title band along the bottom.',
    build(W, H) {
      const gap = Math.max(4, Math.round(W * 0.012));
      const bandH = Math.round(H * 0.18);
      const gridH = H - bandH;
      const cellW = (W - gap * 4) / 3;
      const cellH = (gridH - gap * 4) / 3;
      const panels = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          panels.push({
            x: gap + col * (cellW + gap),
            y: gap + row * (cellH + gap),
            w: cellW,
            h: cellH,
            rot: 0,
          });
        }
      }
      return { panels, title: { x: 0, y: gridH, w: W, h: bandH, align: 'center' } };
    },
  },

  hero3: {
    label: 'Hero + 3',
    describe: 'One big hero panel on the left, three small panels stacked right.',
    build(W, H) {
      const gap = Math.max(4, Math.round(W * 0.012));
      const bandH = Math.round(H * 0.18);
      const gridH = H - bandH;
      const heroW = Math.round(W * 0.6);
      const sideX = heroW + gap;
      const sideW = W - sideX - gap;
      const smallH = (gridH - gap * 4) / 3;
      const panels = [
        { x: gap, y: gap, w: heroW - gap, h: gridH - gap * 2, rot: 0 },
      ];
      for (let i = 0; i < 3; i++) {
        panels.push({
          x: sideX,
          y: gap + i * (smallH + gap),
          w: sideW,
          h: smallH,
          rot: 0,
        });
      }
      return { panels, title: { x: 0, y: gridH, w: W, h: bandH, align: 'center' } };
    },
  },

  full: {
    label: 'Full Bleed',
    describe: 'A single photo edge to edge, title over a scrim at the bottom.',
    build(W, H) {
      const bandH = Math.round(H * 0.22);
      return {
        panels: [{ x: 0, y: 0, w: W, h: H, rot: 0 }],
        title: { x: 0, y: H - bandH, w: W, h: bandH, align: 'center' },
      };
    },
  },

  quad: {
    label: 'Quad',
    describe: 'A 2 x 2 grid with a title band along the bottom.',
    build(W, H) {
      const gap = Math.max(4, Math.round(W * 0.012));
      const bandH = Math.round(H * 0.18);
      const gridH = H - bandH;
      const cellW = (W - gap * 3) / 2;
      const cellH = (gridH - gap * 3) / 2;
      const panels = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          panels.push({
            x: gap + col * (cellW + gap),
            y: gap + row * (cellH + gap),
            w: cellW,
            h: cellH,
            rot: 0,
          });
        }
      }
      return { panels, title: { x: 0, y: gridH, w: W, h: bandH, align: 'center' } };
    },
  },

  tilted: {
    label: 'Tilted Shots',
    describe: 'Three snapshot frames, each tilted, overlapping on a gradient.',
    build(W, H) {
      const bandH = Math.round(H * 0.2);
      const areaH = H - bandH;
      const pw = Math.round(W * 0.42);
      const ph = Math.round(areaH * 0.72);
      const cy = Math.round(areaH * 0.44);
      const panels = [
        { x: Math.round(W * 0.05), y: cy - ph / 2, w: pw, h: ph, rot: -0.1 },
        { x: Math.round(W * 0.3), y: cy - ph / 2 + Math.round(H * 0.03), w: pw, h: ph, rot: 0.05 },
        { x: Math.round(W * 0.55), y: cy - ph / 2 - Math.round(H * 0.02), w: pw, h: ph, rot: -0.04 },
      ];
      return { panels, title: { x: 0, y: areaH, w: W, h: bandH, align: 'center' } };
    },
  },

  duo: {
    label: 'Duo',
    describe: 'Two tall vertical halves side by side, title band below.',
    build(W, H) {
      const gap = Math.max(4, Math.round(W * 0.012));
      const bandH = Math.round(H * 0.18);
      const gridH = H - bandH;
      const halfW = (W - gap * 3) / 2;
      const panels = [
        { x: gap, y: gap, w: halfW, h: gridH - gap * 2, rot: 0 },
        { x: gap * 2 + halfW, y: gap, w: halfW, h: gridH - gap * 2, rot: 0 },
      ];
      return { panels, title: { x: 0, y: gridH, w: W, h: bandH, align: 'center' } };
    },
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

export function buildLayout(id, W, H) {
  const layout = LAYOUTS[id] || LAYOUTS.nine;
  return layout.build(W, H);
}
