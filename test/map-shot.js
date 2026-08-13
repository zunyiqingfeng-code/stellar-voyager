const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html?scene=flight&seed=20240721';
const PORT = 9237;
const profile = path.join(require('os').tmpdir(), 'sv-mapshot-' + Date.now());
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
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    await sleep(3000);
    console.log('scene1:', await ev('STARFALL.G.engine.currentName'));
    // 真实按键 M 打开星图（走真实路径，含飞行相机状态）
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyM', key: 'm', windowsVirtualKeyCode: 77, nativeVirtualKeyCode: 77 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyM', key: 'm', windowsVirtualKeyCode: 77, nativeVirtualKeyCode: 77 });
    await sleep(1200);
    console.log('scene2:', await ev('STARFALL.G.engine.currentName'));
    // 像素分析：全画面亮度/彩色统计 + 中心星点亮度
    const probe = await ev('(function(){ var gm = STARFALL.G.engine.current; var cv = document.getElementById("game"); var cx = cv.getContext("2d"); var W = cv.width, H = cv.height; var img = cx.getImageData(0, 0, W, H).data; var bright = 0, colored = 0; var step = Math.max(16, Math.floor(img.length / 4 / 40000) * 4); for (var i = 0; i < img.length; i += step) { var r = img[i], g = img[i+1], b = img[i+2]; if (r+g+b > 140) bright++; if (Math.max(r,g,b) - Math.min(r,g,b) > 45) colored++; } var cur = gm.galaxy.systems.find(function(s){ return s.id === gm.p.sysId; }); var dpr = STARFALL.G.engine.dpr; var sx = Math.round((cur.x - gm.camX) * gm.zoom + innerWidth/2); var sy = Math.round((cur.y - gm.camY) * gm.zoom + innerHeight/2); var p = cx.getImageData(Math.round(sx*dpr), Math.round(sy*dpr), 1, 1).data; return JSON.stringify({ bright: bright, colored: colored, center: p[0]+p[1]+p[2] }); })()');
    console.log('PROBE:', probe);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      const file = path.join(__dirname, '..', 'qa', 'galaxy-realpath.png');
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      console.log('saved:', fs.statSync(file).size, 'bytes');
    }
    ws.close();
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });