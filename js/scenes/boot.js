/* 星海远航 · 启动场景：初始化全局状态 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  class BootScene {
    create(engine, params) {
      this.engine = engine;
      this.params = params || {};
      this.t = 0;
      this.booted = false;
    }

    update(dt) {
      this.t += dt;
      if (!this.booted && this.t > 0.9) {
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
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, this.engine.width, this.engine.height);
      ctx.fillStyle = '#8be6ff';
      ctx.font = '600 34px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('星 海 远 航', this.engine.width / 2, this.engine.height / 2);
      ctx.fillStyle = '#8aa5c8';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText('正在生成银河……', this.engine.width / 2, this.engine.height / 2 + 34);
    }
  }

  S.registerScene('boot', BootScene);
})(typeof window !== 'undefined' ? window : globalThis);