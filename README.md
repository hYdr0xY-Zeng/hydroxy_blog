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

Use `/admin/` for normal publication. Create Learn directories first in the **Learn Directories** panel, choosing a parent (or `/learn`), a display label, lowercase `kebab-case` slug, and sort order. A Learn article then uses **Directory + Slug** to produce its stable path; published moves create a D1-backed 301 redirect. A Learn article that contains child nodes cannot be moved from the normal editor.

Empty directories, drafts, and archived Learn items stay available in the admin tree but are hidden from the public Wiki tree until a published article exists beneath them. Equal sort orders are ordered by display label.

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
- Legacy local content structure is retained under `src/content/` and `src/data/` for import and backup only. Fonts, favicon, and UI assets remain under `public/`.
