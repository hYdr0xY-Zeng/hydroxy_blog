// Build first; run with Node 24+ and PLAYWRIGHT_MODULE pointing to Playwright if needed.
// Uses local HTML fixtures and the real built editor script, not authenticated SSR or D1.
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
const editorSource = await readFile(join(root, 'src/pages/admin/editor/[id].astro'), 'utf8');
const adminSource = await readFile(join(root, 'src/pages/admin/index.astro'), 'utf8');
const assets = await readdir(join(root, 'dist/_astro'));
const editor = assets.find((name) => name.startsWith('_id_.astro_astro_type_script_') && name.endsWith('.js'));
const css = assets.find((name) => name.endsWith('.css'));
assert.ok(editor && css, 'Run npm run build first.');
assert.match(await readFile(join(root, 'dist/_astro', editor), 'utf8'), /directoryIntro/, 'Rebuild after directory editor changes.');

// These wiring checks supplement the client fixture; CMS tests cover directory-only filtering.
assert.match(editorSource, /name="kind" value="learn"/);
assert.match(editorSource, /name="directory_path" value=\{path\}/);
assert.match(editorSource, /data-directory-intro=\{isDirectoryIntro/);
assert.match(editorSource, /readonly=\{isDirectoryIntro\}/);
assert.match(editorSource, /existing\?\.learn_node_type === 'directory'/);
assert.match(editorSource, /directoryNode\?\.node_type !== 'directory'/);
for (const source of [editorSource, adminSource]) {
  assert.match(source, /listLearnDirectories\(Astro\.locals\)/);
  assert.match(source, /directories\.map\(\(directory\) => <option value=\{directory\.path\}/);
  assert.doesNotMatch(source, /(?:adminTree|tree)\.(?:byPath|roots).*<option/);
}
assert.match(adminSource, /directory\.document_id \? `\/admin\/editor\/\$\{directory\.document_id\}`/);
assert.match(adminSource, /\/admin\/editor\/new\?directory=\$\{encodeURIComponent\(directory\.path\)\}/);

const directoryPath = 'computer-science/Legacy_Directory';
const childPath = directoryPath + '/child-article';
function fixture(mode) {
  const intro = mode !== 'article';
  const existing = mode === 'existing';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/_astro/${css}"></head><body><main class="site-main">
    <form class="editor-console" data-editor-form data-directory-intro="${intro}" data-learn-parent-path="${intro ? 'computer-science' : directoryPath}" data-learn-slug="${intro ? 'Legacy_Directory' : 'child-article'}">
      <header class="editor-toolbar pixel-panel"><h1>Directory regression</h1><output data-editor-save-status></output><button type="submit" data-status="draft">SAVE DRAFT</button><button type="submit" data-status="published">PUBLISH</button></header>
      <details class="editor-metadata pixel-panel" open><summary>METADATA</summary><div class="editor-fields">
        <input type="hidden" name="id" value="${existing ? 'intro-document' : intro ? '' : 'child-document'}">
        ${intro ? `<input type="hidden" name="kind" value="learn"><input type="hidden" name="directory_path" value="${directoryPath}">` : ''}
        <label>Kind<select name="kind" data-kind-select ${intro ? 'disabled' : ''}><option value="learn">Learn</option><option value="essay">Essay</option></select></label>
        <label data-path-field>Path<input name="path" value="${intro ? directoryPath : childPath}" ${intro ? 'readonly' : ''}></label>
        <div data-learn-path-fields><label>Directory<select name="parent_path" data-learn-parent ${intro ? 'disabled' : ''}><option value="">/learn</option><option value="computer-science" ${intro ? 'selected' : ''}>Computer Science</option><option value="${directoryPath}" ${intro ? '' : 'selected'}>Legacy Directory</option></select></label>
          <label>Slug<input name="slug" data-learn-slug value="${intro ? 'Legacy_Directory' : 'child-article'}" ${intro ? 'disabled readonly' : ''}></label>
          <label>Order<input name="sort_order" data-learn-sort-order type="number" value="37" ${intro ? 'disabled' : ''}></label><output data-learn-path-preview></output></div>
        <label>Title<input name="title" value="Directory introduction" required></label><label>Markdown<textarea name="body_markdown">## Introduction</textarea></label>
      </div></details>
    </form></main><script type="module" src="/_astro/${editor}"></script></body></html>`;
}

const saves = [];
const contentTypes = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (['/new', '/existing', '/article'].includes(url.pathname)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(fixture(url.pathname.slice(1)));
    }
    if (url.pathname === '/api/admin/content' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      saves.push(JSON.parse(body));
      // Deliberate failure avoids new-document navigation and any real write.
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Captured locally; nothing saved.' }));
    }
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
    const base = resolve(root, url.pathname.startsWith('/_astro/') ? 'dist' : 'public');
    const file = resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + sep)) { res.statusCode = 403; return res.end(); }
    res.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});

let browser;
let page;
const errors = [];
const failedRequests = [];
const screenshots = await mkdtemp(join(tmpdir(), 'hydroxy-directory-browser-'));
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) return route.abort();
    return route.continue();
  });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['new', 'existing']) {
      await page.goto(`${origin}/${mode}`);
      await page.waitForFunction(() => document.querySelector('input[data-learn-slug]').required === false && document.querySelector('input[data-learn-slug]').disabled && document.querySelector('[data-learn-path-fields]').hidden);
      assert.equal(await page.locator('[data-kind-select]').isDisabled(), true);
      assert.equal(await page.locator('input[name="path"]').getAttribute('readonly'), '');
      assert.equal(await page.locator('input[name="path"]').inputValue(), directoryPath);
      assert.equal(await page.locator('[data-learn-parent]').isDisabled(), true);
      assert.equal(await page.locator('input[data-learn-slug]').isDisabled(), true);
      assert.equal(await page.locator('[data-learn-path-fields]').isVisible(), false);
      assert.equal(await page.locator('[data-document-delete], [data-delete-dialog]').count(), 0);
      const values = await page.locator('form').evaluate((form) => Object.fromEntries(new FormData(form)));
      assert.equal(values.kind, 'learn');
      assert.equal(values.directory_path, directoryPath);
      assert.ok(!Object.hasOwn(values, 'parent_path') && !Object.hasOwn(values, 'slug'));
      await page.locator('input[name="title"]').fill('Edited introduction');
      await page.locator('textarea').fill('## Edited body\n\nDirectory content.');
      assert.equal(await page.locator('form').evaluate((form) => form.checkValidity()), true, 'Legacy directory paths must not trigger article slug validation.');
      for (const status of ['draft', 'published']) {
        const response = page.waitForResponse((res) => res.url() === origin + '/api/admin/content');
        await page.locator(`[data-status="${status}"]`).click();
        await response;
        await page.waitForFunction(() => document.querySelector('[data-editor-save-status]').dataset.state === 'error');
        const payload = saves.at(-1);
        assert.equal(payload.action, 'saveDocument');
        assert.equal(payload.document.id, mode === 'existing' ? 'intro-document' : '');
        assert.equal(payload.document.kind, 'learn');
        assert.equal(payload.document.path, directoryPath);
        assert.equal(payload.document.directory_path, directoryPath);
        assert.equal(payload.document.title, 'Edited introduction');
        assert.equal(payload.document.body_markdown, '## Edited body\n\nDirectory content.');
        assert.equal(payload.document.status, status);
        for (const field of ['parent_path', 'slug', 'sort_order']) assert.ok(!Object.hasOwn(payload.document, field), `${field} must not mutate a directory through its introduction.`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow.');
      await page.screenshot({ path: join(screenshots, `${mode}-${viewport.width}.png`), fullPage: true });
    }
  }
  await page.goto(origin + '/article');
  await page.waitForFunction(() => document.querySelector('input[data-learn-slug]').required);
  assert.equal(await page.locator('[data-kind-select]').isDisabled(), false);
  assert.deepEqual(await page.locator('[data-learn-parent] option').evaluateAll((options) => options.map((option) => option.value)), ['', 'computer-science', directoryPath]);
  assert.equal(await page.locator(`[data-learn-parent] option[value="${childPath}"]`).count(), 0);
  await page.locator('[data-learn-parent]').selectOption(directoryPath);
  await page.locator('input[data-learn-slug]').fill('updated-child');
  const response = page.waitForResponse((res) => res.url() === origin + '/api/admin/content');
  await page.locator('[data-status="draft"]').click();
  await response;
  assert.equal(saves.at(-1).document.parent_path, directoryPath);
  assert.equal(saves.at(-1).document.slug, 'updated-child');
  assert.equal(saves.at(-1).document.sort_order, 37);
  assert.ok(!Object.hasOwn(saves.at(-1).document, 'directory_path'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ tests: 'Directory source wiring, new/existing intro locks, draft/publish payloads, legacy paths, mobile layout, article payload isolation', saves: saves.length, screenshots }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ errors, failedRequests, screenshots }, null, 2));
  await page?.screenshot({ path: join(screenshots, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await browser?.close();
  if (server.listening) await new Promise((done) => server.close(done));
}
