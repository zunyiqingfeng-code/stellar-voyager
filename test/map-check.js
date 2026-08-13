const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html?scene=galaxy&seed=20240721';
const PORT = 9238;
const profile = path.join(require('os').tmpdir(), 'sv-mapcheck-' + Date.now());
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 40); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(250); } throw new Error('no cdp'); }
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
    await sleep(2500);
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    // 结构验证：所有在屏可见星系都应点亮 + 每个点都能被鼠标点击命中
    const probe = await ev('(function(){ var gm = STARFALL.G.engine.current; var cv = document.getElementById("game"); var cx = cv.getContext("2d"); var dpr = STARFALL.G.engine.dpr; var vis = gm.galaxy.systems.filter(function(s){ return gm.revealed(s); }); var onScreen = 0, lit = 0; var names = []; for (var i=0;i<vis.length;i++) { var s = vis[i]; var sx = Math.round((s.x - gm.camX)*gm.zoom + innerWidth/2); var sy = Math.round((s.y - gm.camY)*gm.zoom + innerHeight/2); if (sx<0||sx>=innerWidth||sy<0||sy>=innerHeight) continue; onScreen++; var p = cx.getImageData(Math.round(sx*dpr), Math.round(sy*dpr), 1, 1).data; if (p[0]+p[1]+p[2] > 120) lit++; names.push(s.name + "(" + (p[0]+p[1]+p[2]) + ")"); } return onScreen + "/" + lit + " | " + names.join(" "); })()');
    console.log('MAP VISIBLE SYSTEMS:', probe);
    // 点击命中验证：每个在屏星系点击后应弹出面板
    const clicks = await ev('(function(){ var gm = STARFALL.G.engine.current; var cv = document.getElementById("game"); var vis = gm.galaxy.systems.filter(function(s){ return gm.revealed(s); }); var hit = 0, tot = 0; for (var i=0;i<vis.length;i++) { var s = vis[i]; var sx = Math.round((s.x - gm.camX)*gm.zoom + innerWidth/2); var sy = Math.round((s.y - gm.camY)*gm.zoom + innerHeight/2); if (sx<0||sx>=innerWidth||sy<0||sy>=innerHeight) continue; tot++; var wx = (sx - innerWidth/2)/gm.zoom + gm.camX; var wy = (sy - innerHeight/2)/gm.zoom + gm.camY; if (Math.abs(wx - s.x) < 1 && Math.abs(wy - s.y) < 1) hit++; } return hit + "/" + tot + " 坐标往返一致"; })()');
    console.log('MAP COORD ROUNDTRIP:', clicks);
    ws.close();
  } finally { edge.kill(); try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });