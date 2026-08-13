const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://zunyiqingfeng-code.github.io/stellar-voyager/index.html?scene=flight&seed=20240721';
const PORT = 9451;
const profile = path.join(require('os').tmpdir(), 'sv-planet-' + Date.now());
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(300); } throw new Error('no cdp'); }
(async () => {
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check','--window-size=1920,1080','--force-device-scale-factor=2','--remote-debugging-port=' + PORT,'--user-data-dir=' + profile, URL], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + PORT + '/json');
    const page = targets.find(t => t.type === 'page' && t.url.indexOf('stellar-voyager') >= 0);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    for (let i = 0; i < 60; i++) { const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G.engine'); if (rr === true) break; await sleep(400); }
    const setup = await ev('(function(){ var sc = STARFALL.G.engine.current; sc.pirates = []; sc.target = null; sc.projectiles = []; var sy = STARFALL.getSystem(sc.p.sysId); var pl = sy.planets.filter(function(p){ return p.isGas; })[0] || sy.planets[2]; var wp = sc.planetWorldPos(pl); var pl2 = sy.planets.filter(function(p){ return p.isGas; }).sort(function(a, b){ return b.radius - a.radius; })[0] || sy.planets[2]; var wp2 = sc.planetWorldPos(pl2); sc.updateCamera = function(){}; sc.ship.x = wp2.x; sc.ship.y = wp2.y - pl2.radius - 380; sc.ship.vx = 0; sc.ship.vy = 0; sc.ship.angle = Math.PI / 2; sc.zoomT = 2.2; var cam = sc.engine.cam; cam.x = wp2.x; cam.y = wp2.y - pl2.radius * 0.35; cam.zoom = 2.2; return pl2.name + "/" + pl2.cn + "/" + pl2.type + " r=" + pl2.radius; })()');
    console.log('行星:', setup);
    await sleep(2000);
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', 'gallery-planet.png'), Buffer.from(cap.result.data, 'base64'));
    console.log('saved:', fs.statSync(path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', 'gallery-planet.png')).size, 'bytes');
    ws.close();
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });