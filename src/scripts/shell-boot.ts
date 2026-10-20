import { motionAllowed } from './motion-state';

export function initShellBoot(shell: HTMLElement, input: HTMLInputElement) {
  const lines = [...shell.querySelectorAll<HTMLElement>('[data-boot-line]')];
  const originals = lines.map((line) => line.textContent || '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    lines.forEach((line, index) => { line.textContent = originals[index]; line.removeAttribute('data-typing'); });
    shell.removeAttribute('data-booting');
    window.removeEventListener('hydroxy:motion-change', onPreference);
    document.removeEventListener('visibilitychange', onVisibility);
    input.removeEventListener('focus', finish);
    input.removeEventListener('input', finish);
  }
  function onPreference() { if (!motionAllowed()) finish(); }
  function onVisibility() { if (document.hidden) finish(); }
  if (!motionAllowed() || document.hidden || document.activeElement === input) return;
  shell.dataset.booting = 'true';
  lines.forEach((line) => { line.textContent = '\u00a0'; });
  const start = performance.now();
  function tick() {
    const elapsed = performance.now() - start;
    lines.forEach((line, index) => {
      const progress = Math.max(0, Math.min(1, (elapsed - index * 320) / 300));
      line.textContent = originals[index].slice(0, Math.floor(originals[index].length * progress)) || '\u00a0';
      line.toggleAttribute('data-typing', progress > 0 && progress < 1);
    });
    if (elapsed >= 1000) finish(); else timer = setTimeout(tick, 30);
  }
  input.addEventListener('focus', finish);
  input.addEventListener('input', finish);
  window.addEventListener('hydroxy:motion-change', onPreference);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', finish, { once: true });
  tick();
}
