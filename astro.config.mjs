import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

export default defineConfig({
  site: 'https://hydroxy-wiki.com/',
  session: { driver: 'memory' },
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough', platformProxy: { enabled: true } }),
  vite: {
    // The shared Markdown pipeline must use DOM-free package exports inside a Worker.
    resolve: { conditions: ['worker', 'module', 'browser', 'development|production'] },
    worker: { format: 'es' }
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  },
  build: {
    format: 'directory'
  }
});
