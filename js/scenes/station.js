/* 星海远航 · 空间站：贸易/修理/船坞/任务/情报 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;
  const UI = S.UI;

  function genMissions(sys, gsys, p, rng) {
    const offers = [];
    // 清剿
    const faction = S.Names.pirateFaction(rng);
    const total = 2 + Math.min(3, p.techLevel);
    offers.push({ id: 'm' + (rng.next() * 1e9 | 0), type: 'hunt', title: '清剿海盗：' + faction,
      sysId: sys.id, total, progress: 0,
      rewards: { credits: 150 * total, alloys: 35 + total * 8 },
      desc: '在「' + sys.name + '」星系击毁 ' + total + ' 艘海盗舰' });
    // 勘探
    const cand = sys.planets.filter(pl => !pl.isGas && !pl.surveyed && !(p.discovered[sys.id + ':' + pl.id] && p.discovered[sys.id + ':' + pl.id].surveyed));
    if (cand.length) {
      const pl = rng.pick(cand);
      offers.push({ id: 'm' + (rng.next() * 1e9 | 0), type: 'survey', title: '勘探：' + pl.name,
        sysId: sys.id, planetId: pl.id,
        rewards: { science: 45 + pl.resources.science * 8, credits: 60 },
        desc: '扫描「' + pl.name + '」并传回数据' });
    }
    // 采矿
    const ore = rng.int(15, 40);
    offers.push({ id: 'm' + (rng.next() * 1e9 | 0), type: 'mine', title: '采矿订单',
      sysId: sys.id, total: ore, progress: 0,
      rewards: { credits: ore * 9, alloys: 12 },
      desc: '交付 ' + ore + ' 单位矿石（停靠空间站自动交付）' });
    // 信使
    const neighbors = gsys.links.map(i => S.G.galaxy.systems[i]);
    if (neighbors.length) {
      const unvisited = neighbors.filter(s => !(p.discovered[s.id] && p.discovered[s.id].visited));
      const target = unvisited.length ? rng.pick(unvisited) : rng.pick(neighbors);
      offers.push({ id: 'm' + (rng.next() * 1e9 | 0), type: 'courier', title: '信使任务：' + target.name,
        sysId: target.id,
        rewards: { credits: 240, science: 35 },
        desc: '跃迁至「' + target.name + '」并停靠当地空间站' });
    }
    return offers.slice(0, 3);
  }
  function progress(p, m) { return m.progress + '/' + m.total; }

  const StationUI = {
    open(engine, flight) {
      const p = S.G.player;
      const ship = flight.ship;
      const sys = flight.sys;
      const gsys = flight.gsys;
      const st = sys.station;
      const rng = new S.Rand((S.G.seed ^ S.hashStr(st.name) ^ (p.jumps * 97 + p.kills * 13)) >>> 0);

      // 停靠自动结算任务
      for (const m of p.missions) {
        if (m.done) continue;
        if (m.type === 'courier' && m.sysId === sys.id) {
          m.done = true;
          flight.grantRewards(m.rewards, '任务完成：' + m.title);
        } else if (m.type === 'mine' && p.cargo.ore >= m.total) {
          p.cargo.ore -= m.total;
          m.done = true;
          flight.grantRewards(m.rewards, '任务完成：' + m.title);
        }
      }
      flight.renderMissionTracker();

      const offers = genMissions(sys, gsys, p, rng);
      let tab = 'trade';
      const body = document.createElement('div');
      const modal = UI.modal({
        title: st.name, sub: sys.name + ' 星系 · ' + sys.star.spec + ' 型恒星 · 海盗威胁 ' +
          (gsys.danger > 0.6 ? '高' : gsys.danger > 0.25 ? '中' : '低'),
        width: 'wide', body,
        onClose: () => { flight.docked = false; S.saveGame(); }
      });

      const resBar = document.createElement('div');
      resBar.style.cssText = 'display:flex;gap:18px;font-size:13px;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:8px;margin-bottom:12px;flex-wrap:wrap';
      body.appendChild(resBar);
      const resRow = () => {
        resBar.innerHTML = '<span class="res credits"><span class="dot"></span>信用点 <b>' + UI.fmt(p.credits) + '</b></span>' +
          '<span class="res alloys"><span class="dot"></span>合金 <b>' + UI.fmt(p.alloys) + '</b></span>' +
          '<span class="res crystals"><span class="dot"></span>晶体 <b>' + p.crystals + '</b></span>' +
          '<span class="res science"><span class="dot"></span>科研点 <b>' + UI.fmt(p.science) + '</b></span>' +
          '<span class="res"><span class="dot" style="background:#c8a060"></span>矿舱 <b>' + Math.floor(p.cargo.ore) + '</b> / ' + Math.round(ship.stats.cargo) + '</span>' +
          '<span class="res"><span class="dot" style="background:#b98aff"></span>稀有晶体 <b>' + p.cargo.rare + '</b></span>';
      };
      resRow();

      const tabBar = document.createElement('div');
      tabBar.className = 'station-tabs';
      body.appendChild(tabBar);
      const content = document.createElement('div');
      body.appendChild(content);

      const TABS = [['trade', '贸易'], ['repair', '修理'], ['yard', '船坞'], ['missions', '任务'], ['intel', '情报']];
      const renderTabs = () => {
        UI.clear(tabBar);
        for (const [id, label] of TABS) {
          const b = document.createElement('button');
          b.className = 'btn btn-sm' + (tab === id ? ' active' : '');
          b.textContent = label;
          b.onclick = () => { tab = id; render(); S.Audio.click(); };
          tabBar.appendChild(b);
        }
      };

      const render = () => {
        renderTabs();
        resRow();
        UI.clear(content);
        if (tab === 'trade') renderTrade();
        else if (tab === 'repair') renderRepair();
        else if (tab === 'yard') renderYard();
        else if (tab === 'missions') renderMissions();
        else renderIntel();
      };

      const tradeBtn = (label, kind, cb, disabled) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm ' + (kind || '');
        b.textContent = label;
        b.disabled = !!disabled;
        b.onclick = () => { cb(); render(); S.Audio.click(); };
        return b;
      };

      function renderTrade() {
        const ore = Math.floor(p.cargo.ore);
        content.innerHTML = '<div style="font-size:12px;color:#8aa5c8;margin-bottom:8px">贸易码头 —— 价格随站浮动</div>';
        const rows = [
          ['出售矿石 ×10', '3 信用点/单位', ore >= 10, () => { p.cargo.ore -= 10; p.credits += 30; UI.toast('+30 信用点', 'success', 1400); }],
          ['全部出售矿石（' + ore + '）', '3 信用点/单位', ore > 0, () => { p.credits += ore * 3; p.cargo.ore = 0; UI.toast('+' + ore * 3 + ' 信用点', 'success', 1800); }],
          ['出售稀有晶体 ×1', '130 信用点', p.cargo.rare > 0, () => { p.cargo.rare--; p.credits += 130; UI.toast('+130 信用点', 'success', 1400); }],
          ['收购合金 ×10', '300 信用点', p.credits >= 300, () => { p.credits -= 300; p.alloys += 10; UI.toast('-300 信用点，+10 合金', 'info', 1800); }]
        ];
        for (const [label, price, can, fn] of rows) {
          const row = document.createElement('div');
          row.className = 'trade-row';
          row.innerHTML = '<span>' + label + '</span><span style="color:#ffd479">' + price + '</span>';
          const b = tradeBtn('交易', '', fn, !can);
          row.appendChild(b);
          content.appendChild(row);
        }
      }

      function renderRepair() {
        const missHull = ship.stats.hull - ship.hp.hull;
        const missArmor = ship.stats.armor - ship.hp.armor;
        const costHull = Math.round(missHull * 2);
        const costArmor = Math.round(missArmor * 3);
        content.innerHTML = '<div style="font-size:13px;line-height:2.2">' +
          '旗舰「' + ship.name + '」状态：<br>' +
          '　船体 ' + Math.round(ship.hp.hull) + '/' + Math.round(ship.stats.hull) + '（缺口 ' + Math.round(missHull) + '）<br>' +
          '　装甲 ' + Math.round(ship.hp.armor) + '/' + Math.round(ship.stats.armor) + '（缺口 ' + Math.round(missArmor) + '）<br>' +
          '　护盾 ' + Math.round(ship.hp.shield) + '/' + Math.round(ship.stats.shield) + '（离港后自动充能）</div>';
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;gap:10px;margin-top:10px;flex-wrap:wrap';
        box.appendChild(tradeBtn('修理船体（' + costHull + ' 信用点）', 'btn-primary', () => {
          if (p.credits < costHull) return;
          p.credits -= costHull; ship.hp.hull = ship.stats.hull;
          UI.toast('船体修复完毕', 'success', 2000); S.Audio.dock();
        }, missHull <= 1 || p.credits < costHull));
        box.appendChild(tradeBtn('修理装甲（' + costArmor + ' 信用点）', '', () => {
          if (p.credits < costArmor) return;
          p.credits -= costArmor; ship.hp.armor = ship.stats.armor;
          UI.toast('装甲更换完毕', 'success', 2000); S.Audio.dock();
        }, missArmor <= 1 || p.credits < costArmor));
        box.appendChild(tradeBtn('全面检修', 'btn-gold', () => {
          const total = costHull + costArmor;
          if (p.credits < total) { UI.toast('信用点不足', 'error'); return; }
          p.credits -= total;
          ship.hp.hull = ship.stats.hull; ship.hp.armor = ship.stats.armor;
          UI.toast('全面检修完成', 'success', 2000); S.Audio.dock();
        }, missHull + missArmor <= 1 || p.credits < costHull + costArmor));
        content.appendChild(box);
      }

      function renderYard() {
        const box = document.createElement('div');
        for (const d of p.designs) {
          const s = S.Ships.buildStats(S.Ships.byId[d.hullId], d.comps);
          const row = document.createElement('div');
          row.className = 'comp-row';
          row.innerHTML = '<div class="c-ico" style="background:rgba(90,140,220,.12)">' + S.Ships.byId[d.hullId].ico + '</div>' +
            '<div class="c-main"><div class="c-name">' + d.name + '</div>' +
            '<div class="c-desc">' + S.Ships.byId[d.hullId].name + ' · DPS ' + Math.round(s.weapons.reduce((a, w) => a + w.dmg / w.cd, 0)) + ' · 造价 ' + s.cost.credits + ' 信用点 / ' + s.cost.alloys + ' 合金' + (s.cost.crystals ? ' / ' + s.cost.crystals + ' 晶体' : '') + '</div></div>';
          const btns = document.createElement('div');
          btns.style.cssText = 'display:flex;gap:6px;flex:none';
          const canBuild = p.credits >= s.cost.credits && p.alloys >= s.cost.alloys && p.crystals >= s.cost.crystals;
          const buildBtn = tradeBtn('建造', 'btn-primary', () => {
            p.credits -= s.cost.credits; p.alloys -= s.cost.alloys; p.crystals -= s.cost.crystals;
            const gship = { id: 'g' + Date.now(), designId: d.id, name: d.name + '·' + S.Names.ship(new S.Rand(Date.now() % 100000)), hullId: d.hullId, comps: d.comps.slice(), hp: { hull: s.hull, armor: s.armor, shield: s.shield } };
            p.garage.push(gship);
            UI.toast('「' + gship.name + '」建造完成，已入库', 'success', 3200);
            S.Audio.dock();
          }, !canBuild);
          if (p.ship.designId === d.id) buildBtn.disabled = true;
          btns.appendChild(buildBtn);
          row.appendChild(btns);
          box.appendChild(row);
        }
        // 机库
        if (p.garage.length) {
          const hd = document.createElement('div');
          hd.style.cssText = 'font-size:12px;color:#ffd479;margin:12px 0 4px';
          hd.textContent = '机库（备用舰）';
          box.appendChild(hd);
          for (const g of p.garage) {
            const row = document.createElement('div');
            row.className = 'comp-row';
            row.innerHTML = '<div class="c-ico" style="background:rgba(185,138,255,.12)">▣</div>' +
              '<div class="c-main"><div class="c-name">' + g.name + '</div>' +
              '<div class="c-desc">' + S.Ships.byId[g.hullId].name + ' · 船体 ' + Math.round(g.hp.hull) + ' / ' + Math.round(g.hp.shield ? g.hp.shield : 0) + '盾</div></div>';
            const btns = document.createElement('div');
            btns.style.cssText = 'display:flex;gap:6px;flex:none';
            btns.appendChild(tradeBtn('设为旗舰', 'btn-gold', () => {
              // 当前旗舰入库
              const cur = p.ship;
              p.garage.push({ id: 'g' + Date.now(), designId: cur.designId, name: cur.name, hullId: cur.hullId, comps: cur.comps.slice(), hp: { hull: cur.hp.hull, armor: cur.hp.armor, shield: cur.hp.shield } });
              p.garage.splice(p.garage.indexOf(g), 1);
              const d = p.designs.find(x => x.id === g.designId);
              const ns = S.makeShip(d || { id: g.designId, name: g.name, hullId: g.hullId, comps: g.comps }, g.name);
              ns.hp = { hull: g.hp.hull, armor: g.hp.armor, shield: g.hp.shield };
              ns.x = cur.x; ns.y = cur.y; ns.angle = cur.angle; ns.vx = 0; ns.vy = 0;
              p.ship = ns; flight.ship = ns;
              flight.target = null;
              UI.toast('「' + ns.name + '」就任旗舰', 'success', 3000);
              S.Audio.dock();
            }));
            const sellBtn = tradeBtn('拆解', '', () => {
              const s = S.Ships.buildStats(S.Ships.byId[g.hullId], g.comps);
              p.credits += Math.round(s.cost.credits * 0.4);
              p.alloys += Math.round(s.cost.alloys * 0.4);
              p.garage.splice(p.garage.indexOf(g), 1);
              UI.toast('拆解返还 ' + Math.round(s.cost.credits * 0.4) + ' 信用点', 'info', 2200);
            });
            btns.appendChild(sellBtn);
            row.appendChild(btns);
            box.appendChild(row);
          }
        }
        content.appendChild(box);
      }

      function renderMissions() {
        const box = document.createElement('div');
        if (p.missions.length) {
          const hd = document.createElement('div');
          hd.style.cssText = 'font-size:12px;color:#8aa5c8;margin-bottom:6px';
          hd.textContent = '进行中的任务（' + p.missions.filter(m => !m.done).length + '/' + p.missions.length + '）';
          box.appendChild(hd);
          for (const m of p.missions) {
            const row = document.createElement('div');
            row.className = 'mission-chip';
            row.innerHTML = '<div class="m-title">' + (m.done ? '✓ ' : '◇ ') + m.title + '</div><div class="m-prog">' + m.desc + '</div>' +
              '<div class="m-prog" style="color:#ffd479">奖励：' + rewardText(m.rewards) + '</div>';
            box.appendChild(row);
          }
        }
        const hd2 = document.createElement('div');
        hd2.style.cssText = 'font-size:12px;color:#ffd479;margin:12px 0 6px';
        hd2.textContent = '任务板（本次停靠可接取，最多同时 4 个）';
        box.appendChild(hd2);
        for (const m of offers) {
          const row = document.createElement('div');
          row.className = 'comp-row';
          row.innerHTML = '<div class="c-ico" style="background:rgba(255,212,121,.12)">✦</div>' +
            '<div class="c-main"><div class="c-name">' + m.title + '</div><div class="c-desc">' + m.desc + '</div>' +
            '<div class="c-desc" style="color:#ffd479">奖励：' + rewardText(m.rewards) + '</div></div>';
          const acc = tradeBtn('接受', 'btn-primary', () => {
            if (p.missions.filter(x => !x.done).length >= 4) { UI.toast('任务已满', 'warn'); return; }
            p.missions.push(m);
            offers.splice(offers.indexOf(m), 1);
            flight.renderMissionTracker();
            UI.toast('接受任务：' + m.title, 'success', 2400);
          });
          row.appendChild(acc);
          box.appendChild(row);
        }
        content.appendChild(box);
      }

      function renderIntel() {
        const visitedN = S.G.galaxy.systems.filter(s => p.discovered[s.id] && p.discovered[s.id].visited).length;
        content.innerHTML = '<div style="font-size:13px;line-height:2">' +
          '<b style="color:#8be6ff">「' + sys.name + '」星系情报</b><br>' +
          '恒星：' + sys.star.name + '（' + sys.star.spec + ' 型 · ' + sys.star.temp.toLocaleString() + ' K）<br>' +
          sys.star.desc + '<br>' +
          '行星：' + sys.planets.map(pl => pl.cn).join('、') + '<br>' +
          '小行星带：' + (sys.belt ? sys.belt.rocks.length + ' 块可采岩石' : '无') + '<br>' +
          '海盗威胁：' + (gsys.danger > 0.6 ? '高——采矿容易招来掠袭舰队' : gsys.danger > 0.25 ? '中等——保持警戒' : '低——相对安全') + '<br><br>' +
          '<b style="color:#8be6ff">银河概览</b><br>' +
          '已探明星系：' + visitedN + ' / ' + S.G.galaxy.systems.length + '<br>' +
          '已勘探行星：' + p.surveyed + '　击毁敌舰：' + p.kills + '　跃迁次数：' + p.jumps + '<br>' +
          '科技等级：' + S.Components.tierName(p.techLevel) + '　累计科研点：' + UI.fmt(p.science) + '<br>' +
          '<span style="color:#8aa5c8">提示：勘探行星与异常事件是科研点的主要来源；小行星带产矿，空间站收矿。</span></div>';
      }

      function rewardText(r) {
        const bits = [];
        if (r.credits) bits.push(r.credits + ' 信用点');
        if (r.alloys) bits.push(r.alloys + ' 合金');
        if (r.science) bits.push(r.science + ' 科研点');
        if (r.crystals) bits.push(r.crystals + ' 晶体');
        return bits.join(' · ') || '—';
      }

      render();
      flight._dockRef = { forceClose: () => modal.close() };
      return modal;
    }
  };

  S.StationUI = StationUI;
})(typeof window !== 'undefined' ? window : globalThis);