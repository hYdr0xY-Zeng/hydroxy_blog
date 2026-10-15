const sourceKeys = new WeakMap<Node, string>();
const pendingDiagrams = new WeakMap<HTMLPreElement, Promise<void>>();
let mermaidQueue = Promise.resolve();
let mermaidInstance: Promise<typeof import('mermaid')['default']> | undefined;
const renderPrefix = `mermaid-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
let renderSequence = 0;

function getMermaid() {
  mermaidInstance ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        background: '#050505', primaryColor: '#15131a', primaryTextColor: '#fff7f7',
        primaryBorderColor: '#d48bab', lineColor: '#f19abd', secondaryColor: '#130d13',
        tertiaryColor: '#0c0b10', textColor: '#fff7f7', mainBkg: '#15131a',
        nodeBorder: '#d48bab', clusterBkg: '#0c0b10', clusterBorder: '#6b334d',
        edgeLabelBackground: '#050505', fontFamily: 'var(--font-pixel)'
      }
    });
    return mermaid;
  }).catch((error) => { mermaidInstance = undefined; throw error; });
  return mermaidInstance;
}

// Remember unenhanced HTML so COPY buttons and rendered SVGs do not invalidate a block.
export function reconcilePreview(root: HTMLElement, html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const available = new Map<string, Node[]>();
  for (const node of root.childNodes) {
    const key = sourceKeys.get(node);
    if (key !== undefined) available.set(key, [...(available.get(key) ?? []), node]);
  }
  const desired = Array.from(template.content.childNodes, (node) => {
    const key = node instanceof Element ? `element:${node.outerHTML}` : `text:${node.textContent}`;
    const retained = available.get(key)?.shift() ?? node;
    sourceKeys.set(retained, key);
    return retained;
  });
  let cursor = root.firstChild;
  for (const node of desired) {
    if (node === cursor) cursor = cursor.nextSibling;
    else root.insertBefore(node, cursor);
  }
  while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
}

async function renderDiagram(pre: HTMLPreElement, root: HTMLElement | Document) {
  if (!pre.isConnected || !root.contains(pre)) return;
  const mermaid = await getMermaid();
  if (!pre.isConnected || !root.contains(pre)) return;
  const code = pre.querySelector('code');
  const lines = code ? Array.from(code.querySelectorAll('.line')) : [];
  const source = (lines.length ? lines.map((line) => line.textContent).join('\n') : code?.textContent)?.trim();
  if (!source) return;
  const figure = document.createElement('figure');
  const diagram = document.createElement('div');
  figure.className = 'mermaid-figure';
  diagram.className = 'mermaid-diagram';
  figure.append(diagram);
  let bindFunctions: ((element: Element) => void) | undefined;
  try {
    const rendered = await mermaid.render(`${renderPrefix}-${++renderSequence}`, source);
    diagram.innerHTML = rendered.svg;
    bindFunctions = rendered.bindFunctions;
  } catch (error) {
    figure.classList.add('mermaid-figure--error');
    diagram.textContent = source;
    const message = document.createElement('figcaption');
    message.textContent = `Mermaid render failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    figure.append(message);
  }
  if (!pre.isConnected || !root.contains(pre)) return;
  const key = sourceKeys.get(pre);
  if (key !== undefined) sourceKeys.set(figure, key);
  pre.replaceWith(figure);
  try { bindFunctions?.(diagram); }
  catch (error) { console.warn('Mermaid interactions failed to bind', error); }
}

export async function enhanceMarkdown(root: HTMLElement | Document = document) {
  const jobs: Promise<void>[] = [];
  root.querySelectorAll<HTMLPreElement>('.prose pre').forEach((pre) => {
    if (pre.dataset.language === 'mermaid') {
      const pending = pendingDiagrams.get(pre);
      if (pending) { jobs.push(pending); return; }
      const job = mermaidQueue.then(() => renderDiagram(pre, root));
      mermaidQueue = job.catch(() => {});
      const tracked = job.finally(() => pendingDiagrams.delete(pre));
      pendingDiagrams.set(pre, tracked);
      jobs.push(tracked);
      return;
    }
    if (pre.querySelector(':scope > .copy-code')) return;
    const button = document.createElement('button');
    button.className = 'copy-code';
    button.type = 'button';
    button.textContent = 'COPY';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code')?.textContent || '');
        button.textContent = 'DONE';
      } catch { button.textContent = 'FAILED'; }
      window.setTimeout(() => { button.textContent = 'COPY'; }, 1200);
    });
    pre.append(button);
  });
  await Promise.all(jobs);
}
