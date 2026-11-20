// Tests for Vice After Dark geometry, crop, caption fit, looks, export sizes and shot mode.
// Written first (TDD red): they import app/src/geometry.js, which does not exist yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUTS, LOOKS, EXPORT_SIZES, SCENES, SAMPLE_PHOTOS,
  layoutPanels, polygonArea, coverFit, fitCaption, parseShot,
} from '../app/src/geometry.js';

const W = 1080;
const H = 840; // photo area above the caption band on a 1080x1080 cover

function totalArea(panels) {
  return panels.reduce((sum, p) => sum + polygonArea(p.points), 0);
}

test('every layout tiles the photo area with non-degenerate panels', () => {
  for (const layout of LAYOUTS) {
    const panels = layoutPanels(layout.id, W, H);
    assert.ok(panels.length >= 3, `${layout.id} needs at least 3 panels`);
    for (const p of panels) {
      assert.ok(polygonArea(p.points) > 0.04 * W * H, `${layout.id} panel too small`);
      for (const [x, y] of p.points) {
        assert.ok(x >= -1 && x <= W + 1 && y >= -1 && y <= H + 1, `${layout.id} point out of bounds`);
      }
    }
    const area = totalArea(panels);
    assert.ok(area > 0.9 * W * H && area <= W * H + 1, `${layout.id} area ${area} vs ${W * H}`);
  }
});

test('diagonal hero layout gives the hero panel the largest area', () => {
  const panels = layoutPanels('diagonal-hero', W, H);
  const hero = panels.find((p) => p.role === 'hero');
  assert.ok(hero, 'hero panel exists');
  for (const p of panels) {
    if (p !== hero) assert.ok(polygonArea(hero.points) > polygonArea(p.points));
  }
});

test('coverFit keeps the focus point visible and inside the image', () => {
  const img = { w: 1200, h: 800 };
  for (const [fx, fy] of [[0.5, 0.3], [0.05, 0.1], [0.95, 0.9], [0.5, 0.5]]) {
    const src = coverFit(img, 500, 700, { fx, fy, zoom: 1, panX: 0, panY: 0 });
    assert.ok(src.x >= 0 && src.y >= 0, 'src inside image');
    assert.ok(src.x + src.w <= img.w + 0.01 && src.y + src.h <= img.h + 0.01, 'src inside image');
    const focusPx = fx * img.w;
    const focusPy = fy * img.h;
    assert.ok(focusPx >= src.x - 0.01 && focusPx <= src.x + src.w + 0.01, 'focus x visible');
    assert.ok(focusPy >= src.y - 0.01 && focusPy <= src.y + src.h + 0.01, 'focus y visible');
  }
});

test('coverFit zoom narrows the source rect and pan shifts it', () => {
  const img = { w: 1200, h: 800 };
  const base = coverFit(img, 500, 700, { fx: 0.5, fy: 0.5, zoom: 1, panX: 0, panY: 0 });
  const zoomed = coverFit(img, 500, 700, { fx: 0.5, fy: 0.5, zoom: 2, panX: 0, panY: 0 });
  assert.ok(Math.abs(zoomed.w - base.w / 2) < 1, 'zoom 2 halves source width');
  const panned = coverFit(img, 500, 700, { fx: 0.5, fy: 0.5, zoom: 2, panX: 0.2, panY: 0 });
  assert.ok(panned.x > zoomed.x, 'positive panX moves the source window right');
});

test('fitCaption shrinks long text to fit and never goes below the floor', () => {
  const measure = (text, size) => text.length * size * 0.6;
  const short = fitCaption('VICE', 600, 120, 28, measure);
  assert.equal(short, 120, 'short text keeps the starting size');
  const long = fitCaption('VICE CITY AFTER DARK TONIGHT', 600, 120, 28, measure);
  assert.ok(long < 120 && long >= 28, 'long text shrinks but respects the floor');
  assert.ok(measure('VICE CITY AFTER DARK TONIGHT', long) <= 600 + 0.01, 'shrunk text fits');
  const huge = fitCaption('A'.repeat(200), 600, 120, 28, measure);
  assert.equal(huge, 28, 'impossible text stops at the floor');
});

test('the four looks are distinct and use valid hex colours', () => {
  assert.equal(Object.keys(LOOKS).length, 4);
  const hex = /^#[0-9a-f]{6}$/i;
  const seen = new Set();
  for (const [id, look] of Object.entries(LOOKS)) {
    for (const key of ['skyTop', 'skyMid', 'skyBottom', 'sun', 'band', 'ink', 'accent']) {
      assert.ok(hex.test(look[key]), `${id}.${key} must be a hex colour`);
    }
    seen.add(look.skyTop + look.sun + look.band);
  }
  assert.equal(seen.size, 4, 'looks must differ from each other');
});

test('export sizes are exactly the three common post sizes', () => {
  assert.deepEqual(EXPORT_SIZES.map((s) => [s.w, s.h]), [[1080, 1080], [1080, 1350], [1920, 1080]]);
});

test('every sample photo carries a face focus point inside the image', () => {
  for (const photo of SAMPLE_PHOTOS) {
    assert.ok(photo.fx > 0 && photo.fx < 1, `${photo.id} fx in range`);
    assert.ok(photo.fy >= 0.3 && photo.fy <= 0.55, `${photo.id} fy near the face`);
  }
});

test('scenes pair a photo, a look and a caption', () => {
  assert.equal(SCENES.length, 3);
  for (const scene of SCENES) {
    assert.ok(scene.photo, 'scene needs a photo');
    assert.ok(LOOKS[scene.look], 'scene look must exist');
    assert.ok(LAYOUTS.some((l) => l.id === scene.layout), 'scene layout must exist');
    assert.ok(scene.caption.length > 0, 'scene needs a caption');
  }
});

test('parseShot reads a full query and falls back safely on junk', () => {
  const full = parseShot('?shot=cover&photo=marina&caption=Neon%20Run&look=neon-nights&layout=split-diagonals&scene=neon&size=1080x1350');
  assert.equal(full.shot, 'cover');
  assert.equal(full.photo, 'marina');
  assert.equal(full.caption, 'Neon Run');
  assert.equal(full.look, 'neon-nights');
  assert.equal(full.layout, 'split-diagonals');
  assert.equal(full.scene, 'neon');
  assert.deepEqual([full.size.w, full.size.h], [1080, 1350]);
  const junk = parseShot('?shot=nope&look=bogus&layout=bogus&size=1x1');
  assert.equal(junk.shot, 'editor', 'unknown shot falls back to editor');
  assert.equal(junk.look, 'sunset', 'unknown look falls back to sunset');
  assert.equal(junk.layout, 'diagonal-hero', 'unknown layout falls back to diagonal-hero');
  assert.deepEqual([junk.size.w, junk.size.h], [1080, 1080], 'unknown size falls back to square');
  const empty = parseShot('');
  assert.equal(empty.shot, 'editor');
  assert.ok(empty.caption.length > 0, 'empty query still yields a caption');
});
