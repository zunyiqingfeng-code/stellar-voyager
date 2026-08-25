/* 星海远航 · 银河星图：超空间航道 / 迷雾 / 跃迁 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});
  const M = S.MathX;
  const UI = S.UI;

  class GalaxyMapScene {
    create(engine) {
      this.engine = engine;
      this.p = S.G.player;
      this.galaxy = S.G.galaxy;
      this.t = 0;
      this.camX = this.galaxy.width / 2;
      this.camY = this.galaxy.height / 2;
      const cur = this.galaxy.systems.find(s => s.id === this.p.sysId);
      if (cur) { this.camX = cur.x; this.camY = cur.y; }
      this.zoom = 1.0;
      this.hudT = 0;
      // 关键修复：清空引擎相机，星图用独立坐标系渲染（此前被飞行相机残留污染）
      engine.cam.x = 0; engine.cam.y = 0; engine.cam.zoom = 1;
      this.hover = null;
      this.jumping = null;
      this.panel = null;
      this.dragging = false;
      this.dragX = 0; this.dragY = 0;
      this.starfield = new S.Starfield(S.G.seed ^ 0xabcdef);

      UI.toast('银河星图 —— 点击相邻星系进行超空间跃迁，滚轮缩放', 'info', 3600);
    }

    visited(sys) { return !!(this.p.discovered[sys.id] && this.p.discovered[sys.id].visited); }
    revealed(sys) {
      if (this.visited(sys)) return true;
      return sys.links.some(id => this.visited(this.galaxy.systems[id]));
    }

    /** 可达性缓存：同一出发点只做一次 BFS（此前每帧每星系重复计算） */
    distMapFrom(fromIdx) {
      if (this._distMap && this._distFrom === fromIdx) return this._distMap;
      const n = this.galaxy.systems.length;
      const dist = new Array(n).fill(-1);
      dist[fromIdx] = 0;
      const q = [fromIdx];
      while (q.length) {
        const i = q.shift();
        for (const j of this.galaxy.systems[i].links) {
          if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); }
        }
      }
      this._distMap = dist;
      this._distFrom = fromIdx;
      return dist;
    }

    jumpDistance(fromIdx, toIdx) {
      const d = this.distMapFrom(fromIdx)[toIdx];
      return d == null ? -1 : d;
    }

    update(dt) {
      this.t += dt;
      const I = S.Input;
      if (I.wasPressed('menu') || I.wasPressed('map') || I.wasPressed('jump')) {
        if (!this.jumping) { this.back(); return; }
      }

      // 跃迁充能
      if (this.jumping) {
        this.jumping.t += dt;
        const st = this.p.ship.stats;
        const dur = st.windup;
        const cp = UI.el('center-progress');
        UI.show(cp);
        cp.innerHTML = '<div class="cp-label">超空间引擎充能 ' + Math.round(Math.min(1, this.jumping.t / dur) * 100) + '%　→ ' + this.jumping.target.name + '</div><div class="cp-bar"><i style="width:' + Math.min(1, this.jumping.t / dur) * 100 + '%"></i></div>';
        if (this.jumping.t >= dur) {
          const target = this.jumping.target;
          const cur = this.galaxy.systems.find(s => s.id === this.p.sysId);
          this.p.discovered[target.id] = this.p.discovered[target.id] || {};
          this.p.discovered[target.id].visited = true;
          this.p.pos.angle0 = Math.atan2(cur.y - target.y, cur.x - target.x);
          this.p.sysId = target.id;
          this.p.jumps++;
          S.Audio.warpJump();
          S.saveGame();
          this.jumping = null;
          UI.hide(cp);
          this.engine.go('flight', { fromJump: true });
          return;
        }
        return;
      }

      // 平移
      const drag = I.mouse.lmb;
      if (drag && !this._wasDrag) {
        // 检查是否点在星系上（交给 clickSelect，拖拽则平移）
        this.dragStart = { x: I.mouse.x, y: I.mouse.y, camX: this.camX, camY: this.camY };
        this.dragging = false;
      }
      if (drag && this._wasDrag) {
        const dx = I.mouse.x - this.dragStart.x, dy = I.mouse.y - this.dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) this.dragging = true;
        if (this.dragging) {
          this.camX = this.dragStart.camX - dx / this.zoom;
          this.camY = this.dragStart.camY - dy / this.zoom;
        }
      }
      if (!drag && this._wasDrag && !this.dragging) this.clickSelect();
      this._wasDrag = drag;

      // 键盘平移
      const sp = 500 / this.zoom * dt;
      if (I.isDown('up') || I.isDown('left')) {}
      if (I.isDown('up')) this.camY -= sp;
      if (I.isDown('down')) this.camY += sp;
      if (I.isDown('left')) this.camX -= sp;
      if (I.isDown('right')) this.camX += sp;

      // 缩放
      if (I.wheel) this.zoom = M.clamp(this.zoom * Math.exp(-I.wheel * 0.001), 0.3, 4);
      // 跟随当前星系
      if (I.wasPressed('target')) {
        const cur = this.galaxy.systems.find(s => s.id === this.p.sysId);
        if (cur) { this.camX = cur.x; this.camY = cur.y; }
      }

      // HUD 信息节流写入（此前每帧 innerHTML 重绘）
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.3;
        const box = UI.el('sys-info');
        UI.show(UI.el('hud-top'));
        const cur0 = this.galaxy.systems.find(s => s.id === this.p.sysId);
        const visitedN0 = this.galaxy.systems.filter(s => this.visited(s)).length;
        const revealedN0 = this.galaxy.systems.filter(s => this.revealed(s)).length;
        box.innerHTML = '<b>银河星图</b>　<span class="dim">已探明 ' + visitedN0 + '/' + this.galaxy.systems.length +
          ' · 已发现 ' + revealedN0 + ' · 当前：' + cur0.name + '</span>';
      }

      // 悬停
      this.hover = null;
      const wx = (I.mouse.x - this.engine.width / 2) / this.zoom + this.camX;
      const wy = (I.mouse.y - this.engine.height / 2) / this.zoom + this.camY;
      for (const sys of this.galaxy.systems) {
        if (!this.revealed(sys)) continue;
        if (M.dist(sys.x, sys.y, wx, wy) < 14) { this.hover = sys; break; }
      }
      if (this.hover) {
        const tip = UI.tooltip('<div class="title">' + this.hover.name + '</div>' +
          (this.visited(this.hover) ? this.starLine(this.hover) : '<span class="dim">未探明区域</span>'));
        UI.moveTooltip(I.mouse.x, I.mouse.y);
      } else UI.hideTooltip();
    }

    starLine(sys) {
      return '<span class="dim">' + sys.star.spec + ' 型恒星 · ' + sys.star.temp.toLocaleString() + ' K</span><br>' +
        '行星 <b>' + S.getSystem(sys.id).planets.length + '</b> 颗 · 海盗威胁 ' +
        (sys.danger > 0.6 ? '<span style="color:#ff6b7a">高</span>' : sys.danger > 0.25 ? '<span style="color:#ffb25e">中</span>' : '<span style="color:#63e6a0">低</span>');
    }

    clickSelect() {
      const I = S.Input;
      const wx = (I.mouse.x - this.engine.width / 2) / this.zoom + this.camX;
      const wy = (I.mouse.y - this.engine.height / 2) / this.zoom + this.camY;
      let best = null, bd = 20;
      for (const sys of this.galaxy.systems) {
        if (!this.revealed(sys)) continue;
        const d = M.dist(sys.x, sys.y, wx, wy);
        if (d < bd) { best = sys; bd = d; }
      }
      if (best) this.showSystem(best);
    }

    showSystem(sys) {
      const cur = this.galaxy.systems.find(s => s.id === this.p.sysId);
      const jd = this.jumpDistance(cur.idx, sys.idx);
      const st = this.p.ship.stats;
      const isCur = sys.id === cur.id;
      const reachable = !isCur && jd > 0 && jd <= st.jumpRange;
      const sysObj = this.visited(sys) ? S.getSystem(sys.id) : null;
      let body = '<div style="font-size:13px;line-height:1.9">';
      body += '<b style="color:' + sys.star.color + '">' + sys.star.name + '</b>　' + sys.star.spec + ' 型恒星 · ' + sys.star.temp.toLocaleString() + ' K<br>';
      body += sys.star.desc + '<br>';
      if (sysObj) {
        body += '行星 ' + sysObj.planets.length + ' 颗：' + sysObj.planets.map(p => p.cn).join('、') + '<br>';
        body += '海盗威胁：' + (sys.danger > 0.6 ? '<span style="color:#ff6b7a">高</span>' : sys.danger > 0.25 ? '<span style="color:#ffb25e">中</span>' : '<span style="color:#63e6a0">低</span>') + '<br>';
      } else body += '<span style="color:#8aa5c8">尚未探明</span><br>';
      if (isCur) body += '<b style="color:#63e6a0">◈ 当前位置</b><br>';
      else if (jd > 0) body += '航道距离 <b>' + jd + '</b> 跳　（引擎可跳 ' + st.jumpRange + ' 跳）<br>';
      else body += '<span style="color:#ff6b7a">无航道相连</span><br>';
      body += '</div>';

      const buttons = [];
      if (reachable) {
        buttons.push({
          label: '✦ 超空间跃迁（充能 ' + st.windup.toFixed(1) + 's）', kind: 'btn-primary',
          cb: (c) => { c(); this.startJump(sys); }
        });
      }
      if (isCur) {
        buttons.push({ label: '返回星系（Esc）', kind: 'btn-gold', cb: (c) => { c(); this.back(); } });
      }
      buttons.push({ label: '关闭', cb: (c) => c() });
      S.UI.modal({ title: sys.name + (sys.isHome ? '　[母星系]' : ''), body, buttons });
    }

    startJump(sys) {
      this.jumping = { target: sys, t: 0 };
      S.Audio.warpCharge();
      UI.toast('超空间引擎启动，跃向 ' + sys.name, 'info', 2200);
    }

    back() {
      UI.hideTooltip();
      UI.hide(UI.el('center-progress'));
      this.engine.go('flight');
    }

    render(ctx) {
      const engine = this.engine;
      const w = engine.width, h = engine.height, d = engine.dpr;
      // 背景（显式屏幕空间）
      ctx.save();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = '#04060e';
      ctx.fillRect(0, 0, w, h);
      this.starfield.render(ctx, { x: this.camX * 0.3, y: this.camY * 0.3 }, w, h, this.t);
      // 银心光晕
      const gcx = (this.galaxy.width / 2 - this.camX) * this.zoom + w / 2;
      const gcy = (this.galaxy.height / 2 - this.camY) * this.zoom + h / 2;
      const gg = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, 320 * this.zoom + 140);
      gg.addColorStop(0, 'rgba(255,206,140,0.17)');
      gg.addColorStop(1, 'rgba(255,206,140,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(gcx - 480, gcy - 480, 960, 960);
      ctx.restore();

      // 星图变换（显式，与引擎相机完全解耦）
      ctx.save();
      ctx.setTransform(d * this.zoom, 0, 0, d * this.zoom, d * (w / 2 - this.camX * this.zoom), d * (h / 2 - this.camY * this.zoom));

      // 航道
      const cur = this.galaxy.systems.find(s => s.id === this.p.sysId);
      ctx.lineWidth = 1.2 / this.zoom;
      for (const sys of this.galaxy.systems) {
        for (const j of sys.links) {
          if (j <= sys.idx) continue;
          const other = this.galaxy.systems[j];
          const visA = this.visited(sys), visB = this.visited(other);
          const revA = this.revealed(sys), revB = this.revealed(other);
          if (!revA && !revB) continue;
          ctx.strokeStyle = visA && visB ? 'rgba(120,170,240,0.5)' : 'rgba(120,170,240,0.16)';
          ctx.beginPath(); ctx.moveTo(sys.x, sys.y); ctx.lineTo(other.x, other.y); ctx.stroke();
        }
      }

      // 跃迁范围高亮
      if (this.hover && !this.jumping) {
        const jd = this.jumpDistance(cur.idx, this.hover.idx);
        if (jd > 0 && jd <= this.p.ship.stats.jumpRange && this.hover.id !== cur.id) {
          ctx.strokeStyle = 'rgba(99,230,160,0.65)';
          ctx.lineWidth = 2 / this.zoom;
          ctx.beginPath(); ctx.arc(this.hover.x, this.hover.y, 16, 0, M.TAU); ctx.stroke();
        }
      }

      // 可达星系光环（当前引擎跃迁范围内）
      for (const sys of this.galaxy.systems) {
        if (!this.revealed(sys) || sys.id === cur.id) continue;
        const jd = this.jumpDistance(cur.idx, sys.idx);
        if (jd > 0 && jd <= this.p.ship.stats.jumpRange) {
          ctx.strokeStyle = this.hover === sys ? 'rgba(99,230,160,0.85)' : 'rgba(99,230,160,0.32)';
          ctx.lineWidth = (this.hover === sys ? 2 : 1.2) / this.zoom;
          ctx.setLineDash([6 / this.zoom, 5 / this.zoom]);
          ctx.beginPath(); ctx.arc(sys.x, sys.y, 17, 0, M.TAU); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 星系
      for (const sys of this.galaxy.systems) {
        if (!this.revealed(sys)) continue;
        const vis = this.visited(sys);
        const r = M.clamp(3.2 + sys.star.radius / 18, 3.2, 12);
        // 光晕
        const g2 = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, r * 3.4);
        g2.addColorStop(0, sys.star.color + (vis ? 'cc' : '66'));
        g2.addColorStop(1, sys.star.color + '00');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(sys.x, sys.y, r * 3.4, 0, M.TAU); ctx.fill();
        // 星点
        ctx.fillStyle = vis ? sys.star.color : '#5a6c8c';
        ctx.beginPath(); ctx.arc(sys.x, sys.y, r, 0, M.TAU); ctx.fill();
        // 未探明微光描边
        if (!vis) {
          ctx.strokeStyle = 'rgba(140,160,200,0.35)';
          ctx.lineWidth = 1 / this.zoom;
          ctx.beginPath(); ctx.arc(sys.x, sys.y, r + 2, 0, M.TAU); ctx.stroke();
        }
        if (sys.isHome) {
          ctx.strokeStyle = '#ffd479';
          ctx.lineWidth = 1.6 / this.zoom;
          ctx.beginPath(); ctx.arc(sys.x, sys.y, r + 4, 0, M.TAU); ctx.stroke();
        }
        if (sys.id === cur.id) {
          const pulse = 1 + Math.sin(this.t * 4) * 0.25;
          ctx.strokeStyle = '#63e6a0';
          ctx.lineWidth = 2 / this.zoom;
          ctx.beginPath(); ctx.arc(sys.x, sys.y, (r + 6) * pulse, 0, M.TAU); ctx.stroke();
        }
        // 名字：已到访常显；未到访仅放大/悬停时显示
        if (vis || this.zoom > 1.6 || this.hover === sys) {
          ctx.font = (vis ? 12 : 11) / this.zoom + 'px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = this.hover === sys ? '#eaf6ff' : (vis ? '#a8bcd8' : '#7a8aa8');
          ctx.fillText(sys.name, sys.x, sys.y + r + 14 / this.zoom);
        }
      }

      // 跃迁动画
      if (this.jumping) {
        const tgt = this.jumping.target;
        const a = Math.atan2(cur.y - tgt.y, cur.x - tgt.x);
        const R = M.dist(cur.x, cur.y, tgt.x, tgt.y);
        for (let i = 0; i < 10; i++) {
          const frac = (this.t * 1.2 + i / 10) % 1;
          const rr = R * frac;
          ctx.fillStyle = 'rgba(140,220,255,' + (0.7 - frac * 0.5) + ')';
          ctx.beginPath();
          ctx.arc(cur.x + Math.cos(a) * rr, cur.y + Math.sin(a) * rr, 3.5 - frac * 2, 0, M.TAU);
          ctx.fill();
        }
      }
      ctx.restore();

      // 底部提示（屏幕空间）
      ctx.save();
      ctx.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0);
      ctx.fillStyle = '#8aa5c8';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('拖动平移 · 滚轮缩放 · 点击星系查看 · E 回到当前星系 · Esc 返回飞行', w / 2, h - 18);
      ctx.restore();
    }

    renderUI(ctx) {}

    onLeave() {
      UI.hideTooltip();
      UI.hide(UI.el('center-progress'));
      UI.hide(UI.el('hud-top'));
      UI.closeAll();
    }
  }

  S.registerScene('galaxymap', GalaxyMapScene);
})(typeof window !== 'undefined' ? window : globalThis);