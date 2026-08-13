/* 星海远航 · 行星程序化贴图（值噪声绘制，无光照烘焙，光照在渲染时动态叠加） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  // 每种行星类型的配色
  const PAL = {
    gaia: { land: ['#2e7d3a', '#3f9b4f', '#6db86f'], sea: ['#1e4f8f', '#2f74c4', '#4fa0e8'], ice: '#eef6ff', cloud: 'rgba(255,255,255,0.85)' },
    continental: { land: ['#6a7d3a', '#7d934a', '#a3b26a'], sea: ['#1e4f8f', '#2f74c4', '#4fa0e8'], ice: '#f2f8ff', cloud: 'rgba(255,255,255,0.8)' },
    ocean: { land: ['#3a6a4a', '#4a7d5a'], sea: ['#123c74', '#1e5fa8', '#3388d8'], ice: '#f0f8ff', cloud: 'rgba(255,255,255,0.75)' },
    tundra: { land: ['#7d8a6a', '#93a07d', '#b8c0a0'], sea: ['#2a4a6a', '#3a6488'], ice: '#ffffff', cloud: 'rgba(255,255,255,0.7)' },
    ice: { land: ['#c8dcef', '#dceaf7', '#b0c8e0'], sea: ['#7fa8cc', '#9cc0e0'], ice: '#ffffff', cloud: 'rgba(255,255,255,0.6)' },
    desert: { land: ['#b98a4a', '#d2a45e', '#e8c37e'], sea: ['#a06a2a'], ice: '#f8f0e0', cloud: 'rgba(255,240,220,0.5)' },
    arid: { land: ['#a8783c', '#c09050', '#d8b06a'], sea: ['#8a6028'], ice: '#f0e8d8', cloud: 'rgba(255,244,224,0.5)' },
    barren: { land: ['#8a8478', '#9a948a', '#6e685e'], sea: ['#7a746a'], ice: '#cfc8bc', cloud: 'rgba(255,255,255,0.3)' },
    lava: { land: ['#3a2018', '#2a1610', '#1c0f0a'], sea: ['#ff5a1e', '#ff8a2a', '#ffc04a'], ice: 'rgba(0,0,0,0)', cloud: 'rgba(0,0,0,0)' },
    toxic: { land: ['#5a7a2a', '#6a8a3a', '#7a9a4a'], sea: ['#8aa050', '#a0b060'], ice: '#d0d8a0', cloud: 'rgba(220,255,140,0.6)' },
    tomb: { land: ['#4a4a50', '#58585e', '#3c3c42'], sea: ['#2a2a30'], ice: '#8a8a90', cloud: 'rgba(160,160,170,0.4)' },
    machine: { land: ['#3a3f46', '#4a5058', '#545c66'], sea: ['#2a2f36'], ice: '#7a828c', cloud: 'rgba(140,160,180,0.4)' },
    hive: { land: ['#4a2a5a', '#5a3a6a', '#3a2048'], sea: ['#7a3a8a', '#9050a0'], ice: '#c8a0d0', cloud: 'rgba(200,160,220,0.4)' },
    shattered: { land: ['#5a5048', '#6a6058', '#4a423c'], sea: ['#3a322c'], ice: '#9a9088', cloud: 'rgba(180,170,160,0.3)' },
    gas_giant: { bands: ['#c8a06a', '#e8d4a0', '#a8824c', '#d8b878', '#8a6a3a', '#f0e2b8'], spot: '#c06040' },
    ice_giant: { bands: ['#6a9ac8', '#8ab8e0', '#5a88b8', '#a0ccec', '#4a76a8', '#b8d8f4'], spot: '#3a5a88' }
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function paintRocky(p) {
    const w = 128, h = 128;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const pal = PAL[p.type] || PAL.barren;
    const seed = (p.seed * 2654435761) >>> 0;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w * 2 - 1, v = y / h * 2 - 1;  // -1..1
        const r2 = u * u + v * v;
        let r, g, b, a = 255;
        if (r2 > 1) { d[(y * w + x) * 4 + 3] = 0; continue; }
        const n1 = S.fbm2(u * 3.2 + 7.3, v * 3.2 + 1.7, seed, 4);
        const n2 = S.fbm2(u * 6.0 + 13.1, v * 6.0 + 5.9, seed + 77, 4);
        let col;
        if (p.type === 'lava') {
          const ridge = 1 - Math.abs(2 * S.fbm2(u * 4.5 + 3.1, v * 4.5 + 9.7, seed + 31, 4) - 1);
          const glow = Math.max(0, ridge - 0.62) * 4;
          const dark = pal.land[0];
          const darkN = n1 * 0.3;
          const dr = parseInt(dark.slice(1, 3), 16) + darkN * 40, dg = parseInt(dark.slice(3, 5), 16) + darkN * 20, db = parseInt(dark.slice(5, 7), 16) + darkN * 10;
          r = Math.min(255, dr + 230 * glow); g = Math.min(255, dg + 120 * glow); b = Math.min(255, db + 10 * glow);
        } else if (p.type === 'continental' || p.type === 'ocean' || p.type === 'gaia' || p.type === 'tundra' || p.type === 'ice') {
          const seaLevel = p.type === 'ocean' ? 0.78 : p.type === 'ice' ? 0.85 : p.type === 'gaia' ? 0.55 : 0.62;
          const landNoise = n1 + (n2 - 0.5) * 0.35;
          let colArr;
          if (landNoise > seaLevel) {
            const t = Math.min(1, (landNoise - seaLevel) * 3);
            colArr = lerpColor(pal.land[0], pal.land[1], t);
            if (n2 > 0.72) colArr = lerpColor(colArr, pal.land[2] || pal.land[1], (n2 - 0.72) * 3);
          } else {
            const t = Math.min(1, (seaLevel - landNoise) * 2.5);
            colArr = lerpColor(pal.sea[0], pal.sea[1], t);
            if (p.type === 'ice' && landNoise > seaLevel - 0.15) colArr = lerpColor(pal.ice, pal.sea[1], 0.6);
          }
          // 冰盖
          const lat = Math.abs(v);
          const iceT = p.type === 'ice' || p.type === 'tundra' ? 0.55 : 0.78;
          if (lat > iceT - (n2 - 0.5) * 0.2) {
            const t = Math.min(1, (lat - (iceT - 0.1)) * 4);
            colArr = lerpColor(colArr, pal.ice, t * 0.9);
          }
          r = colArr[0]; g = colArr[1]; b = colArr[2];
        } else {
          // 荒芜/沙漠/干旱/剧毒/墓地/机械/蜂巢/破碎
          const t = S.fbm2(u * 4 + 21.7, v * 4 + 3.3, seed + 53, 4);
          let colArr = lerpColor(pal.land[0], pal.land[1], t);
          if (n2 > 0.66) colArr = lerpColor(colArr, pal.land[2] || pal.land[1], Math.min(1, (n2 - 0.66) * 2.5));
          const lat = Math.abs(v);
          if (lat > 0.8 && p.type !== 'lava' && p.type !== 'toxic') {
            colArr = lerpColor(colArr, pal.ice || pal.land[2] || pal.land[1], (lat - 0.8) * 3);
          }
          r = colArr[0]; g = colArr[1]; b = colArr[2];
        }
        // 环形山
        if (p.type === 'barren' || p.type === 'tomb' || p.type === 'shattered') {
          const cn = S.fbm2(u * 9 + 41.3, v * 9 + 17.9, seed + 91, 3);
          if (cn > 0.72) { const t = (cn - 0.72) * 4; r *= 1 - 0.4 * t; g *= 1 - 0.4 * t; b *= 1 - 0.4 * t; }
        }
        const i = (y * w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);

    // 云层（大陆/海洋/盖亚/苔原）
    if (pal.cloud && p.type !== 'ice') {
      const c2 = makeCanvas(w, h);
      const c2x = c2.getContext('2d');
      c2x.globalAlpha = 0.35;
      for (let i = 0; i < 90; i++) {
        const x = S.fbm2(i * 3.7 + seed, i * 1.3, seed + 5, 2) * w;
        const y = S.fbm2(i * 2.9, i * 4.1 + seed, seed + 9, 2) * h;
        const rad = 4 + S.fbm2(i, i + seed, seed + 13, 2) * 18;
        const grd = c2x.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, pal.cloud);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        c2x.fillStyle = grd;
        c2x.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-atop';
      ctx.drawImage(c2, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  function paintGas(p) {
    const w = 200, h = 140;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const pal = PAL[p.type] || PAL.gas_giant;
    const seed = (p.seed * 2654435761) >>> 0;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const spotX = 0.6 + S.fbm2(seed, 1, seed, 1) * 0.25;
    const spotY = 0.45 + S.fbm2(seed, 2, seed + 3, 1) * 0.2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const nx = u * 2 - 1, ny = v * 2 - 1;
        if (nx * nx + ny * ny > 1) { d[(y * w + x) * 4 + 3] = 0; continue; }
        const warp = (S.fbm2(u * 5 + seed, v * 3, seed + 21, 3) - 0.5) * 0.22;
        const band = Math.sin((v + warp) * 11) * 0.5 + 0.5;
        const n = S.fbm2(u * 14 + 3.3, v * 2 + 7.7, seed + 37, 3);
        let t = Math.max(0, Math.min(1, band + (n - 0.5) * 0.25));
        let col = lerpColor(pal.bands[Math.floor(t * (pal.bands.length - 1))], pal.bands[Math.ceil(t * (pal.bands.length - 1))], t * (pal.bands.length - 1) % 1);
        // 大红斑
        const ds = Math.hypot(u - spotX, (v - spotY) * 1.6);
        if (ds < 0.14) {
          const tt = 1 - ds / 0.14;
          col = lerpColor(col, pal.spot, 0.35 + tt * 0.5);
        }
        const i = (y * w + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function lerpColor(c1, c2, t) {
    t = Math.max(0, Math.min(1, t));
    const a = hexRgb(c1), b = hexRgb(c2);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function hexRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  const PlanetTex = {
    /** 获取行星贴图（懒生成并缓存到 planet._tex） */
    get(p) {
      if (p._tex) return p._tex;
      try {
        p._tex = p.isGas ? paintGas(p) : paintRocky(p);
      } catch (e) {
        e.message = 'planet-tex[' + p.type + '/' + p.name + '] ' + e.message;
        throw e;
      }
      return p._tex;
    },
    dropCache(p) { p._tex = null; }
  };

  S.PlanetTex = PlanetTex;
})(typeof window !== 'undefined' ? window : globalThis);