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

## Content Maintenance

### Local workflow

```bash
npm install
npm run dev
npm run build
```

- Preview locally at `http://localhost:4321/`.
- Run `npm run build` before pushing. The build also regenerates the Pagefind search index in `dist/pagefind`.
- Do not commit generated output such as `dist/`, `.astro/`, or `node_modules/`.

### Learning Wiki

Add long-form technical articles, course notes, and lab writeups under `src/content/learn/`.

- Prefer one folder per article, with an `index.md` inside it.
- Put article-local images next to the article Markdown file.
- Use numeric prefixes for ordering, but keep names in English `kebab-case`.
- URL paths mirror the folder tree after numeric prefixes are removed.

Example:

```text
src/content/learn/01-computer-science/01-operating-system/02-memory-management/index.md
```

becomes:

```text
/learn/computer-science/operating-system/memory-management/
```

Use this frontmatter:

```yaml
---
title: "Memory Management"
description: "Operating system memory notes."
date: 2026-07-02
tags: ["os", "note"]
draft: false
cover: "./cover.png"
---
```

- `draft: true` is visible in local dev but hidden in production builds.
- If a directory has no article body, the site automatically renders it as a directory page.

### Mathematical notation

Math is rendered at build time with KaTeX. Use single dollar signs for inline notation and double dollar signs on their own lines for display equations:

```md
The dependency bound is $CPE_{dep} \approx \frac{L}{k}$.

$$
S = \frac{1}{(1-p) + p/s}
$$
```

Keep TeX source inside a `code` fence when it should be shown as code rather than rendered as math.

### Life Essays

Add personal essays under `src/content/life/essays/`.

```text
src/content/life/essays/my-note.md
```

becomes:

```text
/life/essays/my-note/
```

Use this frontmatter:

```yaml
---
title: "First Note"
description: "A short life note."
date: 2026-07-02
tags: ["life"]
draft: false
mood: "quiet"
---
```

### Anime Log

Maintain anime entries in `src/data/anime.json`. Covers should live in `public/images/anime/`.

Example entry:

```json
{
  "title": "Frieren: Beyond Journey's End",
  "cnTitle": "葬送的芙莉莲",
  "status": "watching",
  "year": 2023,
  "score": 9,
  "cover": "/images/anime/frieren.svg",
  "note": "慢节奏旅途、记忆与时间感。"
}
```

- `title` and `cover` are the most important fields.
- Optional fields can be omitted if unknown.
- The Anime page paginates every 20 entries.

### Gallery

Maintain gallery entries in `src/data/gallery.json`. Images should live in `public/images/gallery/`.

Example entry:

```json
{
  "title": "Desk Light",
  "src": "/images/gallery/desk-light.svg",
  "alt": "A pixel-styled desk with a terminal glow"
}
```

- Only the image name is shown on the page.
- Images keep their original proportions in a masonry-style layout.
- The Gallery page paginates every 30 images.

### Publishing

```bash
git status
npm run build
git add README.md src public
git commit -m "Update content"
git push origin main
```

After the push, Cloudflare Pages builds the site with:

```bash
npm run build
```

and publishes the `dist` directory.

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Optional environment variable: `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
