import type { APIRoute } from 'astro';
import { requireAdmin, requireSameOrigin } from '@/lib/auth';
import { CmsOperationError, deleteLifeEntry } from '@/lib/cms';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  try {
    const payload = await request.json() as { confirmation?: unknown };
    await deleteLifeEntry(locals, 'anime', params.id ?? '', typeof payload?.confirmation === 'string' ? payload.confirmation : '');
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Delete failed.' }, { status: error instanceof CmsOperationError ? error.status : 400 });
  }
};
