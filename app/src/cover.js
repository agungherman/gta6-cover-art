// cover.js — the cover renderer of Neon Coast Cover Studio.
//
// Pure drawing code: given a 2d context, a pixel size, the editor state and
// the photo store, it paints one finished cover. No DOM is touched except
// the canvas it is handed, so the editor preview and the PNG export share
// exactly the same drawing path.
//
// Panel assignment: state.panels is indexed by layout slot,
// { photoId, zoom, dx, dy }. A slot with no photo assigned borrows one
// from the store in rotation, so a layout never shows a blank panel while
// photos exist. With no photos at all a slot is painted as a warm gradient
// with diagonal stripes — never black.

import { buildLayout } from './layouts.js';
import { getGrade, paintOverlay } from './grades.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Resolve which photo fills a slot, borrowing from the store in rotation.
function photoForSlot(state, store, slotIndex) {
  const assigned = state.panels && state.panels[slotIndex];
  if (assigned && assigned.photoId) {
    const found = store.get(assigned.photoId);
    if (found) return { photo: found, zoom: assigned.zoom ?? 1, dx: assigned.dx ?? 0, dy: assigned.dy ?? 0 };
  }
  if (store.photos.length === 0) return null;
  const photo = store.photos[slotIndex % store.photos.length];
  return { photo, zoom: 1, dx: 0, dy: 0 };
}

// Draw one photo cover-fitting a panel rect, with zoom and pan.
function drawPhotoInPanel(ctx, photo, rect, zoom, dx, dy, filter) {
  const iw = photo.width;
  const ih = photo.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // Pan is a fraction of the panel; clamp so the photo still covers it.
  const maxDx = dw > rect.w ? (dw - rect.w) / 2 : 0;
  const maxDy = dh > rect.h ? (dh - rect.h) / 2 : 0;
  const ox = clamp(dx * rect.w, -maxDx, maxDx);
  const oy = clamp(dy * rect.h, -maxDy, maxDy);
  const x = rect.x + (rect.w - dw) / 2 + ox;
  const y = rect.y + (rect.h - dh) / 2 + oy;
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(photo.image, x, y, dw, dh);
  ctx.restore();
}

