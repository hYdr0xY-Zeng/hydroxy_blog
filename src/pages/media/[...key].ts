import { getEnv } from '@/lib/runtime';

export const prerender = false;

export async function GET({ params, locals }: { params: { key?: string }; locals: App.Locals }) {
  const key = (params.key ?? '').split('/').map(decodeURIComponent).join('/');
  if (!key || key.split('/').some((part) => part === '.' || part === '..')) return new Response('Not found', { status: 404 });
  const object = await getEnv(locals).HYDROXY_MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers as unknown as import('@cloudflare/workers-types').Headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body as unknown as BodyInit, { headers });
}