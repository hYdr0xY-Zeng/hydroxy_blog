import { enhanceMarkdown, reconcilePreview } from './markdown-client';
import type { PreviewRequest, PreviewResponse } from '../lib/markdown.worker';

export function startEditorPreview(textarea: HTMLTextAreaElement, preview: HTMLElement, pane: HTMLElement, status: HTMLOutputElement | null) {
  let worker: Worker | undefined;
  let fallback = false;
  let busy = false;
  let composing = false;
  let version = 0;
  let pending: PreviewRequest | undefined;
  let timer: number | undefined;
  let watchdog: number | undefined;
  let controller: AbortController | undefined;
  let interaction = 0;
  const noteInteraction = () => { interaction++; };
  for (const element of [textarea, pane]) {
    for (const event of ['wheel', 'touchmove', 'pointerdown', 'keydown']) element.addEventListener(event, noteInteraction, { passive: true });
  }
  const setStatus = (message: string, error = false) => {
    if (status) { status.textContent = message; status.dataset.state = error ? 'error' : 'ready'; }
  };
  const apply = async (result: PreviewResponse) => {
    if (result.version !== version || composing) return;
    if (result.error) { setStatus(result.error, true); return; }
    const range = pane.scrollHeight - pane.clientHeight;
    const ratio = range > 0 ? pane.scrollTop / range : 0;
    const observedInteraction = interaction;
    const restore = () => {
      if (result.version === version && observedInteraction === interaction) pane.scrollTop = Math.max(0, (pane.scrollHeight - pane.clientHeight) * ratio);
    };
    reconcilePreview(preview, result.html ?? '');
    requestAnimationFrame(restore);
    preview.querySelectorAll('img').forEach((image) => { if (!image.complete) image.addEventListener('load', restore, { once: true }); });
    try {
      await enhanceMarkdown(preview);
      if (result.version === version) {
        requestAnimationFrame(restore);
        setStatus(fallback ? 'SERVER PREVIEW' : '');
      }
    } catch (error) {
      if (result.version === version) setStatus(error instanceof Error ? error.message : 'Diagram preview failed.', true);
    }
  };

  const useFallback = () => {
    if (fallback) return;
    fallback = true;
    worker?.terminate();
    worker = undefined;
    window.clearTimeout(watchdog);
    busy = false;
    if (!composing) pending = { version, markdown: textarea.value };
    setStatus('SERVER PREVIEW');
    pump();
  };

  const pump = () => {
    if (busy || !pending || composing) return;
    const request = pending;
    pending = undefined;
    busy = true;
    setStatus(fallback ? 'SERVER PREVIEW...' : 'RENDERING...');
    if (!fallback && worker) {
      watchdog = window.setTimeout(useFallback, 15000);
      try { worker.postMessage(request); } catch { useFallback(); }
      return;
    }
    controller = new AbortController();
    const signal = controller.signal;
    void (async () => {
      try {
        const response = await fetch('/api/admin/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: request.markdown }), signal
        });
        const payload = await response.json() as { html?: string; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Preview failed.');
        void apply({ ...payload, version: request.version });
      } catch (error) {
        if (!signal.aborted && request.version === version) setStatus(error instanceof Error ? error.message : 'Preview failed.', true);
      } finally { busy = false; pump(); }
    })();
  };

  const schedule = () => {
    version++;
    window.clearTimeout(timer);
    pending = undefined;
    controller?.abort();
    if (composing) return;
    timer = window.setTimeout(() => { pending = { version, markdown: textarea.value }; pump(); }, 150);
  };

  textarea.addEventListener('compositionstart', () => { composing = true; schedule(); });
  textarea.addEventListener('compositionend', () => { composing = false; schedule(); });
  textarea.addEventListener('input', schedule);
  try {
    worker = new Worker(new URL('../lib/markdown.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<PreviewResponse>) => {
      window.clearTimeout(watchdog);
      busy = false;
      void apply(event.data);
      pump();
    });
    worker.addEventListener('error', (event) => { event.preventDefault(); console.warn('Local preview unavailable; using server preview.', event.message); useFallback(); });
    worker.addEventListener('messageerror', useFallback);
  } catch { useFallback(); }
  if (!fallback) { pending = { version, markdown: textarea.value }; pump(); }
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    window.clearTimeout(timer);
    window.clearTimeout(watchdog);
    controller?.abort();
    worker?.terminate();
  });
}
