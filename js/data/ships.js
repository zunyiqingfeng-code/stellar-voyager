/* 星海远航 · 舰体库 + 建造/装配逻辑 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const C = S.Components;

  // slots: { wpn:{S,M,L}, def:{S,M,L}, core:{S}, aux:{S} }
  const HULLS = [
    { id: 'corvette', name: '护卫舰', cls: 'corvette', unlock: 1, ico: '▸',
      desc: '轻巧快速的护航舰，适合侦察与袭扰',
      base: { hull: 220, armor: 0, shield: 0, speed: 320, turn: 3.6, evasion: 0.3, cargo: 60, crew: 14 },
      slots: { wpn: { S: 3, M: 0, L: 0 }, def: { S: 3, M: 0, L: 0 }, core: { S: 5 }, aux: { S: 1 } },
      cost: { credits: 400, alloys: 40 } },
    { id: 'destroyer', name: '驱逐舰', cls: 'destroyer', unlock: 2, ico: '▹',
      desc: '中型主战舰，火力与防护均衡',
      base: { hull: 480, armor: 0, shield: 0, speed: 250, turn: 2.7, evasion: 0.22, cargo: 120, crew: 40 },
      slots: { wpn: { S: 2, M: 2, L: 0 }, def: { S: 3, M: 1, L: 0 }, core: { S: 5 }, aux: { S: 2 } },
      cost: { credits: 900, alloys: 110 } },
    { id: 'cruiser', name: '巡洋舰', cls: 'cruiser', unlock: 3, ico: '▰',
      desc: '重型主力舰，可挂载大口径主炮',
      base: { hull: 950, armor: 0, shield: 0, speed: 200, turn: 2.0, evasion: 0.15, cargo: 220, crew: 110 },
      slots: { wpn: { S: 3, M: 2, L: 1 }, def: { S: 3, M: 2, L: 1 }, core: { S: 6 }, aux: { S: 3 } },
      cost: { credits: 2000, alloys: 260 } },
    { id: 'battleship', name: '战列舰', cls: 'battleship', unlock: 4, ico: '▮',
      desc: '舰队之巅，移动要塞',
      base: { hull: 1900, armor: 0, shield: 0, speed: 150, turn: 1.4, evasion: 0.08, cargo: 380, crew: 320 },
      slots: { wpn: { S: 2, M: 2, L: 3 }, def: { S: 2, M: 2, L: 2 }, core: { S: 7 }, aux: { S: 4 } },
      cost: { credits: 4800, alloys: 700 } },
    { id: 'science', name: '科研船', cls: 'science', unlock: 1, ico: '◯',
      desc: '专精勘探，自带勘测加成',
      base: { hull: 160, armor: 0, shield: 0, speed: 290, turn: 3.0, evasion: 0.25, cargo: 60, crew: 10, surveyBonus: 0.5 },
      slots: { wpn: { S: 1, M: 0, L: 0 }, def: { S: 2, M: 0, L: 0 }, core: { S: 5 }, aux: { S: 2 } },
      cost: { credits: 300, alloys: 30 } },
    { id: 'mining', name: '采矿船', cls: 'mining', unlock: 1, ico: '◇',
      desc: '货舱巨大，采矿效率高',
      base: { hull: 190, armor: 0, shield: 0, speed: 240, turn: 2.4, evasion: 0.18, cargo: 400, crew: 16, miningBonus: 0.6 },
      slots: { wpn: { S: 1, M: 0, L: 0 }, def: { S: 2, M: 0, L: 0 }, core: { S: 5 }, aux: { S: 3 } },
      cost: { credits: 350, alloys: 45 } }
  ];
  const byId = {};
  HULLS.forEach(h => byId[h.id] = h);

  /** 装配统计：comps 为部件 id 数组 */
  function buildStats(hull, compIds) {
    const comps = compIds.map(id => C.byId[id]).filter(Boolean);
    const s = {
      hull: hull.base.hull, armor: 0, shield: 0, shieldRegen: 0,
      speed: hull.base.speed, turn: hull.base.turn, evasion: hull.base.evasion,
      fireMult: 1, accuracy: 0.7, tracking: 0, scanRange: 500, jumpRange: 1, windup: 3.0,
      cargo: hull.base.cargo, surveyMult: 1, miningMult: 1,
      powerUse: 0, powerSupply: 0,
      weapons: [], cost: { credits: hull.cost.credits, alloys: hull.cost.alloys, crystals: 0 },
      comps
    };
    let hullMult = 1, shieldRegenMult = 0, windupReduction = 0, speedBonus = 0;

    comps.forEach(c => {
      const st = c.stats;
      if (c.family === 'reactor') s.powerSupply += st.power || 0;
      else s.powerUse += st.power || 0;
      s.cost.credits += c.cost.credits; s.cost.alloys += c.cost.alloys; s.cost.crystals += c.cost.crystals;
      if (c.kind) s.weapons.push({ ...st, id: c.id, name: c.name });
      if (st.shieldHP) s.shield += st.shieldHP;
      if (st.regen) s.shieldRegen += st.regen;
      if (st.armorHP) s.armor += st.armorHP;
      if (st.hullMult && c.slotType !== 'wpn') hullMult += st.hullMult; // 武器伤害倍率不算船体加成
      if (st.speedMult) s.speed *= st.speedMult;
      if (st.turnBonus) s.turn += st.turnBonus;
      if (st.evasionBonus) s.evasion += st.evasionBonus;
      if (st.fireMult) s.fireMult *= st.fireMult;
      if (st.accuracy) s.accuracy = Math.max(s.accuracy, st.accuracy);
      if (st.trackingBonus) s.tracking += st.trackingBonus;
      if (st.scanRange) s.scanRange = Math.max(s.scanRange, st.scanRange);
      if (st.jumpRange) s.jumpRange = Math.max(s.jumpRange, st.jumpRange);
      if (st.windup) s.windup = Math.min(s.windup, st.windup);
      if (st.shieldRegenMult) shieldRegenMult += st.shieldRegenMult;
      if (st.windupReduction) windupReduction += st.windupReduction;
      if (st.speedBonus) speedBonus += st.speedBonus;
      if (st.surveyMult) s.surveyMult *= st.surveyMult;
      if (st.cargoBonus) s.cargo += st.cargoBonus;
    });

    s.hull = Math.round(s.hull * hullMult);
    s.shieldRegen *= (1 + shieldRegenMult);
    s.windup *= (1 - windupReduction);
    s.speed = Math.round(s.speed * (1 + speedBonus));
    if (hull.base.surveyBonus) s.surveyMult *= (1 + hull.base.surveyBonus);
    if (hull.base.miningBonus) s.miningMult *= (1 + hull.base.miningBonus);
    s.powerUse = Math.round(s.powerUse);
    s.powerSupply = Math.round(s.powerSupply);
    s.overpower = s.powerUse > s.powerSupply;
    return s;
  }

  /** 校验装配是否合法（槽位/科技/电力） */
  function validate(hull, compIds, techLevel) {
    const sl = hull.slots;
    const slotsLeft = {
      wpn: { S: sl.wpn.S, M: sl.wpn.M, L: sl.wpn.L },
      def: sl.def.S + (sl.def.M || 0) + (sl.def.L || 0), // 防御槽合并（任意防御件）
      core: sl.core.S,
      aux: sl.aux.S
    };
    for (const id of compIds) {
      const c = C.byId[id];
      if (!c) return { ok: false, msg: '未知部件' };
      if (c.tier > techLevel) return { ok: false, msg: '科技等级不足' };
      if (c.slotType === 'wpn') {
        if (!slotsLeft.wpn[c.slotSize]) return { ok: false, msg: '武器槽不足' };
        slotsLeft.wpn[c.slotSize]--;
      } else {
        if (!slotsLeft[c.slotType]) return { ok: false, msg: '对应槽位不足' };
        slotsLeft[c.slotType]--;
      }
    }
    const s = buildStats(hull, compIds);
    if (s.overpower) return { ok: false, msg: '电力不足，请更换更高功率反应堆' };
    return { ok: true, msg: '装配合法', stats: s };
  }

  /** 生成默认设计 */
  function defaultDesigns(techLevel) {
    const tl = Math.max(1, Math.min(5, techLevel));
    const mk = (hullId, defs) => {
      const hull = byId[hullId];
      return { hullId, comps: defs.filter(id => C.byId[id] && C.byId[id].tier <= tl), name: hull.name };
    };
    return [
      mk('corvette', ['rea1', 'thr1', 'cpu1', 'sen1', 'kin_s1', 'kin_s1', 'pd_s1', 'shd1', 'shd1', 'arm1', 'aux4']),
      mk('science', ['rea1', 'thr2', 'sen1', 'cpu1', 'pd_s1', 'shd1', 'arm1', 'aux5']),
      mk('mining', ['rea1', 'thr1', 'sen1', 'cpu1', 'pd_s1', 'shd1', 'arm1', 'aux6'])
    ];
  }

  const Ships = {
    hulls: HULLS, byId, buildStats, validate, defaultDesigns,
    unlockedHulls(techLevel) { return HULLS.filter(h => h.unlock <= techLevel); }
  };

  S.Ships = Ships;
})(typeof window !== 'undefined' ? window : globalThis);