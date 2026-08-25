/* 星海远航 · 主菜单 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  class MenuScene {
    create(engine) {
      this.engine = engine;
      this.starfield = new S.Starfield(S.G.seed);
      this.t = 0;
      // 装饰行星
      this.demoPlanet = {
        type: 'continental', radius: 190, seed: 42, isGas: false,
        name: '远航', cn: '大陆世界'
      };
      this.demoAngle = 0.7;

      const ui = S.UI.el('ui');
      this.overlay = document.createElement('div');
      this.overlay.className = 'menu-overlay';
      const save = S.Save.load();
      const hasSave = !!save;

      const title = document.createElement('div');
      title.className = 'menu-title';
      title.innerHTML = '<h1>星海远航</h1><div class="en">STELLAR VOYAGER</div>' +
        '<span class="tag">太空飞船飞行模拟 · 银河勘探与舰队战争</span>';
      this.overlay.appendChild(title);

      const btns = document.createElement('div');
      btns.className = 'menu-buttons';
      const add = (label, cb, kind) => {
        const b = document.createElement('button');
        b.className = 'btn ' + (kind || '');
        b.textContent = label;
        b.onclick = () => { S.Audio.unlock(); S.Audio.click(); cb(); };
        btns.appendChild(b);
      };
      if (hasSave) {
        add('▶ 继续航行', () => this.engine.go('boot', { continue: true }));
        const info = document.createElement('div');
        info.className = 'menu-save-info';
        info.textContent = '存档：' + save.player.name + ' · 信用点 ' + S.UI.fmt(save.player.credits);
        btns.appendChild(info);
      }
      add('✦ 新的远征', () => {
        if (hasSave) {
          S.UI.confirm('开始新的远征', '开始新游戏将覆盖现有存档，确定吗？', {
            okLabel: '踏上新征程', okKind: 'btn-primary',
            onOk: () => { S.Save.wipe(); this.engine.go('boot', { mode: 'new' }); }
          });
        } else this.engine.go('boot', { mode: 'new' });
      }, 'btn-primary');
      add('✧ 舰船设计手册', () => S.UI.modal({
        title: '舰船设计手册', width: 'wide',
        body: '<div style="font-size:13px;line-height:1.9">' +
          '<p>你的舰队由<b>舰体</b>与<b>部件</b>装配而成（参考《群星》的舰船设计器）：</p>' +
          '<p>◆ <b>武器槽</b>：动能（克护盾）/ 能量（克装甲）/ 导弹（制导、可被点防拦截）/ 点防御（拦截导弹）。S/M/L 三种口径。</p>' +
          '<p>◆ <b>防御槽</b>：护盾（可再生）/ 装甲（不可再生）/ 船体强化。</p>' +
          '<p>◆ <b>核心槽</b>：反应堆（供电）/ 推进器（航速机动）/ 超光速引擎（跃迁距离与充能）/ 作战电脑（射速命中）/ 探测器（扫描勘探）。</p>' +
          '<p>◆ <b>辅助槽</b>：护盾电容、跃迁稳定器、货舱扩容等。</p>' +
          '<p>科技等级 I~V 由累计获得的科研点解锁，等级越高部件越强。</p>' +
          '<p>在空间站「船坞」中建造新船并切换旗舰。</p></div>',
        buttons: [{ label: '明白', kind: 'btn-primary' }]
      }), '');
      add('⌘ 操作指南', () => S.UI.modal({
        title: '操作指南',
        body: '<div style="font-size:13px;line-height:2">' +
          '<b>W/↑</b> 推进　<b>S/↓</b> 制动　<b>A/D</b> 转向　<b>Shift</b> 加力<br>' +
          '<b>T</b> 巡航模式　<b>X</b> 曲速飞行（赶路）<br>' +
          '<b>Space</b> 集火锁定目标　<b>E/Tab</b> 切换目标<br>' +
          '<b>F</b> 扫描行星　<b>鼠标左键</b> 采矿光束　<b>鼠标右键</b> 锁定行星<br>' +
          '<b>滚轮</b> 缩放视野　<b>M</b> 银河星图　<b>B</b> 舰船设计<br>' +
          '<b>Q</b> 空间站对接　<b>Esc</b> 菜单/暂停　<b>J</b> 超空间跃迁（在星图上）</div>',
        buttons: [{ label: '出发！', kind: 'btn-primary' }]
      }), '');
      add('♪ 音效：' + (S.Audio.isMuted() ? '关' : '开'), () => {
        S.Audio.setMuted(!S.Audio.isMuted());
        const p = S.G && S.G.player; if (p) p.settings.muted = S.Audio.isMuted();
        btns.children[btns.children.length - 1].textContent = '♪ 音效：' + (S.Audio.isMuted() ? '关' : '开');
      }, '');
      this.overlay.appendChild(btns);

      const ver = document.createElement('div');
      ver.className = 'menu-version';
      ver.textContent = 'v1.1.0 · 程序化银河 · 免安装 · 在线游玩或双击 index.html 均可';
      this.overlay.appendChild(ver);

      const tips = document.createElement('div');
      tips.className = 'menu-tips';
      const tipList = [
        '先扫描母星系的每一颗行星，科研点能解锁更强部件',
        '动能武器撕碎护盾，能量武器熔穿装甲，导弹会被点防御拦截',
        '小行星带是矿物的宝库，也藏着海盗',
        '超空间航道越远，跃迁充能越久，高级超光速引擎一次能跳 5 个星系',
        '红巨星附近的内行星已被吞没，中子星与黑洞的残骸带资源惊人'
      ];
      tips.innerHTML = '<b>航行日志：</b>' + tipList[Math.floor(Math.random() * tipList.length)];
      this.overlay.appendChild(tips);

      ui.appendChild(this.overlay);
    }

    update(dt) {
      this.t += dt;
      this.demoAngle += dt * 0.05;
      const c = this.engine.cam;
      c.zoom = 0.9;
      c.x = 420; c.y = -260;
    }

    render(ctx) {
      const w = this.engine.width, h = this.engine.height;
      // 显式屏幕空间变换，避免引擎相机残留污染菜单画面
      ctx.save();
      ctx.setTransform(this.engine.dpr, 0, 0, this.engine.dpr, 0, 0);
      this.starfield.render(ctx, this.engine.cam, w, h, this.t);
      // 装饰行星与光晕
      const px = w / 2 - 320, py = h / 2 + 130;
      const g = ctx.createRadialGradient(px, py, 100, px, py, 520);
      g.addColorStop(0, 'rgba(120,180,255,0.12)');
      g.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 520, py - 520, 1040, 1040);
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath(); ctx.arc(0, 0, this.demoPlanet.radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.rotate(this.demoAngle * 0.3);
      ctx.drawImage(S.PlanetTex.get(this.demoPlanet), -this.demoPlanet.radius, -this.demoPlanet.radius, this.demoPlanet.radius * 2, this.demoPlanet.radius * 2);
      ctx.restore();
      // 昼夜阴影
      const sh = ctx.createRadialGradient(px - 60, py - 60, 30, px, py, this.demoPlanet.radius * 1.15);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(px, py, this.demoPlanet.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(140,200,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, this.demoPlanet.radius + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    onLeave() {
      if (this.overlay) this.overlay.remove();
    }
  }

  S.registerScene('menu', MenuScene);
})(typeof window !== 'undefined' ? window : globalThis);