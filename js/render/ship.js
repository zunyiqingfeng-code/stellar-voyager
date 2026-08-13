/* 星海远航 · 飞船矢量绘制（缓存离屏画布） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  const RADIUS = { corvette: 15, destroyer: 22, cruiser: 30, battleship: 42, science: 14, mining: 18 };
  const cache = {};

  function sprite(cls, accent) {
    const key = cls + '|' + accent;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const x = c.getContext('2d');
    x.translate(80, 80);
    x.scale(0.85, 0.85);
    x.lineJoin = 'round';

    const hull = (path, fill, stroke) => {
      x.beginPath();
      path(x);
      x.closePath();
      x.fillStyle = fill; x.fill();
      x.strokeStyle = stroke; x.lineWidth = 2; x.stroke();
    };
    const accentGlow = (path) => {
      x.beginPath();
      path(x);
      x.strokeStyle = accent; x.lineWidth = 2.4;
      x.shadowColor = accent; x.shadowBlur = 8;
      x.stroke();
      x.shadowBlur = 0;
    };

    switch (cls) {
      case 'corvette':
        hull((x2) => { x2.moveTo(52, 0); x2.lineTo(-38, 26); x2.lineTo(-24, 0); x2.lineTo(-38, -26); }, '#3d4656', '#5d6a80');
        accentGlow((x2) => { x2.moveTo(48, 0); x2.lineTo(-30, 22); x2.moveTo(48, 0); x2.lineTo(-30, -22); });
        hull((x2) => { x2.moveTo(6, 0); x2.lineTo(-20, 8); x2.lineTo(-20, -8); }, '#2a3040', '#3a4458');
        x.fillStyle = accent; x.beginPath(); x.arc(24, 0, 3.4, 0, M.TAU); x.fill();
        break;
      case 'destroyer':
        hull((x2) => { x2.moveTo(58, 0); x2.lineTo(10, 18); x2.lineTo(-30, 12); x2.lineTo(-46, 0); x2.lineTo(-30, -12); x2.lineTo(10, -18); }, '#414c60', '#63718a');
        hull((x2) => { x2.moveTo(14, 0); x2.lineTo(-6, 22); x2.lineTo(-18, 22); x2.lineTo(-26, 0); x2.lineTo(-18, -22); x2.lineTo(-6, -22); }, '#333c4e', '#4a566c');
        accentGlow((x2) => { x2.moveTo(52, 0); x2.lineTo(6, 14); x2.moveTo(52, 0); x2.lineTo(6, -14); });
        x.fillStyle = accent; x.beginPath(); x.arc(30, 0, 3.6, 0, M.TAU); x.fill();
        break;
      case 'cruiser':
        hull((x2) => { x2.moveTo(64, 0); x2.lineTo(24, 22); x2.lineTo(-28, 26); x2.lineTo(-44, 0); x2.lineTo(-28, -26); x2.lineTo(24, -22); }, '#49556c', '#6b7a94');
        hull((x2) => { x2.moveTo(30, 0); x2.lineTo(14, 12); x2.lineTo(-16, 12); x2.lineTo(-24, 0); x2.lineTo(-16, -12); x2.lineTo(14, -12); }, '#363f52', '#525e76');
        x.fillStyle = accent; x.fillRect(-4, -34, 8, 7); x.fillRect(-4, 27, 8, 7);
        accentGlow((x2) => { x2.moveTo(58, 0); x2.lineTo(18, 18); x2.moveTo(58, 0); x2.lineTo(18, -18); });
        x.fillStyle = accent; x.beginPath(); x.arc(36, 0, 4, 0, M.TAU); x.fill();
        break;
      case 'battleship':
        hull((x2) => { x2.moveTo(70, 0); x2.lineTo(38, 26); x2.lineTo(-26, 32); x2.lineTo(-48, 12); x2.lineTo(-48, -12); x2.lineTo(-26, -32); x2.lineTo(38, -26); }, '#4b5870', '#74839e');
        hull((x2) => { x2.moveTo(42, 0); x2.lineTo(24, 16); x2.lineTo(-8, 16); x2.lineTo(-20, 0); x2.lineTo(-8, -16); x2.lineTo(24, -16); }, '#3a4358', '#56627a');
        // 炮塔
        x.fillStyle = '#5a6a85';
        [[44, -12], [30, -14], [44, 12], [30, 14], [10, -16], [10, 16]].forEach(([tx, ty]) => { x.beginPath(); x.arc(tx, ty, 6.5, 0, M.TAU); x.fill(); x.strokeStyle = accent; x.lineWidth = 1.4; x.stroke(); });
        accentGlow((x2) => { x2.moveTo(64, 0); x2.lineTo(34, 20); x2.moveTo(64, 0); x2.lineTo(34, -20); });
        x.fillStyle = accent; x.beginPath(); x.arc(48, 0, 4, 0, M.TAU); x.fill();
        break;
      case 'science':
        hull((x2) => { x2.arc(0, 0, 34, 0, M.TAU); }, '#414a5e', '#62708a');
        hull((x2) => { x2.arc(30, -34, 16, 0, M.TAU); }, '#353d50', '#4a566e');
        x.strokeStyle = accent; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 26, 0, M.TAU); x.stroke();
        x.fillStyle = accent; x.beginPath(); x.arc(0, 0, 5, 0, M.TAU); x.fill();
        x.fillStyle = '#7fb8ff'; x.beginPath(); x.arc(30, -34, 5, 0, M.TAU); x.fill();
        break;
      case 'mining':
        hull((x2) => { x2.moveTo(46, 0); x2.lineTo(10, 20); x2.lineTo(-34, 22); x2.lineTo(-44, 0); x2.lineTo(-34, -22); x2.lineTo(10, -20); }, '#4a4a38', '#7a7a5a');
        hull((x2) => { x2.moveTo(30, 0); x2.lineTo(34, -18); x2.lineTo(12, -18); }, '#5a5238', '#8a8058');
        x.fillStyle = accent; x.fillRect(-44, -10, 6, 20);
        x.strokeStyle = '#c8b060'; x.lineWidth = 2.4;
        x.beginPath(); x.moveTo(24, 0); x.lineTo(14, -26); x.stroke();
        x.fillStyle = accent; x.beginPath(); x.arc(14, -26, 3, 0, M.TAU); x.fill();
        break;
    }

    // 引擎喷口
    x.fillStyle = '#1a2030';
    [[-44, 0]].forEach(([tx, ty]) => { x.beginPath(); x.arc(tx, ty, 5, 0, M.TAU); x.fill(); });
    cache[key] = c;
    return c;
  }

  const ShipArt = {
    radiusFor(cls) { return RADIUS[cls] || 16; },
    sprite,
    /** 绘制飞船（世界坐标，朝 angle 方向） */
    draw(ctx, x, y, angle, cls, accent, thruster, time, id) {
      const img = sprite(cls, accent);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // 引擎尾焰
      if (thruster > 0.02) {
        const fl = 18 + thruster * 34 + Math.sin(time * 42 + (id || 0)) * 5;
        const g = ctx.createLinearGradient(-40, 0, -40 - fl, 0);
        g.addColorStop(0, 'rgba(120,200,255,' + (0.5 + thruster * 0.5) + ')');
        g.addColorStop(0.55, 'rgba(80,140,255,' + thruster * 0.5 + ')');
        g.addColorStop(1, 'rgba(60,80,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-40, -4.5 - thruster * 2);
        ctx.lineTo(-40 - fl, 0);
        ctx.lineTo(-40, 4.5 + thruster * 2);
        ctx.closePath(); ctx.fill();
      }
      ctx.drawImage(img, -80, -80);
      ctx.restore();
      // 航行灯
      const blink = Math.sin(time * 3 + (id || 0)) > 0;
      ctx.fillStyle = blink ? '#ff4d4d' : '#ff9a9a';
      ctx.beginPath(); ctx.arc(x - Math.sin(angle) * 14, y + Math.cos(angle) * 14, 1.6, 0, M.TAU); ctx.fill();
    }
  };

  S.ShipArt = ShipArt;
})(typeof window !== 'undefined' ? window : globalThis);
