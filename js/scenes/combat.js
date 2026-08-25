/* 星海远航 · 战斗系统：开火/弹道/伤害管线/海盗AI（独立于场景） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;

  const PROJ_COLOR = { kinetic: '#ffd9a0', energy: '#7fd8ff', missile: '#ff9a5a', pd: '#c8ffc8' };
  const PROJ_SIZE = { kinetic: 2.4, energy: 2.6, missile: 4.2, pd: 1.6 };

  /** 开火：遍历舰船所有武器，对目标自动射击 */
  function fireShipWeapons(ship, dt, target, ctx) {
    if (!ship || !target || ship.hp.hull <= 0) return;
    for (const w of ship.weapons) {
      w.cd -= dt * (ship.stats.fireMult || 1);
      if (w.cd > 0) continue;
      const d = M.dist(ship.x, ship.y, target.x, target.y);
      if (d > w.range * 0.96) continue;

      let aimTarget = target;
      let kind = w.kind;
      if (w.kind === 'pd') {
        // 优先拦截来袭导弹
        const missile = ctx.projectiles.find(p => p.kind === 'missile' && p.owner !== ship && M.dist2(p.x, p.y, ship.x, ship.y) < w.range * w.range);
        if (missile) { kind = 'pd'; spawnProjectile(ship, w, missile, ctx, true, ship.stats); w.cd = w.baseCd ?? w.cd; continue; }
        if (d > w.range * 0.8) continue;
      }
      spawnProjectile(ship, w, aimTarget, ctx, false, ship.stats);
      w.cd = w.baseCd ?? w.cd;
    }
  }

  function spawnProjectile(ship, w, target, ctx, isIntercept, stats) {
    // 目标位置预测
    let tx = target.x, ty = target.y;
    if (target.vx != null && !isIntercept && w.projSpeed > 0) {
      const d = M.dist(ship.x, ship.y, target.x, target.y);
      const t = d / w.projSpeed;
      tx = target.x + target.vx * t;
      ty = target.y + target.vy * t;
    }
    let aim = Math.atan2(ty - ship.y, tx - ship.x);
    if (!isIntercept) {
      const acc = stats.accuracy || 0.7;
      aim += (Math.random() - 0.5) * Math.max(0.02, (1 - acc) * 0.55);
    }
    const speed = w.projSpeed * (0.92 + Math.random() * 0.16);
    ctx.projectiles.push({
      x: ship.x + Math.cos(ship.angle) * 14,
      y: ship.y + Math.sin(ship.angle) * 14,
      vx: Math.cos(aim) * speed + (ship.vx || 0) * 0.4,
      vy: Math.sin(aim) * speed + (ship.vy || 0) * 0.4,
      dmg: w.dmg, kind: w.kind, size: PROJ_SIZE[w.kind] || 2,
      color: PROJ_COLOR[w.kind] || '#fff',
      shieldMult: w.shieldMult, armorMult: w.armorMult, hullMult: w.hullMult,
      owner: ship, ttl: w.range / speed * 1.15 + 1.2,
      homing: w.homing && !isIntercept ? target : null,
      homingRate: 2.0 + (w.tracking || 0) * 2,
      speed, tracking: w.tracking || 0
    });
    // 音效
    const A = S.Audio;
    if (w.kind === 'kinetic') A.kinetic();
    else if (w.kind === 'energy') A.laser();
    else if (w.kind === 'missile') A.missile();
    else if (w.kind === 'pd') { /* 点防轻响 */ }
  }

  /** 弹道推进 + 碰撞（飞船/小行星/拦截） */
  function stepProjectiles(projectiles, ships, rocks, dt, fx, onHit) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.ttl -= dt;
      if (p.ttl <= 0) { projectiles.splice(i, 1); continue; }
      if (p.homing && (!p.homing.hp || p.homing.hp.hull <= 0)) p.homing = null;
      if (p.homing) {
        const t = p.homing;
        const desired = Math.atan2(t.y - p.y, t.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        const a = M.turnToward(cur, desired, p.homingRate * dt);
        p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed;
      }
      const px0 = p.x, py0 = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;

      // 撞击飞船（线段-圆检测，防止高速穿透）
      let hit = false;
      for (const ship of ships) {
        if (!ship || ship === p.owner || ship.hp.hull <= 0) continue;
        const r = (S.ShipArt ? S.ShipArt.radiusFor(ship.hullId) : 16) + p.size + 3;
        if (segHit(px0, py0, p.x, p.y, ship.x, ship.y, r)) {
          const res = applyDamage(ship, p.dmg, p, fx);
          if (onHit) onHit(ship, p, res);
          hit = true;
          break;
        }
      }
      // 撞击小行星
      if (!hit && rocks) {
        for (const rk of rocks) {
          if (rk.ore <= 0) continue;
          const rr = rk.size + p.size;
          if (segHit(px0, py0, p.x, p.y, rk.x, rk.y, rr)) {
            rk.ore -= p.dmg * 0.8;
            fx.burst(p.x, p.y, 3, { speed: 50, ttl: 0.3, size: 1.2, color: '#b8a888', kind: 'spark' });
            if (rk.ore <= 0) rk.ore = 0;
            hit = true;
            break;
          }
        }
      }
      if (hit) projectiles.splice(i, 1);
    }
  }

  /** 伤害管线：护盾→装甲→船体，返回伤害明细 */
  function applyDamage(ship, dmg, src, fx) {
    const res = { shieldDmg: 0, armorDmg: 0, hullDmg: 0, killed: false, missed: false };
    if (ship.hp.hull <= 0) return res;
    // 闪避（追踪抵消）
    const ev = Math.max(0, (ship.stats.evasion || 0) - (src.tracking || 0));
    if (ev > 0 && Math.random() < ev) { res.missed = true; return res; }

    if (ship.hp.shield > 0) {
      const d = Math.min(ship.hp.shield, dmg * (src.shieldMult || 1));
      ship.hp.shield -= d;
      res.shieldDmg = d;
      dmg -= d / (src.shieldMult || 1);
    }
    if (dmg > 0 && ship.hp.armor > 0) {
      const d = Math.min(ship.hp.armor, dmg * (src.armorMult || 1));
      ship.hp.armor -= d;
      res.armorDmg = d;
      dmg -= d / (src.armorMult || 1);
    }
    if (dmg > 0 && ship.hp.hull > 0) {
      const d = Math.min(ship.hp.hull, dmg * (src.hullMult || 1));
      ship.hp.hull -= d;
      res.hullDmg = d;
    }
    ship.shieldCd = 0;
    if (ship.hp.hull <= 0) res.killed = true;
    return res;
  }

  /** 护盾再生 */
  /** 线段(px0,py0)→(x,y)与圆心(cx,cy)半径r是否相交 */
  function segHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t, py = y1 + dy * t;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy) < r * r;
  }

  function regenShield(ship, dt) {
    ship.shieldCd += dt;
    if (ship.shieldCd > 4 && ship.stats.shieldRegen > 0 && ship.hp.shield < ship.stats.shield) {
      ship.hp.shield = Math.min(ship.stats.shield, ship.hp.shield + ship.stats.shieldRegen * dt);
    }
  }

  /** 生成海盗舰队 */
  function spawnPirates(system, galaxySys, player, techCap) {
    const list = [];
    if (!galaxySys || galaxySys.danger <= 0) return list;
    const pt = Math.max(1, Math.min(5, techCap || 1));
    // 数量随危险度与玩家科技提升（后期舰队更庞大）
    const n = Math.min(5, (galaxySys.danger > 0.6 ? 3 : (galaxySys.danger > 0.3 ? 2 : 1)) + (pt >= 4 ? 1 : 0));
    const rng = new S.Rand((galaxySys.seed ^ 0x5f3759df) >>> 0);
    const faction = S.Names.pirateFaction(rng);
    // 等级随星系危险度与玩家科技共同成长：玩家到 IV 级时海盗不掉队
    const tier = Math.min(4, Math.max(1 + Math.floor(galaxySys.danger * 2.5), pt - 1));
    for (let i = 0; i < n; i++) {
      const ship = makePirate(rng, faction, tier);
      // 出生在带内或外环
      const belt = system.belt;
      if (belt && i % 2 === 0) {
        const a = rng.next() * M.TAU, r = rng.range(belt.inner, belt.outer);
        ship.x = Math.cos(a) * r; ship.y = Math.sin(a) * r;
      } else {
        const a = rng.next() * M.TAU;
        const r = system.outerRadius * rng.range(0.55, 0.75);
        ship.x = Math.cos(a) * r; ship.y = Math.sin(a) * r;
      }
      ship.angle = rng.next() * M.TAU;
      ship.ai = { state: 'patrol', strafe: rng.chance(0.5) ? 1 : -1, wander: rng.next() * M.TAU, faction };
      list.push(ship);
    }
    return list;
  }

  function makePirate(rng, faction, tier) {
    const t = Math.min(4, Math.max(1, tier));
    // IV 级海盗升级为驱逐舰舰体
    const hullId = t >= 4 ? 'destroyer' : 'corvette';
    const comps = ['rea' + (t >= 4 ? 5 : t), 'thr' + t, 'cpu' + t, 'sen' + t, 'hyp' + t];
    const kin = 'kin_s' + t;
    if (hullId === 'corvette') comps.push(kin, kin); else comps.push(kin);
    comps.push('pd_s' + t);
    comps.push('shd' + Math.min(t, 3), 'arm' + Math.min(t, 3));
    if (t >= 3) comps.push('mis_m' + Math.min(t, 5));
    if (t >= 4) { comps.push('ene_m4', 'aux4'); }
    const design = { id: 'pirate', name: faction, hullId, comps };
    const ship = S.makeShip(design, S.Names.ship(rng));
    ship.isPirate = true;
    ship.faction = faction;
    ship.bounty = Math.round(60 + t * 110 + rng.range(0, 80));
    return ship;
  }

  /** 海盗AI */
  function pirateAI(ship, dt, ctx) {
    const { player, projectiles } = ctx;
    ship.ai.think -= dt;
    const t = player && player.hp.hull > 0 ? player : null;
    const d = t ? M.dist(ship.x, ship.y, t.x, t.y) : 1e9;

    // 状态切换
    if (ship.ai.state === 'patrol') {
      if (t && d < 1300) ship.ai.state = 'hunt';
    }
    if (ship.ai.state === 'hunt') {
      if (!t || d > 1900) ship.ai.state = 'patrol';
      else if (d < 620) ship.ai.state = 'attack';
    }
    if (ship.ai.state === 'attack') {
      if (!t || d > 900) ship.ai.state = 'hunt';
      if (ship.hp.hull < ship.stats.hull * 0.3) ship.ai.state = 'flee';
    }
    if (ship.ai.state === 'flee' && ship.hp.shield > ship.stats.shield * 0.5 && d > 900) ship.ai.state = 'hunt';

    const spd = ship.stats.speed;
    let thrust = 0, turnTarget = ship.angle;
    const ta = t ? Math.atan2(t.y - ship.y, t.x - ship.x) : 0;

    if (ship.ai.state === 'patrol') {
      ship.ai.wander += dt * 0.4;
      turnTarget = ship.ai.wander;
      thrust = 0.45;
    } else if (ship.ai.state === 'hunt') {
      turnTarget = ta;
      thrust = 1;
    } else if (ship.ai.state === 'attack') {
      // 环绕射击
      const orbitDir = ship.ai.strafe;
      const desired = ta + orbitDir * (Math.PI / 2 - Math.min(Math.PI / 2 - 0.5, Math.max(0, (d - 240) / 400) * 1.1));
      turnTarget = desired;
      thrust = d > 460 ? 0.9 : (d < 260 ? -0.5 : 0.3);
      fireShipWeapons(ship, dt, t, ctx);
    } else if (ship.ai.state === 'flee') {
      turnTarget = ta + Math.PI;
      thrust = 1;
    }

    // 简易机动物理（与玩家相同的牛顿模型 + 阻尼）
    const turnRate = ship.stats.turn;
    ship.angle = M.turnToward(ship.angle, turnTarget, turnRate * dt);
    const accel = spd * 1.9;
    if (thrust > 0) {
      ship.vx += Math.cos(ship.angle) * accel * thrust * dt;
      ship.vy += Math.sin(ship.angle) * accel * thrust * dt;
    }
    const damp = Math.exp(-1.4 * dt);
    ship.vx *= damp; ship.vy *= damp;
    const maxSpd = spd * 1.15;
    const vl = M.len(ship.vx, ship.vy);
    if (vl > maxSpd) { ship.vx *= maxSpd / vl; ship.vy *= maxSpd / vl; }
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    ship.thrustVis = Math.max(0, thrust);

    // 海盗也拦截来袭导弹
    for (const w of ship.weapons) {
      if (w.kind !== 'pd') continue;
      w.cd -= dt * (ship.stats.fireMult || 1);
      if (w.cd > 0) continue;
      const m = projectiles.find(p => p.kind === 'missile' && p.owner !== ship && M.dist2(p.x, p.y, ship.x, ship.y) < w.range * w.range);
      if (m) { spawnProjectile(ship, w, m, ctx, true, ship.stats); w.cd = w.baseCd ?? w.cd; }
    }
    regenShield(ship, dt);
  }

  S.Combat = { fireShipWeapons, stepProjectiles, applyDamage, regenShield, spawnPirates, pirateAI, makePirate, PROJ_COLOR };
})(typeof window !== 'undefined' ? window : globalThis);