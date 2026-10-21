// Actual built Astro pages, synthetic read-only D1, and local media only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { experimental_AstroContainer } from 'astro/container';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const worker = join(root, 'dist/_worker.js');
const assets = await readdir(join(root, 'dist/_astro'));
const manifestName = (await readdir(worker)).find((name) => /^manifest_.*\.mjs$/.test(name));
const raw = await readFile(join(worker, manifestName), 'utf8');
const manifest = JSON.parse(raw.match(/const manifest = deserializeManifest\((\{.*\})\);/)[1]);
const inlineScripts = new Map(manifest.inlinedScripts);
const inlineRoutes = new Map();
const container = await experimental_AstroContainer.create({ resolve: async (id) => {
  if (inlineScripts.has(id)) {
    const url = '/_fixture/' + inlineRoutes.size + '.js';
    inlineRoutes.set(url, inlineScripts.get(id));
    return url;
  }
  assert.ok(manifest.entryModules[id], `Built script ${id}`);
  return '/'+manifest.entryModules[id];
} });
const home = (await import(pathToFileURL(join(worker, 'pages/index.astro.mjs')).href)).page().default;
const baseName = (await readdir(join(worker, 'chunks'))).find((name) => /^BaseLayout_/.test(name));
const base = (await import(pathToFileURL(join(worker, 'chunks', baseName)).href)).$;
const styles = assets.filter((name) => name.endsWith('.css')).map((name) => `<link rel="stylesheet" href="/_astro/${name}">`).join('');
const image = await readFile(join(root, 'public/images/profile/avatar.jpg'));
const photos = Array.from({ length: 6 }, (_, i) => ({ title: `Gallery ${i} ` + (i ? 'long-title-'.repeat(8) : ''), alt: i === 1 ? 'Long description '+ '花瓣与风 '.repeat(60) : i === 2 ? '' : `Photo ${i}`, media_key: `test-${i}.png` }));
function locals(rows) {
  return { runtime: { env: { HYDROXY_MEDIA: {}, HYDROXY_DB: { prepare(query) {
    const adapter = {
      bind() { return adapter; },
      async all() { return { results: query.includes('FROM gallery_entries g JOIN') ? rows : [] }; },
      async first() { return query.includes('COUNT(') ? { total: 0 } : null; }
    };
    return adapter;
  } } } } };
}
const pages = new Map();
for (const [variant, rows] of [['home', photos], ['single', photos.slice(0, 1)], ['empty', []], ['broken', photos.map((photo) => ({ ...photo, media_key: 'broken-' + photo.media_key }))]]) {
  const html = await container.renderToString(home, { request: new Request('https://fixture.invalid/'), locals: locals(rows) });
  pages.set('/'+variant+'/', html.replace('</head>', styles+'</head>'));
}
for (const path of ['/learn/example/', '/admin/']) {
  const html = await container.renderToString(base, { request: new Request('https://fixture.invalid'+path), slots: { default: '<header class="article-hero pixel-panel"><h1 class="section-title">长篇标题与像素世界：公开文章的主标题保持完整排版和可访问名称</h1></header><article class="prose"><h1>Static article</h1><p>Readable content.</p></article>' } });
  pages.set(path, html.replace('</head>', styles+'</head>'));
}
for (const [path, file] of [['/about/', 'about.astro.mjs'], ['/learn/', 'learn.astro.mjs']]) {
  const route = (await import(pathToFileURL(join(worker, 'pages', file)).href)).page().default;
  const html = await container.renderToString(route, { request: new Request('https://fixture.invalid'+path), locals: locals([]) });
  pages.set(path, html.replace('</head>', styles+'</head>'));
}
assert.ok(!pages.get('/admin/').includes('data-wind-toggle'));
assert.ok(!pages.get('/admin/').includes('data-motion-toggle'));
assert.ok(!pages.get('/admin/').includes('PublicEffects.astro_'));
assert.ok(!pages.get('/learn/example/').includes('HomeGallery.astro_'));

const requests = [];
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    requests.push(path);
    if (pages.has(path)) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(pages.get(path)); }
    if (inlineRoutes.has(path)) { res.setHeader('Content-Type', 'text/javascript'); return res.end(inlineRoutes.get(path)); }
    if (path.startsWith('/media/')) {
      if (path.includes('broken')) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', 'image/jpeg'); return res.end(image);
    }
    const dir = resolve(root, path.startsWith('/_astro/') ? 'dist' : 'public');
    const file = resolve(dir, '.'+decodeURIComponent(path));
    if (!file.startsWith(dir+sep)) { res.statusCode = 403; return res.end(); }
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});
const screenshots = await mkdtemp(join(tmpdir(), 'hydroxy-motion-browser-'));
let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext();
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.addInitScript(() => {
    const clear = CanvasRenderingContext2D.prototype.clearRect, fill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) { if (this.canvas.className === 'pixel-petals') window.__windDraws = []; return clear.apply(this, args); };
    CanvasRenderingContext2D.prototype.fillRect = function(...args) { if (this.canvas.className === 'pixel-petals') (window.__windDraws ??= []).push(args); return fill.apply(this, args); };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.locator('[data-wind-toggle]:not([hidden])').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-booting]'));
  };
  const settled = () => page.waitForFunction(() => [...document.querySelectorAll('.home-gallery__image img')].every((img) => img.getAnimations().length === 0));
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin+'/home/'); await ready();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
    assert.equal(await page.locator('[data-gallery-image]').evaluate((img) => getComputedStyle(img).objectFit), 'contain');
    const frame = await page.locator('[data-gallery-link]').boundingBox();
    assert.ok(Math.abs(frame.width / frame.height - (width <= 560 ? 5 / 3 : 3)) < 0.02, 'Stable responsive image frame');
    if (width === 1440 || width === 390) await page.screenshot({ path: join(screenshots, `home-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install();
  requests.length = 0;
  await page.goto(origin+'/home/'); await ready();
  await page.waitForFunction(() => document.querySelector('[data-gallery-image]').naturalWidth > 0);
  await page.waitForTimeout(150);
  assert.deepEqual([...new Set(requests.filter((path) => path.startsWith('/media/')))].sort(), ['/media/test-0.png', '/media/test-1.png']);
  assert.ok(!requests.some((path) => /petals\..*\.js/.test(path)), 'Petals are not eagerly loaded');
  await page.clock.runFor(4100);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^2 /);
  await page.locator('[data-gallery-prev]').click();
  await page.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('1 /'));
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^1 /);
  await settled();
  await page.mouse.move(0, 0);
  await page.clock.runFor(9000);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^1 /, 'Manual selection stays paused');
  await page.locator('[data-gallery-play]').click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(4100);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^2 /);
  await page.locator('[data-gallery-image]').hover();
  await page.clock.runFor(9000);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^2 /, 'Hover pauses slideshow');
  await page.mouse.move(0, 0);
  await page.locator('[data-gallery-prev]').focus();
  await page.clock.runFor(9000);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^2 /, 'Keyboard focus stops slideshow');
  let resolvePetals;
  const heldPetals = new Promise((resolve) => { resolvePetals = resolve; });
  const holdPetals = (route) => resolvePetals(route);
  await context.route('**/petals.*.js', holdPetals);
  await page.evaluate(() => { for (let i = 0; i < 6; i++) window.dispatchEvent(new Event('hydroxy:wind')); });
  const petalRoute = await heldPetals;
  assert.equal(await page.locator('.pixel-petals').count(), 0);
  await petalRoute.continue();
  await context.unroute('**/petals.*.js', holdPetals);
  await page.locator('.pixel-petals').waitFor();
  await page.clock.runFor(80);
  assert.ok(await page.evaluate(() => window.__windDraws.every(([x]) => x < innerWidth * 0.08)), 'Petals enter at the left edge');
  await page.clock.runFor(500);
  assert.ok(await page.evaluate(() => window.__windDraws.length <= 240), 'Lazy import queue is capped to four gusts');
  assert.equal(await page.locator('.pixel-petals').count(), 1);
  assert.ok(await page.locator('.pixel-petals').evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  }), 'Petals canvas is nonblank');
  assert.equal(await page.locator('.pixel-petals').evaluate((canvas) => getComputedStyle(canvas).pointerEvents), 'none');
  await page.screenshot({ path: join(screenshots, 'petals-desktop.png') });
  await page.locator('[data-wind-toggle]').click();
  assert.equal(await page.locator('.pixel-petals').count(), 1, 'Repeated triggers do not stop active gusts');
  assert.equal(await page.locator('[data-wind-toggle]').getAttribute('aria-pressed'), null);
  const input = page.locator('[data-shell-input]');
  await input.fill('mysterious-wind'); await input.press('Enter');
  await page.locator('.pixel-petals').waitFor();
  await page.clock.runFor(3000);
  assert.equal(await page.locator('.pixel-petals').count(), 0, 'Petals expire');
  await input.fill('help'); await input.press('Enter');
  assert.ok((await page.locator('[data-shell-output]').innerText()).includes('mysterious-wind'));
  await input.fill('pwd'); await input.press('Enter');
  assert.match(await page.locator('[data-shell-output]').innerText(), /\n\/$/);
  await input.fill('clear'); await input.press('Enter');
  assert.equal(await page.locator('[data-shell-output]').innerText(), '');
  await page.locator('[data-motion-toggle]').uncheck();
  assert.equal(await page.locator('[data-wind-toggle]').isDisabled(), true);
  await page.reload(); await ready();
  assert.equal(await page.locator('[data-motion-toggle]').isChecked(), false);
  assert.equal(await page.locator('[data-boot-line]').first().innerText(), 'HYDROXY SHELL v0.2');
  await page.locator('[data-motion-toggle]').check();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[data-wind-toggle]').disabled);
  assert.equal(await page.locator('[data-wind-toggle]').isDisabled(), true);
  await page.locator('[data-gallery-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('2 /'));
  assert.equal(await page.locator('[data-gallery-image]').evaluate((img) => img.getAnimations().length), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let heldImage;
  const holdNext = (route) => { heldImage = route; };
  await context.route('**/media/test-1.png', holdNext);
  await page.goto(origin+'/home/', { waitUntil: 'domcontentloaded' }); await ready();
  await page.clock.runFor(4100);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^1 /, 'Slow next image leaves current photo visible');
  assert.ok(heldImage);
  await page.locator('[data-motion-toggle]').uncheck();
  await heldImage.continue();
  await page.waitForTimeout(150);
  assert.match(await page.locator('[data-gallery-count]').innerText(), /^1 /, 'Disabling motion cancels a pending automatic change');
  await context.unroute('**/media/test-1.png', holdNext);
  await page.locator('[data-motion-toggle]').check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin+'/home/'); await ready();
  await page.locator('[data-wind-toggle]').click(); await page.locator('.pixel-petals').waitFor();
  await page.clock.runFor(500);
  assert.ok(await page.locator('.pixel-petals').evaluate((canvas) => canvas.width <= innerWidth * 1.5 + 1));
  await page.screenshot({ path: join(screenshots, 'petals-mobile.png') });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.locator('.pixel-petals').count(), 0, 'Hiding page removes active particles');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  for (const variant of ['single', 'empty', 'broken']) {
    await page.goto(origin+`/${variant}/`); await ready();
    if (variant === 'empty') assert.equal(await page.locator('[data-home-gallery]').count(), 0);
    else if (variant === 'single') assert.equal(await page.locator('[data-gallery-controls]').count(), 0);
    else { await page.waitForFunction(() => document.querySelector('.home-gallery figure').hidden); assert.equal(await page.getByRole('link', { name: 'View all', exact: true }).count(), 1); }
  }
  requests.length = 0;
  await page.goto(origin+'/learn/example/'); await ready();
  assert.ok(!requests.some((path) => /HomeGallery|MiniShell/.test(path)));
  await page.locator('[data-wind-toggle]').click(); await page.locator('.pixel-petals').waitFor();
  await page.goto(origin+'/admin/');
  assert.equal(await page.locator('.pixel-petals, [data-wind-toggle], [data-motion-toggle]').count(), 0);
  assert.equal(await page.locator('.typewriter').count(), 0, 'Admin headings stay static');
  await page.goto(origin+'/learn/example/', { waitUntil: 'domcontentloaded' });
  const heading = page.locator('.article-hero h1');
  await heading.locator('.typewriter__visual').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  const headingBefore = await heading.boundingBox();
  const headingText = '长篇标题与像素世界：公开文章的主标题保持完整排版和可访问名称';
  assert.equal(await page.getByRole('heading', { name: headingText, exact: true }).count(), 1, 'Heading name stays complete during typing');
  assert.equal(await page.locator('.prose .typewriter').count(), 0);
  await page.clock.runFor(1300);
  const headingAfter = await heading.boundingBox();
  assert.equal(await heading.locator('.typewriter__visual').count(), 0);
  assert.ok(Math.abs(headingBefore.height - headingAfter.height) < 1 && Math.abs(headingBefore.width - headingAfter.width) < 1, 'Typing does not resize heading');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await heading.locator('.typewriter__visual').count(), 0, 'Heading does not repeat when scrolling back');
  for (const path of ['/about/', '/learn/']) {
    await page.goto(origin+path, { waitUntil: 'domcontentloaded' });
    await page.locator('h1.section-title .typewriter__visual').waitFor({ state: 'attached' });
    await page.clock.runFor(1300);
    assert.equal(await page.locator('h1.section-title .typewriter__visual').count(), 0, 'Public page and directory headings finish once');
  }
  await page.goto(origin+'/home/'); await ready();
  const captionFrame = await page.locator('.home-gallery figcaption').boundingBox();
  await page.locator('[data-gallery-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('2 /'));
  assert.equal(await page.locator('[data-gallery-description]').getAttribute('title'), photos[1].alt);
  assert.equal(await page.locator('[data-gallery-image]').getAttribute('alt'), photos[1].alt);
  const fades = await page.locator('.home-gallery__image img').evaluateAll((images) => images.flatMap((img) => img.getAnimations().map((animation) => ({ duration: animation.effect.getTiming().duration, frames: animation.effect.getKeyframes().map((key) => key.opacity) }))));
  assert.equal(fades.length, 2, 'Two decoded images crossfade together');
  assert.ok(fades.every((fade) => fade.duration === 400));
  assert.equal(await page.locator('[data-gallery-description] .typewriter__visual').getAttribute('aria-hidden'), 'true');
  await page.locator('[data-gallery-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('3 /'));
  await page.clock.runFor(1600);
  assert.equal(await page.locator('[data-gallery-description]').innerText(), photos[2].title, 'Rapid switches cancel old caption and empty Alt falls back to title');
  const captionAfter = await page.locator('.home-gallery figcaption').boundingBox();
  assert.ok(Math.abs(captionFrame.height - captionAfter.height) < 1, 'Long Alt does not resize caption frame');
  await page.locator('[data-gallery-prev]').click();
  await page.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('2 /'));
  await page.locator('[data-motion-toggle]').uncheck();
  assert.equal(await page.locator('[data-gallery-description]').textContent(), photos[1].alt, 'Disabling motion completes the current caption');
  assert.equal(await page.locator('.typewriter').count(), 0);
  assert.equal(await page.locator('.home-gallery__image img').evaluateAll((images) => images.reduce((sum, img) => sum + img.getAnimations().length, 0)), 0);
  await page.locator('[data-motion-toggle]').check();
  await page.locator('[data-gallery-play]').click();
  await page.mouse.move(0, 0);
  await settled();
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await page.clock.runFor(4100);
  await page.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('3 /'));
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(origin+'/home/');
  assert.equal(await staticPage.locator('[data-gallery-image]').count(), 1);
  assert.equal(await staticPage.locator('[data-boot-line]').first().innerText(), 'HYDROXY SHELL v0.2');
  assert.equal(await staticPage.locator('[data-gallery-description]').innerText(), photos[0].alt);
  assert.equal(await staticPage.locator('[data-wind-toggle]').isVisible(), false);
  await noScript.close();
  const storageBlocked = await browser.newContext();
  await storageBlocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }));
  const blockedPage = await storageBlocked.newPage();
  await blockedPage.goto(origin+'/home/');
  await blockedPage.locator('[data-wind-toggle]:not([hidden])').waitFor();
  await blockedPage.locator('[data-shell-input]').focus();
  assert.equal(await blockedPage.locator('[data-booting]').count(), 0);
  await storageBlocked.close();
  const dataSaver = await browser.newContext();
  await dataSaver.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
  const savingPage = await dataSaver.newPage();
  const savingMedia = [];
  savingPage.on('request', (req) => { if (req.url().includes('/media/')) savingMedia.push(req.url()); });
  await savingPage.goto(origin+'/home/');
  await savingPage.locator('[data-gallery-controls]:not([hidden])').waitFor();
  assert.equal(await savingPage.locator('[data-gallery-play]').isDisabled(), true);
  assert.equal(savingMedia.length, 1, 'Data saver does not preload next photo');
  await savingPage.locator('[data-gallery-next]').click();
  await savingPage.waitForFunction(() => document.querySelector('[data-gallery-count]').textContent.startsWith('2 /'));
  assert.equal(savingMedia.length, 2);
  await dataSaver.close();
  const effectAssets = assets.filter((name) => /^(HomeGallery\.astro_|PublicEffects\.astro_|MiniShell\.astro_|motion-state\.|typewriter\.|petals\.|preload-helper\.)/.test(name));
  let bytes = 0;
  for (const name of effectAssets) bytes += gzipSync(await readFile(join(root, 'dist/_astro', name))).length;
  assert.ok(bytes < 12 * 1024, `Effects bundle budget: ${bytes}`);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ success: true, screenshots, effectGzipBytes: bytes, renderedActualBuild: true }));
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }
