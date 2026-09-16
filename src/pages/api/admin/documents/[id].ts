import type { APIRoute } from 'astro';
import { CmsOperationError, deleteDocument } from '@/lib/cms';
import { requireAdmin, requireSameOrigin } from '@/lib/auth';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  try {
    const payload = await request.json() as { confirmation?: unknown };
    const result = await deleteDocument(locals, params.id ?? '', typeof payload.confirmation === 'string' ? payload.confirmation : '');
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof CmsOperationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : 'Delete failed.' }, { status });
  }
};
