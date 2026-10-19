// Local synthetic full-console fixture, production CSS and built admin scripts only.
// Never authenticates to production or performs real content/media writes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entries, fields, panel } from './helpers/life-fixture.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = await readdir(join(root, 'dist/_astro'));
const styles = assets.filter((name) => name.endsWith('.css'));
const manifestFile = (await readdir(join(root, 'dist/_worker.js'))).find((name) => /^manifest_.*\.mjs$/.test(name));
const manifestText = await readFile(join(root, 'dist/_worker.js', manifestFile), 'utf8');
const manifest = JSON.parse(manifestText.match(/const manifest = deserializeManifest\((\{.*\})\);/)[1]);
async function builtScript(path, prefix) {
  const inline = manifest.inlinedScripts.find(([name]) => name.includes(path + '?'))?.[1];
  if (inline) return inline;
  const name = assets.find((name) => name.startsWith(prefix) && name.endsWith('.js'));
  assert.ok(name, `Build script for ${path}`);
  return readFile(join(root, 'dist/_astro', name), 'utf8');
}
const scripts = {
  '/_fixture/admin.js': await builtScript('/pages/admin/index.astro', 'index.astro_astro_type_script_'),
  '/_fixture/life.js': await builtScript('/components/AdminLifePanel.astro', 'AdminLifePanel.astro_astro_type_script_')
};
const source = await readFile(join(root, 'src/pages/admin/index.astro'), 'utf8');
const lifeSource = await readFile(join(root, 'src/components/AdminLifePanel.astro'), 'utf8');
assert.match(source, /import '@\/scripts\/admin-workspace'/);
assert.doesNotMatch(source, /class="admin-grid"/);
for (const id of ['documents', 'directories', 'media']) assert.ok(source.includes(`id="admin-${id}" data-admin-panel`));
assert.match(lifeSource, /data-admin-panel data-life-panel/);
assert.match(lifeSource, /admin-split admin-life__workspace/);
assert.ok(lifeSource.indexOf('admin-life__collection') < lifeSource.indexOf('admin-life__editing'));
assert.match(lifeSource, /<ul class="admin-life__list admin-scroll-list"/);
assert.match(source, /class="admin-media-list admin-scroll-list"/);
assert.match(source, /class="article-list admin-scroll-list admin-document-list"/);
assert.match(source, /class="article-list admin-scroll-list admin-directory-list"/);
assert.match(lifeSource, /\[page\]|pages/);
assert.match(lifeSource, /\$\{other\}_q/);
assert.match(lifeSource, /\$\{other\}_page/);

