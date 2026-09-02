/* 星海远航 · 启动场景：屏幕空间渲染的开屏动画 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  class BootScene {
    create(engine, params) {
      this.engine = engine;
      this.params = params || {};
      this.t = 0;
      this.booted = false;
      // 开屏星点（屏幕空间）
      const rng = new S.Rand(20260825);
      this.stars = [];
      for (let i = 0; i < 130; i++) {
        this.stars.push({
          x: rng.next(), y: rng.next(),
          r: 0.4 + rng.next() * 1.4,
          a: 0.2 + rng.next() * 0.7,
          tw: rng.next() * 6.28, tws: 0.5 + rng.next() * 2
        });
      }
    }

    update(dt) {
      this.t += dt;
      if (!this.booted && this.t > 1.4) {
        this.booted = true;
        if (this.params.continue && S.Save.has()) {
          S.continueGame();
          this.engine.go('flight');            // 继续航行 → 直接恢复飞行
        } else if (this.params.mode === 'new') {
          S.newGame();
          this.engine.go('flight');            // 新的远征 → 直接起航
        } else {
          // 冷启动：加载存档（若存在）后停留在主菜单
          if (S.Save.has()) S.continueGame();
          else S.newGame();
          this.engine.go('menu');
        }
      }
    }

    render(ctx) {
      const eng = this.engine;
      const w = eng.width, h = eng.height;
      // 关键：显式屏幕空间变换（引擎世界变换带相机平移，直接画会偏到角落）
      ctx.save();
      ctx.setTransform(eng.dpr, 0, 0, eng.dpr, 0, 0);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, w, h);
      // 星点
      for (const s of this.stars) {
        ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(this.t * s.tws + s.tw));
        ctx.fillStyle = '#cfd8ea';
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 标题（淡入 + 呼吸）
      const fade = Math.min(1, this.t / 0.5);
      const pulse = 1 + Math.sin(this.t * 2.2) * 0.02;
      ctx.globalAlpha = fade;
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(w / 2, h / 2 - 30);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#8be6ff';
      ctx.font = '600 40px "Microsoft YaHei", sans-serif';
      ctx.shadowColor = 'rgba(80,180,255,0.6)';
      ctx.shadowBlur = 24;
      ctx.fillText('星 海 远 航', 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.fillStyle = '#8aa5c8';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText('STELLAR VOYAGER', w / 2, h / 2 + 4);
      // 进度条
      const bw = 220, bx = w / 2 - bw / 2, by = h / 2 + 34;
      const p = Math.min(1, this.t / 1.3);
      ctx.strokeStyle = 'rgba(90,140,220,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 7);
      const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grd.addColorStop(0, '#1c7fa8');
      grd.addColorStop(1, '#8be6ff');
      ctx.fillStyle = grd;
      ctx.fillRect(bx, by, bw * p, 6);
      ctx.fillStyle = '#8aa5c8';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText('正在生成银河 ……', w / 2, by + 30);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  S.registerScene('boot', BootScene);
})(typeof window !== 'undefined' ? window : globalThis);
