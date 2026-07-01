# Hydroxy Wiki

Dark pixel-styled personal Wiki built with Astro, Markdown/MDX, Pagefind, and Cloudflare Pages.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Content

- Learning Wiki: `src/content/learn`
- Life essays: `src/content/life/essays`
- Anime data: `src/data/anime.json`
- Gallery data: `src/data/gallery.json`
- Manual redirects: `public/_redirects`

Learning routes mirror the file tree. Use English `kebab-case` names and optional numeric prefixes like `01-operating-system`; prefixes control sort order and are hidden in page labels.

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Optional environment variable: `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
