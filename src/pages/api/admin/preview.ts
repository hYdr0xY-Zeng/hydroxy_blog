import { requireAdmin, requireSameOrigin } from '@/lib/auth';
import { renderMarkdown } from '@/lib/markdown';

export const prerender = false;

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const admin = await requireAdmin(request, locals);
  if (admin instanceof Response) return admin;
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const { markdown } = await request.json() as { markdown?: string };
  return Response.json(await renderMarkdown(String(markdown ?? '')));
}