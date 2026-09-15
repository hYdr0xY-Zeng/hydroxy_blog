import { strToU8, zipSync } from 'fflate';
import { requireAdmin } from '@/lib/auth';
import { getEnv } from '@/lib/runtime';

export const prerender = false;

export async function GET({ request, locals }: { request: Request; locals: App.Locals }) {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const database = getEnv(locals).HYDROXY_DB;
  const [documents, tags, anime, gallery, media] = await Promise.all([
    database.prepare('SELECT * FROM documents ORDER BY kind, path').all<Record<string, unknown>>(),
    database.prepare('SELECT document_id, label FROM document_tags JOIN tags ON slug = tag_slug ORDER BY label').all<{ document_id: string; label: string }>(),
    database.prepare('SELECT * FROM anime_entries ORDER BY sort_order DESC').all(),
    database.prepare('SELECT * FROM gallery_entries ORDER BY sort_order DESC').all(),
    database.prepare('SELECT * FROM media_assets ORDER BY key').all()
  ]);
  const tagMap = new Map<string, string[]>();
  tags.results.forEach((tag) => tagMap.set(tag.document_id, [...(tagMap.get(tag.document_id) ?? []), tag.label]));
  const files: Record<string, Uint8Array> = {};
  documents.results.forEach((document) => {
    const kind = String(document.kind), path = String(document.path), output = kind === 'learn' ? `learn/${path}.md` : kind === 'essay' ? `life/essays/${path}.md` : 'profile/home.md';
    const frontmatter = { title: document.title, description: document.description, date: document.published_at, tags: tagMap.get(String(document.id)) ?? [], draft: document.status !== 'published', mood: document.mood || undefined, cover: document.cover_key ? `/media/${document.cover_key}` : undefined };
    const header = Object.entries(frontmatter).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
    files[output] = strToU8(`---\n${header}\n---\n\n${document.body_markdown ?? ''}\n`);
  });
  files['data/anime.json'] = strToU8(JSON.stringify(anime.results, null, 2));
  files['data/gallery.json'] = strToU8(JSON.stringify(gallery.results, null, 2));
  files['media-manifest.json'] = strToU8(JSON.stringify(media.results, null, 2));
  const archive = zipSync(files, { level: 6 });
  return new Response(archive as unknown as BodyInit, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="hydroxy-wiki-export-${new Date().toISOString().slice(0, 10)}.zip"` } });
}