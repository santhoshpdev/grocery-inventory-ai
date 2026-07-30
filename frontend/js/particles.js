function getThemePrimary() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--primary').trim() || '#059669';
}

function hexToRgba(hex, alpha) {
  if (hex.startsWith('#')) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

class ParticleNetwork {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: null, y: null, radius: 200 };
    const isMobile = window.innerWidth < 768;
    this.count = isMobile ? 40 : 90;
    this.maxDist = 200;
    this.speed = 0.25;
    this.time = 0;
    this.flowAngle = 0;

    this.resize();
    this.createParticles();
    this.bindEvents();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    const isMobile = window.innerWidth < 768;
    const targetCount = isMobile ? 40 : 90;
    if (targetCount !== this.count) {
      this.count = targetCount;
      this.particles = [];
      this.createParticles();
    }
  }

  createParticles() {
    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * this.speed,
        vy: (Math.random() - 0.5) * this.speed,
        r: Math.random() * 2.5 + 0.8,
        baseR: 0,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        opacity: Math.random() * 0.5 + 0.5,
      });
      this.particles[i].baseR = this.particles[i].r;
    }
  }

  bindEvents() {
    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.resize(), 150);
    };
    window.addEventListener('resize', onResize);

    const onMove = (e) => {
      const x = e.clientX || (e.touches && e.touches[0]?.clientX);
      const y = e.clientY || (e.touches && e.touches[0]?.clientY);
      if (x != null) { this.mouse.x = x; this.mouse.y = y; }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchstart', onMove, { passive: true });
    window.addEventListener('mouseleave', () => { this.mouse.x = null; this.mouse.y = null; });
    window.addEventListener('touchend', () => { this.mouse.x = null; this.mouse.y = null; });

    const observer = new MutationObserver(() => {
      const primary = getThemePrimary();
      this.themeColor = hexToRgba(primary, 0.8);
      this.themeColorLine = (a) => hexToRgba(primary, a);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    const primary = getThemePrimary();
    this.themeColor = hexToRgba(primary, 0.8);
    this.themeColorLine = (a) => hexToRgba(primary, a);
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.time += 0.003;
    this.flowAngle += 0.001;

    for (const p of this.particles) {
      const flowX = Math.sin(this.flowAngle + p.phase) * 0.08;
      const flowY = Math.cos(this.flowAngle * 0.7 + p.phase * 1.3) * 0.08;
      p.x += p.vx + flowX;
      p.y += p.vy + flowY;
      if (p.x < -20 || p.x > this.canvas.width + 20) p.vx *= -1;
      if (p.y < -20 || p.y > this.canvas.height + 20) p.vy *= -1;

      const pulse = Math.sin(this.time * p.pulseSpeed * 10 + p.phase) * 0.3 + 0.7;
      p.r = p.baseR * pulse;

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.mouse.radius) {
        const force = (1 - dist / this.mouse.radius) * 0.5;
        p.x -= dx * 0.012 * force;
        p.y -= dy * 0.012 * force;
        p.vx += dx * 0.00008;
        p.vy += dy * 0.00008;
      }
      p.vx *= 0.999;
      p.vy *= 0.999;
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.maxDist) {
          const alpha = (1 - dist / this.maxDist) * 0.55;
          const lineAlpha = this.mouse.x != null
            ? alpha * (1 + 0.5 * (1 - dist / this.maxDist))
            : alpha;
          this.ctx.strokeStyle = this.themeColorLine ? this.themeColorLine(Math.min(lineAlpha, 0.7)) : `rgba(5,150,105,${Math.min(lineAlpha, 0.7)})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }

    for (const p of this.particles) {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      const baseColor = this.themeColor || 'rgba(5,150,105,0.8)';
      this.ctx.fillStyle = baseColor;
      this.ctx.fill();
      if (p.r > 2) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.themeColorLine ? this.themeColorLine(0.08) : 'rgba(5,150,105,0.08)';
        this.ctx.fill();
      }
    }
    requestAnimationFrame(() => this.animate());
  }
}
