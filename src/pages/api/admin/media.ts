import { requireAdmin, requireSameOrigin } from '@/lib/auth';
import { saveMediaMetadata } from '@/lib/cms';
import { getEnv } from '@/lib/runtime';

export const prerender = false;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !ALLOWED.has(file.type) || file.size > 10 * 1024 * 1024) return Response.json({ error: 'Use a supported image no larger than 10 MiB.' }, { status: 400 });
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  const key = `uploads/${new Date().toISOString().slice(0, 7)}/${hash}${extension}`;
  await getEnv(locals).HYDROXY_MEDIA.put(key, data, { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
  await saveMediaMetadata(locals, { key, originalName: file.name, contentType: file.type, byteSize: file.size, sha256: hash });
  return Response.json({ key, href: `/media/${key}` });
}