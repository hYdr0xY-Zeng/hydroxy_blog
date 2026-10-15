import { renderMarkdown } from './markdown';

export type PreviewRequest = { version: number; markdown: string };
export type PreviewResponse = { version: number; html?: string; error?: string };

self.addEventListener('message', async (event: MessageEvent<PreviewRequest>) => {
  const { version, markdown } = event.data;
  try {
    const { html } = await renderMarkdown(markdown);
    self.postMessage({ version, html } satisfies PreviewResponse);
  } catch (error) {
    self.postMessage({ version, error: error instanceof Error ? error.message : 'Preview failed.' } satisfies PreviewResponse);
  }
});
