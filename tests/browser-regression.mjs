// Run after npm run build. PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { renderMarkdown } from '../src/lib/markdown.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = await readdir(join(root, 'dist/_astro'));
const editor = assets.find((name) => name.startsWith('_id_.astro_astro_type_script_') && name.endsWith('.js'));
const layout = assets.find((name) => name.startsWith('BaseLayout.astro_astro_type_script_') && name.endsWith('.js'));
const css = assets.find((name) => name.endsWith('.css'));
assert.ok(editor && layout && css, 'Build the project before browser tests.');
const benchmark = '# Synthetic preview benchmark\n\n' + Array.from({ length: 32 }, (_, section) => [
  `## Iteration ${section}`,
  'This generated workload exercises incremental Markdown rendering, code highlighting, and unchanged code-node reuse without relying on published content.',
  '```cpp',
  `int reduce_${section}(const std::vector<int>& values) {`,
  '    int total = 0;',
  ...Array.from({ length: 8 }, (_, line) => `    total += values[${line}] * ${section + line + 1};`),
  '    return total;',
  '}',
  '```',
  `- Sample ${section}: deterministic input\n- Expected result: stable highlighted blocks`
].join('\n\n')).join('\n\n');
assert.ok(Buffer.byteLength(benchmark) >= 18000 && Buffer.byteLength(benchmark) <= 24000, 'Keep the synthetic performance sample approximately 20 KB.');
const sample = '## Math\n\n$$\n\\boxed{\\nabla^2p^{n+1}=\\frac{\\rho}{\\Delta t}\\nabla\\cdot\\mathbf u^*}\n$$\n\n$$\n\\sqrt{x^2+y^2}, \\left|x\\right|, \\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$\n\n$$\n\\boxed{\\text{A deliberately wide formula tests horizontal scrolling without overflowing the article}}\n$$\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\nsequenceDiagram\nA->>B: Hello\n```\n\n```mermaid\nnot a diagram\n```\n\n```cpp\nint x = 1;\n```\n\n' + Array.from({length: 30}, (_, i) => `Paragraph ${i}.\n\n`).join('');
const escaped = (value) => value.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shell = (body, script) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/_astro/${css}"></head><body><header class="site-header"><div class="site-header__inner">HYDROXY WIKI</div></header><main class="site-main">${body}</main><script type="module" src="/_astro/${script}"></script></body></html>`;
function editorPage(source) {
  return shell(`<form class="editor-console" data-editor-form data-learn-parent-path="computer-science/XCPC-Algorithm/data-structrue" data-learn-slug="template">
    <header class="editor-toolbar pixel-panel"><div><h1>Data Structure</h1><output data-editor-save-status></output></div><div class="editor-toolbar__actions"><button type="button" data-editor-sync>SYNC: ON</button><button type="submit" data-status="draft">SAVE DRAFT</button><button type="submit" data-status="published">PUBLISH</button></div></header>
    <div class="editor-shell"><details class="editor-metadata pixel-panel" open><summary>METADATA</summary><div class="editor-fields"><input name="id" type="hidden" value="test-document"><label>Kind<select name="kind" data-kind-select><option value="learn">Learn</option><option value="essay">Essay</option></select></label><label data-path-field>Path<input name="path" value="old/path"></label><div data-learn-path-fields><label>Directory<select name="parent_path" data-learn-parent><option value="">/learn</option><option selected value="computer-science/XCPC-Algorithm/data-structrue">Data Structure</option></select></label><label>Slug<input name="slug" data-learn-slug value="template" pattern="[a-z0-9]+(-[a-z0-9]+)*" required></label><input name="sort_order" data-learn-sort-order type="number" value="9999"><output data-learn-path-preview></output></div><label>Title<input name="title" value="Data Structure" required></label></div></details>
    <section class="editor-workspace" data-editor-workspace data-active-pane="edit"><div class="editor-pane-tabs" role="tablist"><button type="button" data-editor-tab="edit">EDIT</button><button type="button" data-editor-tab="preview">PREVIEW</button></div><section class="editor-markdown editor-pane pixel-panel" data-editor-pane="edit"><label>Markdown<textarea name="body_markdown" data-markdown-input>${escaped(source)}</textarea></label></section><section class="editor-preview editor-pane pixel-panel" data-editor-pane="preview"><h2>Preview</h2><output class="editor-preview-status" data-preview-status></output><article class="prose" data-preview></article></section></section></div></form>`, editor);
}
const saved = [];
let previewRequests = 0;
let failPreview = false;
const contentTypes = {'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml'};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/editor') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(editorPage(url.searchParams.has('sample') ? sample : benchmark));
    }
    if (url.pathname === '/article') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(shell(`<article class="prose article-body pixel-panel">${(await renderMarkdown(sample)).html}</article>`, layout));
    }
    if (url.pathname.startsWith('/api/admin/')) {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname.endsWith('/content')) {
        saved.push(payload.document);
        return res.end(JSON.stringify({ document: { id: 'test-document' } }));
      }
      previewRequests++;
      if (failPreview) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'Simulated preview failure' })); }
      if (payload.markdown.includes('SLOW_REQUEST')) await new Promise((done) => setTimeout(done, 400));
      return res.end(JSON.stringify(await renderMarkdown(payload.markdown)));
    }
    const base = resolve(root, url.pathname.startsWith('/_astro/') ? 'dist' : 'public');
    const file = resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + sep)) { res.statusCode = 403; return res.end(); }
    res.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const screenshots = await mkdtemp(join(tmpdir(), 'hydroxy-browser-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const failedRequests = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) { super(...args); this.addEventListener('error', (event) => console.warn('Worker error: ' + event.message)); }
  };
});
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'warning') console.warn(message.text()); });
page.on('requestfailed', (req) => failedRequests.push({url:req.url(),error:req.failure()?.errorText}));
const ready = (p) => p.waitForFunction(() => document.querySelector('[data-preview] pre.shiki') && !document.querySelector('[data-preview-status]').textContent, { timeout: 20000 });
try {
  const coldStart = Date.now();
  await page.goto(origin + '/editor');
  await ready(page);
  const coldMs = Date.now() - coldStart;
  assert.equal(previewRequests, 0);
  await page.locator('[data-preview] pre').first().evaluate((node) => { window.originalCodeBlock = node; });
  const latencies = [];
  for (let i = 0; i < 20; i++) {
    const start = Date.now();
    await page.locator('textarea').evaluate((el, {source, i}) => { el.value = source + `\n\nMARKER_${i}`; el.dispatchEvent(new Event('input', {bubbles:true})); }, {source: benchmark, i});
    await page.waitForFunction((i) => document.querySelector('[data-preview]').textContent.trim().endsWith(`MARKER_${i}`), i);
    latencies.push(Date.now() - start);
  }
  assert.ok(await page.locator('[data-preview] pre').first().evaluate((node) => node === window.originalCodeBlock));
  assert.equal(previewRequests, 0);
  await page.locator('textarea').evaluate((el) => { el.dispatchEvent(new CompositionEvent('compositionstart')); el.value = '## COMPOSING'; el.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(300);
  assert.ok(!(await page.locator('[data-preview]').textContent()).includes('COMPOSING'));
  await page.locator('textarea').dispatchEvent('compositionend');
  await page.waitForFunction(() => document.querySelector('[data-preview]').textContent.includes('COMPOSING'));
  await page.locator('[data-learn-parent]').selectOption('');
  await page.getByText('PUBLISH', {exact:true}).click();
  await page.waitForFunction(() => document.querySelector('[data-editor-save-status]').textContent.includes('SAVED'));
  assert.equal(saved.at(-1).parent_path, '');
  assert.equal(saved.at(-1).status, 'published');
  await page.locator('[data-learn-parent]').selectOption('computer-science/XCPC-Algorithm/data-structrue');
  await page.evaluate(() => { const form=document.querySelector('form'); form.dataset.learnSlug='Old_Name'; const slug=document.querySelector('input[data-learn-slug]'); slug.value='Old_Name'; slug.dispatchEvent(new Event('input')); });
  assert.equal(await page.locator('form').evaluate((form) => form.checkValidity()), true);
  await page.locator('input[data-learn-slug]').fill('New_Invalid');
  assert.equal(await page.locator('form').evaluate((form) => form.checkValidity()), false);

  await page.goto(origin + '/editor?sample');
  await page.waitForFunction(() => document.querySelectorAll('.mermaid-diagram svg').length === 2 && document.querySelector('.mermaid-figure--error') && !document.querySelector('[data-preview-status]').textContent, {timeout:20000});
  const diagramIds = await page.locator('.mermaid-diagram svg').evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(new Set(diagramIds).size, 2);
  assert.ok(await page.locator('.mermaid-diagram svg').evaluateAll((nodes) => nodes.every((n) => n.viewBox.baseVal.width > 0)));
  assert.equal(await page.locator('.mermaid-figure .copy-code').count(), 0);
  assert.ok(await page.locator('.fbox').first().evaluate((node) => node.getBoundingClientRect().width > 100));
  await page.locator('textarea').fill(sample + '\n\nUpdated paragraph');
  await page.waitForFunction(() => document.querySelector('[data-preview]').textContent.includes('Updated paragraph') && !document.querySelector('[data-preview-status]').textContent);
  assert.deepEqual(await page.locator('.mermaid-diagram svg').evaluateAll((nodes) => nodes.map((n) => n.id)), diagramIds);
  await page.locator('textarea').fill(sample.replace('A-->B', 'A-->D'));
  await page.waitForFunction((id) => document.querySelector('.mermaid-diagram svg')?.id !== id && document.querySelectorAll('.mermaid-diagram svg').length === 2, diagramIds[0]);
  assert.equal(await page.locator('.mermaid-diagram svg').nth(1).getAttribute('id'), diagramIds[1]);
  await page.locator('textarea').evaluate((el) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * .5; });
  await page.waitForFunction(() => {
    const input = document.querySelector('textarea'), pane = document.querySelector('[data-editor-pane="preview"]');
    return Math.abs(input.scrollTop / (input.scrollHeight - input.clientHeight) - pane.scrollTop / (pane.scrollHeight - pane.clientHeight)) < .02;
  });
  await page.locator('[data-editor-sync]').click();
  const heldScroll = await page.locator('[data-editor-pane="preview"]').evaluate((el) => el.scrollTop);
  await page.locator('textarea').evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(100);
  assert.ok(Math.abs(await page.locator('[data-editor-pane="preview"]').evaluate((el) => el.scrollTop) - heldScroll) < 2);
  await page.locator('textarea').fill(sample + '\n\nScroll-preserving update');
  await page.waitForFunction(() => document.querySelector('[data-preview]').textContent.includes('Scroll-preserving update'));
  assert.ok((await page.locator('[data-editor-pane="preview"]').evaluate((el) => el.scrollTop)) > 100);
  await page.locator('[data-editor-pane="preview"]').evaluate((el) => { el.scrollTop = 0; });
  await page.screenshot({path:join(screenshots,'editor-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-editor-tab="preview"]').click();
  assert.equal(await page.locator('[data-editor-pane="edit"]').isVisible(), false);
  assert.equal(await page.locator('[data-editor-pane="preview"]').isVisible(), true);
  await page.screenshot({path:join(screenshots,'editor-mobile.png')});

  const fallback = await browser.newPage();
  await fallback.route('**/markdown.worker-*.js', (route) => route.abort());
  await fallback.goto(origin + '/editor?sample');
  await fallback.waitForFunction(() => document.querySelector('[data-preview-status]').textContent === 'SERVER PREVIEW', {timeout:20000});
  assert.ok(previewRequests > 0);
  const lastHtml = await fallback.locator('[data-preview]').innerHTML();
  failPreview = true;
  await fallback.locator('textarea').fill('New text that fails');
  await fallback.waitForFunction(() => document.querySelector('[data-preview-status]').dataset.state === 'error');
  assert.equal(await fallback.locator('[data-preview]').innerHTML(), lastHtml);
  assert.equal(await fallback.locator('textarea').inputValue(), 'New text that fails');
  failPreview = false;
  await fallback.locator('textarea').fill('SLOW_REQUEST old text');
  await fallback.waitForTimeout(180);
  await fallback.locator('textarea').fill('LATEST_REQUEST');
  await fallback.waitForFunction(() => document.querySelector('[data-preview]').textContent.trim() === 'LATEST_REQUEST');
  await fallback.waitForTimeout(500);
  assert.equal((await fallback.locator('[data-preview]').textContent()).trim(), 'LATEST_REQUEST');
  await fallback.close();

  const scheduler = await browser.newPage();
  await scheduler.route('**/markdown.worker-*.js', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'self.onmessage = ({data}) => setTimeout(() => self.postMessage({version:data.version,html:"<p>" + data.markdown.slice(-30) + "</p>"}), 400);'
  }));
  await scheduler.goto(origin + '/editor');
  await scheduler.evaluate(() => {
    window.appliedResults = [];
    new MutationObserver(() => window.appliedResults.push(document.querySelector('[data-preview]').textContent))
      .observe(document.querySelector('[data-preview]'), {childList:true});
  });
  await scheduler.locator('textarea').fill('LATEST_WORKER_SNAPSHOT');
  await scheduler.waitForFunction(() => document.querySelector('[data-preview]').textContent === 'LATEST_WORKER_SNAPSHOT');
  assert.deepEqual(await scheduler.evaluate(() => window.appliedResults), ['LATEST_WORKER_SNAPSHOT']);
  await scheduler.close();

  const publicPage = await browser.newPage({viewport:{width:390,height:844}});
  const publicRequests = [];
  publicPage.on('request', (req) => publicRequests.push(req.url()));
  await publicPage.goto(origin + '/article');
  await publicPage.waitForFunction(() => document.querySelectorAll('.mermaid-diagram svg').length === 2);
  assert.ok(!publicRequests.some((url) => url.includes('markdown.worker-')));
  await publicPage.locator('.fbox').first().scrollIntoViewIfNeeded();
  assert.ok(await publicPage.locator('.katex-display').last().evaluate((el) => el.scrollWidth > el.clientWidth));
  assert.ok(await publicPage.locator('.fbox').evaluateAll((nodes) => nodes.every((node) => {
    const box = node.getBoundingClientRect(), clip = node.closest('.katex-display').getBoundingClientRect();
    return box.top >= clip.top && box.bottom <= clip.bottom;
  })), 'Display math must not clip the top or bottom of its box');
  assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await publicPage.screenshot({path:join(screenshots,'math-mobile.png')});
  assert.deepEqual(errors, []);
  if (process.env.PREVIEW_ORIGIN) {
    const remote = await browser.newPage();
    const remoteOrigin = process.env.PREVIEW_ORIGIN.replace(/\/$/, '');
    const apiCalls = [];
    remote.on('request', (req) => { if (req.url().includes('/api/admin/')) apiCalls.push(req.url()); });
    // Only the fixture HTML is local; all CSS, fonts, Worker and diagram chunks come from preview.
    await remote.route(remoteOrigin + '/__editor-regression', (route) => route.fulfill({contentType:'text/html',body:editorPage(sample)}));
    await remote.goto(remoteOrigin + '/__editor-regression');
    await remote.waitForFunction(() => document.querySelectorAll('.mermaid-diagram svg').length === 2 && !document.querySelector('[data-preview-status]').textContent, null, {timeout:45000});
    assert.equal(apiCalls.length, 0);
    assert.ok(await remote.locator('.fbox').first().evaluate((node) => node.getBoundingClientRect().width > 100));
    console.log('Deployed preview Worker, math and diagram assets passed: ' + remoteOrigin);
    await remote.close();
  }
  latencies.sort((a,b)=>a-b);
  const p95 = latencies[Math.ceil(latencies.length * .95) - 1];
  assert.ok(p95 <= 500, `Warm preview P95 ${p95}ms exceeded 500ms`);
  console.log(JSON.stringify({coldMs,warmMedianMs:latencies[10],warmP95Ms:p95,workerPreviewRequests:0,screenshots,tests:'publication payload, legacy slug, IME, worker preview, node reuse, Mermaid, math, mobile, fallback and stale requests passed'},null,2));
} catch (error) {
  console.error(JSON.stringify({errors,failedRequests,status:await page.locator('[data-preview-status]').textContent(),preview:(await page.locator('[data-preview]').textContent()).slice(0,400),previewRequests}));
  await page.screenshot({path:join(screenshots,'failure.png')});
  console.error('Failure screenshot: ' + screenshots);
  throw error;
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
