/* 星海远航 · 飞船部件库（参考《群星》Stellaris） */
/* 槽位类型: wpn(武器) def(防御) core(核心) aux(辅助) ；武器系: kinetic/energy/missile/pd */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const defs = [];
  function cost(tier, size, base, alloy) {
    const sf = size === 'L' ? 4 : size === 'M' ? 2 : 1;
    return {
      credits: Math.round(base * sf * tier * tier),
      alloys: Math.round(alloy * sf * tier),
      crystals: tier >= 3 ? Math.round(sf * (tier - 2)) : 0
    };
  }
  function pow(tier, base) { return base + tier * base; }

  // ---- 武器 ----
  function W(id, name, tier, size, kind, dmg, cd, range, speed, tracking, homing, power, flavor) {
    const mult = kind === 'kinetic' ? { shieldMult: 1.25, armorMult: 0.75, hullMult: 1.0 }
      : kind === 'energy' ? { shieldMult: 0.5, armorMult: 1.5, hullMult: 1.0 }
      : kind === 'missile' ? { shieldMult: 0.6, armorMult: 0.6, hullMult: 1.0 }
      : { shieldMult: 1.0, armorMult: 1.0, hullMult: 1.0 };
    const sf = size === 'L' ? 4 : size === 'M' ? 2 : 1;
    defs.push({
      id, name, tier, family: 'wpn', kind, slotType: 'wpn', slotSize: size, ico: kind === 'kinetic' ? '⚙' : kind === 'energy' ? '✦' : kind === 'missile' ? '➤' : '•',
      desc: flavor,
      cost: kind === 'pd' ? cost(tier, 'S', 30, 6) : cost(tier, size, 40, 9),
      stats: { dmg, cd, range, projSpeed: speed, tracking: tracking || 0, homing: !!homing,
        shieldMult: mult.shieldMult, armorMult: mult.armorMult, hullMult: mult.hullMult,
        kind, size, power: power == null ? (kind === 'pd' ? 1 + tier : (sf === 4 ? 5 + 3 * tier : sf === 2 ? 3 + 2 * tier : 2 + tier)) : power }
    });
  }
  // 动能系：对护盾强、对装甲弱
  W('kin_s1', '质量加速器', 1, 'S', 'kinetic', 8, 1.5, 520, 900, 0, 0, null, '基础电磁弹射武器，廉价可靠');
  W('kin_s2', '线圈炮', 2, 'S', 'kinetic', 13, 1.5, 560, 960, 0, 0, null, '双级线圈加速，初速更高');
  W('kin_s3', '轨道炮', 3, 'S', 'kinetic', 20, 1.4, 600, 1020, 0.05, 0, null, '电磁轨道加速，弹道平直');
  W('kin_s4', '高斯炮', 4, 'S', 'kinetic', 30, 1.4, 640, 1080, 0.08, 0, null, '超导线圈，穿透力惊人');
  W('kin_s5', '动能撕裂者', 5, 'S', 'kinetic', 44, 1.3, 680, 1140, 0.12, 0, null, '高密度弹丸将船体撕成碎片');
  W('kin_m2', '双联线圈炮', 2, 'M', 'kinetic', 22, 1.6, 620, 900, 0, 0, null, '中型炮塔，火力与射程均衡');
  W('kin_m3', '双联轨道炮', 3, 'M', 'kinetic', 34, 1.5, 660, 960, 0.05, 0, null, '双管电磁轨道炮');
  W('kin_m4', '双联高斯炮', 4, 'M', 'kinetic', 52, 1.5, 700, 1020, 0.08, 0, null, '中口径超导电磁炮');
  W('kin_m5', '风暴连射炮', 5, 'M', 'kinetic', 40, 0.9, 660, 1080, 0.1, 0, null, '三管转管炮，弹幕如风暴');
  W('kin_l3', '重型攻城加农', 3, 'L', 'kinetic', 75, 2.6, 860, 820, 0, 0, null, '重型电磁加农，专轰大舰');
  W('kin_l4', '超级电磁炮', 4, 'L', 'kinetic', 120, 2.5, 920, 860, 0.02, 0, null, '旗舰级主炮');
  W('kin_l5', '千兆加农炮', 5, 'L', 'kinetic', 190, 2.4, 1000, 900, 0.05, 0, null, '传说中的巨炮，一击定乾坤');
  // 能量系：对装甲强、对护盾弱
  W('ene_s1', '红激光', 1, 'S', 'energy', 10, 1.2, 440, 1500, 0.1, 0, null, '可见光波段战斗激光');
  W('ene_s2', '蓝激光', 2, 'S', 'energy', 16, 1.2, 470, 1500, 0.12, 0, null, '短波激光，烧蚀装甲');
  W('ene_s3', '紫外线激光', 3, 'S', 'energy', 24, 1.15, 500, 1500, 0.15, 0, null, '高能紫外光，熔穿合金');
  W('ene_s4', 'X射线激光', 4, 'S', 'energy', 35, 1.1, 530, 1500, 0.18, 0, null, 'X射线穿透纵深装甲');
  W('ene_s5', '伽马激光', 5, 'S', 'energy', 52, 1.05, 560, 1500, 0.22, 0, null, '伽马射线流，摧枯拉朽');
  W('ene_m2', '双联蓝激光', 2, 'M', 'energy', 26, 1.25, 500, 1500, 0.1, 0, null, '中型激光炮台');
  W('ene_m3', '粒子枪', 3, 'M', 'energy', 40, 1.2, 540, 1500, 0.12, 0, null, '加速粒子束射击');
  W('ene_m4', '双联X射线激光', 4, 'M', 'energy', 60, 1.15, 580, 1500, 0.15, 0, null, '双联高能射线炮');
  W('ene_m5', '相位裂解炮', 5, 'M', 'energy', 45, 0.85, 540, 1500, 0.2, 0, null, '相位能量分解物质');
  W('ene_l3', '重型粒子长矛', 3, 'L', 'energy', 90, 2.2, 780, 1300, 0.02, 0, null, '长程粒子束，穿刺一切');
  W('ene_l4', '等离子加农', 4, 'L', 'energy', 145, 2.1, 820, 1300, 0.03, 0, null, '超高温等离子团');
  W('ene_l5', '湮灭光束', 5, 'L', 'energy', 230, 2.0, 880, 1300, 0.05, 0, null, '正反物质湮灭的能量洪流');
  // 导弹系：制导、可被点防拦截、重创船体
  W('mis_s1', '核导弹', 1, 'S', 'missile', 16, 2.4, 700, 420, 0.6, 1, null, '小型核弹头制导导弹');
  W('mis_s2', '聚变导弹', 2, 'S', 'missile', 26, 2.4, 760, 460, 0.65, 1, null, '聚变战斗部，威力倍增');
  W('mis_s3', '反物质导弹', 3, 'S', 'missile', 40, 2.3, 820, 500, 0.7, 1, null, '反物质湮灭弹头');
  W('mis_s4', '量子导弹', 4, 'S', 'missile', 62, 2.3, 880, 540, 0.75, 1, null, '量子态跃迁突防弹头');
  W('mis_s5', '奇点导弹', 5, 'S', 'missile', 95, 2.2, 940, 580, 0.8, 1, null, '微型奇点坍缩，吞噬船体');
  W('mis_m2', '双联核导弹', 2, 'M', 'missile', 44, 2.6, 780, 400, 0.55, 1, null, '中型导弹阵列');
  W('mis_m3', '裂变鱼雷', 3, 'M', 'missile', 68, 2.5, 840, 430, 0.6, 1, null, '重型鱼雷，专破重甲');
  W('mis_m4', '反物质鱼雷', 4, 'M', 'missile', 105, 2.5, 900, 460, 0.65, 1, null, '反物质装药鱼雷');
  W('mis_m5', '量子鱼雷', 5, 'M', 'missile', 160, 2.4, 960, 490, 0.7, 1, null, '量子隧穿鱼雷');
  W('mis_l3', '攻城鱼雷', 3, 'L', 'missile', 160, 3.4, 1100, 360, 0.4, 1, null, '巨型鱼雷，轰击主力舰');
  W('mis_l4', '重装攻城鱼雷', 4, 'L', 'missile', 250, 3.3, 1160, 380, 0.45, 1, null, '末日级鱼雷');
  W('mis_l5', '湮灭鱼雷', 5, 'L', 'missile', 400, 3.2, 1240, 400, 0.5, 1, null, '携奇点的终极鱼雷');
  // 点防御：拦截导弹、射速极高
  W('pd_s1', '高炮', 1, 'S', 'pd', 3, 0.35, 360, 1400, 0.5, 0, null, '速射防空炮，拦截来袭导弹');
  W('pd_s2', '机关炮', 2, 'S', 'pd', 5, 0.32, 400, 1500, 0.55, 0, null, '高速机关炮');
  W('pd_s3', '双管机关炮', 3, 'S', 'pd', 8, 0.3, 440, 1500, 0.6, 0, null, '双管速射炮');
  W('pd_s4', '激光点防', 4, 'S', 'pd', 12, 0.28, 480, 1500, 0.7, 0, null, '激光点防御阵列');
  W('pd_s5', '相位点防', 5, 'S', 'pd', 18, 0.26, 520, 1500, 0.8, 0, null, '相位能量点防系统');

  // ---- 防御 ----
  function SH(id, name, tier, hp, regen, flavor) {
    defs.push({ id, name, tier, family: 'shield', slotType: 'def', slotSize: 'S', ico: '◈',
      desc: flavor, cost: cost(tier, 'S', 55, 12),
      stats: { shieldHP: hp, regen, power: 2 + 2 * tier } });
  }
  function AR(id, name, tier, hp, flavor) {
    defs.push({ id, name, tier, family: 'armor', slotType: 'def', slotSize: 'S', ico: '▣',
      desc: flavor, cost: cost(tier, 'S', 45, 10), stats: { armorHP: hp, power: 0 } });
  }
  function HU(id, name, tier, mult, flavor) {
    defs.push({ id, name, tier, family: 'hull', slotType: 'def', slotSize: 'S', ico: '⬢',
      desc: flavor, cost: cost(tier, 'S', 65, 12), stats: { hullMult: mult, power: 0 } });
  }
  SH('shd1', '偏导护盾', 1, 60, 3.0, '低功率偏导护盾');
  SH('shd2', '强化偏导护盾', 2, 90, 4.5, '增强的偏导护盾发生器');
  SH('shd3', '偏导护盾阵列', 3, 140, 7.0, '多重护盾阵列覆盖全舰');
  SH('shd4', '高级偏导护盾', 4, 210, 10, '高级护盾，再生极快');
  SH('shd5', '超能护盾', 5, 300, 15, '近乎不破的超级护盾');
  AR('arm1', '合金装甲', 1, 60, '标准合金装甲板');
  AR('arm2', '强化合金装甲', 2, 100, '强化合金，抗打击更强');
  AR('arm3', '晶体镀层', 3, 160, '晶体镀层折射能量攻击');
  AR('arm4', '纳米自适应装甲', 4, 240, '纳米装甲实时修复形变');
  AR('arm5', '龙鳞装甲', 5, 360, '传说中的龙鳞级装甲');
  HU('hul1', '船体强化 I', 1, 0.2, '结构加强，+20% 船体');
  HU('hul2', '船体强化 II', 2, 0.4, '结构加强，+40% 船体');
  HU('hul3', '船体强化 III', 3, 0.7, '结构加强，+70% 船体');

  // ---- 核心 ----
  function CORE(id, name, tier, family, stats, flavor, base, alloy) {
    defs.push({ id, name, tier, family, slotType: 'core', slotSize: 'S', ico: family === 'reactor' ? '⚡' : family === 'thruster' ? '➤' : family === 'hyperdrive' ? '✧' : family === 'computer' ? '⌘' : '◉',
      desc: flavor, cost: cost(tier, 'S', base || 70, alloy || 14), stats: { ...stats, power: stats.power == null ? 2 + 2 * tier : stats.power } });
  }
  CORE('rea1', '聚变反应堆', 1, 'reactor', { power: 45 }, '标准聚变能源核心');
  CORE('rea2', '强化聚变堆', 2, 'reactor', { power: 65 }, '更高输出的聚变核心');
  CORE('rea3', '反物质反应堆', 3, 'reactor', { power: 90 }, '反物质湮灭供能');
  CORE('rea4', '零点能反应堆', 4, 'reactor', { power: 125 }, '汲取真空零点能');
  CORE('rea5', '奇点核心', 5, 'reactor', { power: 175 }, '束缚微型奇点供能');
  CORE('thr1', '化学推进器', 1, 'thruster', { speedMult: 1.0, turnBonus: 0, evasionBonus: 0 }, '传统化学燃料引擎');
  CORE('thr2', '离子推进器', 2, 'thruster', { speedMult: 1.1, turnBonus: 0.1, evasionBonus: 0.02 }, '离子流持续加速');
  CORE('thr3', '等离子推进器', 3, 'thruster', { speedMult: 1.22, turnBonus: 0.2, evasionBonus: 0.04 }, '等离子引擎，机动大增');
  CORE('thr4', '脉冲推进器', 4, 'thruster', { speedMult: 1.36, turnBonus: 0.3, evasionBonus: 0.06 }, '脉冲爆震引擎');
  CORE('thr5', '反物质推进器', 5, 'thruster', { speedMult: 1.55, turnBonus: 0.45, evasionBonus: 0.1 }, '反物质喷射，追风逐电');
  CORE('hyp1', '曲速引擎', 1, 'hyperdrive', { jumpRange: 1, windup: 3.0, power: 7 }, '基础超光速，只能邻接跃迁');
  CORE('hyp2', '超空间引擎', 2, 'hyperdrive', { jumpRange: 2, windup: 2.6, power: 10 }, '沿超空间航道跃迁');
  CORE('hyp3', '超空间跳跃门', 3, 'hyperdrive', { jumpRange: 3, windup: 2.2, power: 13 }, '跳跃门技术缩短充能');
  CORE('hyp4', '虫洞稳定器', 4, 'hyperdrive', { jumpRange: 4, windup: 1.9, power: 16 }, '稳定虫洞，远距跃迁');
  CORE('hyp5', '奇点跳跃引擎', 5, 'hyperdrive', { jumpRange: 5, windup: 1.6, power: 19 }, '奇点扭曲时空，长驱直入');
  CORE('cpu1', '基础战斗电脑', 1, 'computer', { fireMult: 1.0, accuracy: 0.7, trackingBonus: 0, evasionBonus: 0 }, '基础火控计算机');
  CORE('cpu2', '火控计算机', 2, 'computer', { fireMult: 1.08, accuracy: 0.75, trackingBonus: 0.05, evasionBonus: 0 }, '火控解算提升命中');
  CORE('cpu3', '先进火控', 3, 'computer', { fireMult: 1.16, accuracy: 0.8, trackingBonus: 0.1, evasionBonus: 0.02 }, '先进弹道预测系统');
  CORE('cpu4', '量子火控', 4, 'computer', { fireMult: 1.26, accuracy: 0.85, trackingBonus: 0.16, evasionBonus: 0.04 }, '量子并行火控解算');
  CORE('cpu5', '自律AI核心', 5, 'computer', { fireMult: 1.38, accuracy: 0.9, trackingBonus: 0.24, evasionBonus: 0.07 }, '自律AI接管全舰火控');
  CORE('sen1', '基础雷达', 1, 'sensor', { scanRange: 500, surveyMult: 1.0 }, '基础探测雷达');
  CORE('sen2', '引力传感器', 2, 'sensor', { scanRange: 650, surveyMult: 1.15 }, '引力异常侦测');
  CORE('sen3', '超空间探测器', 3, 'sensor', { scanRange: 820, surveyMult: 1.3 }, '扫描超空间信号');
  CORE('sen4', '量子探测器', 4, 'sensor', { scanRange: 1040, surveyMult: 1.5 }, '量子纠缠探测阵列');
  CORE('sen5', '全谱探测器', 5, 'sensor', { scanRange: 1300, surveyMult: 1.8 }, '全电磁频谱扫描');

  // ---- 辅助 ----
  function AUX(id, name, tier, stats, flavor) {
    defs.push({ id, name, tier, family: 'aux', slotType: 'aux', slotSize: 'S', ico: '◇',
      desc: flavor, cost: cost(tier, 'S', 50, 10), stats: { ...stats, power: 1 + tier } });
  }
  AUX('aux1', '护盾电容', 1, { shieldRegenMult: 0.5 }, '+50% 护盾再生');
  AUX('aux2', '辅助火控', 1, { fireMult: 0.05 }, '+5% 射速');
  AUX('aux3', '跃迁稳定器', 1, { windupReduction: 0.2 }, '-20% 跃迁充能时间');
  AUX('aux4', '后燃加力器', 1, { speedBonus: 0.12 }, '+12% 航速');
  AUX('aux5', '勘测套件', 1, { surveyMult: 0.25 }, '+25% 勘探速度');
  AUX('aux6', '货舱扩容', 1, { cargoBonus: 80 }, '+80 货舱容量');
  AUX('aux7', '强化船壳', 1, { hullMult: 0.08 }, '+8% 船体耐久');

  const byId = {};
  defs.forEach(d => byId[d.id] = d);

  const TIER_NAME = ['', 'I', 'II', 'III', 'IV', 'V'];
  const TECH_THRESHOLDS = [0, 0, 250, 900, 2400, 5500];

  const Components = {
    list: defs,
    byId,
    tierName(t) { return TIER_NAME[t] || ''; },
    techLevelFor(science) {
      let lv = 1;
      for (let i = 2; i <= 5; i++) if (science >= TECH_THRESHOLDS[i]) lv = i;
      return lv;
    },
    /** 某槽位可用的部件（按类型/尺寸/科技过滤） */
    forSlot(slotType, slotSize, techLevel) {
      return defs.filter(d => d.slotType === slotType && d.tier <= techLevel &&
        (slotType !== 'wpn' ? true : d.slotSize === slotSize));
    },
    forFamily(family) { return defs.filter(d => d.family === family); },
    familyName(f) {
      return { kinetic: '动能武器', energy: '能量武器', missile: '导弹武器', pd: '点防御',
        shield: '护盾', armor: '装甲', hull: '船体强化', reactor: '反应堆', thruster: '推进器',
        hyperdrive: '超光速引擎', computer: '作战电脑', sensor: '探测器', aux: '辅助系统' }[f] || f;
    },
    slotTypeName(t) { return { wpn: '武器槽', def: '防御槽', core: '核心槽', aux: '辅助槽' }[t] || t; }
  };

  S.Components = Components;
})(typeof window !== 'undefined' ? window : globalThis);