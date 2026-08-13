/* 星海远航 · 数学工具 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = {};

  M.TAU = Math.PI * 2;
  M.DEG = Math.PI / 180;

  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.smoothstep = (a, b, v) => {
    const t = M.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  /** 角度插值（走最短弧） */
  M.angleLerp = (a, b, t) => {
    let d = M.wrapAngle(b - a);
    return a + d * t;
  };
  /** 归一化到 [-PI, PI] */
  M.wrapAngle = (a) => {
    a = ((a + Math.PI) % M.TAU + M.TAU) % M.TAU - Math.PI;
    return a;
  };
  M.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  M.dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
  M.len = (x, y) => Math.hypot(x, y);
  M.norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  /** 向目标方向旋转（返回新的角度，每帧最多 step 弧度） */
  M.turnToward = (cur, target, step) => {
    const d = M.wrapAngle(target - cur);
    if (Math.abs(d) <= step) return target;
    return cur + Math.sign(d) * step;
  };
  M.randomRange = (a, b) => a + Math.random() * (b - a);
  M.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

  S.MathX = M;
})(typeof window !== 'undefined' ? window : globalThis);
