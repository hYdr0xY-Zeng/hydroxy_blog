const preference = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = true;
try { enabled = localStorage.getItem('hydroxy:motion') !== 'off'; } catch { /* Storage is optional. */ }

export function motionAllowed() { return enabled && !preference.matches; }
export function setMotionEnabled(value: boolean) {
  enabled = value;
  try { localStorage.setItem('hydroxy:motion', value ? 'on' : 'off'); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event('hydroxy:motion-change'));
}
preference.addEventListener('change', () => window.dispatchEvent(new Event('hydroxy:motion-change')));
window.addEventListener('storage', (event) => {
  if (event.key === 'hydroxy:motion' || event.key === null) {
    enabled = event.newValue !== 'off';
    window.dispatchEvent(new Event('hydroxy:motion-change'));
  }
});
