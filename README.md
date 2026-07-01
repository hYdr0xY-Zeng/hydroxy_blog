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
- Pixel font: `public/fonts`, using Fusion Pixel Font under the SIL Open Font License 1.1

Learning routes mirror the file tree. Use English `kebab-case` names and optional numeric prefixes like `01-operating-system`; prefixes control sort order and are hidden in page labels.

Life pages are split into `/life/anime/`, `/life/essays/`, and `/life/gallery/`. Anime entries support `title`, `cnTitle`, `status`, `year`, `score`, `cover`, and `note`; gallery entries use `title`, `src`, and `alt`. Anime paginates every 20 entries, and gallery paginates every 30 images.

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Optional environment variable: `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
