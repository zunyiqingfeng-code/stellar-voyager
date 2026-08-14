/* 竖版封面采集：1080x1440 3:4 构图（小红书信息流） */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://zunyiqingfeng-code.github.io/stellar-voyager/index.html?scene=flight&seed=20240721';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(300); } throw new Error('no cdp'); }
async function shoot(name, port, setupFn, waitMs) {
  const profile = path.join(require('os').tmpdir(), 'sv-cover-' + name + '-' + Date.now());
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check',
    '--window-size=1080,1440','--force-device-scale-factor=1.5','--remote-debugging-port=' + port,'--user-data-dir=' + profile, URL], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + port + '/json');
    const page = targets.find(t => t.type === 'page' && t.url.indexOf('stellar-voyager') >= 0);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    for (let i = 0; i < 60; i++) { const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G.engine'); if (rr === true) break; await sleep(400); }
    const info = await ev(setupFn);
    await sleep(waitMs);
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', name + '.png');
    fs.writeFileSync(file, Buffer.from(cap.result.data, 'base64'));
    console.log(name + ' -> ' + Math.round(fs.statSync(file).size / 1024) + ' KB (' + info + ')');
    ws.close();
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
}
(async () => {
  // 封面A：冰巨星竖构图（行星占下方 2/3）
  await shoot('gallery-cover-planet', 9461, '(function(){ var sc = STARFALL.G.engine.current; sc.showHUD(false); sc.pirates = []; sc.target = null; sc.projectiles = []; var sy = STARFALL.getSystem(sc.p.sysId); var pl = sy.planets.filter(function(p){ return p.isGas; }).sort(function(a, b){ return b.radius - a.radius; })[0]; pl.orbitSpeed = 0; pl.orbitAngle = Math.PI / 2; var wp = sc.planetWorldPos(pl); var tb = document.getElementById("toasts"); while (tb.firstChild) tb.removeChild(tb.firstChild); var zoom = Math.min(2.6, Math.max(1.2, 300 / pl.radius)); sc.updateCamera = function(){}; sc.ship.x = wp.x; sc.ship.y = wp.y - pl.radius - 340; sc.ship.vx = 0; sc.ship.vy = 0; sc.ship.angle = Math.PI / 2; sc.zoomT = zoom; var cam = sc.engine.cam; cam.x = wp.x; cam.y = wp.y - pl.radius * 0.5; cam.zoom = zoom; return pl.name + " r=" + Math.round(pl.radius) + " zoom=" + zoom.toFixed(2); })()', 2200);
  // 封面B：遭遇战竖构图（动态感）
  await shoot('gallery-cover-combat', 9462, '(function(){ var sc = STARFALL.G.engine.current; sc.showHUD(false); sc.updateCamera = function(){}; var tb = document.getElementById("toasts"); while (tb.firstChild) tb.removeChild(tb.firstChild); var rnd = new STARFALL.Rand(99); sc.pirates = []; sc.projectiles = []; for (var i = 0; i < 3; i++) { var pk = STARFALL.Combat.makePirate(rnd, "血颅掠夺者", 2); pk.x = sc.ship.x + 420 + i * 240; pk.y = sc.ship.y - 260 + i * 340; pk.angle = Math.PI; pk.vx = 0; pk.vy = 0; pk.ai = { state: "attack", strafe: i % 2 ? 1 : -1, wander: 0, faction: "血颅掠夺者", think: 0 }; sc.pirates.push(pk); } sc.target = sc.pirates[0]; var cam = sc.engine.cam; cam.x = sc.ship.x + 360; cam.y = sc.ship.y - 160; cam.zoom = 1.5; sc.zoomT = 1.5; return "3 pirates"; })()', 2400);
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });