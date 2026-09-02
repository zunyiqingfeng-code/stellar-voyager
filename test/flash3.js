const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html';
const PORT = 9504;
const profile = path.join(require('os').tmpdir(), 'sv-flash3-' + Date.now());
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(200); } throw new Error('no cdp'); }
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
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : 'EXC'; };
    await sleep(600);
    // 读取当前变换矩阵 + 颜色采样
    console.log('transform:', await ev('(function(){ var m = STARFALL.G.engine.ctx.getTransform(); return JSON.stringify([m.a, m.b, m.c, m.d, m.e, m.f]); })()'));
    console.log('colors:', await ev('(function(){ var cv = document.getElementById("game"); var cx = cv.getContext("2d"); var s = []; for (var x = 1490; x < 1560; x += 10) for (var y = 778; y < 800; y += 6) { var p = cx.getImageData(x, y, 1, 1).data; if (p[0]+p[1]+p[2] > 60) s.push(p[0]+","+p[1]+","+p[2]); } return s.slice(0, 8).join(" / "); })()'));
    // 用恒等变换手动重绘 boot，看文字去哪
    console.log(await ev('(function(){ var eng = STARFALL.G.engine; var ctx = eng.ctx; ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle = "#05070f"; ctx.fillRect(0,0,cv_width(),cv_height()); function cv_width(){ return 0; } ctx.fillStyle = "#8be6ff"; ctx.font = "600 34px sans-serif"; ctx.textAlign = "center"; ctx.fillText("TEST", eng.width/2, eng.height/2); var img = ctx.getImageData(0, 0, cv.width, cv.height).data; var minX=1e9,minY=1e9,maxX=-1,maxY=-1; for (var y = 0; y < cv.height; y += 2) for (var x = 0; x < cv.width; x += 2) { var i = (y*cv.width+x)*4; if (img[i]+img[i+1]+img[i+2] > 60) { if (x<minX)minX=x; if (x>maxX)maxX=x; if (y<minY)minY=y; if (y>maxY)maxY=y; } } return "TEST bbox: " + minX + "," + minY + " -> " + maxX + "," + maxY; })()'.replace('cv_width(),cv_height()','eng.canvas.width,eng.canvas.height').replace('var cv_width(){ return 0; }','').replace('cv.width','eng.canvas.width').replace('cv.height','eng.canvas.height')));
    ws.close();
  } finally { edge.kill(); try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });