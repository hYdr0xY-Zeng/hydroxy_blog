# Hydroxy Wiki Maintenance Guide

## Project identity

Hydroxy Wiki is a dynamic personal knowledge base and blog. It is maintained in GitHub and served through Cloudflare Pages Functions with D1 and R2.

- Owner and writing voice: Hydroxy (羟), a computer science student interested in algorithms, high-performance computing, anime, Chinese poetry, and industrial simulation software for ship and marine engineering.
- Site focus: technical articles, course notes, experiment and lab records, personal essays, anime log, and gallery.
- Primary language: Chinese, with concise English labels where they fit the technical/pixel-RPG interface.
- Public site name: `Hydroxy Wiki`.

When assisting the owner in this repository, address them as “羟桑”. Keep advice precise and evidence-based. Do not invent biographical details or publish private information.

## Stack and commands

- Framework: Astro 5 with Cloudflare Pages Functions SSR for the public site.
- Primary content: D1. Learn, Essays, Profile, Anime, Gallery, tags, redirects, and D1 FTS5 are served at request time.
- Media: private R2 binding `HYDROXY_MEDIA`, publicly streamed through `/media/*`.
- Markdown: shared Astro Markdown processor with Shiki, KaTeX, and client-side Mermaid rendering.
- Admin: `/admin/*` and `/api/admin/*` require Cloudflare Access; the app also validates the Access JWT and `ADMIN_EMAILS` allowlist.
- Deployment: pushes to `main` trigger automatic deployment of Pages project `hydroxy-wiki`, which serves `hydroxy-wiki.com` and `www.hydroxy-wiki.com`. A separate same-named Worker and build integration also exist; its `workers.dev` endpoint does not serve the formal domains.

```bash
npm install
npm run dev
npm test
npm run build
npm run check
npm run preview
npm run dev:pages
npm run db:migrate:local
```

Use Node 24+ for `npm test`, `npm run check`, and `npm run build`. `npm run build` runs `astro build` only. Do not commit generated `dist/`, `.astro/`, `.wrangler/`, or `node_modules/` output. Search is D1-backed; Pagefind is no longer part of the build.

Public-site Pages settings:

```text
Build command: npm run build
Build output directory: dist
D1 binding: HYDROXY_DB
R2 binding: HYDROXY_MEDIA
```

Set `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `ADMIN_EMAILS` in the Pages project's production/preview environment settings, along with its D1/R2 bindings. Configure optional Workers separately. Never commit credentials or secret values. `wrangler.toml` contains actual resource IDs and separate production/preview bindings for optional Worker deployment and local use; defaults use preview resources. Resource IDs are not credentials, and this file does not establish the formal site's routing.

Pages auto deploy on `main` is the primary public-site deployment. Apply required D1 migrations before deploying schema-dependent code, including before a triggering push. `npm run dev:pages` remains available for local binding emulation. Do not change deployment topology or domain routing during routine publishing.

Optional Worker deployment after building: `npx wrangler deploy --env preview`. Manual `npx wrangler deploy --env production --name hydroxy-wiki --keep-vars` updates ONLY the standalone Worker, not Pages or the formal site; `--env production` alone defaults to `hydroxy-wiki-production`. Verify the target first, keep the explicit name and `--keep-vars` to preserve dashboard-managed plain variables, and manage secrets per environment. Preview Worker testing remains valid but does not deploy Pages.

`astro.config.mjs` contains the canonical `site` URL used by dynamic RSS and sitemap. Keep it synchronized with the active Cloudflare custom domain before publishing a domain change.
## Repository map

```text
src/
  pages/                   SSR routes and route templates
  components/              Header, shell, tree, search, TOC, pagination
  layouts/BaseLayout.astro Shared head, global CSS, Mermaid and copy-code logic
  styles/global.css        Design tokens and all global visual rules
  utils/                   Content paths, tree construction, pagination, site config
public/
  images/                  Avatar and local UI assets
  fonts/                   Local Fusion Pixel Font files
  favicon.svg              Pixel heart plus H favicon
  _redirects               Fixed site-level Cloudflare redirects
```

## Dynamic content operation

- Use `/admin/` for regular publishing and Life management. Create Learn directories in the dedicated **Learn Directories** panel before assigning articles to them. The editor uses Markdown split preview and supports drafts, publish, archive, tags, KaTeX, Mermaid, and code blocks.
- Learn nodes have explicit `node_type` values of `directory` or `article`; only directories can be parents, and articles are leaves. Types are fixed. Articles use a parent directory plus lowercase `kebab-case` slug; the server composes and validates the final path. Edit directory introductions through the directory intro editor. Order siblings by `sort_order`, then display label.
- Public directories require a nonempty published introduction or a published descendant; empty, draft-only, and archived items remain available to admins, but draft/archived bodies are never public. Directory introductions are excluded from ordinary article lists, article statistics, RSS, and view/like engagement.
- D1 is the sole online content source. No static content import or backup-in-Git workflow is supported; `src/content/`, `src/data/`, `content:migrate`, and its script are removed.
- Use `/api/admin/export` for Markdown/JSON/media-manifest exports stored outside the repository. `data/learn-tree.json` preserves paths, labels, parents, order, and explicit `nodeType`; directory introductions use `learn/<path>/index.md`, articles normally `learn/<path>.md`. An article with final slug `index` uses `learn/<path>/article.md` to avoid a parent-intro collision; frontmatter retains the original `path`. The ZIP is a content/metadata export, not an automatic import or full SQL backup. It excludes engagement data and R2 binaries; back up objects separately when needed.
- Moving a published leaf article must go through the admin save operation so a D1 301 redirect is recorded. Directories with child nodes cannot be moved. Do not add dynamic content redirects to `public/_redirects`.
- Published Learn articles and Essays record one anonymous browser view per UTC day and allow an anonymous like toggle; directory introductions do not. The identifier is an `HttpOnly`, `SameSite=Lax` first-party cookie; D1 stores only a per-article hash, never IP addresses or a public account.
- Permanent deletion requires exact-title or exact-filename confirmation. Profile and all directory introductions cannot be permanently deleted, even when empty; directories with children are also protected; only delete media after the server confirms it has no Markdown, cover, Anime, or Gallery references. Export content before destructive operations.
- The homepage shell is a read-only public D1 view. Maintain `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`; never include drafts, archived content, or admin-only data.
## Schema rollout and content management

Database schema migrations in `migrations/` remain required; they are not static content imports.

1. Pause admin writes and prevent automatic deployment of schema-dependent code.
2. Back up D1 SQL and the backend content ZIP outside the repository; verify backups. Bare full D1 export fails on FTS5: explicitly select ordinary table names with `--table` and save a separate FTS snapshot. Preserve R2 binaries separately if needed.
3. Apply schema migrations to local (`npm run db:migrate:local`), preview, and production before new code. For remote environments, use `npx wrangler d1 migrations apply HYDROXY_DB --remote --env preview` and the corresponding `--env production` command. The node-type migration preserves existing URLs, classifies existing parent nodes as directories, and retains their bodies as introductions.
4. Run Node 24+ `npm test`, `npm run check`, and `npm run build`; verify preview before production rollout.
5. Verify parent restrictions, intro editing, existing URLs, public visibility, article exclusions, and exports, then resume writes.

- Edit the homepage Profile through the admin editor. Homepage tags are generated from published D1 Learn article and Essay tags; keep them below the three dashboard panels using the established `pixel-panel`, `tag-list`, and `tag` styles.
- Manage Life Essays, Anime Log, Gallery, covers, and media from `/admin/`. Articles and metadata live in D1; uploaded media lives in private R2 and is served through `/media/*`.
- `/life/`, `/life/essays/`, `/life/anime/`, and `/life/gallery/` are SSR pages backed by published D1 data. Preserve the compact Anime list and Gallery's original-aspect-ratio masonry display.

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

- Admin live previews run in a browser Web Worker with the shared Markdown renderer; retain the authenticated server-preview fallback, latest-result protection, IME handling, bounded code cache, and unchanged diagram reuse. Do not load the editor Worker on public pages.
- Preserve existing Learn URLs exactly, including historical casing, when editing unchanged paths. Validate parent paths by D1 directory existence, not by applying new-slug rules to every ancestor. New or changed slugs remain lowercase `kebab-case`.
- Keep KaTeX HTML generation and imported CSS/fonts on the same pinned version; `npm test` checks renderer and Mermaid resolution alongside content/path regression tests (Node 24+).

- Navigation and social links are centralized in `src/utils/site.ts`.
- The homepage avatar is a static asset under `public/images/profile/`; preserve its square pixel-frame treatment.
- The mini shell supports `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`. Keep it read-only, D1-backed, and limited to published public data.
- Search is D1 FTS5-backed. Published articles, tags, Anime metadata, and Gallery metadata can be found without rebuilding the site.
- Code blocks receive a browser-side Copy button. Mermaid fenced blocks are specially rendered by `BaseLayout.astro`; use a `mermaid` code fence for diagrams.
- Published article redirects are stored in D1 by the admin save flow. Reserve `public/_redirects` for fixed, site-level Cloudflare rules.
- Cloudflare Web Analytics is optional through `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`. Existing anonymous views and likes are first-party D1 features; do not add public accounts, comments, or third-party CMS services without an explicit product decision.

## Verification checklist

Before publishing content or code:

1. With Node 24+, run `npm test`, `npm run check`, and `npm run build`; resolve failures.
2. Verify new or moved Learn content appears in the tree with the expected URL; unchanged existing URLs must remain exact. Check directory-only parents, intro editing, visibility rules, and intro exclusion from article lists, stats, RSS, and engagement.
3. Confirm drafts and archived content return no public page and are absent from the public tree, search, RSS, and sitemap.
4. Check the homepage Profile renders from D1, and that Tags remain beneath the Dashboard.
5. Optionally run `node --experimental-strip-types tests/directory-browser.mjs` after building with Node 24+, Playwright (`PLAYWRIGHT_MODULE` if needed), and Chrome (`PLAYWRIGHT_CHANNEL` can override). Local fixtures check directory intro locks, draft/publish payloads, historical paths, parent wiring, article payload isolation, and desktop/mobile layout without authenticated SSR or D1 writes; screenshots go to the system temporary directory. Check desktop and mobile layouts for navigation, Learn tree drawer, article width/TOC, code blocks, Anime pagination, and Gallery masonry layout.
6. For visual asset or favicon updates, test in a private window or with browser cache disabled. Chrome can cache favicons separately from normal page assets.
7. After a GitHub push, inspect the Cloudflare Pages deployment and verify HTTPS, sitemap, RSS, and search on the formal custom domains; a successful standalone Worker deployment does not verify the public site.

## Change discipline

- Preserve user-authored Markdown, JSON, images, and unrelated working-tree changes.
- Keep implementation changes scoped. Reuse existing Astro components, utility functions, CSS variables, and pagination helpers before introducing new abstractions.
- Prefer repository-maintained D1/R2 data and local UI assets over third-party runtime APIs.
- Update this file and `README.md` when a content path, build command, deployment setting, content schema, or significant maintenance workflow changes.
