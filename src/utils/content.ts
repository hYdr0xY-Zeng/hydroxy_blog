import type { CollectionEntry } from 'astro:content';
import { learnHrefFromId } from './wiki';

export type AnyEntry = CollectionEntry<'learn'> | CollectionEntry<'essays'>;

export function entryHref(entry: AnyEntry) {
  if (entry.collection === 'learn') return learnHrefFromId(entry.id);
  return `/life/essays/${entry.id.replace(/\.(md|mdx)$/, '')}/`;
}

export function allTags(entries: AnyEntry[]) {
  return [...new Set(entries.flatMap((entry) => entry.data.tags ?? []))].sort((a, b) => a.localeCompare(b));
}
