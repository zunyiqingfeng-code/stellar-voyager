/* 星海远航 · 飞行场景：牛顿式飞行/扫描/采矿/对接/战斗/HUD */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;
  const UI = S.UI;

  class FlightScene {
    create(engine, params) {
      this.engine = engine;
      this.params = params || {};
      this.p = S.G.player;
      this.ship = this.p.ship;
      const sys = this.sys = S.getSystem(this.p.sysId) || S.getSystem(S.G.galaxy.home.id);
      this.gsys = S.G.galaxy.systems.find(s => s.id === sys.id);

      this.t = 0;
      this.fx = new S.FxPool();
      this.projectiles = [];
      this.pickups = [];
      this.dmgTexts = [];
      this.target = null;
      this.scan = null;
      this.mining = null;
      this.warp = { charge: 0, active: false, played: false };
      this.cruise = false;
      this.paused = false;
      this.docked = false;
      this.respawnT = 0;
      this.shieldHitT = 0;
      this.showOrbits = false;
      this.autosaveT = 0;
      this.hudTick = 0;
      this.lmbT = 0; this.wasLmb = false;
      this.dead = false;
      this.introQueue = [];

      // 飞船初始位置
      if (this.params.fromJump) {
        const a = this.p.pos.angle0 || 0;
        this.ship.x = Math.cos(a) * (sys.outerRadius * 0.92);
        this.ship.y = Math.sin(a) * (sys.outerRadius * 0.92);
        this.ship.angle = a + Math.PI;
        this.ship.vx = 0; this.ship.vy = 0;
      } else {
        this.ship.x = this.p.pos.x; this.ship.y = this.p.pos.y;
        this.ship.angle = this.p.angle; this.ship.vx = this.p.vx; this.ship.vy = this.p.vy;
      }

      // 小行星运行时数据
      this.rocks = [];
      if (sys.belt) {
        for (const r of sys.belt.rocks) {
          const rng = new S.Rand(r.seed);
          const pts = [];
          const n = 7 + Math.floor(rng.next() * 4);
          for (let i = 0; i < n; i++) pts.push(rng.range(0.7, 1.3));
          this.rocks.push({ ...r, x: Math.cos(r.angle) * r.radius, y: Math.sin(r.angle) * r.radius,
            w: 0.02 * (rng.chance(0.5) ? 1 : -1), maxOre: r.ore, pts, rot: rng.next() * M.TAU, rotV: r.spin });
        }
      }

      // 海盗
      this.pirates = S.Combat.spawnPirates(sys, this.gsys, this.ship, this.p.techLevel);
      if (this.pirates.length) UI.toast('⚠ 雷达侦测到海盗信号：' + this.pirates[0].faction, 'warn', 4200);

      // 相机
      const c = engine.cam;
      c.x = this.ship.x; c.y = this.ship.y; c.zoom = this.params.fromJump ? 0.42 : 1.1;
      this.zoomT = c.zoom;

      this.starfield = new S.Starfield((S.G.seed ^ (this.gsys.idx * 65537)) >>> 0);

      this.buildHUD();
      this.showHUD(true);
      S.Audio.unlock();
      S.Audio.setEngineLevel(0);

      if (!this.p.flags) this.p.flags = {};
      if (!this.p.flags.seenIntro) {
        this.p.flags.seenIntro = true;
        this.introQueue = [
          ['欢迎来到「' + sys.name + '」星系，指挥官。', 'info', 5200],
          ['W/↑ 推进 · A/D 转向 · T 巡航 · X 曲速', 'info', 5200],
          ['靠近行星按 F 扫描，靠近空间站按 Q 对接', 'info', 5200]
        ];
        this.introT = 0;
      } else if (this.params.fromJump) {
        UI.toast('✦ 跃迁完成，抵达「' + sys.name + '」星系', 'success', 3600);
      }
    }

    // ================= HUD =================
    buildHUD() {
      const sysChip = UI.el('sys-info');
      const star = this.sys.star;
      sysChip.innerHTML = '<b>' + this.sys.name + '</b> 星系　<span class="dim">' + star.spec + ' 型恒星 · ' +
        star.temp.toLocaleString() + ' K · ' + this.sys.planets.length + ' 颗行星</span>';
      this.sysChip = sysChip;
      this.targetChip = UI.el('target-chip');
      this.warningsEl = UI.el('warnings');
      this.missionEl = UI.el('mission-tracker');
      this.speedEl = UI.el('speed-readout');
      this.navHintEl = UI.el('nav-hint');
      this.statsEl = UI.el('ship-stats');
      this.actionsEl = UI.el('hud-actions');
      this.cpEl = UI.el('center-progress');

      UI.clear(this.actionsEl);
      const acts = [
        ['星图', 'M', () => this.goMap()],
        ['舰船设计', 'B', () => this.openDesigner()],
        ['扫描', 'F', () => this.startScan()],
        ['对接', 'Q', () => this.tryDock()],
        ['存档', 'F5', () => { S.saveGame(); UI.toast('✓ 已存档', 'success', 1800); }]
      ];
      this.dockBtn = null;
      for (const [label, key, fn] of acts) {
        const b = document.createElement('button');
        b.className = 'act-btn';
        b.innerHTML = label + '<span class="k">[' + key + ']</span>';
        b.onclick = () => { S.Audio.click(); fn(); };
        this.actionsEl.appendChild(b);
        if (label === '对接') this.dockBtn = b;
      }
      this.renderMissionTracker();
    }

    showHUD(v) {
      ['hud-top', 'hud-left', 'hud-nav', 'hud-bottom', 'hud-actions'].forEach(id => UI.toggle(UI.el(id), v));
      UI.hide(UI.el('center-progress'));
    }

    renderMissionTracker() {
      UI.clear(this.missionEl);
      if (!this.p.missions.length) {
        this.missionEl.innerHTML = '<div class="mission-chip"><span class="dim">暂无任务 —— 去空间站接取</span></div>';
        return;
      }
      for (const m of this.p.missions.slice(0, 4)) {
        const d = document.createElement('div');
        d.className = 'mission-chip' + (m.done ? ' done' : '');
        d.innerHTML = '<div class="m-title">' + (m.done ? '✓ ' : '◇ ') + m.title + '</div><div class="m-prog">' + m.desc + '</div>';
        this.missionEl.appendChild(d);
      }
    }

    updateHUD(dt) {
      this.hudTick -= dt;
      if (this.hudTick > 0) return;
      this.hudTick = 0.14;

      const ship = this.ship, st = ship.stats;
      // 速度
      const v = M.len(ship.vx, ship.vy);
      let mode = this.warp.active ? '<small>曲速飞行</small>' : this.cruise ? '<small>巡航模式</small>' :
        this.p.flags.inertia ? '<small>惯性模式</small>' : '<small>辅助稳定</small>';
      this.speedEl.innerHTML = Math.round(v * 3) + ' <small>km/s</small>　' + mode;
      this.navHintEl.innerHTML = '目标：' + (this.target ? this.target.name : '无') +
        (this.target && this.target.hp ? '　距 ' + Math.round(M.dist(ship.x, ship.y, this.target.x, this.target.y)) + 'm' : '');

      // 状态条
      const hmax = st.hull, amax = st.armor, smax = st.shield;
      const pct = (cur, max) => Math.max(0, Math.min(100, max > 0 ? cur / max * 100 : 0));
      this.statsEl.innerHTML =
        barRow('护盾', pct(ship.hp.shield, smax), 'shield', Math.round(ship.hp.shield) + '/' + Math.round(smax)) +
        barRow('装甲', pct(ship.hp.armor, amax), 'armor', Math.round(ship.hp.armor) + '/' + Math.round(amax)) +
        barRow('船体', pct(ship.hp.hull, hmax), 'hull', Math.round(ship.hp.hull) + '/' + Math.round(hmax)) +
        '<div class="bar-row" style="margin-top:2px"><span class="lbl">货舱</span><div class="bar"><i style="background:linear-gradient(90deg,#8a6a1e,#ffd479);width:' + pct(this.p.cargo.ore + this.p.cargo.rare, st.cargo) + '%"></i></div>' +
        '<span class="val">矿 ' + Math.floor(this.p.cargo.ore) + ' + 晶 ' + this.p.cargo.rare + ' / ' + Math.round(st.cargo) + '</span></div>';

      // 顶部目标
      if (this.target && this.target.hp) {
        const t = this.target;
        this.targetChip.classList.remove('hidden');
        this.targetChip.innerHTML = '<b>' + t.name + '</b> <span class="dim">' + (t.isPirate ? '海盗 · ' + t.faction : '') + '</span><br>' +
          '<span style="color:#5ad8ff">盾 ' + Math.round(t.hp.shield) + '</span> / ' +
          '<span style="color:#c8d7e8">甲 ' + Math.round(t.hp.armor) + '</span> / ' +
          '<span style="color:#ff8f6b">体 ' + Math.round(t.hp.hull) + '</span>';
      } else this.targetChip.classList.add('hidden');

      // 警告
      UI.clear(this.warningsEl);
      const heat = this.starHeat();
      if (heat > 0) this.addWarn('☀ 恒星高温灼烧船体！', '');
      if (this.combatNearby()) this.addWarn('⚠ 敌舰接近！', '');
      if (this.scan && this.scan.planet) {
        const d = M.dist(ship.x, ship.y, this.scan.planet.wx, this.scan.planet.wy);
        if (d > this.scan.planet.radius + st.scanRange + 40) this.addWarn('扫描目标超出探测距离', '');
      }
      if (this.canDockNow()) this.addWarn('⇪ 空间站对接窗口内 —— 按 Q 对接', 'good');

      // 对接按钮
      if (this.dockBtn) this.dockBtn.disabled = !this.canDockNow();

      // 中心进度
      if (this.scan && this.scan.planet && this.scan.prog > 0 && this.scan.prog < 1) {
        UI.show(this.cpEl);
        this.cpEl.innerHTML = '<div class="cp-label">扫描中：' + this.scan.planet.name + '　' + Math.round(this.scan.prog * 100) + '%</div><div class="cp-bar"><i style="width:' + this.scan.prog * 100 + '%"></i></div>';
      } else if (this.warp.charge > 0 && !this.warp.active) {
        UI.show(this.cpEl);
        this.cpEl.innerHTML = '<div class="cp-label">曲速引擎充能 ' + Math.round(this.warp.charge * 100) + '%</div><div class="cp-bar"><i style="width:' + this.warp.charge * 100 + '%"></i></div>';
      } else UI.hide(this.cpEl);
    }

    addWarn(txt, cls) {
      const d = document.createElement('div');
      d.className = 'warn-item ' + cls;
      d.textContent = txt;
      this.warningsEl.appendChild(d);
    }

    // ================= 更新 =================
    update(dt) {
      this.t += dt;
      if (this.dead) { this.updateDeath(dt); return; }
      if (this.docked || this.paused) return;

      S.G.time += dt;
      this.fx.update(dt);
      this.handleInput(dt);
      this.moveShip(dt);
      this.updateScan(dt);
      this.updateMining(dt);
      this.updateWarp(dt);
      this.updateCombat(dt);
      this.updatePickups(dt);
      this.updateCamera(dt);
      this.updateHUD(dt);
      this.updateIntro(dt);

      // 小行星自转/公转
      for (const r of this.rocks) { r.rot += r.rotV * dt; }

      // 伤害数字
      for (let i = this.dmgTexts.length - 1; i >= 0; i--) {
        const d = this.dmgTexts[i];
        d.ttl -= dt; d.y -= 26 * dt;
        if (d.ttl <= 0) this.dmgTexts.splice(i, 1);
      }

      // 护盾受击特效消退
      this.shieldHitT = Math.max(0, this.shieldHitT - dt);

      // 自动存档
      this.autosaveT += dt;
      if (this.autosaveT > 45) { this.autosaveT = 0; S.saveGame(); }
    }

    updateIntro(dt) {
      if (!this.introQueue.length) return;
      this.introT = (this.introT || 0) - dt;
      if (this.introT <= 0) {
        const [msg, kind, dur] = this.introQueue.shift();
        UI.toast(msg, kind, dur);
        this.introT = 4.5;
      }
    }

    handleInput(dt) {
      const I = S.Input;
      if (I.wasPressed('menu')) { this.pauseMenu(); return; }
      if (I.wasPressed('map')) { this.goMap(); return; }
      if (I.wasPressed('designer')) { this.openDesigner(); return; }
      if (I.wasPressed('dock')) { this.tryDock(); return; }
      if (I.wasPressed('target') || I.wasPressed('tab')) this.cycleTarget();
      if (I.wasPressed('scan')) this.startScan();
      if (I.wasPressed('orbits')) this.showOrbits = !this.showOrbits;
      if (I.wasPressed('inertia')) {
        this.p.flags.inertia = !this.p.flags.inertia;
        UI.toast(this.p.flags.inertia ? '惯性模式：完全牛顿物理' : '辅助稳定：自动阻尼', 'info', 1600);
      }
      if (I.wasPressed('jump')) this.goMap();
      if (I.wasPressed('cruise')) {
        this.cruise = !this.cruise;
        if (this.cruise && this.combatNearby()) { this.cruise = false; UI.toast('敌舰接近，无法进入巡航', 'warn'); }
        else UI.toast(this.cruise ? '巡航模式：航速提升，机动下降' : '退出巡航', 'info', 1400);
      }
      // 鼠标
      if (I.mouse.lmb) {
        this.lmbT += dt;
        if (!this.wasLmb) { this.wasLmb = true; this.lmbT = 0; }
      } else if (this.wasLmb) {
        if (this.lmbT < 0.28) this.clickSelect();
        this.wasLmb = false;
      }
      if (I.mouse.rmb) { this.rmbSelect(); I.mouse.rmb = false; }
    }

    moveShip(dt) {
      const ship = this.ship, st = ship.stats, I = S.Input;
      const thrusting = I.isDown('up');
      const braking = I.isDown('down');
      const boost = I.isDown('boost');

      let maxSpd = st.speed;
      let accel = st.speed * 1.9;
      let turnRate = st.turn;
      if (this.cruise) { maxSpd = st.speed * 4.2; accel = st.speed * 3.4; turnRate *= 0.5; }
      if (this.warp.active) { maxSpd = 15000; accel = 6000; turnRate *= 0.08; }
      if (boost && !this.warp.active) { accel *= 1.6; maxSpd *= 1.25; }

      if (I.isDown('left')) ship.angle -= turnRate * dt;
      if (I.isDown('right')) ship.angle += turnRate * dt;

      let thrust = 0;
      if (thrusting) thrust += 1;
      if (braking) thrust -= 0.75;

      if (thrust !== 0) {
        ship.vx += Math.cos(ship.angle) * accel * thrust * dt;
        ship.vy += Math.sin(ship.angle) * accel * thrust * dt;
      }

      // 阻尼
      const dampMode = this.p.flags.inertia ? 0.04 : 2.1;
      const damp = Math.exp(-dampMode * dt * (this.cruise || this.warp.active ? 0.35 : 1));
      ship.vx *= damp; ship.vy *= damp;

      const v = M.len(ship.vx, ship.vy);
      if (v > maxSpd) { ship.vx *= maxSpd / v; ship.vy *= maxSpd / v; }

      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      ship.thrustVis = Math.max(0, thrust) * (v / Math.max(1, maxSpd) * 0.6 + 0.3);
      if (thrust < 0) ship.thrustVis = 0.25;
      S.Audio.setEngineLevel(this.warp.active ? 1 : Math.min(1, ship.thrustVis + v / maxSpd * 0.4));

      // 尾迹
      if (ship.thrustVis > 0.4 && Math.random() < dt * 30) {
        this.fx.spawn({ x: ship.x - Math.cos(ship.angle) * 16, y: ship.y - Math.sin(ship.angle) * 16,
          vx: -Math.cos(ship.angle) * 40 + M.randomRange(-8, 8), vy: -Math.sin(ship.angle) * 40 + M.randomRange(-8, 8),
          ttl: 0.4, size: 2.2, color: this.warp.active ? '#8be6ff' : '#5a9ad8', kind: 'dot' });
      }

      this.collideWorld(dt);
    }

    collideWorld(dt) {
      const ship = this.ship;
      const shipR = S.ShipArt.radiusFor(ship.hullId);
      // 恒星高温
      const hd = M.dist(ship.x, ship.y, 0, 0);
      const starR = this.sys.star.radius;
      if (hd < starR * 1.5) {
        const heat = this.starHeat();
        if (heat > 0 && this.respawnT <= 0) {
          this.hitShip(this.ship, heat * dt * 14, 'heat');
          this.fx.spawn({ x: ship.x + M.randomRange(-10, 10), y: ship.y + M.randomRange(-10, 10), ttl: 0.3, size: 3, color: '#ff7a30', kind: 'dot' });
        }
        if (hd < starR * 0.9) {
          const push = M.norm(ship.x, ship.y);
          ship.x = push[0] * starR * 0.92; ship.y = push[1] * starR * 0.92;
        }
      }
      // 行星碰撞
      const bodies = [];
      for (const p of this.sys.planets) {
        bodies.push(this.planetWorldPos(p));
        for (const m of p.moons) bodies.push(this.moonWorldPos(p, m));
      }
      for (const b of bodies) {
        const d = M.dist(ship.x, ship.y, b.x, b.y);
        const minD = b.radius + shipR;
        if (d < minD && d > 0) {
          const nx = (ship.x - b.x) / d, ny = (ship.y - b.y) / d;
          const impact = Math.abs(ship.vx * nx + ship.vy * ny);
          if (impact > 260) this.hitShip(ship, (impact - 260) * 0.07, 'collision');
          ship.x = b.x + nx * minD; ship.y = b.y + ny * minD;
          const dot = ship.vx * nx + ship.vy * ny;
          ship.vx -= (1 + 0.4) * dot * nx; ship.vy -= (1 + 0.4) * dot * ny;
          UI.toast('⚠ 与 ' + b.name + ' 发生碰撞！', 'warn', 2000);
        }
      }
      // 小行星碰撞
      for (const r of this.rocks) {
        if (r.ore <= 0) continue;
        const d = M.dist(ship.x, ship.y, r.x, r.y);
        const minD = r.size + shipR + 2;
        if (d < minD && d > 0) {
          const nx = (ship.x - r.x) / d, ny = (ship.y - r.y) / d;
          const impact = Math.abs(ship.vx * nx + ship.vy * ny);
          if (impact > 200) this.hitShip(ship, (impact - 200) * 0.09, 'collision');
          ship.x = r.x + nx * minD; ship.y = r.y + ny * minD;
          const dot = ship.vx * nx + ship.vy * ny;
          ship.vx -= (1 + 0.3) * dot * nx; ship.vy -= (1 + 0.3) * dot * ny;
          if (impact > 300) { S.Audio.hullHit(); }
        }
      }
    }

    starHeat() {
      const d = M.dist(this.ship.x, this.ship.y, 0, 0);
      const R = this.sys.star.radius;
      if (d >= R * 1.5) return 0;
      return (1 - (d - R * 0.9) / (R * 0.6));
    }

    combatNearby() {
      const ship = this.ship;
      return this.pirates.some(p => p.hp.hull > 0 && M.dist(p.x, p.y, ship.x, ship.y) < 1500);
    }

    // ================= 扫描 =================
    startScan() {
      const st = this.ship.stats;
      const ship = this.ship;
      // 已锁定的行星优先，其次最近的
      let best = null, bestD = st.scanRange + 400;
      if (this.target && this.target.isPlanet) {
        const wp = this.planetWorldPos(this.target.ref);
        const d = M.dist(ship.x, ship.y, wp.x, wp.y);
        if (d < wp.radius + st.scanRange + 60) best = this.target.ref;
      }
      if (!best) {
        for (const p of this.sys.planets) {
          if (p.isGas) continue;
          const wp = this.planetWorldPos(p);
          const d = M.dist(ship.x, ship.y, wp.x, wp.y);
          if (d < wp.radius + st.scanRange + 60 && d < bestD) { best = p; bestD = d; }
        }
      }
      if (!best) { UI.toast('探测范围内没有可扫描的行星，请靠近', 'warn'); return; }
      if (best.surveyed || this.isSurveyed(best)) { this.showPlanetInfo(best); return; }
      this.scan = { planet: best, prog: 0 };
      UI.toast('开始扫描：' + best.name, 'info', 1600);
      S.Audio.scanTick();
    }

    isSurveyed(p) {
      return !!(this.p.discovered[this.sys.id + ':' + p.id] && this.p.discovered[this.sys.id + ':' + p.id].surveyed);
    }

    updateScan(dt) {
      if (!this.scan || !this.scan.planet) return;
      const p = this.scan.planet;
      const st = this.ship.stats;
      const wp = this.planetWorldPos(p);
      const d = M.dist(this.ship.x, this.ship.y, wp.x, wp.y);
      if (d > wp.radius + st.scanRange + 80) {
        if (Math.random() < dt * 2) UI.toast('扫描中断：距离过远', 'warn', 1200);
        return;
      }
      this.scan.prog += dt * 0.4 * st.surveyMult;
      if (Math.random() < dt * 8) S.Audio.scanTick();
      if (this.scan.prog >= 1) {
        const sci = 20 + p.resources.science * 6 + (p.anomaly ? 12 : 0);
        this.p.science += sci;
        S.refreshTech();
        this.p.surveyed++;
        p.surveyed = true;
        if (!this.p.discovered[this.sys.id + ':' + p.id]) this.p.discovered[this.sys.id + ':' + p.id] = {};
        this.p.discovered[this.sys.id + ':' + p.id].surveyed = true;
        this.scan = null;
        S.Audio.scanDone();
        UI.toast('✓ 扫描完成：' + p.name + '　<span style="color:#63e6a0">+' + sci + ' 科研点</span>', 'success', 3800);
        this.checkSurveyMissions(p);
        if (p.anomaly && !this.p.discovered[this.sys.id + ':' + p.id].anomalyDone) this.anomalyModal(p);
        else this.showPlanetInfo(p);
        S.saveGame();
      }
    }

    checkSurveyMissions(planet) {
      for (const m of this.p.missions) {
        if (!m.done && m.type === 'survey' && m.planetId === planet.id) {
          m.done = true;
          this.grantRewards(m.rewards, '任务完成：' + m.title);
        }
      }
      this.renderMissionTracker();
    }

    anomalyModal(p) {
      const a = p.anomaly;
      this.paused = true;
      const key = this.sys.id + ':' + p.id;
      const finish = (choice) => {
        this.p.discovered[key].anomalyDone = choice;
        this.paused = false;
        this.applyAnomalyReward(a[choice]);
      };
      S.UI.modal({
        title: '⚠ 异常信号：' + a.title,
        body: '<p style="font-size:13px;line-height:1.8">' + a.desc + '</p>',
        buttons: [
          { label: a.a.label, kind: 'btn-primary', cb: (c) => { c(); finish('a'); } },
          { label: a.b.label, cb: (c) => { c(); finish('b'); } }
        ]
      });
    }

    applyAnomalyReward(r) {
      let parts = [];
      if (r.credit) { const v = M.randInt(r.credit[0], r.credit[1]); this.p.credits += v; parts.push('+' + v + ' 信用点'); }
      if (r.alloy) { const v = M.randInt(r.alloy[0], r.alloy[1]); this.p.alloys += v; parts.push('+' + v + ' 合金'); }
      if (r.sci) { const v = M.randInt(r.sci[0], r.sci[1]); this.p.science += v; S.refreshTech(); parts.push('+' + v + ' 科研点'); }
      if (r.crystal) { const v = M.randInt(r.crystal[0], r.crystal[1]); this.p.crystals += v; parts.push('+' + v + ' 稀有晶体'); }
      UI.toast('✦ 异常处理完毕：' + parts.join('，'), 'success', 4200);
      S.Audio.pickup();
    }

    // ================= 采矿 =================
    updateMining(dt) {
      const I = S.Input;
      if (!I.mouse.lmb || this.warp.active || this.cruise) { this.mining = null; return; }
      const ship = this.ship;
      const st = ship.stats;
      let best = null, bestD = 300;
      for (const r of this.rocks) {
        if (r.ore <= 0) continue;
        const d = M.dist(ship.x, ship.y, r.x, r.y);
        const ang = Math.abs(M.wrapAngle(Math.atan2(r.y - ship.y, r.x - ship.x) - ship.angle));
        if (d < bestD && ang < 0.65) { best = r; bestD = d; }
      }
      if (!best) { this.mining = null; return; }
      if (!this.mining || this.mining.rock !== best) this.mining = { rock: best, tick: 0, fullWarned: false };
      const m = this.mining;
      m.tick -= dt;
      if (m.tick <= 0) {
        m.tick = 0.12;
        const cap = st.cargo;
        const free = cap - this.p.cargo.ore - this.p.cargo.rare;
        if (free <= 0) {
          if (!m.fullWarned) { m.fullWarned = true; UI.toast('货舱已满，请到空间站出售矿物', 'warn'); }
          return;
        }
        const yieldAmt = Math.min(free, 0.9 + st.miningMult * 0.9);
        m.rock.ore -= yieldAmt;
        this.p.cargo.ore += yieldAmt;
        S.Audio.mine();
        this.fx.burst(m.rock.x + M.randomRange(-4, 4), m.rock.y + M.randomRange(-4, 4), 2, { speed: 60, ttl: 0.35, size: 1.4, color: '#ffd479', kind: 'spark' });
        if (m.rock.ore <= 0) {
          m.rock.ore = 0;
          this.fx.burst(m.rock.x, m.rock.y, 8, { speed: 90, ttl: 0.6, size: 1.8, color: '#b8a888', kind: 'spark' });
          this.fx.spawn({ x: m.rock.x, y: m.rock.y, ttl: 0.4, size: 12, color: '#ffe9c0', kind: 'flash' });
          if (m.rock.rare) {
            this.p.cargo.rare = Math.min(cap - this.p.cargo.ore, this.p.cargo.rare + 1);
            UI.toast('✦ 采得稀有晶体！', 'success', 2400);
            S.Audio.pickup();
          }
          // 海盗伏击
          if (this.gsys.danger > 0.2 && this.pirates.filter(x => x.hp.hull > 0).length < 5 && Math.random() < 0.3) {
            const pk = S.Combat.makePirate(new S.Rand((Math.random() * 0xffffffff) >>> 0), this.pirates[0]?.faction || '碎星掠夺者', Math.min(3, this.p.techLevel));
            pk.x = ship.x + M.randomRange(-600, 600); pk.y = ship.y + M.randomRange(-600, 600);
            pk.angle = Math.atan2(ship.y - pk.y, ship.x - pk.x);
            pk.ai = { state: 'hunt', strafe: 1, wander: 0, faction: pk.faction };
            this.pirates.push(pk);
            UI.toast('⚠ 采矿声引来了海盗！', 'error', 3600);
            S.Audio.alarm();
          }
          this.mining = null;
        }
      }
    }

    // ================= 曲速 =================
    updateWarp(dt) {
      const I = S.Input;
      const want = I.isDown('warp') && !this.combatNearby() && !this.scan;
      if (want) {
        this.warp.charge += dt / 1.3;
        if (!this.warp.played && this.warp.charge > 0.15) { this.warp.played = true; S.Audio.warpCharge(); }
        if (this.warp.charge >= 1) {
          if (!this.warp.active) { this.warp.active = true; UI.toast('✦ 曲速航行启动', 'info', 1400); }
        }
      } else {
        if (this.warp.active) { this.warp.active = false; this.fx.burst(this.ship.x, this.ship.y, 12, { speed: 200, ttl: 0.5, size: 2, color: '#8be6ff', kind: 'spark' }); }
        if (this.warp.charge > 0) { this.warp.charge = Math.max(0, this.warp.charge - dt * 2.5); this.warp.played = false; }
      }
    }

    // ================= 战斗 =================
    updateCombat(dt) {
      const ships = [this.ship, ...this.pirates];
      const ctx = { projectiles: this.projectiles, fx: this.fx, ships, player: this.ship };

      // 玩家开火（Space 集火或自动）
      if (this.target && this.target.hp && this.target.hp.hull > 0 &&
          (S.Input.isDown('fire') || this.target.isPirate)) {
        if (S.Input.isDown('fire') || this.autoFireOn()) {
          S.Combat.fireShipWeapons(this.ship, dt, this.target, ctx);
        }
      }
      if (S.Input.isDown('fire') && this.target && this.target.isPlanet) { /* 不射击行星 */ }

      // 海盗 AI
      for (const pk of this.pirates) {
        if (pk.hp.hull <= 0) continue;
        pk.ai.think = pk.ai.think || 0;
        S.Combat.pirateAI(pk, dt, ctx);
      }

      // 弹道
      S.Combat.stepProjectiles(this.projectiles, ships, this.rocks, dt, this.fx, (ship, pr, res) => {
        if (res.missed) {
          this.dmgTexts.push({ x: ship.x, y: ship.y - 16, txt: 'MISS', ttl: 0.6, color: '#cfe3ff' });
          return;
        }
        const total = res.shieldDmg + res.armorDmg + res.hullDmg;
        if (total > 0) {
          this.dmgTexts.push({ x: ship.x + M.randomRange(-10, 10), y: ship.y - 16, txt: Math.round(total), ttl: 0.7, color: res.hullDmg > 0 ? '#ff8f6b' : res.armorDmg > 0 ? '#c8d7e8' : '#5ad8ff' });
          this.fx.burst(pr.x, pr.y, 3, { speed: 70, ttl: 0.3, size: 1.4, color: pr.color, kind: 'spark' });
          if (res.shieldDmg > 0) S.Audio.shieldHit();
          if (res.hullDmg > 0) { S.Audio.hullHit(); if (ship === this.ship) { this.shieldHitT = 0.5; if (Math.random() < 0.3) S.Audio.alarm(); } }
        }
        if (res.killed) this.onShipDestroyed(ship);
      });

      // 护盾再生
      for (const s of ships) S.Combat.regenShield(s, dt);

      // 剔除死亡海盗
      this.pirates = this.pirates.filter(pk => pk.hp.hull > 0);
    }

    autoFireOn() {
      const st = this.ship.stats;
      const d = M.dist(this.ship.x, this.ship.y, this.target.x, this.target.y);
      return this.target.isPirate && d < st.scanRange * 0.9 && !this.warp.active;
    }

    onShipDestroyed(ship) {
      if (ship === this.ship) { this.playerDeath(); return; }
      // 海盗被击毁
      this.fx && S.explode(this.fx, ship.x, ship.y, 1.2);
      S.Audio.explosion(true);
      const bounty = ship.bounty || 60;
      this.p.credits += bounty;
      this.p.kills++;
      const alloys = M.randInt(5, 22);
      this.p.alloys += alloys;
      this.pickups.push({ x: ship.x, y: ship.y, vx: M.randomRange(-20, 20), vy: M.randomRange(-20, 20), kind: 'credits', amount: bounty, ttl: 40 });
      this.pickups.push({ x: ship.x + 24, y: ship.y - 18, vx: M.randomRange(-20, 20), vy: M.randomRange(-20, 20), kind: 'alloys', amount: alloys, ttl: 40 });
      if (Math.random() < 0.3) {
        this.p.crystals += 1;
        this.pickups.push({ x: ship.x - 22, y: ship.y + 14, vx: M.randomRange(-20, 20), vy: M.randomRange(-20, 20), kind: 'crystals', amount: 1, ttl: 40 });
      }
      UI.toast('✖ 击毁 ' + ship.name + '　<span style="color:#ffd479">+' + bounty + ' 信用点</span>', 'success', 3200);
      if (this.target === ship) this.target = null;
      // 任务进度
      for (const m of this.p.missions) {
        if (!m.done && m.type === 'hunt' && m.sysId === this.sys.id && m.progress < m.total) {
          m.progress++;
          if (m.progress >= m.total) { m.done = true; this.grantRewards(m.rewards, '任务完成：' + m.title); }
        }
      }
      this.renderMissionTracker();
    }

    hitShip(ship, dmg, src) {
      if (this.respawnT > 0) return;
      const res = S.Combat.applyDamage(ship, dmg, { shieldMult: 1, armorMult: 1, hullMult: 1, tracking: 0 }, this.fx);
      if (res.missed) return;
      this.dmgTexts.push({ x: ship.x, y: ship.y - 18, txt: Math.round(dmg), ttl: 0.7, color: src === 'heat' ? '#ff7a30' : '#ff8f6b' });
      if (ship === this.ship) { this.shieldHitT = 0.4; }
      if (res.killed) this.onShipDestroyed(ship);
    }

    playerDeath() {
      if (this.dead) return;
      this.dead = true;
      this.respawnT = 0;
      S.Audio.explosion(true);
      S.explode(this.fx, this.ship.x, this.ship.y, 2.2);
      this.engine.camerashake = 1;
      const penalty = Math.round(this.p.credits * 0.15);
      this.p.credits -= penalty;
      const modal = S.UI.modal({
        title: '☠ 舰船损毁', closable: false,
        body: '<p style="font-size:14px;line-height:2">你的旗舰「' + this.ship.name + '」在星空中化为碎片……<br>' +
          '救援队将你拖回空间站并完成紧急修复（船体 40%）。<br>' +
          '<span style="color:#ff6b7a">损失 ' + penalty + ' 信用点</span>（救援与打捞费用）</p>',
        buttons: [{ label: '重新启航', kind: 'btn-primary', cb: (c) => { c(); this.respawn(); } }]
      });
      this.deathModal = modal;
      S.saveGame();
    }

    respawn() {
      this.dead = false;
      this.respawnT = 2.5;
      const ship = this.ship;
      ship.hp.hull = Math.max(10, Math.round(ship.stats.hull * 0.4));
      ship.hp.armor = 0;
      ship.hp.shield = ship.stats.shield;
      ship.shieldCd = 10;
      const st = this.sys.station;
      const a = st.angle + S.G.time * st.orbitSpeed + 0.3;
      const r = st.orbitRadius + 240;
      ship.x = Math.cos(a) * r; ship.y = Math.sin(a) * r;
      ship.angle = a + Math.PI / 2;
      ship.vx = 0; ship.vy = 0;
      this.projectiles.length = 0;
      for (const pk of this.pirates) { pk.ai.state = 'patrol'; }
      this.target = null;
      UI.toast('船体修复完成，重新启航', 'success', 3000);
    }

    updateDeath(dt) {
      this.fx.update(dt);
      for (let i = this.dmgTexts.length - 1; i >= 0; i--) {
        const d = this.dmgTexts[i]; d.ttl -= dt; d.y -= 26 * dt;
        if (d.ttl <= 0) this.dmgTexts.splice(i, 1);
      }
    }

    // ================= 拾取 =================
    updatePickups(dt) {
      const ship = this.ship;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.ttl -= dt;
        pk.x += pk.vx * dt; pk.y += pk.vy * dt;
        pk.vx *= 0.99; pk.vy *= 0.99;
        if (pk.ttl <= 0) { this.pickups.splice(i, 1); continue; }
        if (M.dist(pk.x, pk.y, ship.x, ship.y) < 110) {
          if (pk.kind === 'credits') this.p.credits += pk.amount;
          else if (pk.kind === 'alloys') this.p.alloys += pk.amount;
          else if (pk.kind === 'crystals') this.p.crystals += pk.amount;
          this.pickups.splice(i, 1);
          S.Audio.pickup();
          this.fx.burst(ship.x, ship.y, 4, { speed: 50, ttl: 0.35, size: 1.5, color: pk.kind === 'credits' ? '#ffd479' : pk.kind === 'alloys' ? '#c8d7e8' : '#b98aff', kind: 'spark' });
        }
      }
    }

    // ================= 目标选择 =================
    cycleTarget() {
      const hostiles = this.pirates.filter(pk => pk.hp.hull > 0)
        .sort((a, b) => M.dist(a.x, a.y, this.ship.x, this.ship.y) - M.dist(b.x, b.y, this.ship.x, this.ship.y));
      if (!hostiles.length) { this.target = null; UI.toast('没有敌舰', 'info', 1200); return; }
      const idx = hostiles.indexOf(this.target);
      this.target = hostiles[(idx + 1) % hostiles.length];
      UI.toast('锁定目标：' + this.target.name, 'info', 1200);
      S.Audio.ui();
    }

    clickSelect() {
      const w = S.Input.mouse;
      const wx = w.worldX, wy = w.worldY;
      // 敌舰
      for (const pk of this.pirates) {
        if (pk.hp.hull > 0 && M.dist(wx, wy, pk.x, pk.y) < S.ShipArt.radiusFor(pk.hullId) + 14) {
          this.target = pk; S.Audio.ui();
          UI.toast('锁定目标：' + pk.name + '　<span style="color:#ff6b7a">[' + pk.faction + ']</span>', 'info', 1600);
          return;
        }
      }
      // 行星
      for (const p of this.sys.planets) {
        const wp = this.planetWorldPos(p);
        if (M.dist(wx, wy, wp.x, wp.y) < wp.radius + 10) {
          this.target = { isPlanet: true, name: p.name, ref: p, hp: null };
          if (this.isSurveyed(p)) this.showPlanetInfo(p);
          else { this.scan = { planet: p, prog: 0 }; UI.toast('开始扫描：' + p.name, 'info', 1600); }
          return;
        }
      }
      this.target = null;
    }

    rmbSelect() {
      const w = S.Input.mouse;
      const wx = w.worldX, wy = w.worldY;
      for (const p of this.sys.planets) {
        const wp = this.planetWorldPos(p);
        if (M.dist(wx, wy, wp.x, wp.y) < wp.radius + 12) {
          this.target = { isPlanet: true, name: p.name, ref: p, hp: null };
          this.showPlanetInfo(p);
          return;
        }
      }
    }

    // ================= 行星信息 =================
    showPlanetInfo(p) {
      this.paused = true;
      const st = this.ship.stats;
      const wp = this.planetWorldPos(p);
      const d = M.dist(this.ship.x, this.ship.y, wp.x, wp.y);
      const surveyed = this.isSurveyed(p) || p.surveyed;
      const body = document.createElement('div');
      body.className = 'planet-detail';
      const prev = document.createElement('div');
      prev.className = 'p-preview';
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      const cx = cv.getContext('2d');
      cx.save();
      cx.beginPath(); cx.arc(64, 64, 62, 0, M.TAU); cx.clip();
      cx.drawImage(S.PlanetTex.get(p), 2, 2, 124, 124);
      cx.restore();
      prev.appendChild(cv);
      body.appendChild(prev);
      const info = document.createElement('div');
      info.innerHTML = '<h3 style="color:#8be6ff;margin-bottom:6px">' + p.name + '</h3>' +
        '<div style="color:#ffd479;font-size:12px;margin-bottom:8px">' + p.cn + ' · ' + p.tag + '</div>' +
        '<table class="stat-table">' +
        '<tr><td>类型</td><td>' + p.cn + (p.isGas ? '（气态）' : '（岩质）') + '</td></tr>' +
        '<tr><td>半径</td><td>' + Math.round(p.radius * 42) + ' km</td></tr>' +
        '<tr><td>质量</td><td>' + p.mass + ' M⊕</td></tr>' +
        '<tr><td>表面重力</td><td>' + p.gravity + ' g</td></tr>' +
        (p.tempC != null ? '<tr><td>表面温度</td><td>' + p.tempC + ' ℃</td></tr>' : '') +
        '<tr><td>大气</td><td>' + p.atmosphere + '</td></tr>' +
        '<tr><td>自转周期</td><td>' + p.dayLength.toFixed(1) + ' 小时</td></tr>' +
        '<tr><td>轨道半径</td><td>' + (p.orbitRadius / S.SystemGen.AU).toFixed(2) + ' AU</td></tr>' +
        '<tr><td>宜居度</td><td>' + (p.habitability > 0 ? p.habitability + '%' : '不可居住') + '</td></tr>' +
        '<tr><td>卫星</td><td>' + (p.moons.length ? p.moons.length + ' 颗' : '无') + '</td></tr>' +
        '<tr><td>资源</td><td>矿物 ' + p.resources.minerals + ' · 能量 ' + p.resources.energy + ' · 科研 ' + p.resources.science + (p.resources.rare ? ' · <span style="color:#b98aff">稀有 ' + p.resources.rare + '</span>' : '') + '</td></tr>' +
        '<tr><td>距离</td><td>' + Math.round(d) + ' m</td></tr>' +
        '</table>' +
        '<div style="margin-top:10px;font-size:12px;color:#8aa5c8;line-height:1.7">' + p.desc + '</div>' +
        (surveyed ? '' : '<div style="margin-top:8px;font-size:12px;color:#ffb25e">⚠ 尚未勘探，资源数据为探测估算值</div>');
      info.style.overflow = 'auto';
      body.appendChild(info);

      const buttons = [];
      if (!surveyed) {
        buttons.push({
          label: '开始扫描', kind: 'btn-primary',
          cb: (c) => { c(); this.paused = false; this.scan = { planet: p, prog: 0 }; UI.toast('开始扫描：' + p.name, 'info', 1600); }
        });
      }
      buttons.push({ label: '关闭', cb: (c) => c() });
      S.UI.modal({ title: '行星详情', width: 'wide', body, buttons, onClose: () => { this.paused = false; } });
    }

    grantRewards(rewards, title) {
      const parts = [];
      if (rewards.credits) { this.p.credits += rewards.credits; parts.push('+' + rewards.credits + ' 信用点'); }
      if (rewards.alloys) { this.p.alloys += rewards.alloys; parts.push('+' + rewards.alloys + ' 合金'); }
      if (rewards.science) { this.p.science += rewards.science; S.refreshTech(); parts.push('+' + rewards.science + ' 科研点'); }
      if (rewards.crystals) { this.p.crystals += rewards.crystals; parts.push('+' + rewards.crystals + ' 晶体'); }
      UI.toast('✓ ' + title + '　' + parts.join('，'), 'success', 4200);
      S.Audio.pickup();
      S.saveGame();
      this.renderMissionTracker();
    }

    // ================= 对接 / 面板 =================
    canDockNow() {
      const st = this.sys.station;
      const a = st.angle + S.G.time * st.orbitSpeed;
      const sx = Math.cos(a) * st.orbitRadius, sy = Math.sin(a) * st.orbitRadius;
      const v = M.len(this.ship.vx, this.ship.vy);
      return M.dist(this.ship.x, this.ship.y, sx, sy) < 190 && v < 160;
    }

    tryDock() {
      if (!this.canDockNow()) {
        const st = this.sys.station;
        const a = st.angle + S.G.time * st.orbitSpeed;
        const sx = Math.cos(a) * st.orbitRadius, sy = Math.sin(a) * st.orbitRadius;
        const d = M.dist(this.ship.x, this.ship.y, sx, sy);
        if (d < 500) UI.toast('减速并靠近空间站才能对接', 'warn', 2000);
        else UI.toast('空间站在 ' + Math.round(d) + 'm 外', 'info', 1600);
        return;
      }
      this.docked = true;
      S.Audio.dock();
      S.StationUI.open(this.engine, this);
    }

    openDesigner() {
      this.docked = true;
      S.DesignerUI.open(this.engine, this);
    }

    pauseMenu() {
      this.paused = true;
      S.UI.modal({
        title: '暂停', sub: '航行日志已同步',
        body: '<div style="font-size:13px;line-height:2">指挥官：' + this.p.name + '<br>' +
          '信用点 ' + S.UI.fmt(this.p.credits) + ' · 合金 ' + S.UI.fmt(this.p.alloys) + ' · 晶体 ' + this.p.crystals +
          ' · 科研点 ' + S.UI.fmt(this.p.science) + '<br>击毁敌舰 ' + this.p.kills + ' · 勘探行星 ' + this.p.surveyed + '</div>',
        buttons: [
          { label: '继续航行', kind: 'btn-primary', cb: (c) => { c(); this.paused = false; } },
          { label: '保存并返回主菜单', cb: (c) => { c(); S.saveGame(); this.leaveToMenu(); } },
          { label: '音效：' + (S.Audio.isMuted() ? '关' : '开'), cb: (c) => {
            S.Audio.setMuted(!S.Audio.isMuted());
            this.p.settings.muted = S.Audio.isMuted();
            S.saveGame();
            c(); this.paused = false; this.pauseMenu();
          } }
        ],
        onClose: () => { this.paused = false; }
      });
    }

    leaveToMenu() {
      this.persistPos();
      S.saveGame();
      this.engine.go('menu');
    }

    goMap() {
      if (this.combatNearby()) { UI.toast('战斗中无法打开星图', 'warn', 1600); return; }
      this.persistPos();
      this.engine.go('galaxymap');
    }

    persistPos() {
      this.p.pos = { x: this.ship.x, y: this.ship.y };
      this.p.angle = this.ship.angle;
      this.p.vx = this.ship.vx; this.p.vy = this.ship.vy;
    }

    // ================= 相机 =================
    updateCamera(dt) {
      const c = this.engine.cam;
      const ship = this.ship;
      const wheel = S.Input.wheel;
      if (wheel !== 0) this.zoomT = M.clamp(this.zoomT * Math.exp(-wheel * 0.0012), 0.14, 6);
      c.zoom += (this.zoomT - c.zoom) * Math.min(1, dt * 8);
      // 视线前移
      const look = Math.min(180, M.len(ship.vx, ship.vy) * 0.1);
      const tx = ship.x + (ship.vx || 0) * 0.1 + Math.cos(ship.angle) * look;
      const ty = ship.y + (ship.vy || 0) * 0.1 + Math.sin(ship.angle) * look;
      const k = 1 - Math.exp(-5 * dt);
      c.x += (tx - c.x) * k;
      c.y += (ty - c.y) * k;
    }

    // ================= 渲染 =================
    planetWorldPos(p) {
      const a = p.orbitAngle + p.orbitSpeed * S.G.time;
      return { x: Math.cos(a) * p.orbitRadius, y: Math.sin(a) * p.orbitRadius, radius: p.radius, name: p.name };
    }
    moonWorldPos(parent, m) {
      const pa = this.planetWorldPos(parent);
      const a = m.orbitAngle + m.orbitSpeed * S.G.time;
      return { x: pa.x + Math.cos(a) * m.orbitRadius, y: pa.y + Math.sin(a) * m.orbitRadius, radius: m.radius, name: m.name };
    }

    render(ctx) {
      const engine = this.engine, c = engine.cam;
      const w = engine.width, h = engine.height;
      const zoom = c.zoom;

      // 背景星空（屏幕空间）
      ctx.save();
      ctx.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0);
      this.starfield.render(ctx, c, w, h, this.t);
      ctx.restore();

      // 恒星
      S.drawStar(ctx, this.sys.star, 0, 0, this.t, this.sys.star.name.length);

      // 轨道线
      if (this.showOrbits || zoom < 0.5) {
        ctx.strokeStyle = 'rgba(120,170,230,0.13)';
        ctx.lineWidth = 1.5 / zoom;
        for (const p of this.sys.planets) {
          ctx.beginPath(); ctx.arc(0, 0, p.orbitRadius, 0, M.TAU); ctx.stroke();
        }
        if (this.sys.belt) {
          ctx.setLineDash([8 / zoom, 10 / zoom]);
          ctx.beginPath(); ctx.arc(0, 0, this.sys.belt.inner, 0, M.TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, this.sys.belt.outer, 0, M.TAU); ctx.stroke();
          ctx.setLineDash([]);
        }
        // 跃迁边界
        ctx.strokeStyle = 'rgba(255,200,120,0.10)';
        ctx.setLineDash([20 / zoom, 14 / zoom]);
        ctx.beginPath(); ctx.arc(0, 0, this.sys.outerRadius * 0.92, 0, M.TAU); ctx.stroke();
        ctx.setLineDash([]);
      }

      // 行星（由远及近）
      const planets = this.sys.planets.map(p => this.planetWorldPos(p))
        .sort((a, b) => b.orbitRadius - a.orbitRadius);
      for (const wp of planets) {
        const p = this.sys.planets.find(pp => pp.name === wp.name);
        this.drawPlanet(ctx, p, wp.x, wp.y);
      }
      // 小行星带
      if (zoom > 0.16) this.drawRocks(ctx);

      // 空间站
      this.drawStation(ctx);

      // 拾取物
      for (const pk of this.pickups) {
        const col = pk.kind === 'credits' ? '#ffd479' : pk.kind === 'alloys' ? '#c8d7e8' : '#b98aff';
        const pulse = 1 + Math.sin(this.t * 6) * 0.25;
        ctx.fillStyle = col;
        ctx.globalAlpha = Math.min(1, pk.ttl / 6 + 0.2);
        ctx.beginPath(); ctx.arc(pk.x, pk.y, 5 * pulse, 0, M.TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(pk.x, pk.y, 9 * pulse, 0, M.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 海盗
      for (const pk of this.pirates) {
        if (pk.hp.hull <= 0) continue;
        S.ShipArt.draw(ctx, pk.x, pk.y, pk.angle, pk.hullId, '#ff6b7a', pk.thrustVis || 0.3, this.t, pk.name.length);
        this.drawShipBars(ctx, pk);
      }

      // 玩家
      if (!this.dead && this.respawnT <= 0) {
        S.ShipArt.draw(ctx, this.ship.x, this.ship.y, this.ship.angle, this.ship.hullId, '#4dd2ff', this.ship.thrustVis || 0, this.t, 1);
        // 护盾泡
        if (this.ship.hp.shield > 2) {
          const sr = S.ShipArt.radiusFor(this.ship.hullId) + 9;
          const flash = this.shieldHitT > 0 ? 0.5 : 0.14;
          ctx.strokeStyle = 'rgba(90,216,255,' + flash + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(this.ship.x, this.ship.y, sr, 0, M.TAU); ctx.stroke();
        }
      }

      // 弹道
      for (const pr of this.projectiles) {
        if (pr.kind === 'missile') {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = pr.color; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = pr.color;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size, 0, M.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size * 0.4, 0, M.TAU); ctx.fill();
      }

      // 采矿光束
      if (this.mining && this.mining.rock.ore > 0) {
        const r = this.mining.rock;
        S.drawBeam(ctx, this.ship.x, this.ship.y, r.x, r.y, 'rgba(255,212,121,0.9)', 2.4);
      }

      // 特效与伤害数字
      this.fx.render(ctx);
      if (zoom > 0.2) {
        for (const d of this.dmgTexts) {
          ctx.fillStyle = d.color;
          ctx.font = (13 / zoom) + 'px "Cascadia Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(d.txt, d.x, d.y);
        }
      }

      // 行星标签
      if (zoom > 0.3) {
        for (const p of this.sys.planets) {
          const wp = this.planetWorldPos(p);
          if (wp.radius * zoom > 15) this.drawLabel(ctx, wp.x, wp.y + wp.radius + 16 / zoom, p.name, this.isSurveyed(p) ? '#63e6a0' : '#8aa5c8', p.tag, zoom);
        }
      }
    }

    drawLabel(ctx, x, y, name, color, tag, zoom) {
      ctx.font = (13 / zoom) + 'px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(4,8,16,0.55)';
      const tw = ctx.measureText(name).width;
      ctx.fillRect(x - tw / 2 - 6 / zoom, y - 12 / zoom, tw + 12 / zoom, 20 / zoom);
      ctx.fillStyle = color;
      ctx.fillText(name, x, y + 2 / zoom);
      if (tag) {
        ctx.font = (10 / zoom) + 'px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(200,220,245,0.75)';
        ctx.fillText(tag, x, y + 16 / zoom);
      }
      ctx.globalAlpha = 1;
    }

    drawPlanet(ctx, p, x, y) {
      const tex = S.PlanetTex.get(p);
      const R = p.radius;
      // 环（后层）
      if (p.ring) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.orbitAngle * 0.7 + 0.3);
        ctx.strokeStyle = p.ring.color;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 5; i++) {
          ctx.lineWidth = R * 0.05 * (1 + i * 0.4);
          ctx.globalAlpha = 0.32 - i * 0.05;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.ring.outer - i * R * 0.16, (p.ring.outer - i * R * 0.16) * 0.36, 0, 0, M.TAU);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      // 行星本体
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, M.TAU); ctx.clip();
      ctx.rotate(this.t * 0.03 * (p.orbitSpeed > 0 ? 1 : -1) + p.seed % 6);
      const scale = p.isGas ? R * 2 / tex.height : R * 2 / tex.width;
      const dw = tex.width * scale, dh = tex.height * scale;
      ctx.drawImage(tex, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      // 昼夜阴影（背向恒星）
      const sunAng = Math.atan2(-y, -x);
      const sh = ctx.createRadialGradient(x + Math.cos(sunAng) * R * 0.5, y + Math.sin(sunAng) * R * 0.5, R * 0.2, x, y, R * 1.02);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(0.72, 'rgba(0,0,0,0.05)');
      sh.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, R, 0, M.TAU); ctx.clip();
      ctx.fillStyle = sh;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.restore();
      // 大气辉光
      if (!p.isGas) {
        const atmo = p.type === 'toxic' ? 'rgba(140,220,90,0.20)' :
          p.type === 'lava' ? 'rgba(255,120,40,0.16)' :
          p.type === 'ice' ? 'rgba(200,235,255,0.20)' :
          p.type === 'ocean' || p.type === 'gaia' || p.type === 'continental' ? 'rgba(110,180,255,0.22)' : 'rgba(170,180,200,0.12)';
        ctx.strokeStyle = atmo;
        ctx.lineWidth = Math.max(1.5, R * 0.06);
        ctx.beginPath(); ctx.arc(x, y, R + ctx.lineWidth * 0.6, 0, M.TAU); ctx.stroke();
      }
      // 卫星
      for (const m of p.moons) {
        const mw = this.moonWorldPos(p, m);
        if (mw.radius < 2.5) continue;
        const mtex = S.PlanetTex.get(m);
        ctx.save();
        ctx.beginPath(); ctx.arc(mw.x, mw.y, mw.radius, 0, M.TAU); ctx.clip();
        ctx.drawImage(mtex, mw.x - mw.radius, mw.y - mw.radius, mw.radius * 2, mw.radius * 2);
        ctx.restore();
      }
      // 目标高亮
      if (this.target && this.target.isPlanet && this.target.ref === p) {
        ctx.strokeStyle = 'rgba(77,210,255,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.arc(x, y, R + 12, 0, M.TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      // 未勘探标记
      if (!this.isSurveyed(p) && this.target && this.target.isPlanet && this.target.ref !== p) {
        // 小问号
        if (R * this.engine.cam.zoom > 26) {
          ctx.fillStyle = 'rgba(255,178,94,0.9)';
          ctx.font = (15 / this.engine.cam.zoom) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('?', x, y - R - 10 / this.engine.cam.zoom);
        }
      }
    }

    drawRocks(ctx) {
      const c = this.engine.cam;
      const vw = this.engine.width / c.zoom, vh = this.engine.height / c.zoom;
      const x0 = c.x - vw / 2 - 50, x1 = c.x + vw / 2 + 50;
      const y0 = c.y - vh / 2 - 50, y1 = c.y + vh / 2 + 50;
      for (const r of this.rocks) {
        if (r.ore <= 0) continue;
        if (r.x < x0 || r.x > x1 || r.y < y0 || r.y > y1) continue;
        const frac = r.ore / r.maxOre;
        const size = r.size * (0.55 + 0.45 * frac);
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.beginPath();
        for (let i = 0; i < r.pts.length; i++) {
          const a = i / r.pts.length * M.TAU;
          const rr = size * r.pts[i];
          i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fillStyle = r.rare ? '#7a6a8a' : '#6e6a60';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    drawStation(ctx) {
      const st = this.sys.station;
      const a = st.angle + S.G.time * st.orbitSpeed;
      const x = Math.cos(a) * st.orbitRadius, y = Math.sin(a) * st.orbitRadius;
      const zoom = this.engine.cam.zoom;
      // 对接圈
      if (this.canDockNow()) {
        ctx.strokeStyle = 'rgba(99,230,160,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(x, y, 190, 0, M.TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.t * 0.4);
      // 旋转环
      ctx.strokeStyle = '#8a9bb8';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, M.TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(140,190,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 52, 0, M.TAU); ctx.stroke();
      // 停靠臂
      ctx.fillStyle = '#5a6a84';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2);
        ctx.fillRect(30, -4, 22, 8);
        ctx.restore();
      }
      // 中央舱
      ctx.fillStyle = '#39435a';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, M.TAU); ctx.fill();
      ctx.restore();
      // 信标
      const blink = Math.sin(this.t * 3.4) > 0.2;
      ctx.fillStyle = blink ? '#63e6a0' : 'rgba(99,230,160,0.35)';
      ctx.beginPath(); ctx.arc(x, y - 16, 3.5, 0, M.TAU); ctx.fill();
      // 标签
      if (zoom > 0.35 || M.dist(this.ship.x, this.ship.y, x, y) < 800) {
        this.drawLabel(ctx, x, y + 70 / zoom, st.name, '#ffd479', this.gsys.isHome ? '母星站' : '贸易站', zoom);
      }
    }

    drawShipBars(ctx, ship) {
      const zoom = this.engine.cam.zoom;
      if (ship.hp.hull >= ship.stats.hull && ship.hp.shield >= ship.stats.shield) return;
      const wpx = 44 / zoom, hpx = 4 / zoom;
      const x = ship.x - wpx / 2, y = ship.y - S.ShipArt.radiusFor(ship.hullId) - 16 / zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 1 / zoom, y - 1 / zoom, wpx + 2 / zoom, hpx + 2 / zoom);
      if (ship.stats.shield > 0) {
        ctx.fillStyle = '#5ad8ff';
        ctx.fillRect(x, y, wpx * ship.hp.shield / ship.stats.shield, hpx);
      }
      if (ship.stats.armor > 0) {
        ctx.fillStyle = '#c8d7e8';
        ctx.fillRect(x, y + hpx + 1 / zoom, wpx * ship.hp.armor / ship.stats.armor, hpx);
      }
      ctx.fillStyle = '#ff8f6b';
      ctx.fillRect(x, y + (hpx + 1 / zoom) * 2, wpx * ship.hp.hull / ship.stats.hull, hpx);
    }

    renderUI(ctx) {
      const engine = this.engine;
      const w = engine.width, h = engine.height;
      // 曲速速度线
      if (this.warp.active) {
        ctx.strokeStyle = 'rgba(150,210,255,0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          const a = M.randomRange(0, M.TAU);
          const r0 = M.randomRange(60, 200);
          const r1 = r0 + M.randomRange(120, 420);
          ctx.globalAlpha = M.randomRange(0.2, 0.6);
          ctx.beginPath();
          ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
          ctx.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      this.drawEdgeArrow(ctx, w, h);
    }

    drawEdgeArrow(ctx, w, h) {
      const c = this.engine.cam;
      const marks = [];
      if (this.target && this.target.isPlanet && this.target.ref) {
        const wp = this.planetWorldPos(this.target.ref);
        marks.push({ x: wp.x, y: wp.y, color: '#4dd2ff' });
      } else if (this.target && this.target.hp) {
        marks.push({ x: this.target.x, y: this.target.y, color: '#ff6b7a' });
      }
      const st = this.sys.station;
      const sa = st.angle + S.G.time * st.orbitSpeed;
      marks.push({ x: Math.cos(sa) * st.orbitRadius, y: Math.sin(sa) * st.orbitRadius, color: '#ffd479' });
      // 最近未勘探行星
      let near = null, nd = 1e9;
      for (const p of this.sys.planets) {
        if (p.isGas || this.isSurveyed(p)) continue;
        const wp = this.planetWorldPos(p);
        const d = M.dist(wp.x, wp.y, this.ship.x, this.ship.y);
        if (d < nd) { nd = d; near = { x: wp.x, y: wp.y }; }
      }
      if (near) marks.push({ x: near.x, y: near.y, color: '#63e6a0', pulse: true });

      for (const mk of marks) {
        let sx = (mk.x - c.x) * c.zoom + w / 2;
        let sy = (mk.y - c.y) * c.zoom + h / 2;
        if (sx > -20 && sx < w + 20 && sy > -20 && sy < h + 20) continue;
        const ang = Math.atan2(sy - h / 2, sx - w / 2);
        const ex = Math.min(Math.max(sx, 22), w - 22);
        const ey = Math.min(Math.max(sy, 22), h - 22);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.fillStyle = mk.color;
        ctx.globalAlpha = mk.pulse ? 0.55 + Math.sin(this.t * 4) * 0.25 : 0.8;
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-4, -7); ctx.lineTo(-4, 7);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    onLeave() {
      this.persistPos();
      this.showHUD(false);
      S.Audio.setEngineLevel(0);
      S.UI.closeAll();
      this.docked = false;
      this.paused = false;
      if (this._dockRef) this._dockRef = null;
      S.saveGame();
    }
  }

  function barRow(lbl, pct, cls, val) {
    return '<div class="bar-row"><span class="lbl">' + lbl + '</span><div class="bar ' + cls + '"><i style="width:' + pct + '%"></i></div><span class="val">' + val + '</span></div>';
  }

  S.registerScene('flight', FlightScene);
})(typeof window !== 'undefined' ? window : globalThis);
