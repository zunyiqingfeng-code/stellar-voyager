const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9512;
const profile = path.join(require('os').tmpdir(), 'sv-shot-' + Date.now());
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(300); } throw new Error('no cdp'); }
(async () => {
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check','--window-size=1600,900','--force-device-scale-factor=1.5','--remote-debugging-port=' + PORT,'--user-data-dir=' + profile, 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html'], { stdio: 'ignore' });
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
    for (let i = 0; i < 40; i++) { const s = await ev('STARFALL.G.engine.currentName'); if (s === 'menu') break; await sleep(300); }
    await sleep(2000);
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    const f = path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', 'gallery-menu.png');
    fs.writeFileSync(f, Buffer.from(cap.result.data, 'base64'));
    console.log('gallery-menu:', Math.round(fs.statSync(f).size / 1024) + ' KB');
    ws.close();
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(0);
})().catch(function (e) { console.error('ERR:', e.message); process.exit(2); });