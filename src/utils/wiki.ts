export type Crumb = {
  label: string;
  href: string;
};

function titleFromSegment(segment: string) {
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
