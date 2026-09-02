import { documentHref, listDocuments } from '@/lib/cms';

export const prerender = false;
const xmlEntities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => xmlEntities[character] ?? character);

export async function GET({ locals, request }: { locals: App.Locals; request: Request }) {
  const origin = new URL(request.url).origin;
  const documents = await listDocuments(locals);
  const staticPaths = ['/', '/learn/', '/life/', '/life/essays/', '/life/anime/', '/life/gallery/', '/archive/', '/about/', '/search/'];
  const urls = [...staticPaths.map((path) => ({ path, updated: null })), ...documents.map((entry) => ({ path: documentHref(entry), updated: entry.updated_at }))];
  const body = urls.map((item) => '<url><loc>' + escapeXml(new URL(item.path, origin).href) + '</loc>' + (item.updated ? '<lastmod>' + escapeXml(item.updated) + '</lastmod>' : '') + '</url>').join('');
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + '</urlset>', { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}
