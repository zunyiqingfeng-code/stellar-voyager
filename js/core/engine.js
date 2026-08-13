/* 星海远航 · 游戏引擎：主循环 + 场景管理 + 相机 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const registry = {};
  S.registerScene = (name, def) => { registry[name] = def; };

  class Engine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.width = 0; this.height = 0; this.dpr = 1;
      this.cam = { x: 0, y: 0, zoom: 1 };
      this.current = null; this.currentName = null;
      this.time = 0; this.frame = 0; this.fps = 60;
      this.running = false;
      this._params = null;
      this._fpsAcc = 0; this._fpsN = 0;
    }

    resize() {
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = window.innerWidth; this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
    }

    _sceneError(stage, err) {
      // 场景异常隔离：记录但不中断主循环
      if (typeof console !== 'undefined') console.error('[' + this.currentName + '.' + stage + ']', err);
      if (typeof window !== 'undefined') {
        window.__loopErrs = window.__loopErrs || [];
        if (window.__loopErrs.length < 20) window.__loopErrs.push(stage + ':' + err.message + ' :: ' + String(err.stack || '').split('\n').slice(1, 4).join(' | '));
      }
    }

    go(name, params) {
      const Def = registry[name];
      if (!Def) { console.error('场景不存在: ' + name); return; }
      if (this.current && this.current.onLeave) this.current.onLeave();
      this.currentName = name;
      this._params = params || null;
      const scene = new Def();
      this.current = scene;
      scene.engine = this;
      if (scene.onEnter) scene.onEnter(this, params || {});
      if (scene.create) scene.create(this, params || {});
    }

    /** 世界坐标 → 屏幕(CSS)坐标 */
    w2s(x, y) {
      return { x: (x - this.cam.x) * this.cam.zoom + this.width / 2, y: (y - this.cam.y) * this.cam.zoom + this.height / 2 };
    }
    s2w(x, y) {
      return { x: (x - this.width / 2) / this.cam.zoom + this.cam.x, y: (y - this.height / 2) / this.cam.zoom + this.cam.y };
    }

    start(name, params) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      S.Input.init(this.canvas);
      this.go(name, params);
      if (!this.running) { this.running = true; this.last = performance.now(); this._loop(this.last); }
    }

    _loop(ts) {
      if (!this.running) return;
      let dt = (ts - this.last) / 1000;
      this.last = ts;
      dt = Math.min(Math.max(dt, 1 / 120), 1 / 20);
      this.time += dt; this.frame++;

      // 帧率统计
      this._fpsAcc += dt; this._fpsN++;
      if (this._fpsAcc >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }

      // 鼠标世界坐标
      const m = S.Input.mouse;
      const w = this.s2w(m.x, m.y);
      m.worldX = w.x; m.worldY = w.y;

      if (this.current && this.current.update) {
        try { this.current.update(dt); }
        catch (err) { this._sceneError('update', err); }
      }

      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.current && this.current.render) {
        const c = this.cam, d = this.dpr;
        ctx.setTransform(d * c.zoom, 0, 0, d * c.zoom, d * (this.width / 2 - c.x * c.zoom), d * (this.height / 2 - c.y * c.zoom));
        try { this.current.render(ctx); } catch (err) { this._sceneError('render', err); }
      }
      if (this.current && this.current.renderUI) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        try { this.current.renderUI(ctx); } catch (err) { this._sceneError('renderUI', err); }
      }

      S.Input.endFrame();
      requestAnimationFrame((t) => this._loop(t));
    }
  }

  S.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);