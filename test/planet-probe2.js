const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html';
const PORT = 9508;
const profile = path.join(require('os').tmpdir(), 'sv-planet2-' + Date.now());
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
    for (let i = 0; i < 60; i++) { const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G && !!STARFALL.G.engine'); if (rr === true) break; await sleep(400); }
    for (let i = 0; i < 40; i++) { const s2 = await ev('STARFALL.G.engine.currentName'); if (s2 === 'menu') break; await sleep(300); }
    console.log('hi-res:', await ev('(function(){ var sc = STARFALL.G.engine.current; if (!sc.demoPlanet) return "nope"; STARFALL.PlanetTex.dropCache(sc.demoPlanet); var t0 = performance.now(); var tex = STARFALL.PlanetTex.get(sc.demoPlanet); return tex.width + "x" + tex.height + " in " + (performance.now()-t0).toFixed(1) + "ms type=" + sc.demoPlanet.type + " hires=" + sc.demoPlanet.hires; })()'));
    // 重新生成后采样
    await sleep(200);
    console.log('colors:', await ev('(function(){ var sc = STARFALL.G.engine.current; var tex = STARFALL.PlanetTex.get(sc.demoPlanet); var cx = tex.getContext("2d"); var img = cx.getImageData(0,0,tex.width,tex.height).data; var red=0,blue=0,green=0,white=0; for (var i = 0; i < img.length; i += 16) { var r=img[i],g=img[i+1],b=img[i+2],a=img[i+3]; if (a < 50) continue; if (r>180 && g<100 && b<100) red++; if (b>140 && r<120 && g<170) blue++; if (g>120 && r<150 && b<130) green++; if (r>220 && g>220 && b>220) white++; } return "红=" + red + " 蓝=" + blue + " 绿=" + green + " 白=" + white; })()'));
    // 截图菜单
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', 'v12-menu.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('shot saved:', fs.statSync(path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', 'v12-menu.png')).size, 'bytes');
    ws.close();
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });