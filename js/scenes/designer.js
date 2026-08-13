/* 星海远航 · 舰船设计器（参考《群星》舰船设计界面） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;
  const UI = S.UI;
  const C = S.Components;

  // 槽位列表（wpn 分 S/M/L，def/core/aux 合并为单行）
  function slotList(hull) {
    const out = [];
    const add = (st, size, n) => { for (let i = 0; i < n; i++) out.push({ st, size, i }); };
    const h = hull.slots;
    add('wpn', 'S', h.wpn.S); add('wpn', 'M', h.wpn.M); add('wpn', 'L', h.wpn.L);
    add('def', 'S', h.def.S + (h.def.M || 0) + (h.def.L || 0));
    add('core', 'S', h.core.S);
    add('aux', 'S', h.aux.S);
    return out;
  }

  function assignments(hull, comps) {
    const slots = slotList(hull);
    const pools = { wpn: [], def: [], core: [], aux: [] };
    for (const id of comps) {
      const c = C.byId[id];
      if (c && pools[c.slotType]) pools[c.slotType].push(id);
    }
    const idx = { wpn: 0, def: 0, core: 0, aux: 0 };
    return slots.map(s => {
      const pool = pools[s.st];
      return { ...s, compId: idx[s.st] < pool.length ? pool[idx[s.st]++] : null };
    });
  }

  function setSlot(hull, comps, st, i, compId) {
    const assigns = assignments(hull, comps);
    const target = assigns.find(a => a.st === st && a.i === i);
    if (!target) return comps;
    if (compId) target.compId = compId; else target.compId = null;
    return assigns.map(a => a.compId).filter(Boolean);
  }

  const UI2 = {
    open(engine, flight) {
      const p = S.G.player;
      const state = {
        designId: p.ship ? p.ship.designId : p.designs[0].id,
        working: null, // {id,name,hullId,comps}
        tab: null
      };
      const loadDesign = (d) => { state.working = { id: d.id, name: d.name, hullId: d.hullId, comps: d.comps.slice() }; };

      const design = p.designs.find(d => d.id === state.designId) || p.designs[0];
      loadDesign(design);

      const body = document.createElement('div');
      const modal = UI.modal({
        title: '舰船设计器', sub: '科技等级 ' + C.tierName(p.techLevel) + '　·　信用点 ' + UI.fmt(p.credits) + '　合金 ' + UI.fmt(p.alloys) + '　晶体 ' + p.crystals,
        width: 'wide', body,
        buttons: [],
        onClose: () => { flight.docked = false; flight.ship && (flight.ship.stats = S.Ships.buildStats(S.Ships.byId[flight.ship.hullId], flight.ship.comps)); }
      });

      const layout = document.createElement('div');
      layout.className = 'designer-layout';
      body.appendChild(layout);

      // 左侧舰体列表
      const hullCol = document.createElement('div');
      hullCol.innerHTML = '<div style="font-size:12px;color:#8aa5c8;margin-bottom:6px">舰体（点击切换）</div>';
      const hullList = document.createElement('div');
      hullList.className = 'hull-list';
      hullCol.appendChild(hullList);
      layout.appendChild(hullCol);

      // 右侧
      const right = document.createElement('div');
      layout.appendChild(right);

      const renderHulls = () => {
        UI.clear(hullList);
        for (const h of S.Ships.unlockedHulls(p.techLevel)) {
          const d = document.createElement('div');
          d.className = 'hull-item' + (state.working.hullId === h.id ? ' active' : '');
          d.innerHTML = '<div class="h-name">' + h.ico + ' ' + h.name + '</div><div class="h-desc">' + h.desc + '</div>' +
            '<div class="h-desc" style="margin-top:2px">船体 ' + h.base.hull + ' · 造价 ' + h.cost.credits + ' 信用点 / ' + h.cost.alloys + ' 合金</div>';
          d.onclick = () => { state.working.hullId = h.id; render(); S.Audio.click(); };
          hullList.appendChild(d);
        }
      };

      const previewCv = document.createElement('canvas');
      previewCv.width = 140; previewCv.height = 140;

      const slotWrap = document.createElement('div');
      const statsWrap = document.createElement('div');
      const statusWrap = document.createElement('div');
      const nameInput = document.createElement('input');
      nameInput.style.cssText = 'background:#0d1526;border:1px solid #2f4668;color:#cfe3ff;border-radius:6px;padding:6px 10px;font-size:13px;width:220px;font-family:inherit;';
      nameInput.value = state.working.name;

      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:10px';
      nameRow.innerHTML = '<span style="font-size:12px;color:#8aa5c8">设计名称</span>';
      nameRow.appendChild(nameInput);
      right.appendChild(nameRow);

      const previewRow = document.createElement('div');
      previewRow.style.cssText = 'display:flex;gap:16px;align-items:flex-start;margin-bottom:10px';
      previewRow.appendChild(previewCv);
      const slotBox = document.createElement('div');
      slotBox.style.flex = '1';
      slotBox.appendChild(slotWrap);
      previewRow.appendChild(slotBox);
      right.appendChild(previewRow);
      right.appendChild(statsWrap);
      right.appendChild(statusWrap);

      const renderPreview = () => {
        const cx = previewCv.getContext('2d');
        cx.clearRect(0, 0, 140, 140);
        const hull = S.Ships.byId[state.working.hullId];
        cx.drawImage(S.ShipArt.sprite(hull.cls, '#4dd2ff'), -10, -10, 160, 160);
      };

      const renderSlots = () => {
        UI.clear(slotWrap);
        const hull = S.Ships.byId[state.working.hullId];
        const assigns = assignments(hull, state.working.comps);
        const rows = [['wpn', '武器'], ['def', '防御'], ['core', '核心'], ['aux', '辅助']];
        for (const [st, label] of rows) {
          const list = assigns.filter(a => a.st === st);
          if (!list.length) continue;
          const row = document.createElement('div');
          row.className = 'slot-row';
          const lbl = document.createElement('div');
          lbl.className = 'row-lbl';
          lbl.textContent = C.slotTypeName(st);
          row.appendChild(lbl);
          for (const a of list) {
            const sl = document.createElement('div');
            const comp = a.compId ? C.byId[a.compId] : null;
            sl.className = 'slot ' + st + (comp ? ' filled' : '');
            sl.innerHTML = '<span class="sz">' + (st === 'wpn' ? a.size : 'S') + '</span>' +
              '<span class="nm">' + (comp ? comp.ico + '<br>' + comp.name : '+') + '</span>';
            sl.title = comp ? comp.name + ' ' + C.tierName(comp.tier) + '：' + comp.desc : '空槽位';
            sl.onclick = () => picker(st, a, comp);
            row.appendChild(sl);
          }
          slotWrap.appendChild(row);
        }
      };

      const picker = (st, a, current) => {
        const list = C.forSlot(st, st === 'wpn' ? a.size : 'S', p.techLevel);
        const pb = document.createElement('div');
        pb.style.maxHeight = '420px';
        pb.style.overflow = 'auto';
        const byKind = {};
        for (const c of list) (byKind[c.kind] = byKind[c.kind] || []).push(c);
        for (const kind of Object.keys(byKind)) {
          const hd = document.createElement('div');
          hd.style.cssText = 'font-size:12px;color:#ffd479;margin:8px 0 4px';
          hd.textContent = C.familyName(kind);
          pb.appendChild(hd);
          for (const c of byKind[kind]) {
            const row = document.createElement('div');
            row.className = 'comp-row ' + (current && current.id === c.id ? 'owned' : '');
            row.innerHTML = '<div class="c-ico" style="background:rgba(90,140,220,.12)">' + c.ico + '</div>' +
              '<div class="c-main"><div class="c-name">' + c.name + '<span class="tier">' + C.tierName(c.tier) + '</span></div>' +
              '<div class="c-desc">' + c.desc + '</div><div class="c-desc">' + statText(c.stats) + '</div></div>' +
              '<div class="c-cost">' + c.cost.credits + ' 信用点<br>' + c.cost.alloys + ' 合金' + (c.cost.crystals ? '<br>' + c.cost.crystals + ' 晶体' : '') + '</div>';
            row.onclick = () => {
              state.working.comps = setSlot(S.Ships.byId[state.working.hullId], state.working.comps, st, a.i, c.id);
              pm.close();
              render();
              S.Audio.click();
            };
            pb.appendChild(row);
          }
        }
        const empty = document.createElement('button');
        empty.className = 'btn btn-danger btn-sm btn-block';
        empty.style.marginTop = '8px';
        empty.textContent = '卸下部件';
        empty.onclick = () => {
          state.working.comps = setSlot(S.Ships.byId[state.working.hullId], state.working.comps, st, a.i, null);
          pm.close(); render(); S.Audio.click();
        };
        pb.appendChild(empty);
        const pm = UI.modal({ title: '选择部件 —— ' + C.slotTypeName(st) + (st === 'wpn' ? '（' + a.size + ' 型）' : ''), body: pb, buttons: [] });
      };

      const renderStats = () => {
        const hull = S.Ships.byId[state.working.hullId];
        const v = S.Ships.validate(hull, state.working.comps, p.techLevel);
        const s = S.Ships.buildStats(hull, state.working.comps);
        const dps = Math.round(s.weapons.reduce((a, w) => a + w.dmg / w.cd, 0));
        statsWrap.innerHTML = '<div class="designer-stats">' +
          ds('武器 DPS', dps) + ds('护盾', Math.round(s.shield) + '（+再生 ' + s.shieldRegen.toFixed(1) + '/s）') +
          ds('装甲', Math.round(s.armor)) + ds('船体', Math.round(s.hull)) +
          ds('航速', s.speed + ' px/s') + ds('机动', s.turn.toFixed(2) + ' rad/s') +
          ds('闪避', Math.round(s.evasion * 100) + '%') + ds('扫描距离', s.scanRange + ' m') +
          ds('跃迁距离', s.jumpRange + ' 跳') + ds('跃迁充能', s.windup.toFixed(1) + ' s') +
          ds('货舱', Math.round(s.cargo)) + ds('勘探效率', Math.round(s.surveyMult * 100) + '%') +
          ds('电力', s.powerUse + ' / ' + s.powerSupply + (s.overpower ? ' ⚠超载' : '')) +
          ds('造价', s.cost.credits + ' 信用点 · ' + s.cost.alloys + ' 合金' + (s.cost.crystals ? ' · ' + s.cost.crystals + ' 晶体' : '')) +
          '</div>';
        statusWrap.style.cssText = 'margin-top:10px;font-size:12px;padding:8px 10px;border-radius:8px;';
        if (v.ok) {
          statusWrap.style.cssText += 'background:rgba(99,230,160,.1);border:1px solid rgba(99,230,160,.4);color:#63e6a0';
          statusWrap.textContent = '✓ ' + v.msg;
        } else {
          statusWrap.style.cssText += 'background:rgba(255,107,122,.1);border:1px solid rgba(255,107,122,.45);color:#ff8b96';
          statusWrap.textContent = '✖ ' + v.msg;
        }
      };

      const render = () => {
        state.working.name = nameInput.value || '未命名设计';
        renderHulls();
        renderPreview();
        renderSlots();
        renderStats();
      };
      nameInput.oninput = () => { state.working.name = nameInput.value; };

      // 底部按钮（UI.modal 在无按钮时不渲染页脚，这里确保存在）
      let foot = modal.root.querySelector('.modal-foot');
      if (!foot) {
        foot = document.createElement('div');
        foot.className = 'modal-foot';
        modal.root.appendChild(foot);
      }
      const addBtn = (label, kind, cb) => {
        const b = document.createElement('button');
        b.className = 'btn ' + kind;
        b.textContent = label;
        b.onclick = cb;
        foot.appendChild(b);
      };
      addBtn('保存设计并应用到旗舰', 'btn-primary', () => {
        const hull = S.Ships.byId[state.working.hullId];
        const v = S.Ships.validate(hull, state.working.comps, p.techLevel);
        if (!v.ok) { UI.toast(v.msg, 'error'); S.Audio.error(); return; }
        const d = p.designs.find(x => x.id === state.working.id);
        d.name = state.working.name; d.hullId = state.working.hullId; d.comps = state.working.comps.slice();
        if (p.ship.designId === d.id) { S.refitShip(p.ship, d); UI.toast('旗舰「' + p.ship.name + '」已按新设计重新装配', 'success', 3200); }
        S.saveGame(); S.Audio.dock();
      });
      addBtn('复制为新设计', '', () => {
        const d = { id: 'd' + Date.now(), name: state.working.name + ' 改型', hullId: state.working.hullId, comps: state.working.comps.slice() };
        p.designs.push(d);
        state.designId = d.id;
        loadDesign(d);
        render();
        UI.toast('已复制为新设计', 'success', 2000);
      });
      addBtn('关闭', '', () => modal.close());

      render();
      return modal;
    }
  };

  function statText(st) {
    const bits = [];
    if (st.dmg != null) bits.push('伤害 ' + st.dmg + ' / 冷却 ' + st.cd + 's / 射程 ' + st.range + (st.homing ? ' / 制导' : ''));
    if (st.shieldHP) bits.push('护盾 +' + st.shieldHP + ' / 再生 ' + st.regen + '/s');
    if (st.armorHP) bits.push('装甲 +' + st.armorHP);
    if (st.hullMult) bits.push('船体 +' + Math.round(st.hullMult * 100) + '%');
    if (st.power) bits.push('电力 ' + st.power);
    if (st.speedMult) bits.push('航速 ×' + st.speedMult + ' / 机动 +' + st.turnBonus + ' / 闪避 +' + st.evasionBonus);
    if (st.jumpRange) bits.push('跃迁 ' + st.jumpRange + ' 跳 / 充能 ' + st.windup + 's');
    if (st.fireMult) bits.push('射速 ×' + st.fireMult + ' / 命中 ' + st.accuracy);
    if (st.scanRange) bits.push('扫描 ' + st.scanRange + 'm');
    if (st.shieldRegenMult) bits.push('护盾再生 +' + Math.round(st.shieldRegenMult * 100) + '%');
    if (st.windupReduction) bits.push('充能 -' + Math.round(st.windupReduction * 100) + '%');
    if (st.speedBonus) bits.push('航速 +' + Math.round(st.speedBonus * 100) + '%');
    if (st.surveyMult) bits.push('勘探 +' + Math.round(st.surveyMult * 100) + '%');
    if (st.cargoBonus) bits.push('货舱 +' + st.cargoBonus);
    return bits.slice(0, 2).join('　');
  }

  function ds(k, v) { return '<div class="ds-item"><span>' + k + '</span><span>' + v + '</span></div>'; }

  S.DesignerUI = UI2;
})(typeof window !== 'undefined' ? window : globalThis);