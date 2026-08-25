const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://zunyiqingfeng-code.github.io/stellar-voyager/';
const PORT = 9490;
const profile = path.join(require('os').tmpdir(), 'sv-final-' + Date.now());
let pass = 0, fail = 0;
const ok2 = (c, m) => { if (c) { pass++; console.log('PASS:', m); } else { fail++; console.log('FAIL:', m); } };
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 60); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(300); } throw new Error('no cdp'); }
(async () => {
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check','--window-size=1600,900','--remote-debugging-port=' + PORT,'--user-data-dir=' + profile, URL], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + PORT + '/json');
    const page = targets.find(t => t.type === 'page' && t.url.indexOf('stellar-voyager') >= 0);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : 'EXC'; };
    let ready = false;
    for (let i = 0; i < 60; i++) { const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G && !!STARFALL.G.engine'); if (rr === true) { ready = true; break; } await sleep(500); }
    ok2(ready, '线上版加载就绪');
    for (let i = 0; i < 40; i++) { const s = await ev('STARFALL.G.engine.currentName'); if (s === 'menu') break; await sleep(300); }
    ok2(await ev('STARFALL.G.engine.currentName') === 'menu', '进入主菜单');
    await ev('(function(){ var bs = document.querySelectorAll(".menu-buttons .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("新的远征") >= 0) { bs[i].click(); return 1; } return -1; })()');
    for (let i = 0; i < 40; i++) { const s = await ev('STARFALL.G.engine.currentName'); if (s === 'flight') break; await sleep(250); }
    ok2(await ev('STARFALL.G.engine.currentName') === 'flight', '新游戏直接起航');
    // 雷达在线上渲染
    ok2(await ev('(function(){ var cv = document.getElementById("radar"); if (!cv) return false; var cx = cv.getContext("2d"); var img = cx.getImageData(0, 0, cv.width, cv.height).data; var n = 0; for (var i = 3; i < img.length; i += 16) if (img[i] > 30) n++; return n > 300; })()') === true, '雷达小地图渲染正常');
    // 海盗成长函数生效（tier 上限 4 / 驱逐舰）
    ok2(await ev('(function(){ var pk = STARFALL.Combat.makePirate(new STARFALL.Rand(5), "测试", 4); return pk.hullId === "destroyer" && pk.bounty >= 400; })()') === true, '海盗 IV 级驱逐舰与赏金成长');
    ok2(await ev('JSON.stringify((window.__loopErrs || []).slice(0, 3))') === '[]', '零运行时异常');
    ws.close();
  } finally { edge.kill(); try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  console.log('---');
  console.log(fail === 0 ? '✔ 线上 v1.1.1 验证全部通过 (' + pass + ' 项)' : '✖ ' + fail + ' 项失败');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });