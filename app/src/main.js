// Vice After Dark — the editor: scenes, looks, layouts, photos, caption,
// face-safe framing (drag, keyboard nudge, zoom) and PNG export.
// A `?shot=` query renders a fixed scene for screenshots instead (./shots.js).
import {
  LAYOUTS, LOOKS, EXPORT_SIZES, SAMPLE_PHOTOS, SCENES,
  layoutPanels, coverPanels,
} from './geometry.js';
import { drawCover, renderCoverCanvas } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const imageCache = new Map();

function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  imageCache.set(url, p);
  return p;
}

async function sampleImage(id) {
  return loadImage(`samples/${id}.jpg`);
}

// --- State -----------------------------------------------------------------
const state = {
  look: 'sunset',
  layout: 'diagonal-hero',
  caption: 'VICE CITY',
  kicker: 'WELCOME TO',
  billing1: 'VICE AFTER DARK PRESENTS',
  billing2: 'STARRING DUKE · MARINA · LUNA · VIC · ROSA',
  size: EXPORT_SIZES[0],
  panels: [],
  selected: 0,
};

/** The face anchor a sample photo ships with, so its face lands in frame. */
function photoFocus(photoId) {
  const photo = SAMPLE_PHOTOS.find((s) => s.id === photoId);
  return photo ? { fx: photo.fx, fy: photo.fy } : { fx: 0.5, fy: 0.42 };
}

function panelCount() {
  return layoutPanels(state.layout, 1080, 840).length;
}

/** Grow or shrink the panel list to the layout, filling new panels with photos. */
function ensurePanels() {
  const want = panelCount();
  while (state.panels.length < want) {
    const i = state.panels.length;
    const photo = SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length];
    state.panels.push({
      photoId: photo.id, img: null, customName: '',
      fx: photo.fx, fy: photo.fy, zoom: 1, panX: 0, panY: 0,
    });
  }
  state.panels.length = want;
  if (state.selected >= want) state.selected = 0;
}

async function resolvePanelImages() {
  await Promise.all(state.panels.map(async (p) => {
    if (!p.img && p.photoId) p.img = await sampleImage(p.photoId);
  }));
}

function look() {
  return LOOKS[state.look];
}

function renderState() {
  return {
    layout: state.layout,
    caption: state.caption,
    kicker: state.kicker,
    billing1: state.billing1,
    billing2: state.billing2,
    panels: state.panels,
  };
}

function redraw() {
  canvas.width = state.size.w;
  canvas.height = state.size.h;
  canvas.style.setProperty('--cover-aspect', String(state.size.w / state.size.h));
  drawCover(ctx, state.size.w, state.size.h, renderState(), look());
  drawSelection();
  updatePanelReadout();
}

/** Accent outline around the selected panel, plus its focus-point handle. */
function drawSelection() {
  if (document.body.classList.contains('shot-cover')) return;
  const panels = coverPanels(state.layout, canvas.width, canvas.height - Math.round(canvas.height * 0.22));
  const pts = panels[state.selected].points;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.strokeStyle = look().accent;
  ctx.lineWidth = Math.max(4, canvas.width * 0.006);
  ctx.setLineDash([18, 10]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Focus handle: where the face is anchored inside the panel.
  const p = state.panels[state.selected];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const fx = Math.min(...xs) + p.fx * (Math.max(...xs) - Math.min(...xs));
  const fy = Math.min(...ys) + p.fy * (Math.max(...ys) - Math.min(...ys));
  ctx.fillStyle = look().accent;
  ctx.beginPath();
  ctx.arc(fx, fy, Math.max(8, canvas.width * 0.012), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function updatePanelReadout() {
  const p = state.panels[state.selected];
  const name = p.customName || (SAMPLE_PHOTOS.find((s) => s.id === p.photoId)?.name ?? '—');
  document.getElementById('panel-readout').textContent =
    `Panel ${state.selected + 1} of ${state.panels.length} — ${name} · zoom ${p.zoom.toFixed(1)}×`;
  document.getElementById('zoom').value = String(p.zoom);
  document.getElementById('zoom-value').textContent = `${p.zoom.toFixed(1)}×`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

// --- Controls ---------------------------------------------------------------
function radioGroup(containerId, items, current, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  items.forEach((item) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = containerId;
    input.value = item.id;
    input.checked = item.id === current;
    input.addEventListener('change', () => onPick(item.id));
    const span = document.createElement('span');
    span.textContent = item.name ?? item.label;
    if (item.blurb) span.title = item.blurb;
    label.append(input, span);
    box.append(label);
  });
}

function buildControls() {
  radioGroup('looks', Object.entries(LOOKS).map(([id, l]) => ({ id, name: l.name })), state.look, async (id) => {
    state.look = id;
    syncSwatches();
    redraw();
  });
  radioGroup('layouts', LAYOUTS, state.layout, async (id) => {
    state.layout = id;
    ensurePanels();
    await resolvePanelImages();
    redraw();
  });
  radioGroup('sizes', EXPORT_SIZES, state.size.id, (id) => {
    state.size = EXPORT_SIZES.find((s) => s.id === id);
    redraw();
  });

  const scenesBox = document.getElementById('scenes');
  scenesBox.innerHTML = '';
  SCENES.forEach((scene) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'scene-btn';
    b.textContent = scene.name;
    b.addEventListener('click', () => applyScene(scene));
    scenesBox.append(b);
  });

  const samplesBox = document.getElementById('samples');
  samplesBox.innerHTML = '';
  SAMPLE_PHOTOS.forEach((photo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sample-btn';
    const img = document.createElement('img');
    img.src = `samples/${photo.id}.jpg`;
    img.alt = `${photo.name} sample photo`;
    const span = document.createElement('span');
    span.textContent = photo.name;
    b.append(img, span);
    b.title = photo.blurb;
    b.addEventListener('click', () => setPanelPhoto(state.selected, photo.id));
    samplesBox.append(b);
  });
}

function syncSwatches() {
  const l = look();
  document.querySelectorAll('#looks .choice').forEach((el, i) => {
    const id = Object.keys(LOOKS)[i];
    el.style.setProperty('--swatch', LOOKS[id].accent);
  });
  document.documentElement.style.setProperty('--accent', l.accent);
}

async function applyScene(scene) {
  state.look = scene.look;
  state.layout = scene.layout;
  state.caption = scene.caption;
  state.kicker = scene.kicker;
  document.getElementById('caption').value = scene.caption;
  document.getElementById('kicker').value = scene.kicker;
  ensurePanels();
  state.panels.forEach((p, i) => {
    p.photoId = i === 0 ? scene.photo : SAMPLE_PHOTOS[(i + 1) % SAMPLE_PHOTOS.length].id;
    p.img = null;
    p.customName = '';
    const focus = photoFocus(p.photoId);
    p.fx = focus.fx;
    p.fy = focus.fy;
    p.zoom = 1;
    p.panX = 0;
    p.panY = 0;
  });
  buildControls();
  syncSwatches();
  await resolvePanelImages();
  redraw();
  setStatus(`Scene “${scene.name}” loaded — ${LOOKS[scene.look].name} look, ${scene.layout}.`);
}

async function setPanelPhoto(index, photoId) {
  const p = state.panels[index];
  p.photoId = photoId;
  p.customName = '';
  p.img = await sampleImage(photoId);
  const focus = photoFocus(photoId);
  p.fx = focus.fx;
  p.fy = focus.fy;
  p.zoom = 1;
  p.panX = 0;
  p.panY = 0;
  redraw();
  setStatus(`Panel ${index + 1} now shows ${SAMPLE_PHOTOS.find((s) => s.id === photoId).name}.`);
}

function setAllPanelsPhoto(photoId) {
  state.panels.forEach(async (p, i) => {
    p.photoId = photoId;
    p.customName = '';
    p.img = await sampleImage(photoId);
  });
  resolvePanelImages().then(() => {
    redraw();
    setStatus(`One photo in every panel: ${SAMPLE_PHOTOS.find((s) => s.id === photoId).name}.`);
  });
}

// --- Canvas interaction: click to select, drag to pan, shift-click to focus --
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hitPanel(pt) {
  const photoH = canvas.height - Math.round(canvas.height * 0.22);
  const panels = coverPanels(state.layout, canvas.width, photoH);
  for (let i = 0; i < panels.length; i++) {
    if (pointInPolygon(pt.x, pt.y, panels[i].points)) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const hit = hitPanel(pt);
  if (hit < 0) return;
  state.selected = hit;
  if (e.shiftKey) {
    // Shift-click moves the face anchor to the clicked spot.
    const p = state.panels[hit];
    const photoH = canvas.height - Math.round(canvas.height * 0.22);
    const panels = coverPanels(state.layout, canvas.width, photoH);
    const pts = panels[hit].points;
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const box = {
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
    };
    if (p.img) {
      const srcW = p.img.naturalWidth;
      const srcH = p.img.naturalHeight;
      const panelAspect = box.w / box.h;
      const imgAspect = srcW / srcH;
      let sw;
      let sh;
      if (imgAspect > panelAspect) { sh = srcH; sw = srcH * panelAspect; } else { sw = srcW; sh = srcW / panelAspect; }
      sw /= Math.max(1, p.zoom);
      sh /= Math.max(1, p.zoom);
      const imgX = ((pt.x - box.x) / box.w) * sw + (p.fx * srcW - sw / 2 + p.panX * sw);
      const imgY = ((pt.y - box.y) / box.h) * sh + (p.fy * srcH - sh / 2 + p.panY * sh);
      p.fx = Math.min(0.98, Math.max(0.02, imgX / srcW));
      p.fy = Math.min(0.98, Math.max(0.02, imgY / srcH));
      p.panX = 0;
      p.panY = 0;
    }
    redraw();
    setStatus(`Focus moved in panel ${hit + 1}.`);
    return;
  }
  drag = { last: pt, panel: hit };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const p = state.panels[drag.panel];
  const photoH = canvas.height - Math.round(canvas.height * 0.22);
  const panels = coverPanels(state.layout, canvas.width, photoH);
  const pts = panels[drag.panel].points;
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  p.panX = Math.max(-0.5, Math.min(0.5, p.panX - (pt.x - drag.last.x) / bw));
  p.panY = Math.max(-0.5, Math.min(0.5, p.panY - (pt.y - drag.last.y) / bh));
  drag.last = pt;
  redraw();
});

canvas.addEventListener('pointerup', () => { drag = null; });

canvas.addEventListener('keydown', (e) => {
  const p = state.panels[state.selected];
  const step = e.shiftKey ? 0.05 : 0.01;
  if (e.key === 'ArrowLeft') { p.panX = Math.max(-0.5, p.panX - step); }
  else if (e.key === 'ArrowRight') { p.panX = Math.min(0.5, p.panX + step); }
  else if (e.key === 'ArrowUp') { p.panY = Math.max(-0.5, p.panY - step); }
  else if (e.key === 'ArrowDown') { p.panY = Math.min(0.5, p.panY + step); }
  else if (e.key === '+' || e.key === '=') { p.zoom = Math.min(3, +(p.zoom + 0.1).toFixed(2)); }
  else if (e.key === '-') { p.zoom = Math.max(1, +(p.zoom - 0.1).toFixed(2)); }
  else if (/^[1-9]$/.test(e.key) && Number(e.key) <= state.panels.length) {
    state.selected = Number(e.key) - 1;
  } else return;
  e.preventDefault();
  redraw();
});

// --- Wiring -----------------------------------------------------------------
document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value.toUpperCase();
  redraw();
});
document.getElementById('kicker').addEventListener('input', (e) => {
  state.kicker = e.target.value.toUpperCase();
  redraw();
});
document.getElementById('billing1').addEventListener('input', (e) => {
  state.billing1 = e.target.value;
  redraw();
});
document.getElementById('billing2').addEventListener('input', (e) => {
  state.billing2 = e.target.value;
  redraw();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('use-everywhere').addEventListener('click', () => {
  setAllPanelsPhoto(state.panels[state.selected].photoId);
});
document.getElementById('reset-framing').addEventListener('click', () => {
  const p = state.panels[state.selected];
  const focus = photoFocus(p.photoId);
  p.fx = focus.fx; p.fy = focus.fy; p.zoom = 1; p.panX = 0; p.panY = 0;
  redraw();
  setStatus(`Framing reset on panel ${state.selected + 1}.`);
});
document.getElementById('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  const p = state.panels[state.selected];
  p.img = img;
  p.photoId = '';
  p.customName = file.name.replace(/\.[^.]+$/, '');
  p.fx = 0.5; p.fy = 0.42; p.zoom = 1; p.panX = 0; p.panY = 0;
  redraw();
  setStatus(`Your photo is in panel ${state.selected + 1}. It never leaves this machine.`);
});
document.getElementById('export').addEventListener('click', () => {
  const out = renderCoverCanvas(state.size, renderState(), look());
  out.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — try again.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-after-dark-${state.size.w}x${state.size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-after-dark-${state.size.w}x${state.size.h}.png`);
  }, 'image/png');
});

// --- Shot mode ---------------------------------------------------------------
const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  runShot(location.search, {
    applyShot: async (shot, scene) => {
      if (scene) {
        state.look = scene.look;
        state.layout = scene.layout;
        state.caption = scene.caption;
        state.kicker = scene.kicker;
      } else {
        state.look = shot.look;
        state.layout = shot.layout;
        state.caption = shot.caption;
        state.kicker = shot.kicker;
      }
      state.size = shot.size;
      ensurePanels();
      state.panels[0].photoId = shot.photo;
      state.panels[0].img = null;
      buildControls();
      syncSwatches();
      await resolvePanelImages();
      redraw();
    },
    whenReady: async () => {
      await document.fonts.ready;
      redraw();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
  });
} else {
  ensurePanels();
  buildControls();
  syncSwatches();
  document.fonts.ready.then(async () => {
    await resolvePanelImages();
    redraw();
  });
  resolvePanelImages().then(redraw);
}
