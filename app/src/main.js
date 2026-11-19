// main.js — the wiring of Neon Coast Cover Studio.
//
// Owns the editor state, the undo/redo history (JSON snapshots of the
// state), every UI event, and the PNG export. The preview canvas and the
// exported PNG are painted by the same drawCover in cover.js, so what the
// user sees is exactly what they download.

import { PhotoStore } from './photos.js';
import { drawCover, renderCoverCanvas } from './cover.js';
import { LAYOUTS, buildLayout } from './layouts.js';
import { GRADES } from './grades.js';
import { applyShotParams, runCoverShot, runEditorShot } from './shots.js';

export const EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080', '1080x1920'];

const DEFAULT_STATE = {
  layout: 'nine',
  grade: 'sunset-vice',
  gradeStrength: 1,
  title: 'Neon Coast',
  subtitle: 'A Neon Coast story',
  titlePos: 'bottom',
  titleSize: 1,
  grain: true,
  vignette: true,
  size: '1080x1080',
  panels: [],
};

const store = new PhotoStore();
let state = structuredClone(DEFAULT_STATE);
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];
let samplesReady = false;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const statusEl = $('status');

function setStatus(text) {
  statusEl.textContent = text;
}

function snapshot() {
  return JSON.stringify(state);
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function applySnapshot(json) {
  state = JSON.parse(json);
  syncControls();
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  updateUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  $('undoBtn').disabled = undoStack.length === 0;
  $('redoBtn').disabled = redoStack.length === 0;
}

// Keep one panel entry per layout slot, preserving the user's crop.
function ensurePanels() {
  const { panels } = buildLayout(state.layout, 1080, 1080);
  const next = [];
  for (let i = 0; i < panels.length; i++) {
    next.push(state.panels[i] || { photoId: null, zoom: 1, dx: 0, dy: 0 });
  }
  state.panels = next;
  selectedPanel = Math.min(selectedPanel, next.length - 1);
}

function render() {
  ensurePanels();
  const W = preview.width;
  const H = preview.height;
  const ctx = preview.getContext('2d');
  drawCover(ctx, W, H, state, store);
  renderStrip();
  updatePanelControls();
}

function renderStrip() {
  const strip = $('strip');
  strip.innerHTML = '';
  store.photos.forEach((photo) => {
    const button = document.createElement('button');
    button.className = 'thumb';
    button.type = 'button';
    button.title = photo.name;
    const img = document.createElement('img');
    img.src = store.thumbnail(photo);
    img.alt = photo.name;
    button.appendChild(img);
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.appendChild(label);
    button.addEventListener('click', () => {
      pushHistory();
      ensurePanels();
      state.panels[selectedPanel] = {
        ...(state.panels[selectedPanel] || { zoom: 1, dx: 0, dy: 0 }),
        photoId: photo.id,
      };
      render();
      setStatus(`Panel ${selectedPanel + 1} now shows ${photo.name}.`);
    });
    strip.appendChild(button);
  });
}

function updatePanelControls() {
  const slot = state.panels[selectedPanel] || { zoom: 1 };
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  $('zoomSlider').value = String(slot.zoom ?? 1);
  $('zoomValue').textContent = `${Math.round((slot.zoom ?? 1) * 100)}%`;
}

// Panel picking: click the preview to select the panel under the cursor.
function panelAtPoint(clientX, clientY) {
  const rect = preview.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * preview.width;
  const y = ((clientY - rect.top) / rect.height) * preview.height;
  const { panels } = buildLayout(state.layout, preview.width, preview.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;

preview.addEventListener('pointerdown', (event) => {
  const index = panelAtPoint(event.clientX, event.clientY);
  if (index < 0) return;
  selectedPanel = index;
  const slot = state.panels[index];
  drag = {
    panel: index,
    startX: event.clientX,
    startY: event.clientY,
    dx: slot.dx ?? 0,
    dy: slot.dy ?? 0,
    moved: false,
  };
  preview.setPointerCapture(event.pointerId);
  render();
});

preview.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const rect = preview.getBoundingClientRect();
  const scaleX = preview.width / rect.width;
  const scaleY = preview.height / rect.height;
  const { panels } = buildLayout(state.layout, preview.width, preview.height);
  const p = panels[drag.panel];
  const ndx = drag.dx + ((event.clientX - drag.startX) * scaleX) / p.w;
  const ndy = drag.dy + ((event.clientY - drag.startY) * scaleY) / p.h;
  if (Math.abs(ndx - drag.dx) > 0.005 || Math.abs(ndy - drag.dy) > 0.005) drag.moved = true;
  state.panels[drag.panel] = {
    ...state.panels[drag.panel],
    dx: Math.max(-0.5, Math.min(0.5, ndx)),
    dy: Math.max(-0.5, Math.min(0.5, ndy)),
  };
  render();
});

preview.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushHistory();
  drag = null;
});