function paintPlaceholder(ctx, rect, slotIndex) {
  const warm = ['#ff9a3c', '#ff5e7a', '#b537f2', '#19c2b8', '#ffd166', '#ff2e88'];
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, warm[slotIndex % warm.length]);
  g.addColorStop(1, warm[(slotIndex + 2) % warm.length]);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, rect.w * 0.02);
  for (let i = -rect.h; i < rect.w; i += Math.max(18, rect.w * 0.12)) {
    ctx.beginPath();
    ctx.moveTo(rect.x + i, rect.y + rect.h);
    ctx.lineTo(rect.x + i + rect.h, rect.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHalftone(ctx, zone, W, H) {
  const step = Math.max(7, Math.round(H * 0.016));
  const r = Math.max(1.2, H * 0.0032);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.16;
  for (let y = zone.y + step / 2; y < zone.y + zone.h; y += step) {
    const row = Math.round((y - zone.y) / step);
    for (let x = zone.x + step / 2 + (row % 2 ? step / 2 : 0); x < zone.x + zone.w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startPx, family, weight = '') {
  let px = startPx;
  const set = (size) => { ctx.font = `${weight} ${size}px ${family}`.trim(); };
  set(px);
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px = Math.floor(px * 0.92);
    set(px);
  }
  return px;
}

function drawStars(ctx, cx, y, size) {
  ctx.save();
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = 'rgba(26,11,46,0.8)';
  ctx.lineWidth = Math.max(1, size * 0.08);
  const gap = size * 1.35;
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * gap;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const ang = (Math.PI / 5) * k - Math.PI / 2;
      const rad = k % 2 === 0 ? size / 2 : size / 5;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawRibbon(ctx, W, H, text) {
  const fs = Math.max(11, Math.round(H * 0.016));
  ctx.save();
  ctx.font = `700 ${fs}px Anton, sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = fs * 0.9;
  const bw = tw + padX * 2;
  const bh = fs * 1.9;
  ctx.translate(W - bw * 0.45, bh * 0.9);
  ctx.rotate(-0.32);
  ctx.fillStyle = '#ff2e88';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, H * 0.002);
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

function drawTitleBlock(ctx, W, H, zone, state) {
  const top = state.titlePos === 'top';
  // Scrim so lettering stays readable over any photo.
  const scrim = top
    ? ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h)
    : ctx.createLinearGradient(0, zone.y + zone.h, 0, zone.y);
  scrim.addColorStop(0, 'rgba(12,4,26,0.88)');
  scrim.addColorStop(0.75, 'rgba(12,4,26,0.45)');
  scrim.addColorStop(1, 'rgba(12,4,26,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  drawHalftone(ctx, zone, W, H);

  const cx = zone.x + zone.w / 2;
  const title = (state.title || 'Neon Coast').toUpperCase();
  const maxW = zone.w * 0.92;
  const baseTitle = zone.h * 0.52 * (state.titleSize || 1);
  const titlePx = fitFont(ctx, title, maxW, baseTitle, 'Anton, sans-serif', '400');
  const titleY = top
    ? zone.y + zone.h * 0.3
    : zone.y + zone.h * 0.38;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,94,58,0.85)';
  ctx.shadowBlur = Math.max(4, H * 0.008);
  ctx.shadowOffsetY = Math.max(2, H * 0.004);
  ctx.lineWidth = Math.max(2, titlePx * 0.09);
  ctx.strokeStyle = '#1a0b2e';
  ctx.lineJoin = 'round';
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, cx, titleY);
  ctx.restore();

  const subtitle = state.subtitle || '';
  if (subtitle) {
    const subPx = Math.max(12, Math.round(titlePx * 0.42));
    ctx.save();
    ctx.font = `${subPx}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(255,46,136,0.9)';
    ctx.shadowBlur = Math.max(3, H * 0.005);
    const subY = titleY + titlePx * 0.55;
    ctx.fillText(subtitle, cx, subY);
    ctx.restore();
    drawStars(ctx, cx, subY + subPx * 0.95, Math.max(8, subPx * 0.5));
  } else {
    drawStars(ctx, cx, titleY + titlePx * 0.55, Math.max(8, titlePx * 0.2));
  }
}

function drawGrain(ctx, W, H) {
  const rand = mulberry32((W * 31 + H * 17) | 0);
  const count = Math.min(4200, Math.round((W * H) / 900));
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.fillStyle = '#000000';
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.72,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,2,18,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Paint one finished cover onto ctx at W x H.
export function drawCover(ctx, W, H, state, store) {
  // Backdrop: deep purple gradient, visible in gaps and behind tilted frames.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#150a24');
  bg.addColorStop(0.55, '#2a0f3d');
  bg.addColorStop(1, '#571b4a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const grade = getGrade(state.grade);
  const { panels, title } = buildLayout(state.layout, W, H);
  const frameW = Math.max(2, Math.round(W * 0.006));

  panels.forEach((rect, i) => {
    // Drop shadow behind the frame.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.fillRect(-rect.w / 2 + 4, -rect.h / 2 + 6, rect.w, rect.h);
    } else {
      ctx.fillRect(rect.x + 4, rect.y + 6, rect.w, rect.h);
    }
    ctx.restore();

    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    }
    ctx.beginPath();
    ctx.rect(rect.rot ? 0 : rect.x, rect.rot ? 0 : rect.y, rect.w, rect.h);
    ctx.clip();
    const slot = photoForSlot(state, store, i);
    const local = { x: rect.rot ? 0 : rect.x, y: rect.rot ? 0 : rect.y, w: rect.w, h: rect.h };
    if (slot) {
      drawPhotoInPanel(ctx, slot.photo, local, slot.zoom, slot.dx, slot.dy, grade.filter);
    } else {
      paintPlaceholder(ctx, local, i);
    }
    ctx.restore();

    // White frame around the panel.
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = frameW;
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    } else {
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  });

  // Grade overlays over the photos and backdrop, before the lettering.
  const strength = state.gradeStrength ?? 1;
  for (const overlay of grade.overlays) paintOverlay(ctx, W, H, overlay, strength);

  const zone = state.titlePos === 'top'
    ? { x: title.x, y: 0, w: title.w, h: title.h, align: title.align }
    : title;
  drawTitleBlock(ctx, W, H, zone, state);
  drawRibbon(ctx, W, H, 'EST. 2026');

  if (state.grain !== false) drawGrain(ctx, W, H);
  if (state.vignette !== false) drawVignette(ctx, W, H);
}

// Render a cover to a fresh canvas at the exact pixel size and return it.
export function renderCoverCanvas(W, H, state, store) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, W, H, state, store);
  return canvas;
}
