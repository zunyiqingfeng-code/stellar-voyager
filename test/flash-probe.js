const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html';
const PORT = 9502;
const profile = path.join(require('os').tmpdir(), 'sv-flash2-' + Date.now());
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
    console.log('=== 加载初期状态 ===');
    console.log(await ev('(function(){ var cv = document.getElementById("game"); var dpr = window.devicePixelRatio; var cx = cv.getContext("2d"); var img = cx.getImageData(0, 0, cv.width, cv.height).data; var minX=1e9,minY=1e9,maxX=-1,maxY=-1,count=0; for (var y = 0; y < cv.height; y += 2) for (var x = 0; x < cv.width; x += 2) { var i = (y*cv.width+x)*4; if (img[i]+img[i+1]+img[i+2] > 60) { count++; if (x<minX)minX=x; if (x>maxX)maxX=x; if (y<minY)minY=y; if (y>maxY)maxY=y; } } return JSON.stringify({ dpr: dpr, bitmap: cv.width + "x" + cv.height, css: cv.style.width, scene: (typeof STARFALL !== "undefined" && STARFALL.G.engine) ? STARFALL.G.engine.currentName : "loading", engW: (typeof STARFALL !== "undefined" && STARFALL.G.engine) ? STARFALL.G.engine.width : -1, brightPixels: count, bbox: minX + "," + minY + " -> " + maxX + "," + maxY }); })()'));
    console.log('radar visible:', await ev('(function(){ var r = document.getElementById("radar"); var rect = r.getBoundingClientRect(); return "display=" + (r.classList.contains("hidden") ? "hidden" : "visible") + " rect=" + Math.round(rect.left) + "," + Math.round(rect.top) + " " + rect.width + "x" + rect.height; })()'));
    ws.close();
  } finally { edge.kill(); try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });