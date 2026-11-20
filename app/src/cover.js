// Vice After Dark — the cover renderer: panels, wordmark, seal and badges.
// Draws into any 2D context at any export size; the editor preview and the PNG
// export both call drawCover with the same state.
import { coverPanels, coverFit, fitCaption, wordmarkSize } from './geometry.js';
import { drawSky } from './sky.js';

/** Move every corner of a polygon toward its centre by `inset` pixels. */
export function insetPolygon(points, inset) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x - (dx / d) * inset, y - (dy / d) * inset];
  });
}

function pathPolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function bboxOf(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Split a caption into at most two balanced lines for the stacked wordmark. */
export function splitCaption(caption) {
  const words = caption.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  let best = [words.join(' ')];
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const score = Math.abs(a.length - b.length);
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
}

/**
 * Draw the whole cover. state: { look, layout, caption, kicker, billing1,
 * billing2, panels: [{ img, fx, fy, zoom, panX, panY, label }] } — img is an
 * HTMLImageElement or null, label the name shown when a panel has no photo.
 */
export function drawCover(ctx, W, H, state, look) {
  const bandH = Math.round(H * 0.22);
  const photoH = H - bandH;
  const gap = Math.max(4, W * 0.014);

  // 1. Painted sky on its own layer, so grain and halftone stay off the skin.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = W;
  skyCanvas.height = photoH;
  drawSky(skyCanvas.getContext('2d'), W, photoH, look);
  ctx.drawImage(skyCanvas, 0, 0);

  // 2. Diagonal photo panels, clipped, with a warm GTA-style grade.
  // The panels sit inside a frame of painted sky (see coverPanels).
  const panels = coverPanels(state.layout, W, photoH);
  panels.forEach((panelDef, i) => {
    const panelState = state.panels[i] || {};
    const pts = insetPolygon(panelDef.points, gap);
    const box = bboxOf(pts);
    ctx.save();
    pathPolygon(ctx, pts);
    ctx.clip();
    if (panelState.img) {
      const img = panelState.img;
      const src = coverFit(
        { w: img.naturalWidth, h: img.naturalHeight },
        box.w, box.h,
        { fx: panelState.fx ?? 0.5, fy: panelState.fy ?? 0.35, zoom: panelState.zoom ?? 1, panX: panelState.panX ?? 0, panY: panelState.panY ?? 0 },
      );
      ctx.filter = 'saturate(1.15) contrast(1.06)';
      ctx.drawImage(img, src.x, src.y, src.w, src.h, box.x, box.y, box.w, box.h);
      ctx.filter = 'none';
    } else {
      const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      g.addColorStop(0, look.skyMid);
      g.addColorStop(1, look.band);
      ctx.fillStyle = g;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = look.ink;
      ctx.font = `700 ${Math.max(14, box.w * 0.07)}px "PT Sans Narrow", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', box.x + box.w / 2, box.y + box.h / 2);
    }
    ctx.restore();
    // Crisp ink edge around each panel.
    ctx.save();
    pathPolygon(ctx, pts);
    ctx.strokeStyle = look.ink;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.stroke();
    ctx.restore();
  });

  // 3. Starburst badge, top right of the photo area.
  drawStarburst(ctx, W * 0.93, photoH * 0.09, W * 0.052, look);

  // 4. Caption band.
  const bandTop = photoH;
  const bandGrad = ctx.createLinearGradient(0, bandTop, W, bandTop + bandH);
  bandGrad.addColorStop(0, look.band);
  bandGrad.addColorStop(1, '#00000055');
  ctx.fillStyle = look.band;
  ctx.fillRect(0, bandTop, W, bandH);
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, bandTop, W, bandH);
  ctx.fillStyle = look.accent;
  ctx.fillRect(0, bandTop, W, Math.max(3, H * 0.004));

  const margin = W * 0.055;
  const textW = W * 0.78 - margin;
  // Kicker above the wordmark.
  ctx.fillStyle = look.accent;
  ctx.font = `700 ${Math.round(bandH * 0.11)}px "PT Sans Narrow", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${Math.round(bandH * 0.02)}px`; } catch { /* older canvas */ }
  ctx.fillText((state.kicker || '').toUpperCase(), margin, bandTop + bandH * 0.17);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }

  // Stacked wordmark: thick outline, warm gradient fill, hard offset shadow.
  const lines = splitCaption(state.caption || 'VICE CITY');
  const measure = (text, size) => {
    ctx.font = `900 ${size}px Rokkitt, serif`;
    return ctx.measureText(text).width;
  };
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  const startSize = wordmarkSize(lines.length, bandH, textW, Math.round(bandH * 0.44));
  const size = fitCaption(longest, textW, startSize, 24, measure);
  const lineH = size * 0.94;
  const blockTop = bandTop + bandH * 0.2;
  lines.forEach((line, li) => {
    const baseline = blockTop + size * 0.82 + li * lineH;
    ctx.font = `900 ${size}px Rokkitt, serif`;
    // Hard offset shadow.
    ctx.fillStyle = '#00000088';
    ctx.fillText(line, margin + size * 0.05, baseline + size * 0.05);
    // Gradient fill.
    const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.2);
    fill.addColorStop(0, look.sun);
    fill.addColorStop(0.55, look.accent);
    fill.addColorStop(1, look.ink);
    ctx.fillStyle = fill;
    ctx.fillText(line, margin, baseline);
    // Thick outline on top.
    ctx.strokeStyle = look.band;
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.lineJoin = 'round';
    ctx.strokeText(line, margin, baseline);
  });

  // Billing block, two lines at the bottom left.
  ctx.fillStyle = look.ink;
  ctx.globalAlpha = 0.85;
  ctx.font = `700 ${Math.round(bandH * 0.085)}px "PT Sans Narrow", sans-serif`;
  ctx.fillText((state.billing1 || '').toUpperCase(), margin, bandTop + bandH * 0.88);
  ctx.globalAlpha = 0.65;
  ctx.fillText((state.billing2 || '').toUpperCase(), margin, bandTop + bandH * 0.97);
  ctx.globalAlpha = 1;

  // Roman-numeral VI badge, right of the wordmark.
  const viX = W * 0.875;
  const viY = bandTop + bandH * 0.36;
  const viR = bandH * 0.27;
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = Math.max(2, viR * 0.08);
  ctx.beginPath();
  ctx.arc(viX, viY, viR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, viR * 0.03);
  ctx.beginPath();
  ctx.arc(viX, viY, viR * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = look.ink;
  ctx.font = `900 ${Math.round(viR * 0.95)}px Rokkitt, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VI', viX, viY + viR * 0.04);

  // Round seal, bottom right of the band.
  drawSeal(ctx, W * 0.875, bandTop + bandH * 0.8, bandH * 0.17, look);
}

/** Twelve-point starburst with two short lines of text inside. */
export function drawStarburst(ctx, cx, cy, r, look) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.72;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = look.accent;
  ctx.fill();
  ctx.strokeStyle = look.band;
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.stroke();
  ctx.fillStyle = look.band;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(r * 0.42)}px Rokkitt, serif`;
  ctx.fillText('NEW', 0, -r * 0.16);
  ctx.font = `700 ${Math.round(r * 0.34)}px "PT Sans Narrow", sans-serif`;
  ctx.fillText('2026', 0, r * 0.26);
  ctx.restore();
}

/** Round seal: ringed text "LEONIDA · EST. 2026 ·" around a star. */
export function drawSeal(ctx, cx, cy, r, look) {
  ctx.save();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  const label = 'LEONIDA · EST. 2026 · ';
  ctx.fillStyle = look.ink;
  ctx.font = `700 ${Math.max(9, r * 0.22)}px "PT Sans Narrow", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < label.length; i++) {
    const a = (i / label.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r * 0.89, cy + Math.sin(a) * r * 0.89);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(label[i], 0, 0);
    ctx.restore();
  }
  ctx.font = `900 ${Math.round(r * 0.7)}px Rokkitt, serif`;
  ctx.fillText('★', cx, cy + r * 0.03);
  ctx.restore();
}

/** Render a cover into a fresh canvas at the given export size. */
export function renderCoverCanvas(size, state, look) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state, look);
  return canvas;
}
