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

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
