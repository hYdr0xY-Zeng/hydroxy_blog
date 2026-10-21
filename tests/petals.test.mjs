import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/scripts/petals.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
function fixture(width = 1440, supported = true) {
  let now = 0, id = 0, frames = new Map(), draws = [], ended = 0, appended = 0, removed = 0;
  const listeners = new Map();
  const context = { setTransform() {}, clearRect() { draws = []; }, fillRect(x, y, w, h) { draws.push({ x, y, w, h }); } };
  const canvas = { className: '', setAttribute() {}, getContext() { return supported ? context : null; }, remove() { removed++; } };
  const sandbox = {
    module: { exports: {} }, exports: {}, innerWidth: width, innerHeight: 900, devicePixelRatio: 2,
    performance: { now: () => now }, Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    document: { hidden: false, createElement: () => canvas, body: { append() { appended++; } } },
    window: { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } },
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame(key) { frames.delete(key); }
  };
  vm.runInNewContext(compiled.outputFiles[0].text, sandbox);
  const wind = sandbox.module.exports.createPetalWind(() => ended++);
  return {
    wind, canvas, sandbox, listeners,
    step(time) { now = time; const pending = frames; frames = new Map(); pending.forEach((fn) => fn(now)); return draws; },
    state: () => ({ ended, appended, removed, frames: frames.size })
  };
}

for (const [width, maximum] of [[1440, 80], [390, 40]]) {
  test(`wind at ${width}px enters from the left, stacks four gusts and exits without wrapping`, () => {
    const f = fixture(width);
    assert.equal(f.wind.gust(), true);
    const early = f.step(50);
    assert.equal(early.length, 3, 'Only the first petal has spawned');
    assert.ok(early.every((rect) => rect.x < width * 0.06));
    const middle = f.step(500);
    assert.ok(middle.every((rect) => rect.x > width * 0.1 && rect.x < width * 0.4));
    assert.equal(f.wind.gust(), true);
    assert.equal(f.wind.gust(), true);
    assert.equal(f.wind.gust(), true);
    assert.equal(f.wind.gust(), false, 'Fifth gust is ignored without removing old petals');
    assert.equal(f.state().removed, 0);
    assert.equal(f.step(1000).length, maximum * 3);
    assert.equal(f.state().frames, 1, 'All gusts share one frame loop');
    assert.ok(f.canvas.width <= width * 1.5);
    f.step(3300);
    assert.deepEqual(f.state(), { ended: 1, appended: 1, removed: 1, frames: 0 });
    assert.equal(f.wind.gust(), false);
    f.wind.stop();
    assert.equal(f.state().ended, 1);
  });
}
test('resizing to mobile caps rendering and hiding clears all work', () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) f.wind.gust();
  f.sandbox.innerWidth = 390;
  f.listeners.get('resize')();
  assert.equal(f.step(500).length, 40 * 3);
  f.sandbox.document.hidden = true;
  f.step(600);
  assert.equal(f.state().frames, 0);
  assert.equal(f.state().removed, 1);
  assert.equal(f.listeners.size, 0);
});
test('missing canvas support does not append an unusable overlay', () => {
  const f = fixture(1440, false);
  assert.equal(f.wind, null);
  assert.equal(f.state().appended, 0);
});
