# Hydroxy Wiki Maintenance Guide

## Project identity

Hydroxy Wiki is a dynamic personal knowledge base and blog. It is maintained in GitHub and served through Cloudflare Pages Functions with D1 and R2.

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
    learn/                 Legacy Learn import and backup Markdown/MDX tree
    life/essays/           Legacy Essay import and backup Markdown/MDX
    profile/home.md        Legacy Profile import and backup Markdown
  data/
    anime.json             Legacy Anime import and backup data
    gallery.json           Legacy Gallery import and backup data
  pages/                   SSR routes and route templates
  components/              Header, shell, tree, search, TOC, pagination
  layouts/BaseLayout.astro Shared head, global CSS, Mermaid and copy-code logic
  styles/global.css        Design tokens and all global visual rules
  utils/                   Content paths, tree construction, pagination, site config
public/
  images/                  Avatar, anime covers, gallery images, UI assets
  fonts/                   Local Fusion Pixel Font files
  favicon.svg              Pixel heart plus H favicon
  _redirects               Fixed site-level Cloudflare redirects
```

## Dynamic content operation

- Use `/admin/` for regular publishing and Life management. Create Learn directories in the dedicated **Learn Directories** panel before assigning articles to them. The editor uses Markdown split preview and supports drafts, publish, archive, tags, KaTeX, Mermaid, and code blocks.
- Learn articles use a parent directory plus lowercase `kebab-case` slug; the server composes and validates the final path. Any existing Learn node, including an article with its own body, can become a parent directory. Empty, draft-only, and archived directories are visible to admins but hidden from the public tree until they contain a published descendant. Order siblings by `sort_order`, then display label.
- D1 is the online source of truth. The Markdown/JSON tree below is a one-time migration source and a Git-backup format after cutover.
- Use `/api/admin/export` to download Markdown/JSON/media-manifest backups before committing an archive snapshot. Its `data/learn-tree.json` preserves Learn directory paths, labels, parent relationships, and order; `npm run content:migrate` prefers this manifest when present.
- Run `npm run content:migrate` to produce an inspectable report and SQL seed in `/tmp/hydroxy-wiki-migration`. Only `npm run content:migrate -- --apply --database <name> --bucket <name> --env production` writes the production D1/R2 resources.
- Moving a published leaf article must go through the admin save operation so a D1 301 redirect is recorded. Articles with child nodes cannot be moved. Do not add dynamic content redirects to `public/_redirects`.
- Published Learn and Essay pages record one anonymous browser view per UTC day and allow an anonymous like toggle. The identifier is an `HttpOnly`, `SameSite=Lax` first-party cookie; D1 stores only a per-article hash, never IP addresses or a public account.
- Permanent deletion requires exact-title or exact-filename confirmation. Protect Profile and Learn nodes with children; only delete media after the server confirms it has no Markdown, cover, Anime, or Gallery references. Export content before destructive operations.
- The homepage shell is a read-only public D1 view. Maintain `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`; never include drafts, archived content, or admin-only data.
## Legacy import and backup format

`src/content/` and `src/data/` are retained as the one-time migration source and as a Git-friendly backup format. Do not publish regular content by editing them: D1 is the sole online source of truth.

### Learn and Profile

- Create Learn directories in **Learn Directories**, then create or move a Learn article through the admin editor using its parent directory and lowercase `kebab-case` slug. The server validates the final path and records a D1 301 when a published leaf article moves.
- Edit the homepage Profile through the admin editor. Homepage tags are generated from published D1 Learn and Essay tags; keep them below the three dashboard panels using the established `pixel-panel`, `tag-list`, and `tag` styles.
- The legacy numeric-prefix tree remains supported only by `npm run content:migrate` and export recovery. For example, `src/content/learn/01-computer-science/01-operating-system/02-memory-management/index.md` imports as `/learn/computer-science/operating-system/memory-management/`.

### Life and media

- Manage Life Essays, Anime Log, Gallery, covers, and media from `/admin/`. Articles and metadata live in D1; uploaded media lives in private R2 and is served through `/media/*`.
- `/life/`, `/life/essays/`, `/life/anime/`, and `/life/gallery/` are SSR pages backed by published D1 data. Preserve the compact Anime list and Gallery's original-aspect-ratio masonry display.
- The legacy Markdown and JSON files are appropriate for import/export review and recovery, not for normal runtime publication. Run `npm run content:migrate` only when intentionally importing that backup format.

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
- The mini shell supports `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`. Keep it read-only, D1-backed, and limited to published public data.
- Search is D1 FTS5-backed. Published articles, tags, Anime metadata, and Gallery metadata can be found without rebuilding the site.
- Code blocks receive a browser-side Copy button. Mermaid fenced blocks are specially rendered by `BaseLayout.astro`; use a `mermaid` code fence for diagrams.
- Published article redirects are stored in D1 by the admin save flow. Reserve `public/_redirects` for fixed, site-level Cloudflare rules.
- Cloudflare Web Analytics is optional through `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`. Existing anonymous views and likes are first-party D1 features; do not add public accounts, comments, or third-party CMS services without an explicit product decision.

## Verification checklist

Before publishing content or code:

1. Run `npm run build` and resolve build failures.
2. Verify new or moved Learn content appears in the tree and has the expected prefix-free URL.
3. Confirm drafts and archived content return no public page and are absent from the public tree, search, RSS, and sitemap.
4. Check the homepage Profile renders from D1, and that Tags remain beneath the Dashboard.
5. Check desktop and mobile layouts for navigation, Learn tree drawer, article width/TOC, code blocks, Anime pagination, and Gallery masonry layout.
6. For visual asset or favicon updates, test in a private window or with browser cache disabled. Chrome can cache favicons separately from normal page assets.
7. After a GitHub push, inspect the Cloudflare Pages deployment and verify HTTPS, sitemap, RSS, and search on the deployed domain.

## Change discipline

- Preserve user-authored Markdown, JSON, images, and unrelated working-tree changes.
- Keep implementation changes scoped. Reuse existing Astro components, utility functions, CSS variables, and pagination helpers before introducing new abstractions.
- Prefer repository-maintained D1/R2 data and local UI assets over third-party runtime APIs.
- Update this file and `README.md` when a content path, build command, deployment setting, content schema, or significant maintenance workflow changes.
