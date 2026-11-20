// Vice After Dark — the painted Vice City sky.
// Drawn procedurally on an offscreen canvas so the grain and halftone live on
// the sky only and never touch a face. Deterministic: the same look and size
// always paint the same sky (a tiny seeded generator, no Math.random).

/** A small deterministic generator: same seed, same skyline every time. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Paint the sunset sky for a look across a w-by-h rectangle. */
export function drawSky(ctx, w, h, look) {
  const rand = seeded(20261120);
  // Sky: warm top, hot middle, deep bottom.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, look.skyTop);
  sky.addColorStop(0.45, look.skyMid);
  sky.addColorStop(1, look.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Low sun with a warm halo, sliced by thin sky-coloured slats low down.
  const sunX = w * 0.68;
  const sunY = h * 0.6;
  const sunR = h * 0.26;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.6);
  halo.addColorStop(0, look.sun);
  halo.addColorStop(0.45, look.sun + '55');
  halo.addColorStop(1, look.sun + '00');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = look.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.skyMid;
  for (let i = 0; i < 4; i++) {
    const sy = sunY + sunR * (0.15 + i * 0.2);
    ctx.fillRect(sunX - sunR, sy, sunR * 2, sunR * 0.05);
  }

  // Two skyline layers: a hazy far row, then a near row with lit windows.
  drawSkyline(ctx, w, h, rand, look.skyBottom, 0.62, 0.16, false, look);
  drawSkyline(ctx, w, h, rand, '#14081f', 0.74, 0.22, true, look);

  // Palm silhouettes leaning in from the edges.
  drawPalm(ctx, w * 0.04, h * 0.98, h * 0.34, -0.25, '#14081f');
  drawPalm(ctx, w * 0.97, h * 0.98, h * 0.28, 0.3, '#14081f');
  drawPalm(ctx, w * 0.9, h * 0.98, h * 0.2, 0.12, '#1c0b28');

  // Birds: a few small chevrons high in the sky.
  ctx.strokeStyle = '#14081f';
  ctx.lineWidth = Math.max(2, h * 0.004);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const bx = w * (0.12 + i * 0.13 + rand() * 0.04);
    const by = h * (0.1 + rand() * 0.12);
    const bs = h * 0.012;
    ctx.beginPath();
    ctx.moveTo(bx - bs, by);
    ctx.quadraticCurveTo(bx, by - bs, bx, by);
    ctx.quadraticCurveTo(bx, by - bs, bx + bs, by);
    ctx.stroke();
  }

  // Water reflection strip along the bottom: dark water, sun-coloured shimmer.
  const waterH = h * 0.09;
  const water = ctx.createLinearGradient(0, h - waterH, 0, h);
  water.addColorStop(0, look.skyBottom);
  water.addColorStop(1, '#0a0512');
  ctx.fillStyle = water;
  ctx.fillRect(0, h - waterH, w, waterH);
  for (let i = 0; i < 46; i++) {
    const wy = h - waterH + rand() * waterH;
    const ww = w * (0.02 + rand() * 0.09);
    const wx = rand() * w;
    ctx.fillStyle = rand() > 0.5 ? look.sun + 'aa' : look.accent + '66';
    ctx.fillRect(wx, wy, ww, Math.max(1.5, h * 0.003));
  }

  // Light halftone dots across the upper sky only.
  ctx.fillStyle = look.accent + '22';
  const step = Math.max(10, h * 0.028);
  for (let gy = step / 2; gy < h * 0.42; gy += step) {
    for (let gx = step / 2; gx < w; gx += step) {
      const r = (1 - gy / (h * 0.42)) * step * 0.16 + 0.6;
      ctx.beginPath();
      ctx.arc(gx + ((gy / step) % 2) * step * 0.5, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Film grain, sky only: faint speckles from the same seeded stream.
  for (let i = 0; i < w * h * 0.00012; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.8;
    ctx.fillStyle = rand() > 0.5 ? '#ffffff14' : '#0000001f';
    ctx.fillRect(gx, gy, Math.max(1, w * 0.0012), Math.max(1, w * 0.0012));
  }
}

function drawSkyline(ctx, w, h, rand, colour, baseY, maxH, windows, look) {
  ctx.fillStyle = colour;
  let x = -w * 0.02;
  const base = h * baseY;
  while (x < w * 1.02) {
    const bw = w * (0.04 + rand() * 0.07);
    const bh = h * (0.05 + rand() * maxH);
    ctx.fillRect(x, base - bh, bw, bh + h);
    if (rand() > 0.6) {
      // A rooftop aerial or spire on some buildings.
      ctx.fillRect(x + bw * 0.45, base - bh - h * 0.05, w * 0.004, h * 0.05);
    }
    if (windows) {
      for (let wy = base - bh + h * 0.02; wy < base - h * 0.01; wy += h * 0.035) {
        for (let wx = x + w * 0.008; wx < x + bw - w * 0.008; wx += w * 0.016) {
          if (rand() > 0.72) {
            ctx.fillStyle = look.accent + 'cc';
            ctx.fillRect(wx, wy, w * 0.006, h * 0.014);
            ctx.fillStyle = colour;
          }
        }
      }
    }
    x += bw + w * 0.008;
  }
}

function drawPalm(ctx, x, y, size, lean, colour) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.lineCap = 'round';
  const topX = x + size * lean;
  const topY = y - size;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + size * lean * 0.4, y - size * 0.55, topX, topY);
  ctx.stroke();
  // Fronds: arcs fanning out from the crown.
  ctx.lineWidth = Math.max(2, size * 0.03);
  for (let i = 0; i < 7; i++) {
    const a = (-0.15 - i * 0.22) * Math.PI + (lean > 0 ? 0.15 : -0.15);
    const fx = topX + Math.cos(a) * size * 0.42;
    const fy = topY + Math.sin(a) * size * 0.42 + size * 0.22;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * size * 0.28, topY + Math.sin(a) * size * 0.2, fx, fy);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(topX + size * 0.03, topY + size * 0.04, size * 0.035, 0, Math.PI * 2);
  ctx.arc(topX - size * 0.04, topY + size * 0.05, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
}
