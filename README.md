# Hydroxy Wiki

Dark pixel-styled personal Wiki built with Astro, Cloudflare Pages Functions, D1, and R2.

## Commands

```bash
npm install
npm run dev
npm run build
npm run check
npm run preview
npm run db:migrate:local
npm run content:migrate
```

For local D1/R2 binding emulation, run `npm run db:migrate:local`, build, then run `npm run dev:pages`.

## Runtime

- Public routes are server-rendered by Cloudflare Pages Functions.
- D1 is the primary store for Learn, Essays, homepage Profile, Anime Log, Gallery, tags, redirects, and full-text search.
- R2 stores article media, anime covers, gallery images, and new admin uploads. Public media is served through `/media/*`.
- `/admin/` and `/api/admin/*` must be protected by Cloudflare Access. The app verifies the Access JWT and `ADMIN_EMAILS` allowlist before every read or write.
- `wrangler.toml` contains binding names and placeholders only. Add production IDs and `ADMIN_EMAILS` as Cloudflare Pages secrets; never commit real credentials.

## Content Publishing

The editor renders live previews in a dedicated browser Web Worker using the same Markdown renderer as public pages. Unchanged code blocks and diagrams are reused; if the Worker cannot load, the protected server preview endpoint is used instead. Preview failures do not discard the editor text or the last successful preview. New slugs use lowercase `kebab-case`; existing imported URLs retain their original case when saved unchanged. Existing D1 nodes can be selected as parent directories regardless of their historical casing.

Keep the direct KaTeX dependency pinned to the version used by `rehype-katex` and Mermaid so the generated HTML, CSS, and fonts match. Run `npm test` (WSL Node 24+) for path, content-save, and math-version regression tests, followed by `npm run check` and `npm run build`.

After building, run `node --experimental-strip-types tests/browser-regression.mjs` with an existing Playwright installation and Chrome (`PLAYWRIGHT_MODULE` can specify its module directory). This serves local, in-memory fixtures using the real production editor/Worker bundles; it never authenticates against or writes to production. It covers typing latency, IME, preview fallback, scroll sync, legacy form validation, code/diagram reuse, and desktop/mobile math layout, and writes screenshots to the system temporary directory. Set `PREVIEW_ORIGIN` to a deployed preview URL to additionally check the deployed assets against local fixture HTML without publishing test articles or bypassing admin authentication.

Use `/admin/` for normal publication. Create Learn directories first in the **Learn Directories** panel, choosing a parent (or `/learn`), a display label, lowercase `kebab-case` slug, and sort order. A Learn article then uses **Directory + Slug** to produce its stable path; published moves create a D1-backed 301 redirect. A Learn article that contains child nodes cannot be moved from the normal editor.

Empty directories, drafts, and archived Learn items stay available in the admin tree but are hidden from the public Wiki tree until a published article exists beneath them. Equal sort orders are ordered by display label.

Published Learn and Essay articles record one anonymous browser view per UTC day and provide a browser-local like toggle. The site stores only per-article hashes of a first-party `HttpOnly` cookie, never IP addresses or user profiles. The homepage shell reads published D1 content at request time; use `help`, `ls`, `cd`, `pwd`, `open`, `recent`, `tags`, `stats`, `search`, and `clear`.

Permanent deletion requires typing the exact document title or original media filename. Profile documents and Learn documents with child nodes cannot be deleted. Media deletion is blocked while the asset is referenced by Markdown, a document cover, Anime, or Gallery; export content before deleting because these operations are irreversible.

The repository Markdown and JSON files remain a migration/import source and a Git-friendly backup format, not the primary production data source. Download a backup from `/api/admin/export` and commit it when a snapshot is needed. The ZIP includes `data/learn-tree.json`, which preserves Learn directory paths, labels, parents, and ordering for a later import.

## One-time migration

1. Create separate D1 and R2 resources for Pages production and preview, then replace the placeholders in `wrangler.toml`.
2. Apply the schema with `wrangler d1 migrations apply <database> --remote`.
3. Run `npm run content:migrate` to generate `/tmp/hydroxy-wiki-migration/report.json` and `seed.sql`; inspect the counts and generated URLs.
4. Upload/import only after review:

```bash
npm run content:migrate -- --apply --database <d1-database-name> --bucket <r2-bucket-name> --env production
```

5. Configure the Cloudflare Access application for `/admin/*` and `/api/admin/*`, set `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `ADMIN_EMAILS`, then deploy a Pages preview branch.

The migration rewrites local content-image links inside D1 Markdown to `/media/migration/...`, preserves public article routes, and does not edit source Markdown/JSON files.

## Cloudflare Pages

```text
Build command: npm run build
Build output directory: dist
```

Required bindings and variables:

```text
D1 binding: HYDROXY_DB
R2 binding: HYDROXY_MEDIA
CF_ACCESS_TEAM_DOMAIN
CF_ACCESS_AUD
ADMIN_EMAILS
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN (optional)
```

## Development Notes

- Run `npm run build` before every push. Do not commit `dist/`, `.astro/`, `node_modules/`, or local `.wrangler/` data.
- Search uses D1 FTS5 through `/api/search`, so it is current immediately after publish; Pagefind is no longer used.
- Mermaid renders in the browser from `mermaid` fenced blocks. KaTeX, Shiki, and ordinary code-copy buttons are shared by public pages and the admin preview.
- Apply every new D1 migration to local, preview, and production before deploying code that requires its new tables. Engagement data is operational analytics and is deliberately excluded from content ZIP exports.
- Legacy local content structure is retained under `src/content/` and `src/data/` for import and backup only. Fonts, favicon, and UI assets remain under `public/`.
