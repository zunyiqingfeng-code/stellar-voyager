/* 星海远航 · 恒星系生成：行星/卫星/环带/小行星带/异常/空间站 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  const AU = 900; // 1天文单位 = 900px

  const TYPES = {
    gaia: { cn: '盖亚世界', tag: '完美宜居', habit: 100 },
    continental: { cn: '大陆世界', tag: '宜居', habit: 80 },
    ocean: { cn: '海洋世界', tag: '宜居', habit: 75 },
    arid: { cn: '干旱世界', tag: '亚宜居', habit: 60 },
    tundra: { cn: '苔原世界', tag: '亚宜居', habit: 55 },
    desert: { cn: '沙漠世界', tag: '边缘宜居', habit: 40 },
    ice: { cn: '冰封世界', tag: '严寒', habit: 20 },
    barren: { cn: '荒芜世界', tag: '无大气', habit: 0 },
    lava: { cn: '熔岩世界', tag: '炽热', habit: 0 },
    toxic: { cn: '剧毒世界', tag: '毒气', habit: 0 },
    tomb: { cn: '死寂世界', tag: '核废墟', habit: 0 },
    machine: { cn: '机械世界', tag: '人造', habit: 30 },
    hive: { cn: '蜂巢世界', tag: '有机体', habit: 10 },
    shattered: { cn: '破碎世界', tag: '残骸', habit: 0 },
    gas_giant: { cn: '气态巨行星', tag: '巨行星', habit: 0, isGas: true },
    ice_giant: { cn: '冰巨星', tag: '巨行星', habit: 0, isGas: true }
  };

  const ATMOSPHERE = {
    lava: ['二氧化硫', '二氧化碳', '硫蒸气'],
    barren: ['无大气', '稀薄二氧化碳'],
    desert: ['二氧化碳', '氮气'],
    arid: ['氮气/氧气(稀薄)', '二氧化碳'],
    continental: ['氮气/氧气', '氮气/氧气(湿润)'],
    ocean: ['氮气/氧气(浓密)', '水蒸气/氮气'],
    tundra: ['氮气/氧气(稀薄)', '氮气'],
    ice: ['氮气/甲烷', '二氧化碳/氮气'],
    toxic: ['氨气/甲烷', '氯化氢', '氟化氢'],
    tomb: ['辐射尘/氮气', '无大气'],
    machine: ['工业废气/氮气', '合成气体'],
    hive: ['有机孢子云', '氮气/甲烷'],
    shattered: ['无大气', '稀薄尘埃'],
    gaia: ['氮气/氧气(完美配比)', '水蒸气循环'],
    gas_giant: ['氢气/氦气', '氢气/氦气(风暴)'],
    ice_giant: ['氢气/氦气/甲烷', '氦气/氨冰云']
  };

  function typeByTemp(T, rng) {
    // 特殊类型掷骰
    const r = rng.next();
    if (r < 0.012) return 'gaia';
    if (r < 0.022) return 'tomb';
    if (r < 0.032) return 'machine';
    if (r < 0.042) return 'hive';
    if (r < 0.054) return 'toxic';
    if (r < 0.068) return 'shattered';
    if (T > 1500) return 'lava';
    if (T > 700) return 'barren';
    if (T > 430) return rng.chance(0.6) ? 'desert' : 'arid';
    if (T > 330) return rng.chance(0.4) ? 'continental' : (rng.chance(0.5) ? 'ocean' : 'arid');
    if (T > 250) return rng.chance(0.35) ? 'tundra' : (rng.chance(0.55) ? 'continental' : 'ocean');
    if (T > 170) return 'tundra';
    return 'ice';
  }

  function makePlanet(rng, opts) {
    const { star, orbitRadius, isGas, name, idx, isMoon } = opts;
    const T = isGas ? null : Math.round(278 * Math.sqrt(star.lum / Math.max(0.004, Math.pow(orbitRadius / AU, 2))));
    const type = isGas ? (rng.chance(0.65) ? 'gas_giant' : 'ice_giant') : typeByTemp(T || 0, rng);
    const spec = TYPES[type];
    let radius, mass;
    if (isGas) {
      radius = rng.range(type === 'gas_giant' ? 95 : 70, type === 'gas_giant' ? 175 : 120);
      mass = radius * radius * 0.06;
    } else {
      radius = rng.range(22, 62);
      mass = Math.pow(radius / 30, 3);
    }
    const gravity = mass / Math.max(0.25, Math.pow(radius / 30, 2));

    const p = {
      id: 'p-' + (rng.next() * 0xffffffff).toString(16),
      name, idx, type, cn: spec.cn, tag: spec.tag,
      isGas: !!isGas, isMoon: !!isMoon,
      orbitRadius, orbitAngle: rng.next() * M.TAU,
      orbitSpeed: isMoon ? 0.5 : 0.16 / Math.sqrt(orbitRadius / 800) * (rng.chance(0.5) ? 1 : -1),
      radius, mass: Math.round(mass * 10) / 10, gravity: Math.round(gravity * 100) / 100,
      temp: T, tempC: T ? Math.round(T - 273) : null,
      atmosphere: rng.pick(ATMOSPHERE[type] || ['未知']),
      habitability: spec.habit,
      seed: (rng.next() * 0xffffffff) >>> 0,
      moons: [], ring: null,
      resources: {
        minerals: type === 'lava' || type === 'barren' ? rng.int(3, 8) : rng.int(1, 6),
        energy: type === 'desert' || type === 'gas_giant' ? rng.int(2, 6) : rng.int(0, 4),
        science: rng.int(1, 6),
        rare: type === 'toxic' || type === 'tomb' || type === 'gaia' || type === 'hive' || type === 'machine' ? rng.int(1, 4) : (rng.chance(0.25) ? rng.int(1, 2) : 0)
      },
      dayLength: rng.range(8, 72),
      surveyed: false,
      anomaly: null,
      trait: ''
    };
    // 独特地貌
    const traits = {
      lava: ['熔岩海', '活火山链', '黑曜石高原'],
      barren: ['陨石坑群', '赤色裂谷', '盐漠'],
      desert: ['移动沙丘', '干涸河床', '风蚀石林'],
      arid: ['稀树草原', '峡谷网络', '咸水湖'],
      continental: ['大陆板块', '山脉链', '季风区'],
      ocean: ['深海海沟', '环礁群岛', '永昼风暴'],
      tundra: ['冻土苔原', '针叶林带', '冰湖'],
      ice: ['冰壳裂缝', '甲烷雪原', '极光带'],
      toxic: ['酸雨云', '毒雾海', '腐蚀岩'],
      tomb: ['核爆废墟', '辐射灰原', '失落城市遗址'],
      machine: ['金属城市', '数据塔', '纳米地表'],
      hive: ['有机菌毯', '孢囊塔', '甲壳平原'],
      shattered: ['断裂地壳', '漂浮岩块', '熔核外露'],
      gaia: ['翠绿雨林', '镜湖', '百花平原'],
      gas_giant: ['大红斑', '风暴带', '氨云海'],
      ice_giant: ['钻石雨区', '超离子海', '甲烷环流']
    };
    p.trait = rng.pick(traits[type] || []);
    p.desc = makeDesc(rng, p);

    // 环
    if (p.isGas ? rng.chance(0.35) : rng.chance(0.1)) {
      p.ring = { inner: p.radius * 1.5, outer: p.radius * (2.1 + rng.next() * 0.9), color: rng.pick(['#b8a888', '#9aacc8', '#c8b8d8', '#d8c8a8']) };
    }
    // 卫星
    if (p.isGas || p.radius > 48) {
      const moonN = p.isGas ? rng.int(1, 4) : rng.int(1, 2);
      for (let m = 0; m < moonN; m++) {
        const mr = p.radius * (1.9 + m * 0.5 + rng.next() * 0.3);
        p.moons.push(makePlanet(rng, {
          star, orbitRadius: mr, isGas: false, isMoon: true,
          name: S.Names.moon(rng, name, m), idx: m
        }));
        if (p.moons[p.moons.length - 1].radius > p.radius * 0.45) p.moons[p.moons.length - 1].radius *= 0.6;
      }
    }
    // 异常
    if (!isMoon && rng.chance(0.24)) p.anomaly = makeAnomaly(rng);
    return p;
  }

  function makeDesc(rng, p) {
    const bits = [];
    bits.push(p.cn);
    if (p.temp != null) {
      if (p.temp > 700) bits.push('表面灼热，熔流纵横');
      else if (p.temp > 400) bits.push('高温炙烤，大气稀薄');
      else if (p.temp > 300) bits.push('温暖湿润，生机盎然');
      else if (p.temp > 200) bits.push('气候寒凉，四季分明');
      else bits.push('冰天雪地，凛冽严寒');
    }
    if (p.trait) bits.push('地貌：' + p.trait);
    if (p.atmosphere && p.atmosphere !== '无大气') bits.push('大气成分以' + p.atmosphere + '为主');
    return bits.join('，') + '。';
  }

  function makeAnomaly(rng) {
    const pool = [
      { title: '远古文明遗迹', desc: '探测器捕捉到地表下方规则的几何结构，疑似某个早已消亡文明的都城遗址。', a: { label: '派遣考古挖掘（+科研）', sci: [40, 90], credit: [0, 0] }, b: { label: '保持距离，记录坐标（少量科研）', sci: [10, 25] } },
      { title: '轨道残骸群', desc: '环绕行星的轨道上漂浮着成百上千的舰船残骸，似乎曾发生过一场大战。', a: { label: '打捞残骸（+合金）', alloy: [30, 80], credit: [0, 0] }, b: { label: '扫描战场数据（+科研）', sci: [30, 70] } },
      { title: '未知信号源', desc: '行星同步轨道上有一枚来历不明的信标，以恒定的频率重复着一段加密信号。', a: { label: '破译信号（+科研）', sci: [50, 110], credit: [0, 0] }, b: { label: '拆解信标（+稀有晶体）', crystal: [2, 5], alloy: [10, 30] } },
      { title: '量子裂隙', desc: '行星上空悬着一道肉眼可见的时空裂缝，量子探测器读数完全失控。', a: { label: '采集裂隙能量（+科研）', sci: [60, 140], credit: [0, 0] }, b: { label: '投放能量提取器（+能量币）', credit: [200, 600] } },
      { title: '虫群孢囊', desc: '地表覆盖着脉动的有机孢囊，生物信号微弱但持续。', a: { label: '采集样本（+科研）', sci: [45, 100], credit: [0, 0] }, b: { label: '焚烧清理（+安全，小奖励）', credit: [100, 300] } },
      { title: '遗落方舟', desc: '一艘体积堪比小行星的古老方舟搁浅在行星表面，船体铭刻着未知文字。', a: { label: '进入方舟探索（高风险高回报）', sci: [80, 180], alloy: [40, 120] }, b: { label: '外部扫描（稳妥）', sci: [30, 60] } },
      { title: '海盗藏宝库', desc: '行星背阳面一处伪装陨石坑内，扫描发现堆叠的货箱与加密账本。', a: { label: '搬走货物（+信用点）', credit: [400, 1200] }, b: { label: '寻找失主线索（+合金+信用）', credit: [200, 500], alloy: [20, 60] } }
    ];
    const t = rng.pick(pool);
    return { title: t.title, desc: t.desc, a: t.a, b: t.b, done: false };
  }

  function generate(galaxySys, rng) {
    const star = galaxySys.star;
    const scale = star.spec === 'M' ? 0.82 : (star.spec === 'O' || star.spec === 'B' || star.spec === 'RG') ? 1.35 : 1.0;
    const orbitBase = [620, 1080, 1620, 2340, 3280, 4480, 6000, 7900].map(r => r * scale);
    const count = rng.int(3, 8);
    const planets = [];
    let beltGap = rng.int(0, count - 2);

    for (let i = 0; i < count; i++) {
      const orbitRadius = orbitBase[i] * rng.range(0.82, 1.18);
      const T = 278 * Math.sqrt(star.lum / Math.max(0.004, Math.pow(orbitRadius / AU, 2)));
      // 巨行星带（外轨道更容易出现气态巨星）
      const gasChance = i >= 2 && (T < 400 || i >= count - 2) ? 0.38 : 0.05;
      const isGas = rng.chance(gasChance);
      planets.push(makePlanet(rng, {
        star, orbitRadius, isGas,
        name: S.Names.planet(rng, galaxySys.name, i, isGas),
        idx: i
      }));
    }

    // 小行星带（挑选一个轨道间隙）
    let belt = null;
    const gi = Math.min(beltGap, planets.length - 2);
    if (gi >= 0 && planets.length > 2) {
      const r1 = planets[gi].orbitRadius, r2 = planets[gi + 1].orbitRadius;
      const mid = (r1 + r2) / 2, half = (r2 - r1) * 0.32;
      const rocks = [];
      const rockN = rng.int(40, 90);
      for (let i = 0; i < rockN; i++) {
        rocks.push({
          angle: rng.next() * M.TAU,
          radius: mid + rng.range(-half, half),
          size: rng.range(3, 9),
          ore: rng.range(20, 70),
          rare: rng.chance(0.06),
          spin: rng.range(-0.6, 0.6),
          seed: (rng.next() * 0xffffffff) >>> 0
        });
      }
      belt = { inner: mid - half, outer: mid + half, rocks };
    }

    // 空间站
    const stationNames = ['贸易港', '补给站', '前哨站', '修理坞', '枢纽站'];
    const station = {
      name: galaxySys.isHome ? '家园空间站' : galaxySys.name + rng.pick(stationNames),
      angle: rng.next() * M.TAU,
      orbitRadius: Math.max(330, orbitBase[0] * 0.55),
      orbitSpeed: 0.22,
      docked: false
    };

    // 系统边界（跃迁点）
    const outerRadius = planets.length ? planets[planets.length - 1].orbitRadius * 1.25 + 400 : orbitBase[count - 1];

    return {
      star, planets, belt, station, outerRadius,
      id: galaxySys.id, name: galaxySys.name, isHome: galaxySys.isHome,
      danger: galaxySys.danger
    };
  }

  S.SystemGen = { generate, TYPES, AU };
})(typeof window !== 'undefined' ? window : globalThis);
