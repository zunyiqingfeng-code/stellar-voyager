/* 星海远航 · 星空视差背景 + 恒星绘制 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  class Starfield {
    constructor(seed) {
      const rng = new S.Rand(seed >>> 0 || 1);
      this.layers = [];
      const specs = [
        { n: 220, size: [0.6, 1.4], alpha: [0.35, 0.9], p: 0.12 },
        { n: 160, size: [0.8, 1.8], alpha: [0.4, 1], p: 0.3 },
        { n: 90, size: [1.0, 2.4], alpha: [0.5, 1], p: 0.55 }
      ];
      for (const sp of specs) {
        const arr = [];
        for (let i = 0; i < sp.n; i++) {
          arr.push({
            x: rng.next() * 4000 - 2000, y: rng.next() * 4000 - 2000,
            r: rng.range(sp.size[0], sp.size[1]),
            a: rng.range(sp.alpha[0], sp.alpha[1]),
            tw: rng.next() * M.TAU, tws: rng.range(0.5, 2.5),
            hue: rng.chance(0.12) ? 40 : (rng.chance(0.06) ? 190 : 0)
          });
        }
        this.layers.push({ arr, p: sp.p });
      }
      this.nebulae = [];
      const nb = 7;
      for (let i = 0; i < nb; i++) {
        const c = document.createElement('canvas');
        c.width = 260; c.height = 200;
        const cx = c.getContext('2d');
        const hue = rng.pick([250, 280, 200, 320, 180]);
        for (let b = 0; b < 14; b++) {
          const x = rng.next() * 260, y = rng.next() * 200, rad = rng.range(30, 80);
          const g = cx.createRadialGradient(x, y, 0, x, y, rad);
          const col = 'hsla(' + hue + ',' + rng.int(50, 90) + '%,' + rng.int(30, 55) + '%,';
          g.addColorStop(0, col + (0.10 + rng.next() * 0.08) + ')');
          g.addColorStop(1, col + '0)');
          cx.fillStyle = g;
          cx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        this.nebulae.push({ img: c, x: rng.next() * 5000 - 2500, y: rng.next() * 5000 - 2500, s: rng.range(2.2, 5.5), rot: rng.next() * M.TAU, a: rng.range(0.16, 0.4) });
      }
    }

    /** 绘制（世界坐标空间，跟随相机但按视差系数缩放位移） */
    render(ctx, cam, w, h, time) {
      for (const layer of this.layers) {
        for (const s of layer.arr) {
          const sx = ((s.x - cam.x * layer.p) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
          const sy = ((s.y - cam.y * layer.p) % (h * 1.4) + h * 1.4) % (h * 1.4) - h * 0.2;
          if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
          const tw = 0.7 + 0.3 * Math.sin(time * s.tws + s.tw);
          ctx.globalAlpha = s.a * tw;
          ctx.fillStyle = s.hue ? 'hsl(' + s.hue + ',80%,82%)' : '#cfd8ea';
          ctx.beginPath();
          ctx.arc(sx, sy, s.r, 0, M.TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      for (const n of this.nebulae) {
        const sx = n.x - cam.x * 0.22 + w / 2;
        const sy = n.y - cam.y * 0.22 + h / 2;
        ctx.globalAlpha = n.a;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(n.rot);
        ctx.drawImage(n.img, -130 * n.s, -100 * n.s, 260 * n.s, 200 * n.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** 绘制一颗恒星（世界坐标） */
  function drawStar(ctx, star, x, y, time, rngSeed) {
    const R = star.radius;
    // 光晕
    let glowR = R * (4.5 + Math.sin(time * 1.7 + (star.name.charCodeAt(0) || 0)) * 0.5);
    if (star.spec === 'BH') glowR = R * 2.6;
    const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, glowR);
    if (star.spec === 'BH') {
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.9)');
      g.addColorStop(0.8, 'rgba(255,140,40,0.16)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
    } else {
      g.addColorStop(0, star.color);
      g.addColorStop(0.4, star.glow + 'aa');
      g.addColorStop(1, star.glow + '00');
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, M.TAU); ctx.fill();

    if (star.spec === 'BH') {
      // 事件视界 + 吸积盘
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, R, 0, M.TAU); ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 0.3) * 0.15 + 0.4);
      ctx.strokeStyle = 'rgba(255,150,60,0.85)';
      ctx.lineWidth = R * 0.5;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 2.1, R * 0.75, 0, 0, M.TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,160,0.6)';
      ctx.lineWidth = R * 0.2;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.7, R * 0.6, 0, 0, M.TAU); ctx.stroke();
      ctx.restore();
      return;
    }
    if (star.spec === 'NS') {
      // 脉冲星：旋转射束
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath(); ctx.arc(x, y, R, 0, M.TAU); ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 2.2);
      const beam = ctx.createLinearGradient(0, 0, 0, -R * 7);
      beam.addColorStop(0, 'rgba(180,220,255,0.9)');
      beam.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-R * 0.4, 0); ctx.lineTo(0, -R * 7); ctx.lineTo(R * 0.4, 0);
      ctx.closePath(); ctx.fill();
      ctx.rotate(Math.PI);
      ctx.fill();
      ctx.restore();
      return;
    }
    // 日面 + 米粒组织噪点
    ctx.fillStyle = star.color;
    ctx.beginPath(); ctx.arc(x, y, R, 0, M.TAU); ctx.fill();
    const rng = new S.Rand(star.name.length * 7919 + star.radius);
    for (let i = 0; i < 22; i++) {
      const a = rng.next() * M.TAU, rr = rng.next() * R * 0.85;
      ctx.fillStyle = 'rgba(255,255,255,' + rng.range(0.03, 0.12) + ')';
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, rng.range(1.5, 4), 0, M.TAU); ctx.fill();
    }
    // 边缘亮化
    const rim = ctx.createRadialGradient(x, y, R * 0.7, x, y, R);
    rim.addColorStop(0, 'rgba(255,255,255,0)');
    rim.addColorStop(1, 'rgba(255,255,255,0.35)');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(x, y, R, 0, M.TAU); ctx.fill();
  }

  S.Starfield = Starfield;
  S.drawStar = drawStar;
})(typeof window !== 'undefined' ? window : globalThis);
