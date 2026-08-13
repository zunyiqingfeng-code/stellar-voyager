/* 星海远航 · 银河生成：旋臂结构 + 超空间航道网络 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  // 光谱型分布与外观
  const SPECTRAL = [
    { cls: 'M', weight: 30, color: '#ff8a4c', glow: '#ff5a1e', temp: 3200, lum: 0.02, rMin: 40, rMax: 55, desc: '红矮星：宇宙中最常见的恒星，暗淡而长寿' },
    { cls: 'K', weight: 22, color: '#ffb066', glow: '#ff8830', temp: 4800, lum: 0.25, rMin: 50, rMax: 68, desc: '橙矮星：温和稳定的中年恒星' },
    { cls: 'G', weight: 15, color: '#ffe08a', glow: '#ffb84a', temp: 5800, lum: 1.0, rMin: 60, rMax: 80, desc: '黄矮星：与太阳同类，生命摇篮的常见宿主' },
    { cls: 'F', weight: 12, color: '#fff2c8', glow: '#ffe080', temp: 6800, lum: 2.8, rMin: 72, rMax: 95, desc: '黄白星：更亮更热，宜居带更远' },
    { cls: 'A', weight: 9, color: '#f8fbff', glow: '#c8d8ff', temp: 8500, lum: 12, rMin: 88, rMax: 115, desc: '白星：炽热而短命，行星系通常贫瘠' },
    { cls: 'B', weight: 5, color: '#c8d8ff', glow: '#90a8ff', temp: 15000, lum: 120, rMin: 110, rMax: 150, desc: '蓝白巨星：强辐射灼烤内行星' },
    { cls: 'O', weight: 1.5, color: '#8ab0ff', glow: '#6090ff', temp: 32000, lum: 900, rMin: 140, rMax: 190, desc: '蓝超巨星：银河中最为炽烈的恒星' },
    { cls: 'WD', weight: 2.5, color: '#e8f4ff', glow: '#b0d0f0', temp: 12000, lum: 0.01, rMin: 16, rMax: 24, desc: '白矮星：恒星坍缩后的致密残骸' },
    { cls: 'NS', weight: 1.5, color: '#c8e0ff', glow: '#88c0ff', temp: 600000, lum: 0.005, rMin: 12, rMax: 18, desc: '中子星：每秒自转数百次的脉冲星，磁场撕碎一切' },
    { cls: 'BH', weight: 1, color: '#000000', glow: '#ff9a3c', temp: 0, lum: 0, rMin: 22, rMax: 30, desc: '黑洞：连光都无法逃脱的深渊，环绕着炽热的吸积盘' },
    { cls: 'RG', weight: 0.5, color: '#ff7040', glow: '#ff4020', temp: 3500, lum: 60, rMin: 200, rMax: 300, desc: '红巨星：膨胀中的垂死恒星，吞没了内行星' }
  ];

  function pickSpectral(rng) {
    const total = SPECTRAL.reduce((a, s) => a + s.weight, 0);
    let roll = rng.next() * total;
    for (const s of SPECTRAL) { if ((roll -= s.weight) < 0) return s; }
    return SPECTRAL[2];
  }

  function unionFind(n) {
    const p = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) p[ra] = rb; };
    return { find, union, allConnected: () => { const r = find(0); for (let i = 1; i < n; i++) if (find(i) !== r) return false; return true; } };
  }

  function generate(seed, count = 118) {
    const rng = new S.Rand(seed >>> 0 || 20240721);
    const W = 2200, H = 1500;
    const cx = W / 2, cy = H / 2;
    const systems = [];
    const positions = [];
    const occupied = (x, y, minD) => positions.some(p => M.dist(p.x, p.y, x, y) < minD);

    // 旋臂摆放
    const arms = 4;
    const armBase = rng.next() * M.TAU;
    const maxR = 880;
    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const t = i / count;                       // 0..1 沿臂推进
      const r = 90 + t * maxR;
      const angle = armBase + arm * (M.TAU / arms) + r * 0.0035 + (rng.next() - 0.5) * 0.45;
      let x = cx + Math.cos(angle) * r;
      let y = cy + Math.sin(angle) * r * 0.72;
      let tries = 0;
      while (occupied(x, y, 66) && tries++ < 24) {
        x = cx + Math.cos(angle + (rng.next() - 0.5) * 0.3) * (r + rng.range(-40, 40));
        y = cy + Math.sin(angle) * (r + rng.range(-40, 40)) * 0.72;
      }
      positions.push({ x, y });
      systems.push({ idx: i, x, y, links: [] });
    }
    // 银心聚团
    for (let i = 0; i < 14; i++) {
      const a = rng.next() * M.TAU, r = rng.range(30, 150);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8;
      if (!occupied(x, y, 60)) {
        positions.push({ x, y });
        systems.push({ idx: systems.length, x, y, links: [] });
      }
    }

    // 最小生成树保证连通
    const n = systems.length;
    const edges = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      edges.push({ i, j, d: M.dist(systems[i].x, systems[i].y, systems[j].x, systems[j].y) + rng.range(0, 90) });
    }
    edges.sort((a, b) => a.d - b.d);
    const uf = unionFind(n);
    const chosen = [];
    for (const e of edges) {
      if (uf.find(e.i) !== uf.find(e.j)) {
        uf.union(e.i, e.j);
        chosen.push(e);
        if (uf.allConnected()) break;
      }
    }
    // 追加近邻边
    const byDist = (i) => edges.filter(e => e.i === i || e.j === i)
      .sort((a, b) => a.d - b.d).slice(0, 6)
      .map(e => e.i === i ? e.j : e.i);
    const inSet = (a, b) => systems[a].links.includes(b);
    for (let i = 0; i < n; i++) {
      for (const j of byDist(i)) {
        if (j > i && !inSet(i, j) && systems[i].links.length < 4 && systems[j].links.length < 4 && rng.chance(0.16)) {
          systems[i].links.push(j); systems[j].links.push(i);
        }
      }
    }
    for (const e of chosen) {
      if (!inSet(e.i, e.j)) { systems[e.i].links.push(e.j); systems[e.j].links.push(e.i); }
    }

    // 生成恒星与星系信息
    const galaxy = { seed, name: '银河', width: W, height: H, systems: [] };
    const homeIdx = Math.floor(n / 2);
    systems.forEach((sys, i) => {
      const starSpec = pickSpectral(rng);
      const star = {
        spec: starSpec.cls,
        name: S.Names.system(rng) + '星',
        color: starSpec.color, glow: starSpec.glow,
        temp: starSpec.temp, lum: starSpec.lum,
        radius: rng.range(starSpec.rMin, starSpec.rMax),
        desc: starSpec.desc
      };
      galaxy.systems.push({
        id: 'sys-' + i,
        idx: i,
        name: S.Names.system(rng),
        x: sys.x, y: sys.y,
        links: sys.links,
        star,
        seed: (rng.next() * 0xffffffff) >>> 0,
        danger: rng.chance(0.38) ? rng.range(0.25, 1) : 0,
        isHome: i === homeIdx,
        visited: false, surveyed: false,
        anomalies: []
      });
    });

    // 命名与初始信息
    galaxy.home = galaxy.systems[homeIdx];
    galaxy.home.name = '天枢';
    galaxy.home.star.name = '天枢星';
    galaxy.home.star.desc = '母星系的太阳，人类文明的起点';
    return galaxy;
  }

  S.GalaxyGen = { generate, SPECTRAL };
})(typeof window !== 'undefined' ? window : globalThis);
