import type { CollectionEntry } from 'astro:content';

export type LearnEntry = CollectionEntry<'learn'>;

export type Crumb = {
  label: string;
  href: string;
};

export type TreeNode = {
  key: string;
  name: string;
  label: string;
  href: string;
  order: number;
  type: 'directory' | 'article';
  entry?: LearnEntry;
  children: TreeNode[];
};

const INDEX_RE = /\/index(?:\.(?:md|mdx))?$/;
const EXT_RE = /\.(?:md|mdx)$/;
const PREFIX_RE = /^\d+[-_ ]+/;

export function isPublished<T extends { data: { draft?: boolean } }>(entry: T) {
  return import.meta.env.DEV || !entry.data.draft;
}

export function stripExt(id: string) {
  return id.replace(EXT_RE, '');
}

export function stripIndex(id: string) {
  return stripExt(id).replace(INDEX_RE, '');
}

export function segmentOrder(segment: string) {
  const match = segment.match(/^(\d+)[-_ ]+/);
  return match ? Number(match[1]) : 9999;
}

export function cleanSegment(segment: string) {
  return segment.replace(PREFIX_RE, '');
}

export function titleFromSegment(segment: string) {
  return cleanSegment(segment)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function learnPathFromId(id: string) {
  const clean = stripIndex(id);
  return clean
    .split('/')
    .filter(Boolean)
    .map(cleanSegment);
}

export function learnSlugFromId(id: string) {
  return learnPathFromId(id).join('/');
}

export function learnHrefFromId(id: string) {
  const slug = learnSlugFromId(id);
  return slug ? `/learn/${slug}/` : '/learn/';
}

export function buildCrumbs(slug = ''): Crumb[] {
  const parts = slug.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Learn', href: '/learn/' }];

  parts.forEach((part, index) => {
    crumbs.push({
      label: titleFromSegment(part),
      href: `/learn/${parts.slice(0, index + 1).join('/')}/`
    });
  });

  return crumbs;
}

function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  nodes.forEach((node) => sortTree(node.children));
  return nodes;
}

export function buildLearnTree(entries: LearnEntry[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const nodes = new Map<string, TreeNode>();

  for (const entry of entries) {
    const rawPath = stripIndex(entry.id);
    const rawParts = rawPath.split('/').filter(Boolean);
    const cleanParts = rawParts.map(cleanSegment);
    let currentChildren = roots;

    cleanParts.forEach((part, index) => {
      const key = cleanParts.slice(0, index + 1).join('/');
      const isLeaf = index === cleanParts.length - 1;
      let node = nodes.get(key);

      if (!node) {
        node = {
          key,
          name: part,
          label: isLeaf ? entry.data.title || titleFromSegment(rawParts[index] ?? part) : titleFromSegment(rawParts[index] ?? part),
          href: `/learn/${key}/`,
          order: segmentOrder(rawParts[index] ?? part),
          type: isLeaf ? 'article' : 'directory',
          entry: isLeaf ? entry : undefined,
          children: []
        };
        nodes.set(key, node);
        currentChildren.push(node);
      } else if (!currentChildren.includes(node)) {
        currentChildren.push(node);
      }

      if (isLeaf) {
        node.entry = entry;
        node.label = entry.data.title || node.label;
        return;
      }

      node.type = 'directory';
      currentChildren = node.children;
    });
  }

  return sortTree(roots);
}

export function findChildrenForSlug(tree: TreeNode[], slug = '') {
  if (!slug) return tree;
  const parts = slug.split('/').filter(Boolean);
  let children = tree;

  for (const part of parts) {
    const node = children.find((child) => child.name === part);
    if (!node) return [];
    children = node.children;
  }

  return children;
}

export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

export function findNodeBySlug(tree: TreeNode[], slug = ''): TreeNode | undefined {
  for (const node of tree) {
    if (node.key === slug) return node;
    const child = findNodeBySlug(node.children, slug);
    if (child) return child;
  }
  return undefined;
}

export function sortEntriesByDate<T extends { data: { date: Date } }>(entries: T[]) {
  return [...entries].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
