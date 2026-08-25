/* 性能基线/回归探针：FPS（小行星带）+ 单帧渲染耗时 + 行星贴图冷生成耗时 */
const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html?scene=flight&seed=20240721';
const PORT = Number(process.env.SV_PORT || 9470);
const profile = path.join(require('os').tmpdir(), 'sv-perf-' + Date.now());
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(300); } throw new Error('no cdp'); }
(async () => {
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check','--window-size=1600,900','--remote-debugging-port=' + PORT,'--user-data-dir=' + profile, URL], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + PORT + '/json');
    const page = targets.find(t => t.type === 'page' && t.url.indexOf('stellar') >= 0);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    for (let i = 0; i < 60; i++) { const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G.engine'); if (rr === true) break; await sleep(400); }
    console.log(await ev('(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); if (!sy.belt) return "no-belt"; var mid = (sy.belt.inner + sy.belt.outer)/2; sc.ship.x = mid; sc.ship.y = 0; sc.ship.vx = 0; sc.ship.vy = 0; var cam = sc.engine.cam; cam.x = mid; cam.y = 0; cam.zoom = 0.8; sc.zoomT = 0.8; return "belt rocks=" + sc.rocks.length; })()'));
    await sleep(1500);
    console.log('FPS(belt):', await ev('(function(){ return new Promise(function(res){ var n = 0; var t0 = performance.now(); function f(){ n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res((n/3).toFixed(1)); } requestAnimationFrame(f); }); })()'));
    console.log('renderMs:', await ev('(function(){ var eng = STARFALL.G.engine; var ctx = eng.ctx; var c = eng.cam, d = eng.dpr; var t0 = performance.now(); for (var i = 0; i < 20; i++) { ctx.setTransform(d*c.zoom,0,0,d*c.zoom, d*(eng.width/2-c.x*c.zoom), d*(eng.height/2-c.y*c.zoom)); eng.current.render(ctx); } return ((performance.now()-t0)/20).toFixed(2) + "ms"; })()'));
    console.log(await ev('(function(){ var sy = STARFALL.getSystem(STARFALL.G.player.sysId); var t0 = performance.now(); var n = 0; for (var i = 0; i < sy.planets.length; i++) { var p = sy.planets[i]; STARFALL.PlanetTex.dropCache(p); STARFALL.PlanetTex.get(p); n++; } return "planetColdGen: planets=" + n + " ms=" + (performance.now()-t0).toFixed(0); })()'));
    ws.close();
  } finally { edge.kill(); try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });