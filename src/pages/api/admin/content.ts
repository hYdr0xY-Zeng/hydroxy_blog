import { archiveDocument, saveDocument, saveLearnDirectory, upsertAnime, upsertGallery } from '@/lib/cms';
import { requireAdmin, requireSameOrigin } from '@/lib/auth';

export const prerender = false;

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (payload.action === 'saveDocument') {
      const document = payload.document as Record<string, unknown>;
      const result = await saveDocument(locals, { id: typeof document.id === 'string' && document.id.trim() ? document.id : undefined, kind: document.kind === 'essay' || document.kind === 'profile' ? document.kind : 'learn', path: typeof document.path === 'string' ? document.path : undefined, parent_path: typeof document.parent_path === 'string' ? document.parent_path : undefined, slug: typeof document.slug === 'string' ? document.slug : undefined, sort_order: Number.isInteger(document.sort_order) ? Number(document.sort_order) : undefined, title: String(document.title ?? ''), description: String(document.description ?? ''), body_markdown: String(document.body_markdown ?? ''), mood: typeof document.mood === 'string' ? document.mood : null, cover_key: typeof document.cover_key === 'string' ? document.cover_key : null, status: document.status === 'published' || document.status === 'archived' ? document.status : 'draft', published_at: typeof document.published_at === 'string' ? document.published_at : null, tags: Array.isArray(document.tags) ? document.tags.map(String) : [] });
      return Response.json({ document: result });
    }
    if (payload.action === 'saveLearnDirectory') {
      const directory = payload.directory as Record<string, unknown>;
      const result = await saveLearnDirectory(locals, { parent_path: typeof directory.parent_path === 'string' ? directory.parent_path : undefined, slug: String(directory.slug ?? ''), label: String(directory.label ?? ''), sort_order: Number.isInteger(directory.sort_order) ? Number(directory.sort_order) : undefined });
      return Response.json({ directory: result });
    }
    if (payload.action === 'archiveDocument') { await archiveDocument(locals, String(payload.id)); return Response.json({ ok: true }); }
    if (payload.action === 'saveAnime') {
      const entry = payload.entry as Record<string, unknown>;
      await upsertAnime(locals, { id: String(entry.id || crypto.randomUUID()), title: String(entry.title ?? ''), cn_title: String(entry.cn_title ?? ''), status: String(entry.status ?? ''), year: entry.year ? Number(entry.year) : null, score: entry.score === '' || entry.score == null ? null : Number(entry.score), note: String(entry.note ?? ''), cover_key: typeof entry.cover_key === 'string' ? entry.cover_key : null, sort_order: Number(entry.sort_order ?? 0), visibility: entry.visibility === 'draft' || entry.visibility === 'archived' ? entry.visibility : 'published' });
      return Response.json({ ok: true });
    }
    if (payload.action === 'saveGallery') {
      const entry = payload.entry as Record<string, unknown>;
      if (!entry.media_key) return Response.json({ error: 'A media key is required.' }, { status: 400 });
      await upsertGallery(locals, { id: String(entry.id || crypto.randomUUID()), title: String(entry.title ?? ''), alt: String(entry.alt ?? ''), media_key: String(entry.media_key), sort_order: Number(entry.sort_order ?? 0), visibility: entry.visibility === 'draft' || entry.visibility === 'archived' ? entry.visibility : 'published' });
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('Admin content operation failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Save failed.' }, { status: 400 });
  }
}
