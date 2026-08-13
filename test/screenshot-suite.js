/* 星海远航 · 线上站点高清截图套件：真实渲染各游戏界面并保存到 qa/ */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'https://zunyiqingfeng-code.github.io/stellar-voyager/';
let done = 0, failed = 0;
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(300); } throw new Error('no cdp'); }

async function captureScene(shot) {
  const port = 9300 + Math.floor(Math.random() * 400);
  const profile = path.join(require('os').tmpdir(), 'sv-shot-' + shot.name + '-' + Date.now());
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check',
    '--window-size=1920,1080','--force-device-scale-factor=2','--remote-debugging-port=' + port,'--user-data-dir=' + profile, shot.url], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + port + '/json');
    const page = targets.find(t => t.type === 'page' && t.url.indexOf('stellar-voyager') >= 0);
    if (!page) throw new Error('未找到游戏页面');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    // 就绪轮询
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G && !!STARFALL.G.engine');
      if (rr === true) { ready = true; break; }
      await sleep(400);
    }
    if (!ready) throw new Error('游戏未就绪');
    // 场景专属状态布置
    for (const setup of (shot.setup || [])) {
      const rr = await ev(setup);
      if (typeof rr === 'string' && rr.indexOf('ERR:') === 0) throw new Error(rr);
    }
    await sleep(shot.waitMs || 1500);
    // 截图
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    if (!cap.result || !cap.result.data) throw new Error('截图失败');
    const file = path.join(__dirname, '..', 'qa', shot.name + '.png');
    fs.writeFileSync(file, Buffer.from(cap.result.data, 'base64'));
    const kb = Math.round(fs.statSync(file).size / 1024);
    done++;
    console.log('✔ ' + shot.name + '.png (' + kb + ' KB)');
    ws.close();
  } catch (e) {
    failed++;
    console.log('✖ ' + shot.name + ': ' + e.message);
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

(async () => {
  const seedUrl = BASE + 'index.html?scene=flight&seed=20240721';
  const scenes = [
    { name: 'gallery-menu', url: BASE, waitMs: 3000 },
    { name: 'gallery-flight', url: seedUrl, waitMs: 2000, setup: [
      '(function(){ var sc = STARFALL.G.engine.current; sc.ship.x = 0; sc.ship.y = -1900; sc.ship.vx = 0; sc.ship.vy = 0; sc.zoomT = 0.42; return 1; })()' ] },
    { name: 'gallery-planet', url: seedUrl, waitMs: 2000, setup: [
      '(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var pl = sy.planets.filter(function(p){ return p.isGas; })[0] || sy.planets[2]; var wp = sc.planetWorldPos(pl); sc.ship.x = wp.x; sc.ship.y = wp.y - pl.radius - 620; sc.ship.vx = 0; sc.ship.vy = 0; sc.zoomT = 1.0; return pl.name + "/" + pl.cn; })()' ] },
    { name: 'gallery-galaxy', url: BASE + 'index.html?scene=galaxy&seed=20240721', waitMs: 2500 },
    { name: 'gallery-designer', url: seedUrl, waitMs: 1200, setup: [
      '(function(){ STARFALL.G.engine.current.openDesigner(); return 1; })()' ] },
    { name: 'gallery-station', url: seedUrl, waitMs: 1200, setup: [
      '(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var a = sy.station.angle + STARFALL.G.time * sy.station.orbitSpeed; sc.ship.x = Math.cos(a) * sy.station.orbitRadius; sc.ship.y = Math.sin(a) * sy.station.orbitRadius; sc.ship.vx = 0; sc.ship.vy = 0; STARFALL.G.player.cargo.ore = 60; STARFALL.G.player.cargo.rare = 3; sc.tryDock(); return 1; })()' ] },
    { name: 'gallery-planetdetail', url: seedUrl, waitMs: 1200, setup: [
      '(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var pl = sy.planets.filter(function(p){ return !p.isGas; })[1] || sy.planets[0]; pl.surveyed = true; if (!STARFALL.G.player.discovered[sc.p.sysId + ":" + pl.id]) STARFALL.G.player.discovered[sc.p.sysId + ":" + pl.id] = {}; STARFALL.G.player.discovered[sc.p.sysId + ":" + pl.id].surveyed = true; sc.showPlanetInfo(pl); return pl.name; })()' ] },
    { name: 'gallery-combat', url: seedUrl, waitMs: 1800, setup: [
      '(function(){ var sc = STARFALL.G.engine.current; var rnd = new STARFALL.Rand(77); for (var i = 0; i < 2; i++) { var pk = STARFALL.Combat.makePirate(rnd, "血颅掠夺者", 2); pk.x = sc.ship.x + 420 + i * 260; pk.y = sc.ship.y + 120 + i * 200; pk.angle = Math.PI; pk.vx = 0; pk.vy = 0; pk.ai = { state: "attack", strafe: i ? 1 : -1, wander: 0, faction: "血颅掠夺者", think: 0 }; sc.pirates.push(pk); } sc.target = sc.pirates[0]; return 1; })()' ] }
  ];
  for (const s of scenes) await captureScene(s);
  console.log('---');
  console.log(failed === 0 ? '✔ 全部截图完成 ' + done + ' 张' : '✖ ' + failed + ' 张失败 / ' + done + ' 张成功');
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('套件崩溃:', e.message); process.exit(2); });