function exportPng(sizeLabel) {
  const [W, H] = sizeLabel.split('x').map(Number);
  const started = performance.now();
  const canvas = renderCoverCanvas(W, H, state, store);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG export failed'));
        return;
      }
      const ms = Math.round(performance.now() - started);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-coast-cover-${sizeLabel}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStatus(`Exported ${sizeLabel} PNG in ${ms} ms (${(blob.size / 1024).toFixed(0)} KB).`);
      resolve({ size: sizeLabel, ms, bytes: blob.size });
    }, 'image/png');
  });
}

async function exportAll() {
  setStatus('Exporting all four sizes…');
  const results = [];
  for (const size of EXPORT_SIZES) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await exportPng(size));
  }
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  setStatus(`Exported all four sizes in ${totalMs} ms total.`);
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleSize').value = String(state.titleSize);
  $('titlePos').value = state.titlePos;
  $('grainToggle').checked = state.grain;
  $('vignetteToggle').checked = state.vignette;
  $('gradeStrength').value = String(state.gradeStrength);
}

function buildToolbar() {
  const layoutBar = $('layoutBar');
  for (const [id, def] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = id;
    b.textContent = def.label;
    b.title = def.describe;
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = id;
      selectedPanel = 0;
      syncControls();
      render();
    });
    layoutBar.appendChild(b);
  }
  const gradeBar = $('gradeBar');
  for (const [id, def] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = id;
    b.textContent = def.label;
    b.title = def.describe;
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = id;
      syncControls();
      render();
    });
    gradeBar.appendChild(b);
  }
  const sizeBar = $('sizeBar');
  for (const size of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.size = size;
    b.textContent = size;
    b.addEventListener('click', () => {
      pushHistory();
      state.size = size;
      syncControls();
      render();
    });
    sizeBar.appendChild(b);
  }
}

function bindControls() {
  $('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    render();
  });
  $('titleInput').addEventListener('change', pushHistory);
  $('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    render();
  });
  $('subtitleInput').addEventListener('change', pushHistory);
  $('titleSize').addEventListener('input', (e) => {
    state.titleSize = Number(e.target.value);
    render();
  });
  $('titleSize').addEventListener('change', pushHistory);
  $('titlePos').addEventListener('change', (e) => {
    pushHistory();
    state.titlePos = e.target.value;
    render();
  });
  $('gradeStrength').addEventListener('input', (e) => {
    state.gradeStrength = Number(e.target.value);
    render();
  });
  $('gradeStrength').addEventListener('change', pushHistory);
  $('grainToggle').addEventListener('change', (e) => {
    pushHistory();
    state.grain = e.target.checked;
    render();
  });
  $('vignetteToggle').addEventListener('change', (e) => {
    pushHistory();
    state.vignette = e.target.checked;
    render();
  });
  $('zoomSlider').addEventListener('input', (e) => {
    ensurePanels();
    state.panels[selectedPanel] = {
      ...state.panels[selectedPanel],
      zoom: Number(e.target.value),
    };
    render();
  });
  $('zoomSlider').addEventListener('change', pushHistory);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('exportBtn').addEventListener('click', () => exportPng(state.size).catch((err) => setStatus(err.message)));
  $('exportAllBtn').addEventListener('click', () => exportAll().catch((err) => setStatus(err.message)));
  $('resetBtn').addEventListener('click', () => {
    pushHistory();
    state = structuredClone(DEFAULT_STATE);
    selectedPanel = 0;
    syncControls();
    render();
    setStatus('Reset to the default cover.');
  });

  const fileInput = $('fileInput');
  $('addPhotosBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    try {
      const added = await store.loadFiles(files);
      setStatus(`Added ${added.length} photo(s). Click a panel, then a photo to place it.`);
      render();
    } catch (err) {
      setStatus(err.message);
    }
    fileInput.value = '';
  });

  const dropzone = $('dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    try {
      const added = await store.loadFiles(e.dataTransfer.files);
      setStatus(`Added ${added.length} photo(s).`);
      render();
    } catch (err) {
      setStatus(err.message);
    }
  });
}

async function boot() {
  buildToolbar();
  bindControls();
  syncControls();
  updateUndoButtons();
  // Preview canvas: square by default, matches the 1080x1080 export.
  preview.width = 1080;
  preview.height = 1080;

  store.onChange(() => render());
  // First paint immediately (placeholders if the samples have not landed
  // yet), so the canvas is never blank while the photos load.
  render();
  try {
    await store.loadSamples();
    samplesReady = true;
  } catch (err) {
    setStatus(`Sample photos failed to load: ${err.message}`);
  }

  const shot = applyShotParams(state, store);
  syncControls();
  render();

  if (shot === 'cover') {
    await runCoverShot(state, store);
  } else if (shot === 'editor') {
    await runEditorShot();
    setStatus(
      samplesReady
        ? 'Two sample photos loaded. Add your own, pick a layout and grade, then Export PNG.'
        : 'Add photos to begin.',
    );
  } else {
    setStatus(
      samplesReady
        ? 'Two sample photos loaded. Add your own, pick a layout and grade, then Export PNG.'
        : 'Add photos to begin.',
    );
  }
}

boot();
