import { motionAllowed } from './motion-state';

type Slide = { title: string; alt: string; src: string };
export function initHomeGallery(root: HTMLElement) {
  const slides = JSON.parse(root.dataset.images || '[]') as Slide[];
  const img = root.querySelector<HTMLImageElement>('[data-gallery-image]')!;
  const link = root.querySelector<HTMLAnchorElement>('[data-gallery-link]')!;
  const title = root.querySelector<HTMLElement>('[data-gallery-title]')!;
  const count = root.querySelector<HTMLElement>('[data-gallery-count]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-gallery-play]');
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  let current = 0, playing = !saveData && motionAllowed(), visible = false, hovered = false;
  let timer: ReturnType<typeof setTimeout> | undefined, request = 0;
  let pointerPlaying: boolean | undefined;
  const failed = new Set<number>();
  const loads = new Map<number, Promise<boolean>>();
  function load(index: number): Promise<boolean> {
    if (failed.has(index)) return Promise.resolve(false);
    if (loads.has(index)) return loads.get(index)!;
    const promise = new Promise<boolean>((resolve) => {
      const candidate = new Image();
      candidate.onload = () => resolve(true);
      candidate.onerror = () => { failed.add(index); resolve(false); };
      candidate.src = slides[index].src;
    });
    loads.set(index, promise);
    return promise;
  }
  function availableAfter(from: number, direction: number) {
    for (let step = 1; step <= slides.length; step++) {
      const candidate = (from + direction * step + slides.length) % slides.length;
      if (!failed.has(candidate)) return candidate;
    }
    return -1;
  }
  function sync() {
    clearTimeout(timer);
    const remaining = slides.length - failed.size;
    if (play) {
      play.textContent = playing ? '\u2161' : '\u25b6';
      play.title = play.ariaLabel = playing ? 'Pause slideshow' : 'Play slideshow';
      play.disabled = !motionAllowed() || Boolean(saveData);
    }
    const controls = root.querySelector<HTMLElement>('[data-gallery-controls]');
    if (controls) controls.hidden = remaining <= 1;
    if (!remaining) { root.querySelector('figure')!.hidden = true; return; }
    if (playing && visible && !hovered && !document.hidden && motionAllowed() && remaining > 1) {
      timer = setTimeout(() => void move(1, true), 8000);
    }
  }
  async function preloadNext() {
    if (saveData || !visible || document.hidden || document.readyState !== 'complete' || !img.complete || !img.naturalWidth || slides.length < 2) return;
    const next = availableAfter(current, 1);
    if (next >= 0 && next !== current) { await load(next); sync(); }
  }
  async function move(direction: number, automatic = false) {
    const ticket = ++request;
    clearTimeout(timer);
    let candidate = current;
    for (let attempts = 0; attempts < slides.length; attempts++) {
      candidate = availableAfter(candidate, direction);
      if (candidate < 0) break;
      if (await load(candidate)) {
        if (ticket !== request) return;
        if (automatic && (!playing || !visible || hovered || document.hidden || !motionAllowed())) { sync(); return; }
        current = candidate;
        const slide = slides[current];
        img.src = slide.src; img.alt = slide.alt;
        link.href = slide.src; link.ariaLabel = slide.title;
        title.textContent = slide.title; count.textContent = `${current + 1} / ${slides.length}`;
        if (motionAllowed()) img.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 200, easing: 'steps(4, end)' });
        sync(); void preloadNext(); return;
      }
    }
    if (ticket === request) sync();
  }
  root.querySelector('[data-gallery-prev]')?.addEventListener('click', () => { playing = false; void move(-1); });
  root.querySelector('[data-gallery-next]')?.addEventListener('click', () => { playing = false; void move(1); });
  root.addEventListener('focusin', () => { playing = false; sync(); });
  play?.addEventListener('pointerdown', () => { pointerPlaying = playing; });
  play?.addEventListener('pointercancel', () => { pointerPlaying = undefined; });
  play?.addEventListener('click', () => { playing = !(pointerPlaying ?? playing) && motionAllowed() && !saveData; pointerPlaying = undefined; sync(); });
  root.addEventListener('mouseenter', () => { hovered = true; sync(); });
  root.addEventListener('mouseleave', () => { hovered = false; sync(); });
  window.addEventListener('hydroxy:motion-change', () => {
    if (!motionAllowed()) { playing = false; img.getAnimations().forEach((animation) => animation.cancel()); }
    sync();
  });
  document.addEventListener('visibilitychange', () => { sync(); if (!document.hidden) void preloadNext(); });
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); if (visible) void preloadNext(); });
  observer.observe(root);
  function firstFailed() { failed.add(0); void move(1); }
  img.addEventListener('load', () => { loads.set(0, Promise.resolve(true)); void preloadNext(); }, { once: true });
  img.addEventListener('error', firstFailed, { once: true });
  if (img.complete && !img.naturalWidth) firstFailed();
  else if (img.complete) loads.set(0, Promise.resolve(true));
  window.addEventListener('load', () => void preloadNext(), { once: true });
  window.addEventListener('pagehide', () => { clearTimeout(timer); request++; observer.disconnect(); });
  sync();
}
