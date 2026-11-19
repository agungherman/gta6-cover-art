// shots.js — fixed scenes for screenshots.
//
// The app reads its scene from the URL: ?shot=cover|editor plus
// ?layout=, ?photo=, ?caption=, ?size=WxH. Cover mode hides every control
// and paints only the cover full-frame; editor mode shows the whole
// editor with a sample photo loaded. When the scene is ready it sets
// window.__shotReady so a headless screenshot knows when to shoot.

import { drawCover } from './cover.js';
import { buildLayout } from './layouts.js';

function params() {
  return new URLSearchParams(window.location.search);
}

function sampleId(store, name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  const found = store.photos.find((p) => p.name.toLowerCase().includes(lower));
  return found ? found.id : null;
}

// Apply the URL scene to the editor state and return the shot kind.
export function applyShotParams(state, store) {
  const q = params();
  const shot = q.get('shot') || '';
  const caption = q.get('caption');
  if (caption) state.title = caption;
  const layout = q.get('layout');
  if (layout) state.layout = layout;
  const photoName = q.get('photo');
  if (photoName) {
    const id = sampleId(store, photoName);
    if (id) {
      // Fill every slot with the chosen photo, each at a different crop,
      // so one photo still makes a varied multi-panel cover.
      const { panels } = buildLayout(state.layout, 1080, 1080);
      const cols = Math.max(1, Math.ceil(Math.sqrt(panels.length)));
      state.panels = panels.map((_, i) => {
        const cx = cols > 1 ? (i % cols) / (cols - 1) - 0.5 : 0;
        const cy = cols > 1 ? (Math.floor(i / cols) % cols) / (cols - 1) - 0.5 : 0;
        return { photoId: id, zoom: 1.7, dx: cx * 0.55, dy: cy * 0.55 };
      });
    }
  }
  return shot;
}

function markReady() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

// Cover scene: hide the editor chrome, draw the cover over the window.
// Draw immediately (falling back to system fonts if the vendored ones are
// not ready yet), then redraw once the fonts arrive, so the canvas is
// never left blank if a font load stalls.
export async function runCoverShot(state, store) {
  document.body.classList.add('shot-cover');
  const canvas = document.getElementById('preview');
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  const ctx = canvas.getContext('2d');
  drawCover(ctx, W, H, state, store);
  const fontsReady = (async () => {
    try {
      await Promise.race([
        (async () => {
          await document.fonts.load('400 100px Anton');
          await document.fonts.load('400 60px Pacifico');
          await document.fonts.ready;
        })(),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch {
      // Fall back to the first draw rather than failing the shot.
    }
  })();
  await fontsReady;
  drawCover(ctx, W, H, state, store);
  markReady();
}

// Editor scene: show the editor; the preview already renders the cover.
export async function runEditorShot() {
  try {
    await document.fonts.ready;
  } catch {
    // Ignore font loading failures in the editor scene.
  }
  markReady();
}
