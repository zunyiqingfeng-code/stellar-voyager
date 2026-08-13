/* 星海远航 · 无头冒烟测试：在 Node 中验证数据/世界生成/装配/战斗管线 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'js');
const load = (f) => { vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8')); };
load('core/rand.js'); load('core/math.js');
load('data/names.js'); load('data/components.js'); load('data/ships.js');
load('world/galaxy.js'); load('world/system.js');
load('scenes/combat.js');
const S = globalThis.STARFALL;
let fails = 0;
const assert = (cond, msg) => { if (!cond) { fails++; console.error('FAIL:', msg); } else console.log('PASS:', msg); };

// 1. 银河生成
const g = S.GalaxyGen.generate(20240721, 118);
assert(g.systems.length >= 118, '银河星系数量 >= 118 (' + g.systems.length + ')');
const vis = new Set([0]); const q = [0];
while (q.length) { const i = q.shift(); for (const j of g.systems[i].links) if (!vis.has(j)) { vis.add(j); q.push(j); } }
assert(vis.size === g.systems.length, '超空间航道全网连通 (' + vis.size + '/' + g.systems.length + ')');
assert(!!g.home, '存在母星系');
const deg = g.systems.map(s => s.links.length);
assert(Math.max(...deg) <= 6, '航道度数上限 6（枢纽星系合理） (' + Math.max(...deg) + ')');
const names = new Set(g.systems.map(s => s.name));
assert(names.size >= g.systems.length * 0.75, '星系命名多样性 (' + names.size + ' 唯一 / ' + g.systems.length + ')');
// 光谱覆盖
const specs = new Set(g.systems.map(s => s.star.spec));
assert(specs.size >= 6, '光谱型多样性 (' + specs.size + ' 种)');

// 2. 恒星系生成
for (const sys of g.systems.slice(0, 25)) {
  const rng = new S.Rand(sys.seed);
  const so = S.SystemGen.generate(sys, rng);
  assert(so.planets.length >= 3, sys.name + ' 行星数 >= 3 (' + so.planets.length + ')');
  for (const p of so.planets) {
    assert(!!(p.name && p.cn), p.name + ' 名称类型完整');
    assert(p.orbitRadius > 200, p.name + ' 轨道半径合理');
    assert(p.radius > 0 && p.mass > 0, p.name + ' 半径质量合法');
    assert(!!p.atmosphere && p.atmosphere.length > 0, p.name + ' 大气数据: ' + p.atmosphere);
    if (p.isGas) assert(p.moons.length >= 1, p.name + ' 气态巨星有卫星 (' + p.moons.length + ')');
    if (p.ring) assert(p.ring.outer > p.ring.inner, p.name + ' 环带尺寸合法');
  }
}
const home = S.SystemGen.generate(g.home, new S.Rand(g.home.seed));
assert(!!(home.station && home.station.name), '空间站存在: ' + home.station.name);
assert(home.outerRadius > 3000, '系统边界合理 (' + home.outerRadius + ')');
const gas = home.planets.filter(p => p.isGas);
console.log('INFO: 母星系 ' + home.planets.length + ' 行星, 气态巨星 ' + gas.length + ', 卫星总数 ' + home.planets.reduce((a, p) => a + p.moons.length, 0) + ', 异常 ' + home.planets.filter(p => p.anomaly).length + ', 带 ' + (home.belt ? home.belt.rocks.length + ' 岩' : '无'));

// 3. 部件库
const C = S.Components;
assert(C.list.length >= 80, '部件数量 (' + C.list.length + ')');
for (const c of C.list) {
  assert(c.id && c.name && c.tier >= 1 && c.tier <= 5, '部件 ' + c.id + ' 字段完整');
  assert(c.cost.credits > 0, '部件 ' + c.id + ' 造价合法');
  assert(c.stats.power >= 0, '部件 ' + c.id + ' 电力合法');
}
assert(C.forSlot('wpn', 'S', 1).length >= 4, '一级S武器可选 >= 4 (' + C.forSlot('wpn', 'S', 1).length + ')');
assert(C.forSlot('wpn', 'L', 5).length >= 3, '五级L武器可选 >= 3');
assert(C.techLevelFor(0) === 1 && C.techLevelFor(300) === 2 && C.techLevelFor(3000) === 4 && C.techLevelFor(99999) === 5, '科技等级阈值正确');

// 4. 舰船装配
const Ships = S.Ships;
const corv = Ships.byId.corvette;
const v1 = Ships.validate(corv, ['rea1','thr1','cpu1','sen1','kin_s1','kin_s1','pd_s1','shd1','shd1','arm1','aux4'], 1);
assert(v1.ok, '默认护卫舰装配合法: ' + v1.msg);
assert(v1.stats.weapons.length === 3, '武器数=3 (' + v1.stats.weapons.length + ')');
assert(v1.stats.powerSupply >= v1.stats.powerUse, '电力充足 ' + v1.stats.powerUse + '/' + v1.stats.powerSupply);
assert(v1.stats.speed === 358, '护卫舰航速 358（含加力器） (' + v1.stats.speed + ')');
assert(v1.stats.hull === 220, '护卫舰船体 220 (' + v1.stats.hull + ')');
const v2 = Ships.validate(corv, ['rea1','thr1','cpu1','sen1','kin_l5','kin_l5'], 1);
assert(!v2.ok, 'L武器装不进护卫舰被拒绝');
const v3 = Ships.validate(corv, ['rea1','thr1','cpu1','sen1','shd5','shd5','shd5','shd5','shd5','shd5'], 5);
assert(!v3.ok, '电力超载被拒绝');
const bs = Ships.byId.battleship;
const v4 = Ships.validate(bs, ['rea5','thr5','hyp5','cpu5','sen5','kin_l5','kin_l5','mis_m5','mis_m5','pd_s5','pd_s5','shd5','shd5','arm5','arm5','aux1','aux2','aux3','aux4'], 5);
assert(v4.ok, '五级战列舰装配合法: ' + v4.msg);
assert(v4.stats.hull >= 1900, '战列舰船体 >= 1900 (' + v4.stats.hull + ')');
assert(v4.stats.jumpRange === 5, '跃迁距离 5 (' + v4.stats.jumpRange + ')');
assert(v4.stats.powerUse <= v4.stats.powerSupply, '战列舰电力平衡 ' + v4.stats.powerUse + '/' + v4.stats.powerSupply);
assert(v4.stats.shieldRegen > 15, '护盾再生强化生效 (' + v4.stats.shieldRegen.toFixed(1) + ')');

// 5. 伤害管线
const mk = (comps) => {
  const stats = Ships.buildStats(Ships.byId.corvette, comps);
  return { name: '测试舰', hullId: 'corvette', comps, stats,
    hp: { hull: stats.hull, armor: stats.armor, shield: stats.shield }, shieldCd: 0,
    weapons: stats.weapons.map(w => ({ ...w, baseCd: w.cd, cd: 0 })), x: 0, y: 0, angle: 0, vx: 0, vy: 0 };
};
const def = ['rea1','thr1','cpu1','sen1','kin_s1','kin_s1','pd_s1','shd1','shd1','arm1','aux4'];
const noEva = (ship) => { ship.stats = { ...ship.stats, evasion: 0 }; return ship; };
const a = mk(def);

// 中性伤害守恒
const b1 = noEva(mk(def));
const before1 = b1.hp.hull + b1.hp.armor + b1.hp.shield;
const res1 = S.Combat.applyDamage(b1, 60, { shieldMult: 1, armorMult: 1, hullMult: 1, tracking: 0 }, { spawn(){}, burst(){} });
const total1 = res1.shieldDmg + res1.armorDmg + res1.hullDmg;
assert(Math.abs(before1 - (b1.hp.hull + b1.hp.armor + b1.hp.shield) - total1) < 0.01, '中性伤害守恒 (' + total1.toFixed(1) + ')');
assert(res1.shieldDmg > 0, '先破盾 (' + res1.shieldDmg.toFixed(1) + ')');

// 动能对护盾加成
const b2 = noEva(mk(def));
const res2 = S.Combat.applyDamage(b2, 100, { shieldMult: 1.25, armorMult: 0.75, hullMult: 1, tracking: 0 }, {});
assert(res2.shieldDmg > 100, '动能克制护盾 (' + res2.shieldDmg.toFixed(1) + ')');
const b3 = noEva(mk(def));
const res3 = S.Combat.applyDamage(b3, 100, { shieldMult: 0.5, armorMult: 1.5, hullMult: 1, tracking: 0 }, {});
assert(res3.shieldDmg < 100, '能量被护盾削减 (' + res3.shieldDmg.toFixed(1) + ')');

// 击杀
const b4 = noEva(mk(def));
b4.hp.hull = 1; b4.hp.shield = 0; b4.hp.armor = 0;
const r2 = S.Combat.applyDamage(b4, 50, { shieldMult: 1, armorMult: 1, hullMult: 1, tracking: 0 }, {});
assert(r2.killed, '低血量被击杀');
// 护盾再生
a.shieldCd = 10; a.hp.shield = 1;
S.Combat.regenShield(a, 2);
assert(a.hp.shield > 1, '护盾再生工作 (' + a.hp.shield.toFixed(1) + ')');
// 闪避
const eva = { ...a, stats: { ...a.stats, evasion: 0.99 } };
let missed = 0;
for (let i = 0; i < 50; i++) { const r3 = S.Combat.applyDamage(eva, 10, { shieldMult: 1, armorMult: 1, hullMult: 1, tracking: 0 }, {}); if (r3.missed) missed++; }
assert(missed > 35, '高闪避触发躲避 (' + missed + '/50)');

// 弹道碰撞
const b5 = noEva(mk(def));
const ships = [a, b5];
const projs = [{ x: b5.x, y: b5.y + 100, vx: 0, vy: -600, dmg: 20, kind: 'kinetic', size: 2, color: '#fff', shieldMult: 1, armorMult: 1, hullMult: 1, owner: a, ttl: 5, homing: null, speed: 600, tracking: 0 }];
const hpBefore = b5.hp.hull + b5.hp.armor + b5.hp.shield;
S.Combat.stepProjectiles(projs, ships, [], 0.2, { spawn(){}, burst(){} }, (ship, p, res) => {});
assert(projs.length === 0, '弹道命中后移除');
assert(b5.hp.hull + b5.hp.armor + b5.hp.shield < hpBefore, '弹道造成伤害');

console.log('---');
console.log(fails === 0 ? '✔ 全部冒烟测试通过' : '✖ ' + fails + ' 项失败');
process.exit(fails === 0 ? 0 : 1);