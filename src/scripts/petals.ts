export function startPetals(onEnd: () => void) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-petals';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) { canvas.remove(); onEnd(); return () => {}; }
  let width = innerWidth, height = innerHeight;
  const colors = ['#f19abd', '#d48bab', '#fff7f7', '#ffd65c'];
  const particles = Array.from({ length: width < 768 ? 16 : 32 }, () => ({
    x: Math.random() * width, y: (Math.random() - 0.3) * height,
    speed: 45 + Math.random() * 65, drift: 10 + Math.random() * 28,
    phase: Math.random() * Math.PI * 2, size: 2 + Math.floor(Math.random() * 2),
    color: colors[Math.floor(Math.random() * 10) === 0 ? 3 : Math.floor(Math.random() * 3)]
  }));
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    context!.imageSmoothingEnabled = false;
    if (width < 768) particles.splice(16);
  }
  resize();
  let frame = 0, start = performance.now(), last = start, ended = false;
  function stop() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    canvas.remove();
    onEnd();
  }
  function draw(now: number) {
    if (now - start >= 12000 || document.hidden) { stop(); return; }
    if (now - last >= 1000 / 30) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      context!.clearRect(0, 0, width, height);
      context!.globalAlpha = Math.min(0.8, (12000 - (now - start)) / 1800);
      for (const petal of particles) {
        petal.y += petal.speed * dt;
        petal.x += (petal.drift + Math.sin(now / 950 + petal.phase) * 18) * dt;
        if (petal.y > height + 15) petal.y = -15;
        if (petal.x > width + 15) petal.x = -15;
        const x = Math.round(petal.x), y = Math.round(petal.y), s = petal.size;
        context!.fillStyle = petal.color;
        context!.fillRect(x + s, y, 2 * s, s);
        context!.fillRect(x, y + s, 3 * s, s);
        context!.fillRect(x + s, y + 2 * s, s, s);
      }
    }
    frame = requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  frame = requestAnimationFrame(draw);
  return stop;
}
