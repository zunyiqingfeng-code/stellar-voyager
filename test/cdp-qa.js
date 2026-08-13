/* 星海远航 · CDP 交互 QA（避免反引号的写法） */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html?scene=flight&seed=42';
const PORT = 9223;
const profile = path.join(require('os').tmpdir(), 'sv-cdp-profile-' + Date.now());

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('PASS:', msg); } else { fail++; console.log('FAIL:', msg); } };
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) {
  for (let i = 0; i < (tries || 40); i++) {
    try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {}
    await sleep(250);
  }
  throw new Error('无法连接 CDP');
}

(async () => {
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--disable-logging', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,900', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, URL
  ], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + PORT + '/json');
    const page = targets.find(t => t.type === 'page');
    ok(!!page, '页面目标存在');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0;
    const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    const evalJS = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) return { err: 'EVAL-ERR: ' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text) };
      return { val: r.result && r.result.result ? r.result.result.value : undefined };
    };
    await send('Runtime.enable');
    await evalJS('window.__errs = []; window.addEventListener("error", function(e){ window.__errs.push((e.message || "?") + " @" + String(e.lineno) + ":" + String(e.colno)); }); window.addEventListener("unhandledrejection", function(e){ window.__errs.push("promise:" + String(e.reason && e.reason.message)); }); 1');
    // 等待游戏就绪（轮询）
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const rr = await evalJS('typeof STARFALL !== "undefined" && !!STARFALL.G && !!STARFALL.G.player && !!STARFALL.G.engine');
      if (rr.val === true) { ready = true; break; }
      await sleep(400);
    }
    ok(ready, '游戏初始化完成');
    if (!ready) process.exit(3);

    // 1. 场景初始化
    let r = await evalJS('STARFALL.G.engine.currentName');
    ok(r.val === 'flight', '进入飞行场景');
    r = await evalJS('!!STARFALL.G.player.ship && STARFALL.G.player.ship.hp.hull > 0');
    ok(r.val === true, '旗舰已生成且存活');
    r = await evalJS('document.getElementById("sys-info").innerText');
    ok(typeof r.val === 'string' && r.val.indexOf('星系') >= 0, '系统信息 HUD 显示');

    // 2. 扫描流程
    r = await evalJS('(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var pl = sy.planets[0]; var wp = sc.planetWorldPos(pl); sc.ship.x = wp.x; sc.ship.y = wp.y - pl.radius - 300; sc.ship.vx = 0; sc.ship.vy = 0; sc.scan = { planet: pl, prog: 0 }; return pl.name; })()');
    ok(typeof r.val === 'string', '锁定行星: ' + r.val);
    await sleep(1000);
    r = await evalJS('(function(){ var sc = STARFALL.G.engine.current; var prog = sc.scan ? sc.scan.prog.toFixed(2) : -1; var cp = document.getElementById("center-progress"); return prog + "|" + (cp.classList.contains("hidden") ? "hidden" : "shown"); })()');
    const scanParts = String(r.val).split('|');
    ok(parseFloat(scanParts[0]) > 0.15, '扫描进度推进 (' + scanParts[0] + ')');
    ok(scanParts[1] === 'shown', '扫描进度条显示');
    await evalJS('(function(){ var sc = STARFALL.G.engine.current; sc.scan.prog = 0.999; return 1; })()');
    await sleep(700);
    r = await evalJS('STARFALL.G.player.surveyed > 0');
    ok(r.val === true, '扫描完成并计入勘探数');

    // 3. 星图与跃迁
    await evalJS('(function(){ var sc = STARFALL.G.engine.current; sc.combatNearby = function(){ return false; }; sc.goMap(); return 1; })()');
    await sleep(800);
    r = await evalJS('STARFALL.G.engine.currentName');
    ok(r.val === 'galaxymap', '打开银河星图');
    r = await evalJS('document.getElementById("sys-info").innerText.indexOf("银河星图") >= 0');
    ok(r.val === true, '星图信息条内容显示');
    r = await evalJS('document.getElementById("hud-top").classList.contains("hidden") === false');
    ok(r.val === true, '星图信息条实际可见（修复前被隐藏容器藏住）');
    // 像素级渲染验证：当前星系应精确渲染在数学坐标处（相机污染修复回归）
    r = await evalJS('(function(){ var gm = STARFALL.G.engine.current; var cur = gm.galaxy.systems.find(function(s){ return s.id === gm.p.sysId; }); var dpr = STARFALL.G.engine.dpr; var cv = document.getElementById("game"); var cx = cv.getContext("2d"); var sx = Math.round((cur.x - gm.camX) * gm.zoom + innerWidth / 2); var sy = Math.round((cur.y - gm.camY) * gm.zoom + innerHeight / 2); var p = cx.getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data; return p[0] + "," + p[1] + "," + p[2]; })()');
    const [pr, pg, pb] = String(r.val).split(',').map(Number);
    ok(pr + pg + pb > 200, '当前星系星点渲染于正确屏幕位置（亮度 ' + (pr + pg + pb) + '，修复前此处为黑）');
    r = await evalJS('(function(){ var gm = STARFALL.G.engine.current; var cur = gm.galaxy.systems.find(function(s){ return s.id === gm.p.sysId; }); var nb = gm.galaxy.systems[cur.links[0]]; var dpr = STARFALL.G.engine.dpr; var cv = document.getElementById("game"); var cx = cv.getContext("2d"); var sx = Math.round((nb.x - gm.camX) * gm.zoom + innerWidth / 2); var sy = Math.round((nb.y - gm.camY) * gm.zoom + innerHeight / 2); var p = cx.getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data; return p[0] + "," + p[1] + "," + p[2]; })()');
    const [nr, ng2, nb2] = String(r.val).split(',').map(Number);
    ok(nr + ng2 + nb2 > 150, '相邻星系渲染于正确屏幕位置（亮度 ' + (nr + ng2 + nb2) + '）');
    r = await evalJS('(function(){ var gm = STARFALL.G.engine.current; var cur = gm.galaxy.systems.find(function(s){ return s.id === gm.p.sysId; }); var nb = gm.galaxy.systems[cur.links[0]]; gm.startJump(nb); return nb.name; })()');
    ok(typeof r.val === 'string', '启动跃迁 → ' + r.val);
    await sleep(4500);
    r = await evalJS('STARFALL.G.engine.currentName');
    ok(r.val === 'flight', '跃迁后返回飞行场景');
    r = await evalJS('STARFALL.G.player.jumps >= 1');
    ok(r.val === true, '跃迁计数增加');

    // 4. 舰船设计器
    r = await evalJS('(function(){ try { STARFALL.G.engine.current.openDesigner(); return "ok"; } catch (e) { return "err:" + e.message; } })()');
    ok(r.val === 'ok', '设计器调用无异常 (' + r.val + ')');
    await sleep(700);
    r = await evalJS('document.querySelectorAll(".modal").length > 0 && !!document.querySelector(".designer-stats")');
    ok(r.val === true, '设计器面板打开并渲染属性');
    r = await evalJS('document.querySelector(".designer-stats").innerText.indexOf("武器 DPS") >= 0');
    ok(r.val === true, '设计器统计含武器DPS');
    await evalJS('(function(){ var btns = document.querySelectorAll(".modal-foot .btn"); for (var i = 0; i < btns.length; i++) if (btns[i].textContent.indexOf("关闭") >= 0) { btns[i].click(); break; } return 1; })()');
    await sleep(500);
    r = await evalJS('STARFALL.G.engine.current.docked === false');
    ok(r.val === true, '设计器关闭恢复控制');

    // 5. 空间站对接 + 贸易
    r = await evalJS('(function(){ try { var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var a = sy.station.angle + STARFALL.G.time * sy.station.orbitSpeed; sc.ship.x = Math.cos(a) * sy.station.orbitRadius; sc.ship.y = Math.sin(a) * sy.station.orbitRadius; sc.ship.vx = 0; sc.ship.vy = 0; STARFALL.G.player.cargo.ore = 30; sc.tryDock(); return "ok"; } catch (e) { return "err:" + e.message; } })()');
    ok(r.val === 'ok', '对接调用无异常 (' + r.val + ')');
    await sleep(700);
    r = await evalJS('document.querySelectorAll(".modal").length > 0 && document.body.innerText.indexOf("贸易码头") >= 0');
    ok(r.val === true, '空间站对接成功，贸易页签渲染');
    r = await evalJS('(function(){ var bs = document.querySelectorAll(".trade-row button"); for (var i = 0; i < bs.length; i++) if (bs[i].textContent === "交易" && !bs[i].disabled) { bs[i].click(); break; } return STARFALL.G.player.cargo.ore; })()');
    ok(r.val === 20, '出售矿石成功（剩 ' + r.val + '）');
    r = await evalJS('(function(){ var btns = document.querySelectorAll(".station-tabs .btn"); for (var i = 0; i < btns.length; i++) if (btns[i].textContent === "任务") btns[i].click(); return document.body.innerText.indexOf("任务板") >= 0; })()');
    ok(r.val === true, '任务板渲染');
    r = await evalJS('(function(){ var bs = document.querySelectorAll(".comp-row button"); for (var i = 0; i < bs.length; i++) if (bs[i].textContent === "接受") { bs[i].click(); break; } return STARFALL.G.player.missions.filter(function(m){ return !m.done; }).length; })()');
    ok(r.val === 1, '接取任务成功');
    r = await evalJS('(function(){ var btns = document.querySelectorAll(".station-tabs .btn"); for (var i = 0; i < btns.length; i++) if (btns[i].textContent === "修理") btns[i].click(); return document.body.innerText.indexOf("旗舰") >= 0; })()');
    ok(r.val === true, '修理页签渲染');
    await evalJS('(function(){ var x = document.querySelector(".modal .x-btn"); if (x) x.click(); return 1; })()');
    await sleep(500);
    r = await evalJS('(function(){ var sc = STARFALL.G.engine.current; return JSON.stringify({ docked: sc.docked, paused: sc.paused, dead: sc.dead, t: STARFALL.G.time.toFixed(2), modals: document.querySelectorAll(".modal").length }); })()');
    console.log('STATE after station close:', r.val);
    await sleep(1200);
    r = await evalJS('STARFALL.G.time.toFixed(2)');
    console.log('TIME advanced to:', r.val);
    r = await evalJS('JSON.stringify(window.__errs)');
    console.log('PAGE ERRORS:', r.val);
    r = await evalJS('JSON.stringify((window.__loopErrs || []).slice(0, 2))');
    console.log('LOOP ERRORS:', r.val);

    // 6. 战斗模拟
    r = await evalJS('(function(){ var sc = STARFALL.G.engine.current; var pk = STARFALL.Combat.makePirate(new STARFALL.Rand(7), "测试海盗", 1); pk.x = sc.ship.x + 300; pk.y = sc.ship.y + 180; pk.angle = Math.PI; pk.vx = 0; pk.vy = 0; pk.ai = { state: "attack", strafe: 1, wander: 0, faction: "测试海盗", think: 0 }; pk.hp.shield = 0; pk.hp.armor = 0; sc.pirates = [pk]; sc.target = pk; sc.projectiles = []; return pk.stats.hull; })()');
    ok(typeof r.val === 'number', '海盗出现（船体 ' + r.val + '）');
    const initialPirateHull = r.val;
    await sleep(4200);
    r = await evalJS('(function(){ var sc = STARFALL.G.engine.current; var pk = sc.pirates[0]; return JSON.stringify({ hp: pk ? Math.round(pk.hp.hull) : -1, shield: pk ? Math.round(pk.hp.shield) : -1, proj: sc.projectiles.length, shipHull: Math.round(sc.ship.hp.hull) }); })()');
    const cmb = JSON.parse(r.val);
    console.log('COMBAT state:', r.val);
    ok(cmb.hp < initialPirateHull, '海盗船体受损（破盾后） (' + initialPirateHull + ' → ' + cmb.hp + ')');
    ok(cmb.shipHull > 0, '玩家旗舰存活 (' + cmb.shipHull + ' 船体)');
    await evalJS('(function(){ var sc = STARFALL.G.engine.current; var pk = sc.pirates[0]; pk.hp.hull = 0; pk.hp.shield = 0; pk.hp.armor = 0; sc.onShipDestroyed(pk); return 1; })()');
    await sleep(400);
    r = await evalJS('(function(){ var sc = STARFALL.G.engine.current; return JSON.stringify({ pirates: sc.pirates.length, kills: STARFALL.G.player.kills, credits: STARFALL.G.player.credits }); })()');
    const killState = JSON.parse(r.val);
    ok(killState.kills >= 1, '击毁海盗计数与赏金 (' + killState.kills + ' 击杀, ' + killState.credits + ' 信用点)');
    ok(killState.pirates === 0, '海盗移除');

    // 7. 存档/读档
    r = await evalJS('STARFALL.saveGame()');
    ok(r.val === true, '存档成功');
    r = await evalJS('(function(){ var before = STARFALL.G.player.science; STARFALL.continueGame(); return JSON.stringify({ science: STARFALL.G.player.science, ship: !!STARFALL.G.player.ship, sysId: STARFALL.G.player.sysId, before: before }); })()');
    const cont = JSON.parse(r.val);
    ok(cont.ship === true && cont.sysId != null, '读档后旗舰与位置恢复');
    ok(cont.science === cont.before, '读档数据一致 (' + cont.science + ')');

    // 8. 截图
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      fs.writeFileSync(path.join(__dirname, '..', 'qa', 'cdp-final.png'), Buffer.from(shot.result.data, 'base64'));
      console.log('INFO: 终局截图已保存 qa/cdp-final.png');
    }
    ws.close();
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('---');
  console.log(fail === 0 ? '✔ CDP 交互 QA 全部通过 (' + pass + ' 项)' : '✖ ' + fail + ' 项失败 / ' + pass + ' 项通过');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('QA 崩溃:', e.message); process.exit(2); });