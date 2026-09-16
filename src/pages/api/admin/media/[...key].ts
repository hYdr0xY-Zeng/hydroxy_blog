import type { APIRoute } from 'astro';
import { CmsOperationError, deleteMediaAsset, getMediaReferences } from '@/lib/cms';
import { requireAdmin, requireSameOrigin } from '@/lib/auth';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const key = (params.key ?? '').split('/').map(decodeURIComponent).join('/');
  try {
    const payload = await request.json() as { confirmation?: unknown };
    await deleteMediaAsset(locals, key, typeof payload.confirmation === 'string' ? payload.confirmation : '');
    return Response.json({ ok: true });
  } catch (error) {
    const references = error instanceof CmsOperationError && error.status === 409 ? await getMediaReferences(locals, key) : undefined;
    const status = error instanceof CmsOperationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : 'Delete failed.', references }, { status });
  }
};
