// particles.js — Ambient Particle System
const Particles = (() => {
  let particles = [];
  let canvas, ctx;
  let w = 0, h = 0;
  let animId = null;
  let reducedMotion = false;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resize();
    if (!reducedMotion) spawnAll();
  }

  function resize() {
    w = canvas.width;
    h = canvas.height;
  }

  function spawnAll() {
    particles = [];
    const count = Math.min(Math.floor((w * h) / 25000), 50);
    for (let i = 0; i < count; i++) particles.push(createParticle());
  }

  function createParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2 - 0.1,
      opacity: Math.random() * 0.4 + 0.1,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.005 + 0.003,
      hue: Math.random() > 0.7 ? 45 : 145, // amber or green
    };
  }

  function update(dt) {
    if (reducedMotion) return;
    particles.forEach(p => {
      p.phase += p.speed;
      p.x += p.vx + Math.sin(p.phase) * 0.15;
      p.y += p.vy + Math.cos(p.phase * 0.7) * 0.1;
      p.opacity = 0.15 + Math.sin(p.phase) * 0.15;
      // Wrap around
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    });
  }

  function draw(ctx2) {
    if (reducedMotion) return;
    const c = ctx2 || ctx;
    particles.forEach(p => {
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity})`;
      c.fill();
      // Soft glow
      c.beginPath();
      c.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      c.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity * 0.15})`;
      c.fill();
    });
  }

  function onResize(newW, newH) {
    w = newW; h = newH;
    if (!reducedMotion) spawnAll();
  }

  return { init, update, draw, resize: onResize };
})();
