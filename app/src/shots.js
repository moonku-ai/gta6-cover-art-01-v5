// Fixed scenes for screenshots: ?shot=cover renders one exported cover alone,
// ?shot=editor shows the editor with a scene applied. `photo`, `caption`,
// `kicker`, `look`, `layout`, `scene` and `size` pick the state; anything
// unknown falls back to the defaults in geometry.js. window.__shotReady is set
// once the cover is painted.
import { parseShot, SCENES } from './geometry.js';

export async function runShot(queryString, hooks) {
  const shot = parseShot(queryString);
  const scene = shot.scene ? SCENES.find((s) => s.id === shot.scene) : null;
  if (shot.shot === 'cover') document.body.classList.add('shot-cover');
  await hooks.applyShot(shot, scene);
  await hooks.whenReady();
  window.__shotReady = true;
}
