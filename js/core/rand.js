/* 星海远航 · 确定性随机 + 值噪声（无依赖） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  // ---- mulberry32 伪随机（种子化） ----
  class Rand {
    constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
      let t = (this.s += 0x6D2B79F5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }   // 含端点
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    gauss() { // 近似正态 (Box-Muller)
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.28318530718 * v);
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    /** 从种子派生新的独立随机流 */
    fork(tag) { return new Rand((this.s ^ Math.imul(tag >>> 0, 2654435761)) >>> 0); }
  }

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---- 值噪声 + 分形布朗运动 ----
  function hash2(x, y, seed) {
    let h = seed >>> 0;
    h = Math.imul(h ^ (x * 374761393), 668265263);
    h = Math.imul(h ^ (y * 1440662683), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm2(x, y, seed, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2; gain = gain || 0.5;
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise2(x * freq, y * freq, seed + i * 101);
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm; // 0..1
  }

  S.Rand = Rand;
  S.hashStr = hashStr;
  S.noise2 = noise2;
  S.fbm2 = fbm2;
})(typeof window !== 'undefined' ? window : globalThis);
