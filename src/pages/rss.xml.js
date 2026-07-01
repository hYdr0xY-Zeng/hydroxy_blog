import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '@/utils/site';
import { entryHref } from '@/utils/content';
import { isPublished, sortEntriesByDate } from '@/utils/wiki';

export async function GET(context) {
  const entries = sortEntriesByDate([
    ...(await getCollection('learn')).filter(isPublished),
    ...(await getCollection('essays')).filter(isPublished)
  ]);

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items: entries.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.date,
      link: entryHref(entry)
    }))
  });
}