const modules = ['documents', 'directories', 'media', 'anime', 'gallery'];
const labels = ['Documents', 'Learn Directories', 'Media', 'Anime', 'Gallery'];
const rows = (count, render) => Array.from({ length: count }, (_, i) => render(i)).join('');
const longPath = 'computer-science/Legacy_Algorithms/' + 'very-long-segment-'.repeat(12);
function fixture(empty = false) {
  const documents = `<section class="admin-panel" id="admin-documents" data-admin-panel><div class="admin-panel__head"><h2>Documents</h2><div><a class="text-button" href="/admin/editor/new?kind=learn">NEW LEARN</a><a class="text-button" href="/admin/editor/new?kind=essay">NEW ESSAY</a></div></div><ul class="article-list admin-scroll-list admin-document-list" tabindex="0">${empty ? '' : rows(60, (i) => `<li><a class="article-link" href="/admin/editor/doc-${i}"><strong>Document ${i}</strong><span>learn / published</span><span>${longPath}${i}</span></a></li>`)}</ul></section>`;
  const directories = `<section class="admin-panel" id="admin-directories" data-admin-panel><div class="admin-panel__head"><h2>Learn Directories</h2></div><div class="admin-split"><ul class="article-list admin-scroll-list admin-directory-list" tabindex="0">${empty ? '' : rows(35, (i) => `<li><a class="article-link" href="/admin/editor/new?directory=directory-${i}"><strong>Directory ${i}</strong><span>${longPath}${i}</span><span>ADD INTRO</span></a></li>`)}</ul><form class="admin-form admin-directory-form" data-directory-form><label>Parent<select name="parent_path"><option value="">/learn</option><option value="physics-maths">Physics &amp; Maths</option></select></label><label>Label<input name="label" required></label><label>Slug<input name="slug" required></label><label>Order<input type="number" name="sort_order" value="9999"></label><button class="text-button">CREATE DIRECTORY</button></form></div></section>`;
  const media = `<section class="admin-panel" id="admin-media" data-admin-panel><div class="admin-panel__head"><h2>Media</h2></div><form class="admin-form admin-upload-toolbar" data-media-form><label>Image<input type="file" name="file" required></label><button class="text-button">UPLOAD</button><output data-media-output></output></form><ul class="admin-media-list admin-scroll-list" tabindex="0">${empty ? '' : rows(40, (i) => `<li><a href="/pixel.png"><img src="/pixel.png" alt="Synthetic image ${i}"></a><div><strong>fixture-${i}.png</strong><span>${longPath}${i}.png</span><span>2 KiB / 1 reference(s)</span></div><div><button class="icon-button" data-media-copy="/media/fixture-${i}.png">COPY</button><button class="text-button danger-button" data-media-delete data-media-key="fixture-${i}.png" data-media-name="fixture-${i}.png">DELETE</button></div></li>`)}</ul></section>`;
  const anime = empty ? [] : Array.from({ length: 25 }, (_, i) => ({ ...entries.anime[0], id: `anime-${i}`, cn_title: `Long synthetic anime ${i} ` + 'very-long-title-'.repeat(8) }));
  const gallery = empty ? [] : entries.gallery;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map((name) => `<link rel="stylesheet" href="/_astro/${name}">`).join('')}</head><body><main class="site-main"><header class="admin-console-header"><div><p class="section-kicker">/admin</p><h1>Content Console</h1></div><div class="admin-console-header__actions"><span>fixture@example.invalid</span><a class="text-button" href="/api/admin/export">EXPORT</a></div></header><nav class="admin-module-nav" data-admin-tabs aria-label="Content modules">${modules.map((id, i) => `<a class="text-button" id="tab-admin-${id}" href="#admin-${id}" data-admin-tab>${labels[i]}</a>`).join('')}</nav><section class="admin-workspace" data-admin-workspace>${documents}${directories}${media}${panel('anime', new Set(), anime)}${panel('gallery', new Set(), gallery)}</section><dialog class="delete-dialog pixel-panel" data-media-delete-dialog><form data-media-delete-form><h2>Delete Media</h2><p>Type <strong data-media-delete-name></strong></p><label>Confirmation<input data-media-delete-confirmation></label><div><button type="button" data-dialog-cancel>CANCEL</button><button type="submit">DELETE</button></div><output data-media-delete-error></output></form></dialog></main><script type="module" src="/_fixture/admin.js"></script><script type="module" src="/_fixture/life.js"></script></body></html>`;
}
const requests = [];
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (scripts[url.pathname]) { res.setHeader('Content-Type', 'text/javascript'); return res.end(scripts[url.pathname]); }
    if (url.pathname === '/admin/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(fixture(url.searchParams.has('empty'))); }
    if (url.pathname === '/pixel.png') { res.setHeader('Content-Type', 'image/png'); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=', 'base64')); }
    if (url.pathname.startsWith('/api/')) {
      let body = ''; for await (const chunk of req) body += chunk;
      requests.push({ path: url.pathname, method: req.method, body });
      res.writeHead(url.pathname === '/api/admin/media' ? 200 : 409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(url.pathname === '/api/admin/media' ? { key: 'fixture-upload.png' } : { error: 'Blocked locally; no write.' }));
    }
    const base = resolve(root, url.pathname.startsWith('/_astro/') ? 'dist' : 'public');
    const file = resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + sep)) { res.statusCode = 403; return res.end(); }
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});
const screenshots = await mkdtemp(join(tmpdir(), 'hydroxy-admin-browser-'));
let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const tab = (id) => page.locator(`#tab-admin-${id}`);
  const active = async (id) => {
    assert.equal(await page.locator('[data-admin-panel]:visible').count(), 1);
    assert.equal(await tab(id).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator(`#admin-${id}`).isVisible(), true);
  };
  for (const width of [1440, 1920, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/admin/?anime_page=2&gallery_page=3`);
    await page.waitForLoadState('networkidle');
    await active('documents');
    for (const id of modules) {
      await tab(id).click(); await active(id);
      assert.equal(new URL(page.url()).searchParams.get('anime_page'), '2');
      const current = page.locator(`#admin-${id}`);
      const list = current.locator('.admin-scroll-list');
      const geometry = await list.evaluate((node) => ({ height: node.getBoundingClientRect().height, content: node.scrollHeight, client: node.clientHeight }));
      assert.ok(geometry.height <= (width < 900 ? 400 : 650) + 1, `${id} list bounded at ${width}`);
      if (id !== 'gallery') assert.ok(geometry.content > geometry.client, `${id} list scrolls`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${id}: no horizontal overflow at ${width}`);
      if (id === 'anime' || id === 'gallery') {
        const editor = current.locator('[data-life-form]');
        const listBox = await list.boundingBox(); const formBox = await editor.boundingBox();
        assert.ok(width < 900 ? formBox.y > listBox.y + listBox.height : formBox.x > listBox.x + listBox.width, 'List/editor responsive order');
        for (const field of fields[id]) {
          const box = await editor.locator(`[name="${field}"]`).boundingBox();
          assert.ok(box.width > 20 && box.x >= 0 && box.x + box.width <= width + 1, `${id}/${field} fits`);
        }
        assert.equal(await list.locator('.pagination').count(), 0, 'Pagination outside scroll region');
        assert.equal(await current.locator('.pagination').isVisible(), true);
        await list.locator('[data-life-entry]').first().click();
        assert.equal(await editor.locator('[name="title"]').evaluate((node) => node === document.activeElement), true);
        if (width < 900) assert.ok((await editor.boundingBox()).y >= 0, 'Mobile selection reveals editor');
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: join(screenshots, `${id}-${width}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/admin/#admin-anime`); await page.waitForLoadState('networkidle'); await active('anime');
  const animeForm = page.locator('[data-life-form="anime"]');
  await animeForm.locator('[name="title"]').fill('Unsaved across tabs');
  const initialRequests = requests.length;
  await tab('media').click(); await tab('anime').click();
  assert.equal(await animeForm.locator('[name="title"]').inputValue(), 'Unsaved across tabs');
  assert.equal(requests.length, initialRequests, 'Switching tabs never submits');
  await page.goBack(); await active('media'); await page.goForward(); await active('anime');
  await tab('anime').focus(); await page.keyboard.press('ArrowRight'); await active('gallery');
  await page.keyboard.press('Home'); await active('documents');
  await page.keyboard.press('End'); await active('gallery');
  await page.keyboard.press('ArrowRight'); await active('documents');
  for (const id of modules) {
    await page.goto(`${origin}/admin/#admin-${id}`); await page.waitForLoadState('networkidle'); await active(id);
    await page.reload(); await page.waitForLoadState('networkidle'); await active(id);
  }
  await page.goto(`${origin}/admin/#unknown`); await page.waitForLoadState('networkidle'); await active('documents');
  await tab('directories').click();
  await page.locator('[data-directory-form] [name="label"]').fill('Fixture');
  await page.locator('[data-directory-form] [name="slug"]').fill('fixture');
  await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/admin/content')), page.locator('[data-directory-form] button').click()]);
  assert.equal(JSON.parse(requests.at(-1).body).action, 'saveLearnDirectory');
  await tab('media').click();
  await page.locator('[data-media-copy]').first().click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}/media/fixture-0.png`);
  await page.locator('[data-media-form] input[type="file"]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await page.locator('[data-media-form] button').click();
  await page.waitForFunction(() => document.querySelector('[data-media-output]').textContent === 'fixture-upload.png');
  await page.locator('[data-media-delete]').first().click();
  assert.equal(await page.locator('[data-media-delete-dialog]').isVisible(), true);
  await page.locator('[data-dialog-cancel]').click();
  assert.equal(await page.locator('[data-media-delete-dialog]').isVisible(), false);
  await tab('anime').click();
  await page.locator('[data-life-panel="anime"] .admin-life__search input').fill('needle');
  await Promise.all([page.waitForEvent('load'), page.locator('[data-life-panel="anime"] .admin-life__search button').click()]);
  await page.waitForLoadState('networkidle'); await active('anime');
  assert.equal(new URL(page.url()).searchParams.get('anime_q'), 'needle');
  await Promise.all([page.waitForEvent('load'), page.locator('[data-life-panel="anime"] .pagination a').first().click()]);
  await page.waitForLoadState('networkidle'); await active('anime');
  assert.equal(new URL(page.url()).searchParams.get('anime_page'), '2');
  await page.goto(`${origin}/admin/?empty#admin-gallery`); await page.waitForLoadState('networkidle'); await active('gallery');
  assert.ok((await page.locator('#admin-gallery').boundingBox()).height < 900, 'Empty list does not force tall panel');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallback = await noJs.newPage(); await fallback.goto(`${origin}/admin/`);
  assert.equal(await fallback.locator('[data-admin-panel]:visible').count(), 5);
  await fallback.locator('#tab-admin-gallery').click();
  assert.equal(new URL(fallback.url()).hash, '#admin-gallery');
  await noJs.close();
  assert.deepEqual(errors, []);
  console.log(`Admin workspace regression passed (1440/1920/768/390, tabs/history/forms/scroll/no-JS). Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
