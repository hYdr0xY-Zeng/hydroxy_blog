export const SITE = {
  title: 'Hydroxy Wiki',
  description: 'A dark pixel-styled personal wiki for learning notes, experiments, essays, and life pages.',
  author: 'Hydroxy',
  social: [
    { label: 'GitHub', href: 'https://github.com/hYdr0xY-Zeng' },
    { label: 'Bilibili', href: 'https://space.bilibili.com/405005594' }
  ],
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Learn', href: '/learn/' },
    { label: 'Life', href: '/life/' },
    { label: 'Archive', href: '/archive/' },
    { label: 'Search', href: '/search/' },
    { label: 'About', href: '/about/' }
  ]
};

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return '';
  const value = date instanceof Date
    ? date
    : new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date) ? `${date.replace(' ', 'T')}Z` : date);
  if (Number.isNaN(value.getTime())) return typeof date === 'string' ? date.slice(0, 10) : '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value);
}
