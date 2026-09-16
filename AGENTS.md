# Hydroxy Wiki Maintenance Guide

## Project identity

Hydroxy Wiki is a static personal knowledge base and blog. It is maintained in GitHub and deployed through Cloudflare Pages.

- Owner and writing voice: Hydroxy (羟), a computer science student interested in algorithms, high-performance computing, anime, Chinese poetry, and industrial simulation software for ship and marine engineering.
- Site focus: technical articles, course notes, experiment and lab records, personal essays, anime log, and gallery.
- Primary language: Chinese, with concise English labels where they fit the technical/pixel-RPG interface.
- Public site name: `Hydroxy Wiki`.

When assisting the owner in this repository, address them as “羟桑”. Keep advice precise and evidence-based. Do not invent biographical details or publish private information.

## Stack and commands

- Framework: Astro 5 with Cloudflare Pages Functions SSR.
- Primary content: D1. Learn, Essays, Profile, Anime, Gallery, tags, redirects, and D1 FTS5 are served at request time.
- Media: private R2 binding `HYDROXY_MEDIA`, publicly streamed through `/media/*`.
- Markdown: shared Astro Markdown processor with Shiki, KaTeX, and client-side Mermaid rendering.
- Admin: `/admin/*` and `/api/admin/*` require Cloudflare Access; the app also validates the Access JWT and `ADMIN_EMAILS` allowlist.
- Deployment: Cloudflare Pages builds after a push to `main`.

```bash
npm install
npm run dev
npm run build
npm run check
npm run preview
npm run dev:pages
npm run db:migrate:local
npm run content:migrate
```

`npm run build` runs `astro build` only. Do not commit generated `dist/`, `.astro/`, `.wrangler/`, or `node_modules/` output. Search is D1-backed; Pagefind is no longer part of the build.

Cloudflare Pages settings:

```text
Build command: npm run build
Build output directory: dist
D1 binding: HYDROXY_DB
R2 binding: HYDROXY_MEDIA
```

Set `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `ADMIN_EMAILS` as Pages environment variables/secrets. Keep IDs and credentials out of Git. `wrangler.toml` is the binding-name template and must be updated with separate production/preview resources before deployment.

`astro.config.mjs` contains the canonical `site` URL used by dynamic RSS and sitemap. Keep it synchronized with the active Cloudflare custom domain before publishing a domain change.
## Repository map

```text
src/
  content/
    learn/                 Learning Wiki Markdown/MDX tree
    life/essays/           Life essays Markdown/MDX
    profile/home.md        Homepage Profile Markdown
    config.ts              Content schemas and collection loaders
  data/
    anime.json             Anime Log data
    gallery.json           Gallery data
  pages/                   Static routes and route templates
  components/              Header, shell, tree, search, TOC, pagination
  layouts/BaseLayout.astro Shared head, global CSS, Mermaid and copy-code logic
  styles/global.css        Design tokens and all global visual rules
  utils/                   Content paths, tree construction, pagination, site config
public/
  images/                  Avatar, anime covers, gallery images, UI assets
  fonts/                   Local Fusion Pixel Font files
  favicon.svg              Pixel heart plus H favicon
  _redirects               Manual Cloudflare redirects
```

## Dynamic content operation

- Use `/admin/` for regular publishing and Life management. Create Learn directories in the dedicated **Learn Directories** panel before assigning articles to them. The editor uses Markdown split preview and supports drafts, publish, archive, tags, KaTeX, Mermaid, and code blocks.
- Learn articles use a parent directory plus lowercase `kebab-case` slug; the server composes and validates the final path. Empty, draft-only, and archived directories are visible to admins but hidden from the public tree until they contain a published descendant. Order siblings by `sort_order`, then display label.
- D1 is the online source of truth. The Markdown/JSON tree below is a one-time migration source and a Git-backup format after cutover.
- Use `/api/admin/export` to download Markdown/JSON/media-manifest backups before committing an archive snapshot. Its `data/learn-tree.json` preserves Learn directory paths, labels, parent relationships, and order; `npm run content:migrate` prefers this manifest when present.
- Run `npm run content:migrate` to produce an inspectable report and SQL seed in `/tmp/hydroxy-wiki-migration`. Only `npm run content:migrate -- --apply --database <name> --bucket <name> --env production` writes the production D1/R2 resources.
- Moving a published leaf article must go through the admin save operation so a D1 301 redirect is recorded. Articles with child nodes cannot be moved. Do not add dynamic content redirects to `public/_redirects`.
- Published Learn and Essay pages record one anonymous browser view per UTC day and allow an anonymous like toggle. The identifier is an `HttpOnly`, `SameSite=Lax` first-party cookie; D1 stores only a per-article hash, never IP addresses or a public account.
- Permanent deletion requires exact-title or exact-filename confirmation. Protect Profile and Learn nodes with children; only delete media after the server confirms it has no Markdown, cover, Anime, or Gallery references. Export content before destructive operations.
- The homepage shell is a read-only public D1 view. Maintain `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`; never include drafts, archived content, or admin-only data.
## Legacy content source and backup maintenance

### Learning Wiki

Put technical notes, course material, and experiments under `src/content/learn/`. Prefer one folder per item with an `index.md` or `index.mdx`; keep local images beside that file.

```text
src/content/learn/01-computer-science/01-operating-system/02-memory-management/index.md
```

This becomes:

```text
/learn/computer-science/operating-system/memory-management/
```

Rules:

- Use English `kebab-case` names. Numeric prefixes such as `01-` control order and are hidden from visible labels and URLs.
- Directory-only paths automatically render as Wiki directory pages.
- Do not hand-code learning URLs. Use the existing path helpers so numeric prefixes continue to be stripped consistently.
- Standard article frontmatter:

```yaml
---
title: "Article title"
description: "Short summary"
date: 2026-07-19
tags: ["tag"]
draft: false
cover: "./cover.png"
---
```

`draft: true` remains visible during local development but is excluded from production output. Check this behavior with `npm run build` before publishing.

### Homepage Profile

Maintain the homepage introduction only in `src/content/profile/home.md`. The file requires:

```yaml
---
title: "Profile"
draft: false
---
```

Its Markdown body is rendered directly, so normal paragraphs, lists, emphasis, and links are appropriate. Do not replace it with hard-coded tag arrays in `src/pages/index.astro`. The homepage build deliberately fails when this file is missing.

Homepage Tags are generated from published Learn and Essay tags. They stay below the three Dashboard panels and use the standard `pixel-panel`, `tag-list`, and `tag` styles; do not turn them into a separate lightweight card design.

### Life pages

Life is intentionally separate from the Learning Wiki:

- `/life/` is an entry page with personal/life-oriented information.
- `/life/anime/` uses `src/data/anime.json` and statically paginates 20 items per page.
- `/life/essays/` lists Markdown essays from `src/content/life/essays/`.
- `/life/gallery/` uses `src/data/gallery.json` and statically paginates 30 images per page.

Anime entries use the following fields; omit optional fields rather than inserting fake placeholders:

```json
{
  "title": "Original title",
  "cnTitle": "中文标题",
  "status": "completed",
  "year": 2026,
  "score": 9,
  "cover": "/images/anime/example.jpg",
  "note": "暂无"
}
```

Keep covers under `public/images/anime/`. Preserve the compact, Bangumi-like horizontal list: a small fixed cover, concise metadata, and no oversized cards.

Gallery entries use `title`, `src`, and `alt`. Store images under `public/images/gallery/`. The layout preserves original image proportions in a masonry-like column display and shows only the image name, not a caption. Do not force every image into the same aspect ratio.

Life essays use the normal article frontmatter plus optional `mood`:

```yaml
---
title: "Essay title"
description: "Short summary"
date: 2026-07-19
tags: ["life"]
draft: false
mood: "quiet"
---
```

## Design and interaction invariants

The interface is a readable technical Wiki with an original retro pixel-RPG accent. It may evoke that genre, but must not copy Deltarune characters, sprites, fonts, or other protected assets.

- Palette: near-black background, white body text, muted pink borders, yellow active text, and a red pixel-heart interaction marker. Avoid returning to the former cyan/purple scheme or making every border bright red.
- Non-article UI uses the local Fusion Pixel Font. Article `.prose` content uses a normal readable font and generous line height.
- Prefer hard pixel borders, stepped shadows, subtle scanlines/grid texture, and `image-rendering: pixelated`; avoid blur, glossy gradients, excessive rounded corners, and soft floating-card styling.
- Hover and keyboard focus for interactive controls should keep the established behavior: yellow text plus the original red pixel heart. Preserve a visible focus state.
- Article pages prioritize reading: a wide main column and a narrow right-hand table of contents. Do not reintroduce a dominant left metadata sidebar.
- Keep the homepage RPG status, mini shell, dashboard sequence (Profile, Recent Updates, Primary Gates), and Tags below the dashboard unless a requested redesign explicitly changes them.
- The favicon is `public/favicon.svg`: black background, soft pink pixel frame, original red heart, and yellow H. When changing it, update the icon URL version in `BaseLayout.astro` (for example `/favicon.svg?v=20260719`) so Chrome does not keep an old favicon cache.

## Shared behavior

- Navigation and social links are centralized in `src/utils/site.ts`.
- The homepage avatar is a static asset under `public/images/profile/`; preserve its square pixel-frame treatment.
- The mini shell supports `help`, `ls`, `cd`, `open`, `search`, and `clear`. Keep it navigation-only and entirely static.
- Search is Pagefind-based. A page can be found only after a production build regenerates `dist/pagefind`.
- Code blocks receive a browser-side Copy button. Mermaid fenced blocks are specially rendered by `BaseLayout.astro`; use a `mermaid` code fence for diagrams.
- Redirects are manual in `public/_redirects`. Add old-to-new route mappings there when moving public content.
- Cloudflare Web Analytics is the only analytics integration. The optional variable is `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`. Do not add comments, accounts, likes, a database, or a CMS without an explicit product decision.

## Verification checklist

Before publishing content or code:

1. Run `npm run build` and resolve build failures.
2. Verify new or moved Learn content appears in the tree and has the expected prefix-free URL.
3. Confirm drafts are absent from the production `dist` output.
4. Check the homepage Profile renders from `src/content/profile/home.md`, and that Tags remain beneath the Dashboard.
5. Check desktop and mobile layouts for navigation, Learn tree drawer, article width/TOC, code blocks, Anime pagination, and Gallery masonry layout.
6. For visual asset or favicon updates, test in a private window or with browser cache disabled. Chrome can cache favicons separately from normal page assets.
7. After a GitHub push, inspect the Cloudflare Pages deployment and verify HTTPS, sitemap, RSS, and search on the deployed domain.

## Change discipline

- Preserve user-authored Markdown, JSON, images, and unrelated working-tree changes.
- Keep implementation changes scoped. Reuse existing Astro components, utility functions, CSS variables, and pagination helpers before introducing new abstractions.
- Prefer local static assets and repository-maintained data over third-party runtime APIs.
- Update this file and `README.md` when a content path, build command, deployment setting, content schema, or significant maintenance workflow changes.
