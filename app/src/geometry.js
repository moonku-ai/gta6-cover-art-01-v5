// Vice After Dark — pure cover geometry, looks, scenes and shot parsing.
// No DOM, no canvas: the editor and the renderer both import these helpers, and
// the node test suite exercises them directly.

export const LAYOUTS = [
  { id: 'diagonal-hero', name: 'Diagonal hero', blurb: 'One big diagonal hero panel, three slices beside it.' },
  { id: 'split-diagonals', name: 'Split diagonals', blurb: 'Two big diagonal halves, the right one split in three.' },
  { id: 'diagonal-stripes', name: 'Diagonal stripes', blurb: 'Four diagonal stripes sweeping across the cover.' },
  { id: 'diagonal-grid', name: 'Diagonal-cut grid', blurb: 'A four-panel grid whose cuts run on the diagonal.' },
];

export const LOOKS = {
  sunset: {
    name: 'Sunset', skyTop: '#ff9a3c', skyMid: '#ff5e7a', skyBottom: '#7a2d8f',
    sun: '#ffd166', band: '#1b0f2e', ink: '#fff3e0', accent: '#ffb703',
  },
  'neon-nights': {
    name: 'Neon Nights', skyTop: '#12002e', skyMid: '#7b2ff7', skyBottom: '#00e5ff',
    sun: '#ff2fb3', band: '#0a0018', ink: '#eafcff', accent: '#00e5ff',
  },
  'vice-noir': {
    name: 'Vice Noir', skyTop: '#04141a', skyMid: '#0b3d4a', skyBottom: '#062a33',
    sun: '#7ef0d4', band: '#02090b', ink: '#dff7f2', accent: '#2dd4bf',
  },
  'pastel-vice': {
    name: 'Pastel Vice', skyTop: '#ffd9c0', skyMid: '#ffb3c8', skyBottom: '#a8e6cf',
    sun: '#fff1a8', band: '#274156', ink: '#fff8f0', accent: '#ff8fa3',
  },
};

export const EXPORT_SIZES = [
  { id: 'square', w: 1080, h: 1080, label: '1080 × 1080' },
  { id: 'portrait', w: 1080, h: 1350, label: '1080 × 1350' },
  { id: 'wide', w: 1920, h: 1080, label: '1920 × 1080' },
];

// Sample photos live under app/samples/<id>.jpg; each scene pairs one with a look,
// a layout and a caption so one click builds a finished cover.
export const SAMPLE_PHOTOS = [
  { id: 'duke', name: 'Duke', blurb: 'Leather jacket, golden hour on the boulevard.', fx: 0.5, fy: 0.38 },
  { id: 'marina', name: 'Marina', blurb: 'Sunglasses and a neon-lit night out.', fx: 0.5, fy: 0.38 },
  { id: 'luna', name: 'Luna', blurb: 'Pastel light, palm shade, easy smile.', fx: 0.5, fy: 0.44 },
  { id: 'vic', name: 'Vic', blurb: 'Hood up, harbour haze, quiet stare.', fx: 0.5, fy: 0.46 },
  { id: 'rosa', name: 'Rosa', blurb: 'Red dress, convertible, sunset strip.', fx: 0.5, fy: 0.4 },
];

export const SCENES = [
  {
    id: 'sunset-heist', name: 'Sunset Heist', photo: 'duke', look: 'sunset',
    layout: 'diagonal-hero', caption: 'VICE CITY', kicker: 'WELCOME TO',
  },
  {
    id: 'neon', name: 'Neon Run', photo: 'marina', look: 'neon-nights',
    layout: 'split-diagonals', caption: 'NEON RUN', kicker: 'AFTER MIDNIGHT IN',
  },
  {
    id: 'palm-dreams', name: 'Palm Dreams', photo: 'luna', look: 'pastel-vice',
    layout: 'diagonal-stripes', caption: 'PALM DREAMS', kicker: 'SOMEWHERE IN',
  },
];

