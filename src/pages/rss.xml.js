import rss from '@astrojs/rss';
import { listDocuments, documentHref } from '@/lib/cms';
import { SITE } from '@/utils/site';

export const prerender = false;

export async function GET({ locals, site, request }) {
  const entries = await listDocuments(locals);
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: site ?? new URL(request.url).origin,
    items: entries.map((entry) => ({ title: entry.title, description: entry.description, pubDate: new Date(entry.published_at ?? entry.updated_at), link: documentHref(entry) }))
  });
}