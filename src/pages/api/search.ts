import { searchContent } from '@/lib/cms';

export const prerender = false;

export async function GET({ request, locals }: { request: Request; locals: App.Locals }) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (!query) return Response.json({ results: [] });
  if (query.length > 80) return Response.json({ error: 'Query is too long.' }, { status: 400 });
  try {
    return Response.json({ results: await searchContent(locals, query) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Search failed', error);
    return Response.json({ error: 'Search is unavailable.' }, { status: 503 });
  }
}