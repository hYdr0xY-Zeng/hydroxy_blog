import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://hydroxy.wiki',
  integrations: [mdx(), sitemap()],

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
  },

  adapter: cloudflare()
});