/** Shoelace area of a polygon given as [[x, y], ...]. */
export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function panel(role, points) {
  return { role, points };
}

function lineIntersection(a1, a2, b1, b2) {
  const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0]);
  const t = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d;
  return [a1[0] + t * (a2[0] - a1[0]), a1[1] + t * (a2[1] - a1[1])];
}

/**
 * Panel polygons for a layout inside a photo area of w by h.
 * Every layout tiles the whole area: the gaps the eye sees between panels are
 * strokes drawn over the joins, and the painted sky shows through nowhere else.
 * The first panel of diagonal-hero is the hero; other layouts mark theirs too.
 */
export function layoutPanels(layoutId, w, h) {
  const x = (f) => f * w;
  const y = (f) => f * h;
  switch (layoutId) {
    case 'diagonal-hero': {
      // Hero: a wide diagonal band, top edge longer than the bottom edge.
      const hero = panel('hero', [[0, 0], [x(0.62), 0], [x(0.38), h], [0, h]]);
      // The remaining trapezoid, split into three slices by two diagonal cuts.
      const slices = [0, 1, 2].map((i) => {
        const top = 0.62 - (0.24 * i) / 3;
        const bot = 0.62 - (0.24 * (i + 1)) / 3;
        return panel('slice', [
          [x(top), y(i / 3)], [w, y(i / 3)], [w, y((i + 1) / 3)], [x(bot), y((i + 1) / 3)],
        ]);
      });
      return [hero, ...slices];
    }
    case 'split-diagonals': {
      const hero = panel('hero', [[0, 0], [x(0.55), 0], [x(0.35), h], [0, h]]);
      // Right-hand trapezoid, cut into three stacked slices along the slant.
      const cuts = [0.36, 0.66];
      const edgeAt = (t) => x(0.55 - 0.2 * t);
      const top = panel('slice', [[x(0.55), 0], [w, 0], [w, y(cuts[0])], [edgeAt(cuts[0]), y(cuts[0])]]);
      const mid = panel('slice', [
        [edgeAt(cuts[0]), y(cuts[0])], [w, y(cuts[0])], [w, y(cuts[1])], [edgeAt(cuts[1]), y(cuts[1])],
      ]);
      const bot = panel('slice', [[edgeAt(cuts[1]), y(cuts[1])], [w, y(cuts[1])], [w, h], [x(0.35), h]]);
      return [hero, top, mid, bot];
    }
    case 'diagonal-stripes': {
      // Four bands whose dividers slant left as they run down the cover.
      const tops = [0, 0.25, 0.5, 0.75, 1];
      const bots = [-0, 0.1, 0.35, 0.6, 1];
      return tops.slice(0, 4).map((t, i) => panel(i === 3 ? 'hero' : 'stripe', [
        [x(tops[i]), 0], [x(tops[i + 1]), 0], [x(bots[i + 1]), h], [x(bots[i]), h],
      ]));
    }
    case 'diagonal-grid':
    default: {
      // A 2x2 grid whose vertical cut slants one way and horizontal cut the other.
      const centre = lineIntersection([x(0.52), 0], [x(0.44), h], [0, y(0.46)], [w, y(0.54)]);
      return [
        panel('hero', [[0, 0], [x(0.52), 0], centre, [0, y(0.46)]]),
        panel('cell', [[x(0.52), 0], [w, 0], [w, y(0.54)], centre]),
        panel('cell', [[0, y(0.46)], centre, [x(0.44), h], [0, h]]),
        panel('cell', [centre, [w, y(0.54)], [w, h], [x(0.44), h]]),
      ];
    }
  }
}

/**
 * Face-safe cover crop: the source rectangle of an image (img.w by img.h) that
 * fills a panel (panelW by panelH) while keeping the focus point (fx, fy, each
 * 0..1 across the image) visible. zoom > 1 tightens the crop; panX/panY shift
 * the window by a fraction of its own size. The result never leaves the image.
 */
