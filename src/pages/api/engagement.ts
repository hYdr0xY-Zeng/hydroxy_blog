import type { APIRoute } from 'astro';
import { getDocumentById, recordDailyView, toggleDocumentLike } from '@/lib/cms';
import { requireSameOrigin } from '@/lib/auth';

export const prerender = false;

const visitorCookie = 'hydroxy_visitor';
const validVisitorId = /^[a-f0-9-]{36}$/i;

async function visitorHash(visitorId: string, documentId: string) {
  const bytes = new TextEncoder().encode(`${visitorId}\u0000${documentId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const origin = requireSameOrigin(request);
  if (origin) return origin;

  try {
    const payload = await request.json() as { documentId?: unknown; action?: unknown };
    const documentId = typeof payload.documentId === 'string' ? payload.documentId : '';
    const action = payload.action === 'view' || payload.action === 'toggle-like' ? payload.action : null;
    const document = documentId ? await getDocumentById(locals, documentId) : null;
    if (!action || !document || document.status !== 'published' || document.kind === 'profile') return Response.json({ error: 'Published article not found.' }, { status: 404 });

    let visitorId = cookies.get(visitorCookie)?.value;
    if (!visitorId || !validVisitorId.test(visitorId)) {
      visitorId = crypto.randomUUID();
      cookies.set(visitorCookie, visitorId, { path: '/', httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
    }
    const hash = await visitorHash(visitorId, document.id);
    const engagement = action === 'view' ? await recordDailyView(locals, document.id, hash) : await toggleDocumentLike(locals, document.id, hash);
    return Response.json(engagement);
  } catch (error) {
    console.error('Engagement operation failed', error);
    return Response.json({ error: 'Engagement operation failed.' }, { status: 400 });
  }
};
