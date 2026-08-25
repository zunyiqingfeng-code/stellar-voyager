/* 星海远航 · 主入口：游戏状态初始化 / 存档 / 飞船运行时 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  // ---- 全局状态 ----
  S.G = { seed: 1, galaxy: null, player: null, sysCache: {}, time: 0, gameStartedAt: 0 };
  let engineRef = null;

  S.getSystem = function (sysId) {
    if (S.G.sysCache[sysId]) return S.G.sysCache[sysId];
    const gs = S.G.galaxy.systems.find(s => s.id === sysId);
    if (!gs) return null;
    const rng = new S.Rand(gs.seed);
    const sys = S.SystemGen.generate(gs, rng);
    S.G.sysCache[sysId] = sys;
    return sys;
  };

  /** 由设计装配一艘船（运行时状态） */
  S.makeShip = function (design, name) {
    const hull = S.Ships.byId[design.hullId];
    const stats = S.Ships.buildStats(hull, design.comps);
    return {
      id: 'ship-' + ((Math.random() * 0xffffffff) >>> 0).toString(16),
      designId: design.id, name: name || design.name,
      hullId: design.hullId, comps: design.comps.slice(),
      stats,
      hp: { hull: stats.hull, armor: stats.armor, shield: stats.shield },
      weapons: stats.weapons.map(w => ({ ...w, baseCd: w.cd, cd: Math.random() * 0.5 })),
      shieldCd: 0,
      x: 0, y: 0, angle: 0, vx: 0, vy: 0
    };
  };

  /** 旗舰按最新设计重新装配 */
  S.refitShip = function (ship, design) {
    ship.designId = design.id;
    ship.hullId = design.hullId;
    ship.comps = design.comps.slice();
    const hull = S.Ships.byId[design.hullId];
    ship.stats = S.Ships.buildStats(hull, design.comps);
    ship.hp.hull = Math.min(ship.hp.hull, ship.stats.hull);
    ship.hp.armor = Math.min(ship.hp.armor, ship.stats.armor);
    ship.hp.shield = Math.min(ship.hp.shield, ship.stats.shield);
    ship.weapons = ship.stats.weapons.map(w => ({ ...w, baseCd: w.cd, cd: Math.random() * 0.5 }));
  };

  function initPlayer(name, sysId, shipDesign) {
    const ship = S.makeShip(shipDesign, '远航号');
    const sys = S.getSystem(sysId);
    const a = sys.station.angle + 0.15;
    ship.x = Math.cos(a) * (sys.station.orbitRadius + 260);
    ship.y = Math.sin(a) * (sys.station.orbitRadius + 260);
    ship.angle = a + Math.PI / 2;
    return {
      name: name || '星海指挥官',
      credits: 1500, alloys: 150, crystals: 0, science: 0,
      techLevel: 1,
      designs: [],
      garage: [],
      ship,
      sysId, pos: { x: ship.x, y: ship.y }, angle: ship.angle, vx: 0, vy: 0,
      cargo: { ore: 0, rare: 0 },
      discovered: {},
      missions: [],
      kills: 0, surveyed: 0, jumps: 0,
      settings: { muted: false },
      startedAt: Date.now()
    };
  }

  S.newGame = function () {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const galaxy = S.GalaxyGen.generate(seed);
    // 先建立全局状态，initPlayer 依赖 S.G
    S.G = { seed, galaxy, player: null, sysCache: {}, time: 0, gameStartedAt: Date.now() };
    const designs = S.Ships.defaultDesigns(1).map((d, i) => ({
      id: 'd' + i, name: d.name, hullId: d.hullId, comps: d.comps
    }));
    const player = initPlayer(null, galaxy.home.id, designs[0]);
    player.designs = designs;
    player.discovered[galaxy.home.id] = { visited: true, surveyed: true };
    S.G.player = player;
    S.G.engine = engineRef;
    S.refreshTech(true);
    S.Audio.setMuted(player.settings.muted);
    // 注意：不在 newGame 时自动存档——首次访问不应出现“继续航行”存档
  };

  S.continueGame = function () {
    const save = S.Save.load();
    if (!save) { S.newGame(); return; }
    const galaxy = S.GalaxyGen.generate(save.seed);
    const player = save.player;
    // 重建旗舰运行时状态（防御：存档缺设计时回退默认设计）
    if (!player.designs || !player.designs.length) {
      player.designs = S.Ships.defaultDesigns(1).map((d, i) => ({
        id: 'd' + i, name: d.name, hullId: d.hullId, comps: d.comps
      }));
    }
    const design = player.designs.find(d => d.id === player.activeDesignId) || player.designs[0];
    const ship = S.makeShip(design, player.shipName || '远航号');
    ship.x = player.pos.x; ship.y = player.pos.y;
    ship.angle = player.angle; ship.vx = player.vx; ship.vy = player.vy;
    if (player.shipHp) ship.hp = player.shipHp;
    ship.weapons.forEach(w => { w.cd = 0; });
    player.ship = ship;
    S.G = { seed: save.seed, galaxy, player, sysCache: {}, time: save.time || 0, gameStartedAt: player.startedAt || Date.now() };
    S.G.engine = engineRef;
    S.refreshTech(true);
    S.Audio.setMuted(player.settings.muted);
  };

  /** 科研点变化后刷新科技等级，升级时提示 */
  S.refreshTech = function (silent) {
    const p = S.G.player;
    if (!p) return;
    const before = p.techLevel || 1;
    p.techLevel = S.Components.techLevelFor(p.science);
    if (!silent && p.techLevel > before) {
      S.UI.toast('✦ 科技突破！等级提升至 <b>' + S.Components.tierName(p.techLevel) + '</b> —— 舰船设计器中解锁新部件', 'success', 5000);
      S.Audio.scanDone();
    }
  };

  S.saveGame = function () {
    const p = S.G.player;
    if (!p) return false;
    return S.Save.save({
      seed: S.G.seed,
      time: S.G.time,
      player: {
        name: p.name, credits: p.credits, alloys: p.alloys, crystals: p.crystals, science: p.science,
        techLevel: p.techLevel, designs: p.designs, garage: p.garage,
        activeDesignId: p.ship ? p.ship.designId : p.activeDesignId,
        shipName: p.ship ? p.ship.name : '远航号',
        shipHp: p.ship ? p.ship.hp : null,
        pos: p.pos, angle: p.angle, vx: p.vx, vy: p.vy,
        sysId: p.sysId, cargo: p.cargo, discovered: p.discovered, missions: p.missions,
        kills: p.kills, surveyed: p.surveyed, jumps: p.jumps,
        settings: p.settings, startedAt: p.startedAt
      }
    });
  };

  // 关闭页面前自动存档（飞行中实时位置也一并保存）
  window.addEventListener('beforeunload', () => {
    try {
      const eng = S.G.engine;
      if (eng && eng.currentName === 'flight' && eng.current && eng.current.persistPos) eng.current.persistPos();
      if (S.G.player) S.saveGame();
    } catch (e) {}
  });

  // ---- 启动 ----
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game');
    const engine = new S.Engine(canvas);
    engineRef = engine;
    S.G.engine = engine;
    const q = new URLSearchParams(location.search);
    const scene = q.get('scene');
    const seed = q.get('seed') ? (Number(q.get('seed')) >>> 0) : null;
    if (scene === 'flight' || scene === 'galaxy' || scene === 'menu') {
      // 调试直达：直接初始化并进入场景
      const old = Math.random;
      if (seed != null) {
        Math.random = (() => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
      }
      S.newGame();
      if (scene === 'galaxy') { S.G.player.discovered[S.G.galaxy.home.id].visited = true; }
      Math.random = old;
      engine.start(scene === 'galaxy' ? 'galaxymap' : scene, {});
      if (q.get('probe')) {
        setTimeout(() => {
          try {
            const cv = document.getElementById('game');
            const ctx = cv.getContext('2d');
            const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
            let bright = 0, colored = 0;
            const hues = {};
            const step = Math.max(16, Math.floor(img.length / 4 / 60000) * 4);
            for (let i = 0; i < img.length; i += step) {
              const r = img[i], g = img[i + 1], b = img[i + 2];
              if (r + g + b > 140) bright++;
              if (Math.max(r, g, b) - Math.min(r, g, b) > 45) {
                const h = Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI + 360) % 360 / 30) % 12;
                hues[h] = (hues[h] || 0) + 1;
                colored++;
              }
            }
            const info = {
              bright, colored, hues,
              sys: (document.getElementById('sys-info') || {}).innerText || '',
              stats: (document.getElementById('ship-stats') || {}).innerText || '',
              toast: document.querySelectorAll('.toast').length,
              modal: document.querySelectorAll('.modal').length,
              title: document.title
            };
            document.title = 'PROBE:' + JSON.stringify(info);
          } catch (e) { document.title = 'PROBE-ERR:' + e.message; }
        }, 5000);
      }
    } else {
      engine.start('boot', {});
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);