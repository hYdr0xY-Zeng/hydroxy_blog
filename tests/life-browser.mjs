// Build first. Uses the existing Playwright runtime, local fixtures and real built scripts.
// No authenticated SSR, remote requests, D1 writes or R2 operations are performed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = await readdir(join(root, 'dist/_astro'));
const script = assets.find((name) => name.startsWith('AdminLifePanel.astro_astro_type_script_') && name.endsWith('.js'));
const styles = assets.filter((name) => name.endsWith('.css'));
const worker = join(root, 'dist/_worker.js');
const manifestFile = (await readdir(worker)).find((name) => /^manifest_.*\.mjs$/.test(name));
assert.ok(manifestFile && styles.length, 'Run npm run build after Life panel changes.');
const manifestSource = await readFile(join(worker, manifestFile), 'utf8');
const manifest = JSON.parse(manifestSource.match(/const manifest = deserializeManifest\((\{.*\})\);/)[1]);
const builtScript = script ? await readFile(join(root, 'dist/_astro', script), 'utf8')
  : manifest.inlinedScripts.find(([name]) => name.includes('/AdminLifePanel.astro?'))?.[1];
assert.ok(builtScript, 'Rebuild after adding the Life panel.');
assert.match(builtScript, /lifeDelete|life-delete/);
const source = await readFile(join(root, 'src/components/AdminLifePanel.astro'), 'utf8');
const admin = await readFile(join(root, 'src/pages/admin/index.astro'), 'utf8');
assert.match(admin, /<AdminLifePanel kind="anime"/);
assert.match(admin, /<AdminLifePanel kind="gallery"/);
assert.doesNotMatch(admin, /list(?:Anime|Gallery)\(Astro.locals,\s*1,\s*100/);

const fields = {
  anime: ['title', 'cn_title', 'year', 'score', 'status', 'cover_key', 'sort_order', 'note', 'visibility'],
  gallery: ['title', 'alt', 'media_key', 'sort_order', 'visibility']
};
for (const field of new Set(Object.values(fields).flat())) assert.ok(source.includes(`name="${field}"`), `Real panel must expose ${field}`);
for (const selector of ['data-life-panel', 'data-life-new', 'data-life-form', 'data-life-fields', 'data-life-selection', 'data-life-entry', 'data-life-delete', 'data-life-delete-dialog', 'data-life-delete-form', 'data-life-confirmation', 'data-life-cancel', 'data-life-delete-error']) assert.ok(source.includes(selector), `Fixture contract: ${selector}`);

const entries = {
  anime: [
    { id: 'anime-a', title: 'Original anime', cn_title: '\u4e2d\u6587\u6807\u9898', year: 2026, score: 9.1, status: 'watching', cover_key: 'shared.png', sort_order: 12, note: 'A multiline note\nwith details.', visibility: 'draft' },
    { id: 'anime-b', title: 'Fallback original title', cn_title: '', year: null, score: null, status: 'completed', cover_key: null, sort_order: -2, note: '', visibility: 'archived' }
  ],
  gallery: [
    { id: 'gallery-a', title: 'Gallery title', alt: 'Original alt text', media_key: 'shared.png', sort_order: 11, visibility: 'draft' },
    { id: 'gallery-b', title: 'Other gallery title', alt: '', media_key: 'second.png', sort_order: -3, visibility: 'archived' }
  ]
};
const displayTitle = (entry) => entry.cn_title || entry.title;
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function panel(kind, deleted) {
  const controls = fields[kind].map((name) => {
    const label = source.match(new RegExp(`<label[^>]*>([^<]+)<(?:input|textarea|select)[^>]*name="${name}"`))?.[1];
    assert.ok(label, `Real label for ${name}`);
    if (name === 'visibility') return `<label>${label}<select name="visibility"><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>`;
    if (name === 'note') return `<label class="admin-life__wide">${label}<textarea name="note"></textarea></label>`;
    const numeric = ['year', 'score', 'sort_order'].includes(name);
    return `<label>${label}<input name="${name}" ${numeric ? 'type="number" step="any"' : ''} ${name === 'sort_order' ? 'value="0"' : ''} ${['title', 'media_key'].includes(name) ? 'required' : ''}></label>`;
  }).join('');
  return `<section class="pixel-panel admin-panel admin-life" id="admin-${kind}" data-life-panel="${kind}">
    <div class="admin-panel__head"><h2>${kind === 'anime' ? 'Anime Log' : 'Gallery'}</h2><button class="text-button" type="button" data-life-new>NEW / RESET</button></div>
    <form class="admin-form admin-life__editor" data-life-form="${kind}"><p class="admin-life__selection" data-life-selection>New / published</p><fieldset data-life-fields><input name="id" type="hidden">${controls}<div class="admin-life__wide"><button class="text-button" type="submit">SAVE</button></div></fieldset><output data-life-error></output></form>
    <ul class="admin-life__list">${entries[kind].filter((entry) => !deleted.has(entry.id)).map((entry) => `<li><button class="text-button admin-life__edit" type="button" data-life-entry="${escape(JSON.stringify(entry))}" aria-pressed="false"><strong>${escape(displayTitle(entry))}</strong><span>${entry.visibility}</span><span>EDIT</span></button><button class="text-button danger-button" type="button" data-life-delete data-life-id="${entry.id}" data-life-title="${escape(displayTitle(entry))}">DELETE</button></li>`).join('')}</ul>
    <dialog class="delete-dialog pixel-panel" data-life-delete-dialog><form data-life-delete-form><h2>Delete ${kind}</h2><p>Confirm <strong data-life-delete-title></strong></p><label>Confirmation<input data-life-confirmation autocomplete="off" required autofocus></label><div><button class="text-button" type="button" data-life-cancel>CANCEL</button><button class="text-button danger-button" type="submit">DELETE</button></div><output data-life-delete-error aria-live="polite"></output></form></dialog>
    </section>`;
}

const deleted = new Set();
const deletes = [];
const saves = [];
let pendingDelete;
let pendingSave;
let deleteMode = 'hold';
const contentTypes = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/_fixture/life.js') {
      res.setHeader('Content-Type', 'text/javascript');
      return res.end(builtScript);
    }
    if (url.pathname === '/admin/' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map((name) => `<link rel="stylesheet" href="/_astro/${name}">`).join('')}</head><body><main class="site-main"><section class="admin-grid">${Object.keys(entries).map((kind) => panel(kind, deleted)).join('')}</section></main><script type="module" src="/_fixture/life.js"></script></body></html>`);
    }
    if (req.method === 'DELETE' && /^\/api\/admin\/(anime|gallery)\//.test(url.pathname)) {
      let body = '';
      for await (const chunk of req) body += chunk;
      deletes.push({ path: url.pathname, body: JSON.parse(body) });
      if (deleteMode === 'success') { deleted.add(decodeURIComponent(url.pathname.split('/').at(-1))); return json(res, 200, { ok: true }); }
      pendingDelete = res;
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/content') {
      let body = '';
      for await (const chunk of req) body += chunk;
      saves.push(JSON.parse(body));
      pendingSave = res;
      return;
    }
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
    const base = resolve(root, url.pathname.startsWith('/_astro/') ? 'dist' : 'public');
    const path = resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(base + sep)) { res.statusCode = 403; return res.end(); }
    res.setHeader('Content-Type', contentTypes[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});

let browser;
let page;
const errors = [];
const screenshots = await mkdtemp(join(tmpdir(), 'hydroxy-life-browser-'));
const waitCount = async (values, count) => {
  for (let i = 0; i < 100 && values.length < count; i++) await new Promise((done) => setTimeout(done, 20));
  assert.equal(values.length, count);
};
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    deleted.clear();
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/admin/?anime_page=2&gallery_page=3`);
    await page.waitForLoadState('networkidle');
    for (const kind of Object.keys(entries)) {
      const container = page.locator(`[data-life-panel="${kind}"]`);
      const form = container.locator('[data-life-form]');
      const buttons = container.locator('[data-life-entry]');
      const reset = container.locator('[data-life-new]');
      const dialog = container.locator('[data-life-delete-dialog]');
      const confirmation = dialog.locator('[data-life-confirmation]');
      const submit = dialog.locator('button[type="submit"]');
      const cancel = dialog.locator('[data-life-cancel]');
      for (const field of fields[kind]) {
        const control = form.locator(`[name="${field}"]`);
        assert.equal(await control.isVisible(), true, `${kind}/${field} visible at ${viewport.width}`);
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1, `${kind}/${field} fits viewport`);
      }
      await buttons.nth(0).click();
      for (const [key, value] of Object.entries(entries[kind][0])) assert.equal(await form.locator(`[name="${key}"]`).inputValue(), value == null ? '' : String(value));
      assert.equal(await buttons.nth(0).getAttribute('aria-pressed'), 'true');
      assert.match(await container.locator('[data-life-selection]').innerText(), /draft/);
      await buttons.nth(1).click();
      for (const [key, value] of Object.entries(entries[kind][1])) assert.equal(await form.locator(`[name="${key}"]`).inputValue(), value == null ? '' : String(value));
      assert.equal(await buttons.nth(0).getAttribute('aria-pressed'), 'false');
      await reset.click();
      assert.equal(await form.locator('[name="id"]').inputValue(), '');
      assert.equal(await form.locator('[name="title"]').inputValue(), '');
      assert.equal(await form.locator('[name="sort_order"]').inputValue(), '0');
      assert.equal(await form.locator('[name="visibility"]').inputValue(), 'published');
      assert.deepEqual(await buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-pressed'))), ['false', 'false']);

      // Deleting a different row must not select it or overwrite unsaved editor data.
      await buttons.nth(0).click();
      await form.locator('[name="title"]').fill('Unsaved title');
      const initialDeletes = deletes.length;
      const open = () => container.locator('[data-life-delete]').nth(1).click();
      await open();
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await dialog.locator('[data-life-delete-title]').innerText(), displayTitle(entries[kind][1]));
      assert.equal(await form.locator('[name="id"]').inputValue(), entries[kind][0].id);
      assert.equal(await form.locator('[name="title"]').inputValue(), 'Unsaved title');
      await cancel.click();
      assert.equal(await dialog.isVisible(), false);
      assert.equal(deletes.length, initialDeletes);
      await open();
      await confirmation.fill('mismatch');
      await submit.click();
      assert.equal(deletes.length, initialDeletes);
      assert.notEqual(await dialog.locator('[data-life-delete-error]').innerText(), '');
      await cancel.click();
      await open();
      assert.equal(await confirmation.inputValue(), '');
      assert.equal(await dialog.locator('[data-life-delete-error]').innerText(), '');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), false);

      for (const [status, message] of [[400, 'Title changed'], [404, 'Record missing'], [409, 'Concurrent rename'], [500, 'Server failed']]) {
        await open();
        await confirmation.fill(displayTitle(entries[kind][1]));
        deleteMode = 'hold';
        const count = deletes.length;
        await submit.click();
        await waitCount(deletes, count + 1);
        assert.equal(await dialog.locator('[data-life-delete-form]').getAttribute('aria-busy'), 'true');
        assert.equal(await confirmation.isDisabled(), true);
        assert.equal(await submit.isDisabled(), true);
        assert.equal(await cancel.isDisabled(), true);
        if (status === 500) await page.screenshot({ path: join(screenshots, `${kind}-busy-${viewport.width}.png`), fullPage: true });
        await page.keyboard.press('Escape');
        assert.equal(await dialog.isVisible(), true, 'Escape cannot dismiss a pending deletion');
        await dialog.locator('form').evaluate((node) => { for (let i = 0; i < 3; i++) node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
        assert.equal(deletes.length, count + 1);
        assert.deepEqual(deletes.at(-1), { path: `/api/admin/${kind}/${entries[kind][1].id}`, body: { confirmation: displayTitle(entries[kind][1]) } });
        json(pendingDelete, status, { error: message });
        pendingDelete = undefined;
        await page.waitForFunction(({ kind, message }) => document.querySelector(`[data-life-panel="${kind}"] [data-life-delete-error]`).textContent === message, { kind, message });
        assert.equal(await submit.isDisabled(), false);
        assert.equal(await dialog.isVisible(), true);
        assert.equal(await form.locator('[name="title"]').inputValue(), 'Unsaved title');
        await cancel.click();
      }

      await open();
      await confirmation.fill(displayTitle(entries[kind][1]));
      const networkCount = deletes.length;
      await page.route(`**/api/admin/${kind}/${entries[kind][1].id}`, (route) => route.abort('failed'), { times: 1 });
      await submit.click();
      await page.waitForFunction((kind) => Boolean(document.querySelector(`[data-life-panel="${kind}"] [data-life-delete-error]`).textContent), kind);
      assert.equal(deletes.length, networkCount);
      assert.equal(await submit.isDisabled(), false);
      assert.equal(await dialog.isVisible(), true);
      await cancel.click();

      // Save uses the selected ID and all form fields; a failed save preserves them.
      const saveCount = saves.length;
      await form.locator('button[type="submit"]').click();
      await waitCount(saves, saveCount + 1);
      assert.equal(await form.getAttribute('aria-busy'), 'true');
      assert.equal(await reset.isDisabled(), true);
      await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(saves.length, saveCount + 1);
      assert.equal(saves.at(-1).action, kind === 'anime' ? 'saveAnime' : 'saveGallery');
      assert.equal(saves.at(-1).entry.id, entries[kind][0].id);
      assert.equal(saves.at(-1).entry.title, 'Unsaved title');
      for (const field of fields[kind]) assert.ok(Object.hasOwn(saves.at(-1).entry, field));
      json(pendingSave, 500, { error: 'Save failed locally' });
      pendingSave = undefined;
      await page.waitForFunction((kind) => document.querySelector(`[data-life-panel="${kind}"] [data-life-error]`).textContent === 'Save failed locally', kind);
      assert.equal(await reset.isDisabled(), false);
      assert.equal(await form.locator('[name="title"]').inputValue(), 'Unsaved title');
      await container.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(screenshots, `${kind}-${viewport.width}.png`), fullPage: true });

      deleteMode = 'success';
      await open();
      await confirmation.fill(displayTitle(entries[kind][1]));
      await Promise.all([page.waitForEvent('load'), submit.click()]);
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).hash, `#admin-${kind}`);
      assert.equal(new URL(page.url()).searchParams.get('anime_page'), '2');
      assert.equal(new URL(page.url()).searchParams.get('gallery_page'), '3');
      assert.equal(await page.locator(`[data-life-panel="${kind}"] [data-life-entry]`).count(), 1);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'No horizontal overflow');
  }
  assert.deepEqual(errors, []);
  console.log(`Life browser regression passed (desktop/mobile). Screenshots: ${screenshots}`);
} finally {
  pendingDelete?.destroy();
  pendingSave?.destroy();
  await browser?.close();
  await new Promise((done) => server.close(done));
}
