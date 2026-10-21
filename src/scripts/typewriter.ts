import { motionAllowed } from './motion-state';

export function typeText(target: HTMLElement, maxDuration = 1200) {
  const text = target.textContent || '';
  if (!text || !motionAllowed() || document.hidden) return { finish() {} };
  const glyphs = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment)
    : Array.from(text);
  const source = document.createElement('span');
  source.className = 'typewriter__source';
  source.append(...target.childNodes);
  const visual = document.createElement('span');
  visual.className = 'typewriter__visual';
  visual.setAttribute('aria-hidden', 'true');
  target.classList.add('typewriter');
  target.append(source, visual);
  let timer: ReturnType<typeof setTimeout> | undefined, finished = false;
  const start = performance.now(), duration = Math.min(maxDuration, glyphs.length * 35);
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    target.replaceChildren(...source.childNodes);
    target.classList.remove('typewriter');
    window.removeEventListener('hydroxy:motion-change', finish);
    window.removeEventListener('pagehide', finish);
    document.removeEventListener('visibilitychange', onVisibility);
  }
  function onVisibility() { if (document.hidden) finish(); }
  function tick() {
    const progress = Math.min(1, (performance.now() - start) / duration);
    visual.textContent = glyphs.slice(0, Math.floor(progress * glyphs.length)).join('');
    if (progress === 1) finish(); else timer = setTimeout(tick, 30);
  }
  window.addEventListener('hydroxy:motion-change', finish);
  window.addEventListener('pagehide', finish);
  document.addEventListener('visibilitychange', onVisibility);
  tick();
  return { finish };
}

export function initPageTitles() {
  if (!motionAllowed() || document.hidden) return;
  const running = new Set<ReturnType<typeof typeText>>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      running.add(typeText(entry.target as HTMLElement));
    }
  });
  document.querySelectorAll<HTMLElement>('.rpg-status h1.section-title, .page-hero > h1.section-title, .directory-hero > h1.section-title, .article-hero > h1.section-title').forEach((title) => observer.observe(title));
  function finish() {
    observer.disconnect(); running.forEach((typing) => typing.finish()); running.clear();
    window.removeEventListener('hydroxy:motion-change', finish);
    window.removeEventListener('pagehide', finish);
    document.removeEventListener('visibilitychange', onVisibility);
  }
  function onVisibility() { if (document.hidden) finish(); }
  window.addEventListener('hydroxy:motion-change', finish);
  window.addEventListener('pagehide', finish, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
}
