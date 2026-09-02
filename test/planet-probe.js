const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html';
const PORT = 9506;
const profile = path.join(require('os').tmpdir(), 'sv-planet-probe-' + Date.now());
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
    // 等到进入 menu 场景（boot 开屏 1.4s）
    for (let i = 0; i < 40; i++) { const s2 = await ev('STARFALL.G.engine.currentName'); if (s2 === 'menu') break; await sleep(300); }
    // 菜单行星 hi-res 贴图生成耗时
    console.log(await ev('(function(){ var sc = STARFALL.G.engine.current; if (!sc || !sc.demoPlanet) return "no-menu"; var t0 = performance.now(); var tex = STARFALL.PlanetTex.get(sc.demoPlanet); var ms = performance.now() - t0; return "hi-res " + tex.width + "x" + tex.height + " 生成 " + ms.toFixed(1) + "ms"; })()'));
    // 行星像素采样：检查是否有红色斑块（r>200, g<80, b<80）
    console.log(await ev('(function(){ var sc = STARFALL.G.engine.current; var tex = STARFALL.PlanetTex.get(sc.demoPlanet); var cx = tex.getContext("2d"); var img = cx.getImageData(0,0,tex.width,tex.height).data; var red=0, blue=0, green=0, white=0, total=0; for (var i = 0; i < img.length; i += 16) { total++; var r=img[i],g=img[i+1],b=img[i+2],a=img[i+3]; if (a < 50) continue; if (r>180 && g<100 && b<100) red++; if (r<80 && b>140) blue++; if (g>120 && r<150 && b<120) green++; if (r>220 && g>220 && b>220) white++; } return JSON.stringify({ red: red, blue: blue, green: green, white: white, total: total, redPct: (red/total*100).toFixed(1) }); })()'));
    // 雷达现在默认隐藏？
    console.log('radar hidden:', await ev('document.getElementById("radar").classList.contains("hidden")'));
    ws.close();
  } finally { edge.kill(); try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });