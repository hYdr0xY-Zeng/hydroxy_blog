# Hydroxy Wiki

Dark pixel-styled personal Wiki built with Astro, Cloudflare Pages Functions SSR, D1, and R2.

## Commands

Use Node 24+ for tests, builds, and checks.

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

For local D1/R2 binding emulation, run `npm run db:migrate:local`, build, then run `npm run dev:pages`. The public site deploys through Cloudflare Pages; the separate Worker is optional.

## Runtime

- Public routes are server-rendered by Astro on Cloudflare Pages Functions. The Pages project `hydroxy-wiki` serves `hydroxy-wiki.com` and `www.hydroxy-wiki.com`; the same-named standalone Worker and its `workers.dev` endpoint do not serve those domains.
- D1 is the sole content source for Learn, Essays, homepage Profile, Anime Log, Gallery, tags, redirects, and full-text search.
- R2 stores article media, anime covers, gallery images, and admin uploads. Public media is served through `/media/*`.
- `/admin/` and `/api/admin/*` must be protected by Cloudflare Access. The app verifies the Access JWT and `ADMIN_EMAILS` allowlist before every read or write.
- `wrangler.toml` is for optional standalone Worker deployment and local bindings, not the formal site's deployment topology. It defines the Worker entry point, assets, and separate preview/production D1 and R2 resources; default bindings use preview resources. It contains resource IDs, not just placeholders. IDs are not credentials; never commit credentials or secret values.

## Content Publishing

Use `/admin/` for publication and Life management. Learn nodes have explicit `node_type` values: `directory` or `article`. Only directories can be parents; articles are leaves. Create directories in **Learn Directories**, choosing a parent (or `/learn`), display label, lowercase `kebab-case` slug, and sort order. Edit a directory's introduction through its directory intro editor. Articles use **Directory + Slug**; published article moves create D1-backed 301 redirects. Node types are fixed, and directories with children cannot be moved. Profile and all directory introductions are protected from permanent deletion, even when empty.

New or changed slugs use lowercase `kebab-case`. Existing Learn URLs, including historical casing, are preserved when unchanged. Parent paths must resolve to existing D1 directories without revalidating their historical slugs. Equal sort orders are ordered by display label.

A directory is publicly visible only when it has a nonempty published introduction or a published descendant. Empty, draft-only, and archived items remain available to admins; draft and archived bodies are never public. Directory introductions are excluded from ordinary article lists, article statistics, RSS, and view/like engagement.

The editor renders live previews in a dedicated browser Web Worker using the same Markdown renderer as public pages. Unchanged code blocks and diagrams are reused; if the Worker cannot load, the protected server preview endpoint is used instead. Preview failures do not discard the editor text or the last successful preview.

Keep the direct KaTeX dependency pinned to the version used by `rehype-katex` and Mermaid so the generated HTML, CSS, and fonts match. Run `npm test` (WSL Node 24+) for path, content-save, and math-version regression tests, followed by `npm run check` and `npm run build`.

After building, run `node --experimental-strip-types tests/browser-regression.mjs` with an existing Playwright installation and Chrome (`PLAYWRIGHT_MODULE` can specify its module directory). This serves local, in-memory fixtures using the real production editor/Worker bundles; it never authenticates against or writes to production. It covers typing latency, IME, preview fallback, scroll sync, legacy form validation, code/diagram reuse, and desktop/mobile math layout, and writes screenshots to the system temporary directory. Set `PREVIEW_ORIGIN` to a deployed preview URL to additionally check the deployed assets against local fixture HTML without publishing test articles or bypassing admin authentication.

Optional directory browser regression: after building, run `node --experimental-strip-types tests/directory-browser.mjs` with Node 24+, Playwright (`PLAYWRIGHT_MODULE` if needed), and Chrome (`PLAYWRIGHT_CHANNEL` can override). It checks new/existing intro field locks, draft/publish payloads, historical paths, directory-only parent wiring, article payload isolation, and desktop/mobile layout using local fixtures and the built editor script. It does not authenticate against SSR or write D1; screenshots go to the system temporary directory.

Published Learn articles and Essays record one anonymous browser view per UTC day and provide a browser-local like toggle. The site stores only per-article hashes of a first-party `HttpOnly` cookie, never IP addresses or user profiles. The homepage shell reads published D1 content at request time; use `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`.

The homepage includes a small Gallery slideshow inside the status panel: up to six published images with existing media metadata and original files no larger than 1 MiB. Larger or untracked images remain available in the full Gallery. Each slide displays for four seconds between 400ms crossfades; the three-line Alt caption types in within 1.5 seconds (empty Alt falls back to the title). Images decode before switching and load incrementally; hover pauses playback, keyboard/manual interaction stops it until resumed, and data-saving mode uses manual navigation only. All public pages offer a WIND button (also `mysterious-wind` in the home shell): each trigger adds a roughly three-second left-to-right gust, up to four overlapping gusts in one Canvas (80 petals on desktop, 40 on mobile). Repeated triggers never stop existing petals. Public top-level page titles type once on entering the viewport, with full text reserved for layout and accessibility; prose and admin headings remain static. The footer motion checkbox remembers a local preference; system reduced-motion always takes precedence, and hiding the page clears effects. Shell boot text animates once without blocking input. No effects run in admin; no third-party animation runtime or media service is required. Run `node --experimental-strip-types tests/motion-browser.mjs` after building for synthetic desktop/mobile animation and loading regression tests (same Playwright environment variables as other browser tests).

The admin console uses hash-linked Documents, Learn Directories, Media, Anime, and Gallery workspaces. Switching modules preserves unsaved inputs without a request; search, pagination, and refresh remain full-page navigation and do not autosave. Desktop lists scroll independently beside forms; below 900px, lists precede forms and selecting a Life entry reveals its editor. Without JavaScript, all modules remain available through ordinary anchors.

Anime Log and Gallery have independently searchable, paginated admin lists. Select EDIT to populate the labeled fields, or NEW / RESET to create another entry. Anime viewing status accepts custom values. DELETE requires the exact displayed title (Chinese title when set for Anime); deleting an entry removes its search record but retains its R2 media. Delete unreferenced media separately in Media.

Permanent deletion requires the exact document title or original media filename. Profile and all directory introductions cannot be permanently deleted, even when empty; directories with children are also protected. Media deletion is blocked while referenced by Markdown, a document cover, Anime, or Gallery; export content before irreversible deletion.

After building, `node --experimental-strip-types tests/life-browser.mjs` checks Life editing, reset, deletion confirmation, failure handling, and desktop/mobile layouts using local fixtures and the real built script. It uses the same existing Playwright setup as the other browser regressions and never writes production data.

`node --experimental-strip-types tests/admin-browser.mjs` additionally checks the whole console at 1440/1920/768/390px: long/empty lists, tabs, keyboard navigation, history, deep links, input preservation, upload/copy wiring, and no-JavaScript anchors. It uses synthetic fixtures and production scripts/CSS, never production content or media writes.

## Backups and Schema Rollout

There is no static content source or supported static import. `src/content/`, `src/data/`, the `content:migrate` command, and its script are removed; do not recreate an import or backup-in-Git workflow.

Download content from `/api/admin/export` and keep archives outside this repository. The ZIP contains Markdown, Anime/Gallery JSON, `data/learn-tree.json` with paths, labels, parents, order, and explicit `nodeType`, and `media-manifest.json`. Directory introductions use `learn/<path>/index.md`; articles normally use `learn/<path>.md`. An article whose final slug is `index` uses `learn/<path>/article.md` (for example, `learn/topic/index/article.md`) to avoid colliding with its parent's intro; frontmatter retains the original `path`. The ZIP is a content/metadata export, not an automatic import or full database backup. It excludes engagement data and R2 binary files; back up R2 objects separately when needed.

For schema changes, including explicit Learn node types:

1. Pause admin writes and prevent automatic deployment of schema-dependent code.
2. Export D1 SQL and the backend content ZIP to storage outside the repository; verify backups. Bare full D1 export fails on FTS5: explicitly select ordinary table names with `--table` and save a separate FTS snapshot. Preserve R2 binaries separately if needed.
3. Apply database schema migrations from `migrations/` to local, preview, and production before deploying code that requires them. The node-type migration classifies existing nodes without changing URLs; existing parent nodes become directories and their bodies become introductions.
4. Run Node 24+ `npm test`, `npm run check`, and `npm run build`; verify preview before production rollout.
5. Verify directory intros, parent restrictions, unchanged URLs, public visibility, article exclusions, and exports, then resume writes.

Remote schema migration commands (not static content imports):

```bash
npx wrangler d1 migrations apply HYDROXY_DB --remote --env preview
npx wrangler d1 migrations apply HYDROXY_DB --remote --env production
```

## Cloudflare Deployment

The public site uses the Cloudflare Pages project `hydroxy-wiki`: build command `npm run build`, output directory `dist`. Pushes to `main` trigger Pages automatic deployment; a separate Worker build integration also exists. Apply required schema migrations before pushing schema-dependent code. Use local automated regression and targeted local screenshots for acceptance; after a routine push, confirm Pages success and the formal homepage HTTP response only. The owner reviews the live visual result; do not routinely drive the browser through production pages or capture deployment screenshots. Recheck sitemap, RSS or search when their behavior changes. Do not change domain routing or deployment topology as part of routine publishing.

Optional standalone Worker commands after building (verify the target before deploying; these are not the primary public-site deployment):

```bash
npx wrangler deploy --env preview
npx wrangler deploy --env production --name hydroxy-wiki --keep-vars
```

The manual production command updates ONLY the standalone Worker `hydroxy-wiki`, not the Pages project or formal site. `--env production` alone defaults to `hydroxy-wiki-production`; keep the explicit name and `--keep-vars` to preserve dashboard-managed plain variables, including Access settings. The preview Worker remains valid for preview testing, but is not a Pages deployment.

Required bindings and environment-specific variables/secrets:

```text
D1 binding: HYDROXY_DB
R2 binding: HYDROXY_MEDIA
CF_ACCESS_TEAM_DOMAIN
CF_ACCESS_AUD
ADMIN_EMAILS
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN (optional)
```

Configure bindings, Access values, and the admin allowlist in the Pages project's production/preview settings for the public site; configure optional Workers separately through Cloudflare settings or Wrangler secrets. Never commit secret values. Keep the canonical `site` URL in `astro.config.mjs` synchronized with the custom domain for RSS and sitemap.

## Development Notes

- Do not commit `dist/`, `.astro/`, `node_modules/`, local `.wrangler/` data, or content/SQL backups.
- Search uses D1 FTS5 through `/api/search`, so it is current immediately after publish; Pagefind is no longer used.
- Mermaid renders in the browser from `mermaid` fenced blocks. KaTeX, Shiki, and ordinary code-copy buttons are shared by public pages and the admin preview.
- Fonts, favicon, avatar, and UI assets remain under `public/`; published content and uploaded media live in D1/R2.
