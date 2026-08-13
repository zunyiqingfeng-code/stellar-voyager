/* 星海远航 · 粒子特效池 + 光束 + 爆炸 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  class FxPool {
    constructor(max = 1400) { this.items = []; this.max = max; }
    spawn(o) {
      if (this.items.length >= this.max) this.items.shift();
      this.items.push({
        x: o.x || 0, y: o.y || 0, vx: o.vx || 0, vy: o.vy || 0,
        life: 0, ttl: o.ttl ?? 1, size: o.size ?? 2, color: o.color || '#fff',
        kind: o.kind || 'dot', drag: o.drag ?? 0.98, rot: o.rot ?? 0, vr: o.vr ?? 0
      });
    }
    burst(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + (M.randomRange(-1, 1)) * o.spread : M.randomRange(0, M.TAU);
        const sp = o.speed != null ? o.speed * M.randomRange(0.35, 1.15) : M.randomRange(20, 120);
        this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: o.ttl ?? 0.6, size: o.size ?? 2, color: o.color || '#fff', kind: o.kind || 'spark', drag: 0.985 });
      }
    }
    update(dt) {
      const items = this.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.life += dt;
        if (p.life >= p.ttl) { items.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= p.drag; p.vy *= p.drag;
        p.rot += p.vr * dt;
      }
    }
    render(ctx) {
      for (const p of this.items) {
        const t = p.life / p.ttl, a = 1 - t;
        ctx.globalAlpha = a;
        if (p.kind === 'ring') {
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, p.size * a);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4) * 2, 0, M.TAU); ctx.stroke();
        } else if (p.kind === 'flash') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          g.addColorStop(0, p.color + 'ff');
          g.addColorStop(1, p.color + '00');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
        } else if (p.kind === 'spark') {
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
        } else if (p.kind === 'debris') {
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, M.TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    clear() { this.items.length = 0; }
  }

  /** 光束 */
  function drawBeam(ctx, x1, y1, x2, y2, color, width) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = color; ctx.globalAlpha = 0.28; ctx.lineWidth = width * 3.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.85; ctx.lineWidth = width * 0.9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** 爆炸 */
  function explode(fx, x, y, scale) {
    fx.spawn({ x, y, ttl: 0.25, size: 26 * scale, color: '#ffd9a0', kind: 'flash' });
    fx.spawn({ x, y, ttl: 0.5, size: 10 * scale, color: 'rgba(255,170,80,0.9)', kind: 'ring' });
    fx.burst(x, y, 16, { speed: 130 * scale, ttl: 0.7, size: 1.6, color: '#ffb060', kind: 'spark' });
    fx.burst(x, y, 10, { speed: 60 * scale, ttl: 1.1, size: 2.2, color: '#d8d8d8', kind: 'debris' });
    fx.burst(x, y, 6, { speed: 25 * scale, ttl: 1.6, size: 4, color: '#7a7268', kind: 'dot' });
  }

  S.FxPool = FxPool;
  S.drawBeam = drawBeam;
  S.explode = explode;
})(typeof window !== 'undefined' ? window : globalThis);
