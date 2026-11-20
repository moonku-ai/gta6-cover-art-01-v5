// Extra tests for the cover-panel region: panels sit inside a sky frame, and the
// wordmark sizing rule keeps two stacked lines clear of the billing block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutPanels, coverPanels, wordmarkSize } from '../app/src/geometry.js';

test('coverPanels insets every layout inside the sky frame', () => {
  for (const layout of ['diagonal-hero', 'split-diagonals', 'diagonal-stripes', 'diagonal-grid']) {
    const panels = coverPanels(layout, 1080, 840);
    const plain = layoutPanels(layout, 1080, 840);
    assert.equal(panels.length, plain.length, 'same panel count');
    for (const p of panels) {
      for (const [x, y] of p.points) {
        assert.ok(x >= 10 && x <= 1070, 'panel inside the frame horizontally');
        assert.ok(y >= 10 && y <= 830, 'panel inside the frame vertically');
      }
    }
  }
});

test('wordmarkSize fits one or two lines above the billing block', () => {
  // Band 238px tall (1080 square cover): kicker ~0.17, billing ~0.15 of the band.
  const bandH = 238;
  const one = wordmarkSize(1, bandH, 400, 1000);
  const two = wordmarkSize(2, bandH, 400, 1000);
  assert.ok(two < one, 'two lines get a smaller size than one line');
  assert.ok(two * 0.94 * 2 + bandH * 0.19 + bandH * 0.05 < bandH * 0.85,
    'two-line block ends above the billing lines');
  assert.ok(one * 0.94 + bandH * 0.19 + bandH * 0.05 < bandH * 0.85,
    'one-line block ends above the billing lines');
});
