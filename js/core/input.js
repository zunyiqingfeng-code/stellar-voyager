/* 星海远航 · 统一输入（键盘/鼠标/触摸 → 动作映射） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const BINDINGS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    boost: ['ShiftLeft', 'ShiftRight'], cruise: ['KeyT'], warp: ['KeyX'],
    fire: ['Space'], scan: ['KeyF'], target: ['KeyE'], tab: ['Tab'],
    map: ['KeyM'], designer: ['KeyB'], menu: ['Escape'], dock: ['KeyQ'],
    help: ['KeyH'], pause: ['Escape'], afterburn: ['ShiftLeft', 'ShiftRight'], inertia: ['KeyN'], orbits: ['KeyO'], jump: ['KeyJ']
  };

  const Input = {
    down: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, lmb: false, rmb: false, worldX: 0, worldY: 0, inside: true },
    wheel: 0,
    _canvas: null,

    init(canvas) {
      this._canvas = canvas;
      const onKeyDown = (e) => {
        if (e.repeat) return;
        if (PREVENT.has(e.code)) e.preventDefault();
        this.down.add(e.code);
        this.pressed.add(e.code);
        if (!e.repeat) root.dispatchEvent(new CustomEvent('sv:key', { detail: e.code }));
      };
      const onKeyUp = (e) => { this.down.delete(e.code); };
      const onBlur = () => { this.down.clear(); this.mouse.lmb = this.mouse.rmb = false; };
      const onMouseMove = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
      const onMouseDown = (e) => {
        this.mouse.x = e.clientX; this.mouse.y = e.clientY;
        if (e.button === 0) this.mouse.lmb = true;
        if (e.button === 2) this.mouse.rmb = true;
      };
      const onMouseUp = (e) => { if (e.button === 0) this.mouse.lmb = false; if (e.button === 2) this.mouse.rmb = false; };
      const onWheel = (e) => { e.preventDefault(); this.wheel += e.deltaY; };
      const onCtx = (e) => e.preventDefault();
      const onTouch = (e) => {
        if (e.touches.length) {
          this.mouse.x = e.touches[0].clientX; this.mouse.y = e.touches[0].clientY;
          this.mouse.lmb = true;
        } else this.mouse.lmb = false;
        e.preventDefault();
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('contextmenu', onCtx);
      canvas.addEventListener('touchstart', onTouch, { passive: false });
      canvas.addEventListener('touchmove', onTouch, { passive: false });
      canvas.addEventListener('touchend', onTouch, { passive: false });
    },

    isDown(action) { return BINDINGS[action]?.some(c => this.down.has(c)) ?? false; },
    wasPressed(action) { return BINDINGS[action]?.some(c => this.pressed.has(c)) ?? false; },
    /** 每帧末尾调用，清除边缘触发与滚轮增量 */
    endFrame() { this.pressed.clear(); this.wheel = 0; }
  };

  const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyT', 'KeyX', 'KeyF', 'KeyE', 'KeyQ', 'KeyM', 'KeyB', 'KeyN', 'KeyO', 'KeyJ']);

  S.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);