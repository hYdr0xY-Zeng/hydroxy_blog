import { strToU8, zipSync } from 'fflate';

type ExportRow = Record<string, unknown>;
export type ContentSnapshot = {
  documents: ExportRow[];
  tags: { document_id: string; label: string }[];
  anime: ExportRow[];
  gallery: ExportRow[];
  media: ExportRow[];
  learnTree: ExportRow[];
};

export function createContentArchive(snapshot: ContentSnapshot) {
  const tagMap = new Map<string, string[]>();
  snapshot.tags.forEach((tag) => tagMap.set(tag.document_id, [...(tagMap.get(tag.document_id) ?? []), tag.label]));
  const directories = new Set(snapshot.learnTree.filter((node) => node.node_type === 'directory').map((node) => String(node.path)));
  const files: Record<string, Uint8Array> = {};
  snapshot.documents.forEach((document) => {
    const kind = String(document.kind), path = String(document.path);
    // An article named index must not overwrite its parent's directory introduction.
    const articleFile = path.split('/').at(-1) === 'index' ? `${path}/article.md` : `${path}.md`;
    const output = kind === 'learn' ? directories.has(path) ? `learn/${path}/index.md` : `learn/${articleFile}` : kind === 'essay' ? `life/essays/${path}.md` : 'profile/home.md';
    if (files[output]) throw new Error(`Duplicate content export path: ${output}`);
    const frontmatter = { title: document.title, path: document.path, description: document.description, date: document.published_at, status: document.status, tags: tagMap.get(String(document.id)) ?? [], draft: document.status !== 'published', mood: document.mood || undefined, cover: document.cover_key ? `/media/${document.cover_key}` : undefined };
    const header = Object.entries(frontmatter).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
    files[output] = strToU8(`---\n${header}\n---\n\n${document.body_markdown ?? ''}\n`);
  });
  files['data/anime.json'] = strToU8(JSON.stringify(snapshot.anime, null, 2));
  files['data/gallery.json'] = strToU8(JSON.stringify(snapshot.gallery, null, 2));
  files['data/learn-tree.json'] = strToU8(JSON.stringify(snapshot.learnTree.map((node) => ({ path: node.path, parentPath: node.parent_path, label: node.label, sortOrder: node.sort_order, nodeType: node.node_type })), null, 2));
  files['media-manifest.json'] = strToU8(JSON.stringify(snapshot.media, null, 2));
  return zipSync(files, { level: 6 });
}
