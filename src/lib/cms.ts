import type { D1Database } from '@cloudflare/workers-types';
import { getEnv, mediaHref } from './runtime';

export type DocumentKind = 'learn' | 'essay' | 'profile';
export type Visibility = 'draft' | 'published' | 'archived';
export type ContentDocument = { id: string; kind: DocumentKind; path: string; source_path: string | null; title: string; description: string; body_markdown: string; published_at: string | null; mood: string | null; cover_key: string | null; status: Visibility; created_at: string; updated_at: string; tags: string[] };
export type LearnNode = { path: string; parent_path: string | null; label: string; sort_order: number; document_id: string | null; href: string; children: LearnNode[]; entry?: ContentDocument };
export type LearnTreeOptions = { includeUnpublished?: boolean; includeEmpty?: boolean };
export type LearnDirectory = Pick<LearnNode, 'path' | 'label' | 'sort_order'> & { depth: number };
export type AnimeEntry = { id: string; title: string; cn_title: string; status: string; year: number | null; score: number | null; note: string; cover_key: string | null; sort_order: number; visibility: Visibility; created_at: string; updated_at: string };
export type GalleryEntry = { id: string; title: string; alt: string; media_key: string; sort_order: number; visibility: Visibility; created_at: string; updated_at: string };
export type EngagementSummary = { views: number; likes: number; liked: boolean };
export type EngagementTotals = { views: number; likes: number };
export type MediaReference = { type: 'document-cover' | 'document-body' | 'anime-cover' | 'gallery-image'; label: string; href?: string };
export type MediaAsset = { key: string; original_name: string; content_type: string; byte_size: number; sha256: string; created_at: string; references: number };
export type PageResult<T> = { items: T[]; currentPage: number; totalPages: number; totalItems: number };

export class CmsOperationError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

const db = (locals: App.Locals) => getEnv(locals).HYDROXY_DB;
const pathFor = (value: string) => value.trim().replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
const tagId = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'untagged';

export function documentHref(document: Pick<ContentDocument, 'kind' | 'path'>) { return document.kind === 'learn' ? `/learn/${document.path}/` : document.kind === 'essay' ? `/life/essays/${document.path}/` : '/'; }
export const animeCover = (entry: AnimeEntry) => mediaHref(entry.cover_key);
export const galleryImage = (entry: GalleryEntry) => mediaHref(entry.media_key);

async function attachTags(locals: App.Locals, rows: Omit<ContentDocument, 'tags'>[]) {
  if (!rows.length) return [] as ContentDocument[];
  const ids = rows.map((row) => row.id);
  const tags = await db(locals).prepare(`SELECT document_id, label FROM document_tags JOIN tags ON slug = tag_slug WHERE document_id IN (${ids.map(() => '?').join(',')}) ORDER BY label`).bind(...ids).all<{ document_id: string; label: string }>();
  const byId = new Map<string, string[]>();
  tags.results.forEach((row) => byId.set(row.document_id, [...(byId.get(row.document_id) ?? []), row.label]));
  return rows.map((row) => ({ ...row, tags: byId.get(row.id) ?? [] }));
}

export async function listDocuments(locals: App.Locals, options: { kind?: DocumentKind; includeUnpublished?: boolean; limit?: number } = {}) {
  const filters = [options.kind ? 'kind = ?' : "kind IN ('learn', 'essay')", options.includeUnpublished ? '1 = 1' : "status = 'published'"];
  const statement = db(locals).prepare(`SELECT * FROM documents WHERE ${filters.join(' AND ')} ORDER BY COALESCE(published_at, updated_at) DESC${options.limit ? ` LIMIT ${Math.min(options.limit, 200)}` : ''}`);
  const result = options.kind ? await statement.bind(options.kind).all<Omit<ContentDocument, 'tags'>>() : await statement.all<Omit<ContentDocument, 'tags'>>();
  return attachTags(locals, result.results);
}

export async function getDocument(locals: App.Locals, kind: DocumentKind, path: string, includeUnpublished = false) {
  const row = await db(locals).prepare(`SELECT * FROM documents WHERE kind = ? AND path = ? ${includeUnpublished ? '' : "AND status = 'published'"}`).bind(kind, pathFor(path)).first<Omit<ContentDocument, 'tags'>>();
  return row ? (await attachTags(locals, [row]))[0] : null;
}
export const getProfile = (locals: App.Locals) => getDocument(locals, 'profile', 'home');
export async function getDocumentById(locals: App.Locals, id: string) {
  const row = await db(locals).prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<Omit<ContentDocument, 'tags'>>();
  return row ? (await attachTags(locals, [row]))[0] : null;
}
export async function listTags(locals: App.Locals) { const result = await db(locals).prepare(`SELECT DISTINCT tags.label FROM tags JOIN document_tags ON document_tags.tag_slug = tags.slug JOIN documents ON documents.id = document_tags.document_id WHERE documents.status = 'published' ORDER BY tags.label`).all<{ label: string }>(); return result.results.map((row) => row.label); }

export async function getLearnTree(locals: App.Locals, options: LearnTreeOptions = {}) {
  const documentFilter = options.includeUnpublished ? '' : "AND d.status = 'published'";
  const result = await db(locals).prepare(`SELECT n.path AS node_path, n.parent_path, n.label, n.sort_order, n.document_id, d.* FROM learn_nodes n LEFT JOIN documents d ON d.id = n.document_id ${documentFilter} ORDER BY n.sort_order, n.label`).all<Record<string, unknown>>();
  const documentRows = result.results.filter((row) => typeof row.id === 'string').map((row) => ({ id: String(row.id), kind: 'learn' as const, path: String(row.path), source_path: row.source_path ? String(row.source_path) : null, title: String(row.title), description: String(row.description ?? ''), body_markdown: String(row.body_markdown ?? ''), published_at: row.published_at ? String(row.published_at) : null, mood: row.mood ? String(row.mood) : null, cover_key: row.cover_key ? String(row.cover_key) : null, status: String(row.status) as Visibility, created_at: String(row.created_at), updated_at: String(row.updated_at) }));
  const documents = new Map((await attachTags(locals, documentRows)).map((entry) => [entry.id, entry]));
  const byPath = new Map<string, LearnNode>();
  result.results.forEach((row) => byPath.set(String(row.node_path), { path: String(row.node_path), parent_path: row.parent_path ? String(row.parent_path) : null, label: String(row.label), sort_order: Number(row.sort_order), document_id: row.document_id ? String(row.document_id) : null, href: `/learn/${String(row.node_path)}/`, entry: row.document_id ? documents.get(String(row.document_id)) : undefined, children: [] }));
  const roots: LearnNode[] = [];
  byPath.forEach((node) => { const parent = node.parent_path ? byPath.get(node.parent_path) : undefined; parent ? parent.children.push(node) : roots.push(node); });
  const sortNodes = (nodes: LearnNode[]) => {
    nodes.sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  const visibleByPath = new Map<string, LearnNode>();
  const prune = (node: LearnNode): LearnNode | null => {
    node.children = node.children.map(prune).filter((child): child is LearnNode => child !== null);
    if (!options.includeEmpty && !node.entry && node.children.length === 0) return null;
    visibleByPath.set(node.path, node);
    return node;
  };
  return { roots: roots.map(prune).filter((node): node is LearnNode => node !== null), byPath: visibleByPath };
}

export async function listLearnDirectories(locals: App.Locals) {
  const tree = await getLearnTree(locals, { includeUnpublished: true, includeEmpty: true });
  const directories: LearnDirectory[] = [];
  const visit = (nodes: LearnNode[], depth: number) => nodes.forEach((node) => {
    if (!node.document_id || node.children.length > 0) directories.push({ path: node.path, label: node.label, sort_order: node.sort_order, depth });
    visit(node.children, depth + 1);
  });
  visit(tree.roots, 0);
  return directories;
}

async function page<T>(locals: App.Locals, table: 'anime_entries' | 'gallery_entries', pageNumber: number, size: number, includeUnpublished: boolean) {
  const filter = includeUnpublished ? '1 = 1' : "visibility = 'published'";
  const count = await db(locals).prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${filter}`).first<{ total: number }>();
  const totalItems = Number(count?.total ?? 0), totalPages = Math.max(1, Math.ceil(totalItems / size)), currentPage = Math.max(1, Math.min(pageNumber, totalPages));
  const items = await db(locals).prepare(`SELECT * FROM ${table} WHERE ${filter} ORDER BY sort_order DESC, created_at DESC LIMIT ? OFFSET ?`).bind(size, (currentPage - 1) * size).all<T>();
  return { items: items.results, currentPage, totalPages, totalItems };
}
export const listAnime = (locals: App.Locals, pageNumber: number, size = 20, includeUnpublished = false) => page<AnimeEntry>(locals, 'anime_entries', pageNumber, size, includeUnpublished);
export const listGallery = (locals: App.Locals, pageNumber: number, size = 30, includeUnpublished = false) => page<GalleryEntry>(locals, 'gallery_entries', pageNumber, size, includeUnpublished);
export const getRedirect = (locals: App.Locals, path: string) => db(locals).prepare('SELECT to_path FROM redirects WHERE from_path = ?').bind(path).first<{ to_path: string }>();

export async function getEngagementSummary(locals: App.Locals, documentId: string, visitorHash?: string) {
  const database = db(locals);
  const [viewRow, likeRow, likedRow] = await Promise.all([
    database.prepare('SELECT COUNT(*) AS total FROM document_daily_views WHERE document_id = ?').bind(documentId).first<{ total: number }>(),
    database.prepare('SELECT COUNT(*) AS total FROM document_likes WHERE document_id = ?').bind(documentId).first<{ total: number }>(),
    visitorHash ? database.prepare('SELECT 1 AS liked FROM document_likes WHERE document_id = ? AND visitor_hash = ?').bind(documentId, visitorHash).first<{ liked: number }>() : Promise.resolve(null)
  ]);
  return { views: Number(viewRow?.total ?? 0), likes: Number(likeRow?.total ?? 0), liked: Boolean(likedRow?.liked) } satisfies EngagementSummary;
}

export async function recordDailyView(locals: App.Locals, documentId: string, visitorHash: string) {
  await db(locals).prepare('INSERT OR IGNORE INTO document_daily_views (document_id, visitor_hash, viewed_on) VALUES (?, ?, ?)').bind(documentId, visitorHash, new Date().toISOString().slice(0, 10)).run();
  return getEngagementSummary(locals, documentId, visitorHash);
}

export async function toggleDocumentLike(locals: App.Locals, documentId: string, visitorHash: string) {
  const database = db(locals);
  const existing = await database.prepare('SELECT 1 AS liked FROM document_likes WHERE document_id = ? AND visitor_hash = ?').bind(documentId, visitorHash).first<{ liked: number }>();
  if (existing) await database.prepare('DELETE FROM document_likes WHERE document_id = ? AND visitor_hash = ?').bind(documentId, visitorHash).run();
  else await database.prepare('INSERT INTO document_likes (document_id, visitor_hash) VALUES (?, ?)').bind(documentId, visitorHash).run();
  return getEngagementSummary(locals, documentId, visitorHash);
}

export async function getEngagementTotals(locals: App.Locals) {
  const database = db(locals);
  const [viewRow, likeRow] = await Promise.all([
    database.prepare(`SELECT COUNT(*) AS total FROM document_daily_views JOIN documents ON documents.id = document_daily_views.document_id WHERE documents.status = 'published'`).first<{ total: number }>(),
    database.prepare(`SELECT COUNT(*) AS total FROM document_likes JOIN documents ON documents.id = document_likes.document_id WHERE documents.status = 'published'`).first<{ total: number }>()
  ]);
  return { views: Number(viewRow?.total ?? 0), likes: Number(likeRow?.total ?? 0) } satisfies EngagementTotals;
}

export async function searchContent(locals: App.Locals, query: string) {
  const result = await db(locals).prepare(`SELECT entity_id, entity_kind, path, title, snippet(search_index, 5, '<mark>', '</mark>', '...', 16) AS excerpt FROM search_index WHERE search_index MATCH ? ORDER BY bm25(search_index) LIMIT 12`).bind(`${query.trim()}*`).all<{ entity_id: string; entity_kind: string; path: string; title: string; excerpt: string }>();
  return result.results;
}

async function syncSearch(locals: App.Locals, entity: { id: string; kind: string; path: string; title: string; description: string; body: string; tags?: string }, visible: boolean) {
  await db(locals).prepare('DELETE FROM search_index WHERE entity_id = ?').bind(entity.id).run();
  if (visible) await db(locals).prepare('INSERT INTO search_index (entity_id, entity_kind, path, title, description, body, tags) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(entity.id, entity.kind, entity.path, entity.title, entity.description, entity.body, entity.tags ?? '').run();
}

export type SaveDocumentInput = Pick<ContentDocument, 'kind' | 'title' | 'description' | 'body_markdown' | 'mood' | 'cover_key' | 'status'> & { id?: string; path?: string; parent_path?: string; slug?: string; sort_order?: number; published_at?: string | null; tags: string[] };
export type SaveLearnDirectoryInput = { parent_path?: string; slug: string; label: string; sort_order?: number };

const learnSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const normalizeLearnSlug = (value: string) => {
  const slug = value.trim();
  if (!learnSlugPattern.test(slug)) throw new Error('Learn slug must use lowercase letters, numbers, and hyphens only.');
  return slug;
};
const normalizeLearnParentPath = (value: string | undefined) => {
  const parent = pathFor(value ?? '');
  if (parent && !parent.split('/').every((segment) => learnSlugPattern.test(segment))) throw new Error('Learn parent path is invalid.');
  return parent;
};
const learnPathFor = (parentPath: string, slug: string) => parentPath ? `${parentPath}/${slug}` : slug;
const normalizedSortOrder = (value: number | undefined) => Number.isInteger(value) ? Number(value) : 9999;

async function assertLearnParent(database: D1Database, parentPath: string) {
  if (!parentPath) return;
  const parent = await database.prepare(`SELECT n.document_id, EXISTS(SELECT 1 FROM learn_nodes child WHERE child.parent_path = n.path) AS has_children FROM learn_nodes n WHERE n.path = ?`).bind(parentPath).first<{ document_id: string | null; has_children: number }>();
  if (!parent || (parent.document_id && !parent.has_children)) throw new Error('Choose an existing Learn directory as the parent.');
}

export async function saveLearnDirectory(locals: App.Locals, input: SaveLearnDirectoryInput) {
  const database = db(locals);
  const parentPath = normalizeLearnParentPath(input.parent_path);
  const slug = normalizeLearnSlug(input.slug);
  const path = learnPathFor(parentPath, slug);
  const label = input.label.trim();
  if (!label) throw new Error('A directory label is required.');
  await assertLearnParent(database, parentPath);
  const existing = await database.prepare('SELECT path FROM learn_nodes WHERE path = ?').bind(path).first<{ path: string }>();
  if (existing) throw new Error('That Learn path is already in use.');
  await database.prepare('INSERT INTO learn_nodes (path, parent_path, label, sort_order) VALUES (?, ?, ?, ?)').bind(path, parentPath || null, label, normalizedSortOrder(input.sort_order)).run();
  return { path, parent_path: parentPath || null, label, sort_order: normalizedSortOrder(input.sort_order) };
}

export async function saveDocument(locals: App.Locals, input: SaveDocumentInput) {
  const database = db(locals);
  const learnParentPath = input.kind === 'learn' ? normalizeLearnParentPath(input.parent_path) : '';
  const learnSlug = input.kind === 'learn' ? normalizeLearnSlug(input.slug ?? '') : '';
  const id = input.id ?? crypto.randomUUID(), path = input.kind === 'learn' ? learnPathFor(learnParentPath, learnSlug) : pathFor(input.path ?? '');
  if (!path) throw new Error('A content path is required.');
  const existing = await database.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<ContentDocument>();
  const existingLearnNode = existing?.kind === 'learn' ? await database.prepare(`SELECT path, EXISTS(SELECT 1 FROM learn_nodes child WHERE child.parent_path = learn_nodes.path) AS has_children FROM learn_nodes WHERE path = ?`).bind(existing.path).first<{ path: string; has_children: number }>() : null;
  if (existingLearnNode?.has_children && (input.kind !== 'learn' || existing!.path !== path)) throw new Error('A Learn article with child nodes cannot be moved.');
  if (input.kind === 'learn') {
    await assertLearnParent(database, learnParentPath);
    const targetNode = await database.prepare('SELECT document_id FROM learn_nodes WHERE path = ?').bind(path).first<{ document_id: string | null }>();
    if (targetNode && targetNode.document_id !== id) throw new Error('That Learn path is already in use.');
  }
  const publishedAt = input.status === 'published' ? input.published_at ?? existing?.published_at ?? new Date().toISOString() : input.published_at ?? existing?.published_at ?? null;
  await database.prepare(`INSERT INTO documents (id, kind, path, title, description, body_markdown, published_at, mood, cover_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, path=excluded.path, title=excluded.title, description=excluded.description, body_markdown=excluded.body_markdown, published_at=excluded.published_at, mood=excluded.mood, cover_key=excluded.cover_key, status=excluded.status, updated_at=CURRENT_TIMESTAMP`).bind(id, input.kind, path, input.title.trim(), input.description.trim(), input.body_markdown, publishedAt, input.mood || null, input.cover_key || null, input.status).run();
  if (existing?.status === 'published' && existing.path !== path) await database.prepare('INSERT OR REPLACE INTO redirects (from_path, to_path) VALUES (?, ?)').bind(documentHref(existing), documentHref({ kind: input.kind, path })).run();
  if (existing?.kind === 'learn' && (input.kind !== 'learn' || existing.path !== path)) await database.prepare('DELETE FROM learn_nodes WHERE path = ?').bind(existing.path).run();
  if (input.kind === 'learn') {
    await database.prepare('INSERT INTO learn_nodes (path, parent_path, label, sort_order, document_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET parent_path=excluded.parent_path, label=excluded.label, sort_order=excluded.sort_order, document_id=excluded.document_id').bind(path, learnParentPath || null, input.title.trim(), normalizedSortOrder(input.sort_order), id).run();
  }
  await database.prepare('DELETE FROM document_tags WHERE document_id = ?').bind(id).run();
  const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
  for (const label of tags) { const slug = tagId(label); await database.prepare('INSERT INTO tags (slug, label) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET label=excluded.label').bind(slug, label).run(); await database.prepare('INSERT INTO document_tags (document_id, tag_slug) VALUES (?, ?)').bind(id, slug).run(); }
  await syncSearch(locals, { id, kind: input.kind, path, title: input.title, description: input.description, body: input.body_markdown, tags: tags.join(' ') }, input.status === 'published');
  return getDocument(locals, input.kind, path, true);
}
export async function archiveDocument(locals: App.Locals, id: string) { await db(locals).prepare("UPDATE documents SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run(); await db(locals).prepare('DELETE FROM search_index WHERE entity_id = ?').bind(id).run(); }

export async function deleteDocument(locals: App.Locals, id: string, confirmation: string) {
  const document = await getDocumentById(locals, id);
  if (!document) throw new CmsOperationError('Document not found.', 404);
  if (document.kind === 'profile') throw new CmsOperationError('The homepage profile cannot be deleted.', 409);
  if (confirmation !== document.title) throw new CmsOperationError('Type the exact document title to confirm deletion.', 400);

  const database = db(locals);
  const node = document.kind === 'learn' ? await database.prepare(`SELECT path, parent_path, EXISTS(SELECT 1 FROM learn_nodes child WHERE child.parent_path = learn_nodes.path) AS has_children FROM learn_nodes WHERE document_id = ?`).bind(id).first<{ path: string; parent_path: string | null; has_children: number }>() : null;
  if (node?.has_children) throw new CmsOperationError('A Learn article with child nodes cannot be deleted.', 409);

  const oldHref = documentHref(document);
  const parentHref = document.kind === 'learn' ? node?.parent_path ? `/learn/${node.parent_path}/` : '/learn/' : '/life/essays/';
  const statements = [
    ...(document.published_at ? [
      database.prepare('INSERT OR REPLACE INTO redirects (from_path, to_path) VALUES (?, ?)').bind(oldHref, parentHref),
      database.prepare('UPDATE redirects SET to_path = ? WHERE to_path = ?').bind(parentHref, oldHref)
    ] : []),
    database.prepare('DELETE FROM search_index WHERE entity_id = ?').bind(id),
    database.prepare('DELETE FROM document_tags WHERE document_id = ?').bind(id),
    database.prepare('DELETE FROM document_daily_views WHERE document_id = ?').bind(id),
    database.prepare('DELETE FROM document_likes WHERE document_id = ?').bind(id),
    ...(document.kind === 'learn' ? [database.prepare('DELETE FROM learn_nodes WHERE document_id = ?').bind(id)] : []),
    database.prepare('DELETE FROM documents WHERE id = ?').bind(id),
    database.prepare('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM document_tags WHERE document_tags.tag_slug = tags.slug)')
  ];
  await database.batch(statements);
  return { redirect: '/admin/' };
}

export async function getMediaReferences(locals: App.Locals, key: string) {
  const database = db(locals);
  const [documentCovers, documentBodies, animeCovers, galleryImages] = await Promise.all([
    database.prepare('SELECT id, kind, path, title FROM documents WHERE cover_key = ?').bind(key).all<Pick<ContentDocument, 'id' | 'kind' | 'path' | 'title'>>(),
    database.prepare(`SELECT id, kind, path, title FROM documents WHERE instr(body_markdown, ?) > 0`).bind(`/media/${key}`).all<Pick<ContentDocument, 'id' | 'kind' | 'path' | 'title'>>(),
    database.prepare('SELECT id, title, cn_title FROM anime_entries WHERE cover_key = ?').bind(key).all<{ id: string; title: string; cn_title: string }>(),
    database.prepare('SELECT id, title FROM gallery_entries WHERE media_key = ?').bind(key).all<{ id: string; title: string }>()
  ]);
  return [
    ...documentCovers.results.map((entry) => ({ type: 'document-cover' as const, label: `${entry.title} cover`, href: documentHref(entry) })),
    ...documentBodies.results.map((entry) => ({ type: 'document-body' as const, label: `${entry.title} body`, href: documentHref(entry) })),
    ...animeCovers.results.map((entry) => ({ type: 'anime-cover' as const, label: entry.cn_title || entry.title })),
    ...galleryImages.results.map((entry) => ({ type: 'gallery-image' as const, label: entry.title }))
  ] satisfies MediaReference[];
}

export async function listMediaAssets(locals: App.Locals) {
  const result = await db(locals).prepare('SELECT * FROM media_assets ORDER BY created_at DESC, key').all<Omit<MediaAsset, 'references'>>();
  return Promise.all(result.results.map(async (asset) => ({ ...asset, references: (await getMediaReferences(locals, asset.key)).length } satisfies MediaAsset)));
}

export async function deleteMediaAsset(locals: App.Locals, key: string, confirmation: string) {
  const database = db(locals);
  const asset = await database.prepare('SELECT * FROM media_assets WHERE key = ?').bind(key).first<Omit<MediaAsset, 'references'>>();
  if (!asset) throw new CmsOperationError('Media asset not found.', 404);
  if (confirmation !== asset.original_name) throw new CmsOperationError('Type the exact original file name to confirm deletion.', 400);
  const references = await getMediaReferences(locals, key);
  if (references.length) throw new CmsOperationError(`This media is still referenced by ${references.length} item(s).`, 409);
  await getEnv(locals).HYDROXY_MEDIA.delete(key);
  await database.prepare('DELETE FROM media_assets WHERE key = ?').bind(key).run();
}

export async function upsertAnime(locals: App.Locals, entry: Omit<AnimeEntry, 'created_at' | 'updated_at'>) {
  await db(locals).prepare(`INSERT INTO anime_entries (id,title,cn_title,status,year,score,note,cover_key,sort_order,visibility) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,cn_title=excluded.cn_title,status=excluded.status,year=excluded.year,score=excluded.score,note=excluded.note,cover_key=excluded.cover_key,sort_order=excluded.sort_order,visibility=excluded.visibility,updated_at=CURRENT_TIMESTAMP`).bind(entry.id, entry.title, entry.cn_title, entry.status, entry.year, entry.score, entry.note, entry.cover_key, entry.sort_order, entry.visibility).run();
  await syncSearch(locals, { id: entry.id, kind: 'anime', path: '', title: entry.cn_title || entry.title, description: entry.title, body: entry.note }, entry.visibility === 'published');
}
export async function upsertGallery(locals: App.Locals, entry: Omit<GalleryEntry, 'created_at' | 'updated_at'>) {
  await db(locals).prepare(`INSERT INTO gallery_entries (id,title,alt,media_key,sort_order,visibility) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,alt=excluded.alt,media_key=excluded.media_key,sort_order=excluded.sort_order,visibility=excluded.visibility,updated_at=CURRENT_TIMESTAMP`).bind(entry.id, entry.title, entry.alt, entry.media_key, entry.sort_order, entry.visibility).run();
  await syncSearch(locals, { id: entry.id, kind: 'gallery', path: '', title: entry.title, description: entry.alt, body: '' }, entry.visibility === 'published');
}
export async function saveMediaMetadata(locals: App.Locals, asset: { key: string; originalName: string; contentType: string; byteSize: number; sha256: string }) { await db(locals).prepare('INSERT INTO media_assets (key, original_name, content_type, byte_size, sha256) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET original_name=excluded.original_name, content_type=excluded.content_type, byte_size=excluded.byte_size, sha256=excluded.sha256').bind(asset.key, asset.originalName, asset.contentType, asset.byteSize, asset.sha256).run(); }
