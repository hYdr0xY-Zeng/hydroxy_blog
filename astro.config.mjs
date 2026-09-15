import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

export default defineConfig({
  site: 'https://hydroxy-wiki.com/',
  session: { driver: 'memory' },
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough', platformProxy: { enabled: true } }),
  integrations: [mdx()],
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
