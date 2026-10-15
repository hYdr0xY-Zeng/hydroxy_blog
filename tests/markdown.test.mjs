import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { renderMarkdown } from '../src/lib/markdown.ts';

test('KaTeX renderer, CSS and Mermaid resolve the same pinned version', () => {
  const require = createRequire(import.meta.url);
  const root = require('katex/package.json').version;
  const rehype = createRequire(require.resolve('rehype-katex')).resolve('katex/package.json');
  const mermaid = createRequire(require.resolve('mermaid')).resolve('katex/package.json');
  assert.equal(root, '0.16.47');
  assert.equal(JSON.parse(readFileSync(rehype, 'utf8')).version, root);
  assert.equal(JSON.parse(readFileSync(mermaid, 'utf8')).version, root);
});

test('math, headings, code and Mermaid keep the shared HTML contract', async () => {
  const source = '## Example\n\n$$\\boxed{\\nabla^2p=\\frac{\\rho}{\\Delta t}\\nabla\\cdot u}$$\n\n```cpp\nint value = 1;\n```\n\n```mermaid\nflowchart LR\nA-->B\n```';
  const first = await renderMarkdown(source);
  const second = await renderMarkdown(source + '\n\nNew text');
  assert.deepEqual(first.headings, [{ depth: 2, slug: 'example', text: 'Example' }]);
  assert.match(first.html, /class="[^\"]*fbox/);
  assert.match(first.html, /data-language="cpp"/);
  assert.match(first.html, /class="shiki/);
  assert.match(first.html, /data-language="mermaid"/);
  assert.equal(second.html, first.html + '\n<p>New text</p>');
  assert.deepEqual(second.headings, first.headings);
});
