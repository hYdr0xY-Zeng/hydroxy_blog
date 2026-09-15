import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const root = process.cwd();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const arg = (name) => args[args.indexOf(name) + 1];
const database = arg('--database');
const bucket = arg('--bucket');
const environment = arg('--env');
const output = join(tmpdir(), 'hydroxy-wiki-migration');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sql = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const mime = (file) => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' }[extname(file).toLowerCase()] ?? 'application/octet-stream');
const clean = (segment) => segment.replace(/^\d+[-_ ]+/, '');
const titleFor = (segment) => clean(segment).split('-').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');

async function walk(directory) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const assets = new Map();
async function registerAsset(file) {
  const absolute = resolve(file);
  if (!existsSync(absolute)) throw new Error(`Missing local media: ${file}`);
  if (assets.has(absolute)) return assets.get(absolute).key;
  const bytes = await readFile(absolute);
  const digest = hash(bytes);
  const key = `migration/${digest}${extname(absolute).toLowerCase()}`;
  assets.set(absolute, { key, digest, bytes: bytes.byteLength, type: mime(absolute), originalName: basename(absolute) });
  return key;
}

async function rewriteMedia(markdown, file) {
  const directory = resolve(file, '..');
  const image = /!\[[^\]]*]\(([^\s)]+)(?:\s+[^)]*)?\)/g;
  let output = markdown;
  for (const match of [...markdown.matchAll(image)]) {
    const source = match[1];
    if (/^(https?:|data:|#)/i.test(source)) continue;
    const absolute = source.startsWith('/') ? join(root, 'public', source) : resolve(directory, source);
    const key = await registerAsset(absolute);
    output = output.replace(match[0], match[0].replace(source, `/media/${key}`));
  }
  return output;
}

async function documentFrom(file, kind) {
  const raw = await readFile(file, 'utf8');
  const parsed = matter(raw);
  const rel = relative(kind === 'essay' ? join(root, 'src/content/life/essays') : kind === 'profile' ? join(root, 'src/content/profile') : join(root, 'src/content/learn'), file).replaceAll('\\', '/');
  const withoutExtension = rel.replace(/\.(md|mdx)$/, '');
  const rawParts = withoutExtension.replace(/\/index$/, '').split('/').filter(Boolean);
  const path = kind === 'profile' ? 'home' : rawParts.map(clean).join('/');
  const sourcePath = relative(root, file).replaceAll('\\', '/');
  const title = String(parsed.data.title || titleFor(rawParts.at(-1) || 'home'));
  const status = parsed.data.draft ? 'draft' : 'published';
  let body = await rewriteMedia(parsed.content, file);
  let coverKey = null;
  if (typeof parsed.data.cover === 'string' && !/^https?:/i.test(parsed.data.cover)) coverKey = await registerAsset(parsed.data.cover.startsWith('/') ? join(root, 'public', parsed.data.cover) : resolve(file, '..', parsed.data.cover));
  return { id: hash(sourcePath).slice(0, 32), kind, path, sourcePath, title, description: String(parsed.data.description || ''), body, publishedAt: parsed.data.date ? new Date(parsed.data.date).toISOString() : null, mood: parsed.data.mood ? String(parsed.data.mood) : null, coverKey, status, tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [], rawParts };
}

const documents = [];
for (const file of await walk(join(root, 'src/content/learn'))) if (/\.(md|mdx)$/.test(file)) documents.push(await documentFrom(file, 'learn'));
for (const file of await walk(join(root, 'src/content/life/essays'))) if (/\.(md|mdx)$/.test(file)) documents.push(await documentFrom(file, 'essay'));
documents.push(await documentFrom(join(root, 'src/content/profile/home.md'), 'profile'));

const learnNodes = new Map();
const learnTreeFiles = [join(root, 'src/data/learn-tree.json'), join(root, 'data/learn-tree.json')];
const learnTreeFile = learnTreeFiles.find(existsSync);
if (learnTreeFile) {
  const manifest = JSON.parse(await readFile(learnTreeFile, 'utf8'));
  if (!Array.isArray(manifest)) throw new Error(`Learn tree manifest must be an array: ${learnTreeFile}`);
  for (const entry of manifest) {
    const path = String(entry.path ?? '').trim().replace(/^\/+|\/+$/g, '');
    const parent = entry.parentPath == null && entry.parent_path == null ? null : String(entry.parentPath ?? entry.parent_path).trim().replace(/^\/+|\/+$/g, '');
    const label = String(entry.label ?? '').trim();
    const order = Number.isInteger(entry.sortOrder) ? entry.sortOrder : Number.isInteger(entry.sort_order) ? entry.sort_order : 9999;
    const expectedParent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
    if (!path || !label || parent !== expectedParent) throw new Error(`Invalid Learn tree entry: ${JSON.stringify(entry)}`);
    if (learnNodes.has(path)) throw new Error(`Duplicate Learn tree path: ${path}`);
    learnNodes.set(path, { path, parent, label, order, documentId: null });
  }
  for (const document of documents.filter((item) => item.kind === 'learn')) {
    const node = learnNodes.get(document.path);
    if (!node) throw new Error(`Learn tree manifest is missing article path: ${document.path}`);
    if (node.documentId) throw new Error(`Learn tree path has multiple articles: ${document.path}`);
    node.documentId = document.id;
  }
  console.log(`Using Learn tree manifest: ${learnTreeFile}`);
} else {
  for (const document of documents.filter((item) => item.kind === 'learn')) {
    document.rawParts.forEach((part, index) => {
      const path = document.rawParts.slice(0, index + 1).map(clean).join('/');
      const parent = index ? document.rawParts.slice(0, index).map(clean).join('/') : null;
      const order = Number(part.match(/^(\d+)[-_ ]+/)?.[1] ?? 9999);
      learnNodes.set(path, { path, parent, label: index === document.rawParts.length - 1 ? document.title : titleFor(part), order, documentId: index === document.rawParts.length - 1 ? document.id : null });
    });
  }
}

const animeSource = JSON.parse(await readFile(join(root, 'src/data/anime.json'), 'utf8'));
const gallerySource = JSON.parse(await readFile(join(root, 'src/data/gallery.json'), 'utf8'));
const anime = [];
for (const [index, item] of animeSource.entries()) {
  const coverKey = item.cover?.startsWith('/') ? await registerAsset(join(root, 'public', item.cover)) : null;
  anime.push({ id: hash(`anime:${item.title}:${index}`).slice(0, 32), ...item, coverKey, order: animeSource.length - index });
}
const gallery = [];
for (const [index, item] of gallerySource.entries()) {
  const mediaKey = item.src?.startsWith('/') ? await registerAsset(join(root, 'public', item.src)) : null;
  if (!mediaKey) throw new Error(`Gallery item ${item.title} has no local image.`);
  gallery.push({ id: hash(`gallery:${item.src}:${index}`).slice(0, 32), ...item, mediaKey, order: gallerySource.length - index });
}

const statements = ['DELETE FROM search_index;', 'DELETE FROM document_tags;', 'DELETE FROM tags;', 'DELETE FROM learn_nodes;', 'DELETE FROM documents;', 'DELETE FROM anime_entries;', 'DELETE FROM gallery_entries;'];
for (const asset of assets.values()) statements.push(`INSERT INTO media_assets (key, original_name, content_type, byte_size, sha256) VALUES (${sql(asset.key)}, ${sql(asset.originalName)}, ${sql(asset.type)}, ${asset.bytes}, ${sql(asset.digest)}) ON CONFLICT(key) DO UPDATE SET original_name=excluded.original_name, content_type=excluded.content_type, byte_size=excluded.byte_size;`);
for (const document of documents) {
  statements.push(`INSERT INTO documents (id,kind,path,source_path,title,description,body_markdown,published_at,mood,cover_key,status) VALUES (${sql(document.id)},${sql(document.kind)},${sql(document.path)},${sql(document.sourcePath)},${sql(document.title)},${sql(document.description)},${sql(document.body)},${sql(document.publishedAt)},${sql(document.mood)},${sql(document.coverKey)},${sql(document.status)});`);
  for (const tag of [...new Set(document.tags.map((value) => value.trim()).filter(Boolean))]) { const slug = tag.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'untagged'; statements.push(`INSERT INTO tags (slug,label) VALUES (${sql(slug)},${sql(tag)}) ON CONFLICT(slug) DO UPDATE SET label=excluded.label;`, `INSERT INTO document_tags (document_id,tag_slug) VALUES (${sql(document.id)},${sql(slug)});`); }
  if (document.status === 'published') statements.push(`INSERT INTO search_index (entity_id,entity_kind,path,title,description,body,tags) VALUES (${sql(document.id)},${sql(document.kind)},${sql(document.path)},${sql(document.title)},${sql(document.description)},${sql(document.body)},${sql(document.tags.join(' '))});`);
}
for (const node of learnNodes.values()) statements.push(`INSERT INTO learn_nodes (path,parent_path,label,sort_order,document_id) VALUES (${sql(node.path)},${sql(node.parent)},${sql(node.label)},${node.order},${sql(node.documentId)});`);
for (const item of anime) { statements.push(`INSERT INTO anime_entries (id,title,cn_title,status,year,score,note,cover_key,sort_order,visibility) VALUES (${sql(item.id)},${sql(item.title)},${sql(item.cnTitle || '')},${sql(item.status || '')},${Number(item.year) || 'NULL'},${typeof item.score === 'number' ? item.score : 'NULL'},${sql(item.note || '')},${sql(item.coverKey)},${item.order},'published');`, `INSERT INTO search_index (entity_id,entity_kind,path,title,description,body,tags) VALUES (${sql(item.id)},'anime','',${sql(item.cnTitle || item.title)},${sql(item.title)},${sql(item.note || '')},'');`); }
for (const item of gallery) { statements.push(`INSERT INTO gallery_entries (id,title,alt,media_key,sort_order,visibility) VALUES (${sql(item.id)},${sql(item.title)},${sql(item.alt || '')},${sql(item.mediaKey)},${item.order},'published');`, `INSERT INTO search_index (entity_id,entity_kind,path,title,description,body,tags) VALUES (${sql(item.id)},'gallery','',${sql(item.title)},${sql(item.alt || '')},'','');`); }
await mkdir(output, { recursive: true });
const sqlFile = join(output, 'seed.sql');
const mediaFile = join(output, 'media.json');
await writeFile(sqlFile, statements.join('\n'));
await writeFile(mediaFile, JSON.stringify([...assets.entries()].map(([file, asset]) => ({ file, ...asset })), null, 2));
await writeFile(join(output, 'report.json'), JSON.stringify({ documents: documents.length, learnNodes: learnNodes.size, anime: anime.length, gallery: gallery.length, media: assets.size, sqlFile, mediaFile }, null, 2));
console.log(`Prepared migration report in ${output}`);
if (apply) {
  if (!database || !bucket) throw new Error('Use --apply --database <D1 name> --bucket <R2 bucket>.');
  for (const [file, asset] of assets) execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${bucket}/${asset.key}`, '--file', file, '--remote'], { stdio: 'inherit' });
  const executeArgs = ['wrangler', 'd1', 'execute', database, '--remote', '--file', sqlFile];
  if (environment) executeArgs.push('--env', environment);
  execFileSync('npx', executeArgs, { stdio: 'inherit' });
  console.log('Migration applied. Review the report and visit the Pages preview before production cutover.');
}
