import { requireAdmin } from '@/lib/auth';
import { getEnv } from '@/lib/runtime';
import { createContentArchive } from '@/lib/content-export';

export const prerender = false;

export async function GET({ request, locals }: { request: Request; locals: App.Locals }) {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const database = getEnv(locals).HYDROXY_DB;
  const [documents, tags, anime, gallery, media, learnTree] = await database.batch<Record<string, unknown>>([
    database.prepare('SELECT * FROM documents ORDER BY kind, path'),
    database.prepare('SELECT document_id, label FROM document_tags JOIN tags ON slug = tag_slug ORDER BY label'),
    database.prepare('SELECT * FROM anime_entries ORDER BY sort_order DESC'),
    database.prepare('SELECT * FROM gallery_entries ORDER BY sort_order DESC'),
    database.prepare('SELECT * FROM media_assets ORDER BY key'),
    database.prepare('SELECT path, parent_path, label, sort_order, node_type FROM learn_nodes ORDER BY parent_path, sort_order, label')
  ]);
  const archive = createContentArchive({
    documents: documents.results, tags: tags.results.map((row) => ({ document_id: String(row.document_id), label: String(row.label) })),
    anime: anime.results, gallery: gallery.results, media: media.results, learnTree: learnTree.results
  });
  return new Response(archive as unknown as BodyInit, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="hydroxy-wiki-export-${new Date().toISOString().slice(0, 10)}.zip"`, 'Cache-Control': 'no-store' } });
}
