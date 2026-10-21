import { motionAllowed } from './motion-state';
import { typeText } from './typewriter';

type Slide = { title: string; alt: string; src: string };
export function initHomeGallery(root: HTMLElement) {
  const slides = JSON.parse(root.dataset.images || '[]') as Slide[];
  let img = root.querySelector<HTMLImageElement>('[data-gallery-image]')!;
  let buffer = root.querySelector<HTMLImageElement>('[data-gallery-buffer]')!;
  const link = root.querySelector<HTMLAnchorElement>('[data-gallery-link]')!;
  const title = root.querySelector<HTMLElement>('[data-gallery-title]')!;
  const count = root.querySelector<HTMLElement>('[data-gallery-count]')!;
  const description = root.querySelector<HTMLElement>('[data-gallery-description]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-gallery-play]');
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  let current = 0, playing = !saveData && motionAllowed(), visible = false, hovered = false;
  let timer: ReturnType<typeof setTimeout> | undefined, request = 0;
  let pointerPlaying: boolean | undefined;
  let busy = false, disposed = false, initialCaption = false;
  let transition: Animation[] = [];
  let typing: ReturnType<typeof typeText> | undefined;
  const failed = new Set<number>();
  const loads = new Map<number, Promise<boolean>>();
  function load(index: number): Promise<boolean> {
    if (failed.has(index)) return Promise.resolve(false);
    if (loads.has(index)) return loads.get(index)!;
    const promise = new Promise<boolean>((resolve) => {
      const candidate = new Image();
      candidate.onload = async () => {
        try { await candidate.decode(); resolve(true); }
        catch { failed.add(index); resolve(false); }
      };
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
  function clearTimer() { clearTimeout(timer); timer = undefined; }
  function finishPresentation() {
    transition.forEach((animation) => animation.cancel());
    transition = [];
    typing?.finish();
  }
  function showDescription(slide: Slide) {
    typing?.finish();
    description.textContent = slide.alt || slide.title;
    description.title = slide.alt || slide.title;
    typing = typeText(description, 1500);
  }
  function sync() {
    const remaining = slides.length - failed.size;
    if (play) {
      play.textContent = playing ? '\u2161' : '\u25b6';
      play.title = play.ariaLabel = playing ? 'Pause slideshow' : 'Play slideshow';
      play.disabled = !motionAllowed() || Boolean(saveData);
    }
    const controls = root.querySelector<HTMLElement>('[data-gallery-controls]');
    if (controls) controls.hidden = remaining <= 1;
    if (!remaining) { clearTimer(); finishPresentation(); root.querySelector('figure')!.hidden = true; return; }
    const ready = img.complete && img.naturalWidth > 0;
    if (!initialCaption && visible && ready) { initialCaption = true; showDescription(slides[current]); }
    if (!disposed && !busy && ready && playing && visible && !hovered && !document.hidden && motionAllowed() && remaining > 1) {
      timer ??= setTimeout(() => { timer = undefined; void move(1, true); }, 4000);
    } else {
      clearTimer();
    }
  }
  async function preloadNext() {
    if (saveData || !visible || document.hidden || document.readyState !== 'complete' || !img.complete || !img.naturalWidth || slides.length < 2) return;
    const next = availableAfter(current, 1);
    if (next >= 0 && next !== current) { await load(next); sync(); }
  }
  async function move(direction: number, automatic = false) {
    const ticket = ++request;
    clearTimer();
    finishPresentation();
    busy = true;
    let candidate = current;
    for (let attempts = 0; attempts < slides.length; attempts++) {
      candidate = availableAfter(candidate, direction);
      if (candidate < 0) break;
      if (await load(candidate)) {
        if (ticket !== request) return;
        if (automatic && (!playing || !visible || hovered || document.hidden || !motionAllowed())) { busy = false; sync(); return; }
        current = candidate;
        const slide = slides[current];
        [img, buffer] = [buffer, img];
        buffer.removeAttribute('data-gallery-image'); buffer.setAttribute('data-gallery-buffer', '');
        buffer.setAttribute('aria-hidden', 'true'); buffer.classList.remove('is-current');
        img.removeAttribute('data-gallery-buffer'); img.setAttribute('data-gallery-image', '');
        img.removeAttribute('aria-hidden'); img.classList.add('is-current');
        img.src = slide.src; img.alt = slide.alt || slide.title;
        link.href = slide.src; link.ariaLabel = slide.title;
        title.textContent = slide.title; count.textContent = `${current + 1} / ${slides.length}`;
        initialCaption = true;
        showDescription(slide);
        if (motionAllowed() && !document.hidden) {
          transition = [
            img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-in-out' }),
            buffer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-in-out' })
          ];
          await Promise.all(transition.map((animation) => animation.finished.catch(() => {})));
        }
        if (ticket !== request) return;
        transition = [];
        busy = false;
        sync(); void preloadNext(); return;
      }
    }
    if (ticket === request) { busy = false; sync(); }
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
    finishPresentation();
    if (!motionAllowed()) playing = false;
    sync();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finishPresentation(); sync(); if (!document.hidden) void preloadNext(); });
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); if (visible) void preloadNext(); });
  observer.observe(root);
  const firstImage = img;
  function firstLoaded() { if (firstImage.getAttribute('src') !== slides[0].src) return; loads.set(0, Promise.resolve(true)); sync(); void preloadNext(); }
  function firstFailed() { if (firstImage.getAttribute('src') !== slides[0].src) return; failed.add(0); void move(1); }
  firstImage.addEventListener('load', firstLoaded, { once: true });
  firstImage.addEventListener('error', firstFailed, { once: true });
  if (img.complete && !img.naturalWidth) firstFailed();
  else if (img.complete) loads.set(0, Promise.resolve(true));
  window.addEventListener('load', () => void preloadNext(), { once: true });
  window.addEventListener('pagehide', () => { disposed = true; clearTimer(); finishPresentation(); request++; observer.disconnect(); });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    disposed = false; busy = false;
    observer.observe(root);
    sync(); void preloadNext();
  });
  sync();
}