export function coverFit(img, panelW, panelH, focus) {
  const { fx, fy, zoom = 1, panX = 0, panY = 0 } = focus;
  const panelAspect = panelW / panelH;
  const imgAspect = img.w / img.h;
  let srcW;
  let srcH;
  if (imgAspect > panelAspect) {
    srcH = img.h;
    srcW = img.h * panelAspect;
  } else {
    srcW = img.w;
    srcH = img.w / panelAspect;
  }
  const z = Math.max(1, zoom);
  srcW /= z;
  srcH /= z;
  let srcX = fx * img.w - srcW / 2 + panX * srcW;
  let srcY = fy * img.h - srcH / 2 + panY * srcH;
  srcX = Math.min(Math.max(srcX, 0), img.w - srcW);
  srcY = Math.min(Math.max(srcY, 0), img.h - srcH);
  return { x: srcX, y: srcY, w: srcW, h: srcH };
}

/**
 * Shrink the caption until measure(text, size) fits maxWidth, never below
 * minSize. measure is the caller's text-width function (canvas in the app,
 * a stub in tests).
 */
export function fitCaption(text, maxWidth, startSize, minSize, measure) {
  let size = startSize;
  while (size > minSize && measure(text, size) > maxWidth) size -= 1;
  return size;
}

/** Parse a shot query (?shot=cover&photo=...&caption=...&look=...&layout=...&scene=...&size=WxH). */
export function parseShot(queryString) {
  const q = new URLSearchParams(queryString.startsWith('?') ? queryString : `?${queryString}`);
  const shot = q.get('shot') === 'cover' ? 'cover' : 'editor';
  const lookId = q.get('look');
  const look = lookId && LOOKS[lookId] ? lookId : 'sunset';
  const layoutId = q.get('layout');
  const layout = layoutId && LAYOUTS.some((l) => l.id === layoutId) ? layoutId : 'diagonal-hero';
  const sceneId = q.get('scene');
  const scene = sceneId && SCENES.some((s) => s.id === sceneId) ? sceneId : null;
  const sizeText = q.get('size') ?? '';
  const sizeMatch = sizeText.match(/^(\d+)x(\d+)$/);
  const size = EXPORT_SIZES.find((s) => sizeMatch && s.w === Number(sizeMatch[1]) && s.h === Number(sizeMatch[2]))
    ?? EXPORT_SIZES[0];
  const photoId = q.get('photo');
  const photo = photoId && SAMPLE_PHOTOS.some((p) => p.id === photoId) ? photoId : 'duke';
  return {
    shot,
    photo,
    caption: q.get('caption') || 'VICE CITY',
    kicker: q.get('kicker') || 'WELCOME TO',
    look,
    layout,
    scene,
    size,
  };
}

/** How much of the cover edge stays painted sky around the panel block. */
export const FRAME_FRACTION = 0.016;

/**
 * The panels as actually drawn: the layout tiled inside the photo area with a
 * frame of painted sky left showing around it, so the sunset is visible as a
 * border and in the diagonal seams between panels.
 */
export function coverPanels(layoutId, w, h) {
  const m = Math.round(w * FRAME_FRACTION);
  const inner = layoutPanels(layoutId, w - 2 * m, h - 2 * m);
  return inner.map((p) => ({
    role: p.role,
    points: p.points.map(([x, y]) => [x + m, y + m]),
  }));
}

/**
 * The largest wordmark size whose block of `lineCount` lines still ends above
 * the billing lines: the kicker takes the top of the band and the billing the
 * bottom, so the wordmark gets the middle 60% of the band height.
 */
export function wordmarkSize(lineCount, bandH, maxWidth, startSize) {
  const heightCap = Math.floor((bandH * 0.6) / (lineCount * 0.94));
  return Math.min(startSize, heightCap);
}
