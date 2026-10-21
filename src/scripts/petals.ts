export function createPetalWind(onIdle: () => void) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-petals';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) return null;
  document.body.append(canvas);
  let width = innerWidth, height = innerHeight, frame = 0, last = 0, ended = false;
  const colors = ['#f19abd', '#d48bab', '#fff7f7', '#ffd65c'];
  type Gust = { start: number; petals: { delay: number; duration: number; y: number; phase: number; drift: number; size: number; color: string }[] };
  let gusts: Gust[] = [];
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    context!.imageSmoothingEnabled = false;
  }
  function stop() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    canvas.remove();
    gusts = [];
    onIdle();
  }
  function draw(now: number) {
    if (document.hidden) { stop(); return; }
    gusts = gusts.filter((gust) => now - gust.start < 2700);
    if (!gusts.length) { stop(); return; }
    if (now - last >= 1000 / 30) {
      last = now;
      context!.clearRect(0, 0, width, height);
      context!.globalAlpha = 0.8;
      for (const gust of gusts) {
        for (const petal of gust.petals.slice(0, width < 768 ? 10 : 20)) {
          const age = now - gust.start - petal.delay;
          if (age < 0 || age > petal.duration) continue;
          const progress = age / petal.duration;
          const x = Math.round(-24 + (width + 48) * progress);
          const y = Math.round(petal.y * height + Math.sin(age / 120 + petal.phase) * 9 + progress * petal.drift);
          const s = petal.size, flip = Math.sin(age / 90 + petal.phase) > 0 ? 1 : 2;
          context!.fillStyle = petal.color;
          context!.fillRect(x + s, y, flip * s, s);
          context!.fillRect(x, y + s, 3 * s, s);
          context!.fillRect(x + flip * s, y + 2 * s, s, s);
        }
      }
    }
    frame = requestAnimationFrame(draw);
  }
  function gust() {
    if (ended || document.hidden) return false;
    const now = performance.now();
    gusts = gusts.filter((entry) => now - entry.start < 2700);
    if (gusts.length >= 4) return false;
    gusts.push({ start: now, petals: Array.from({ length: width < 768 ? 10 : 20 }, (_, index) => ({
      delay: index === 0 ? 0 : Math.random() * 450,
      duration: 1500 + Math.random() * 700,
      y: 0.08 + Math.random() * 0.84, phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 50, size: 2 + Math.floor(Math.random() * 2),
      color: colors[Math.random() < 0.1 ? 3 : Math.floor(Math.random() * 3)]
    })) });
    if (!frame) frame = requestAnimationFrame(draw);
    return true;
  }
  resize();
  window.addEventListener('resize', resize);
  return { gust, stop };
}
