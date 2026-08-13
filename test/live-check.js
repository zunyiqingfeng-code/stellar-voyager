const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://zunyiqingfeng-code.github.io/stellar-voyager/';
const PORT = 9240;
const profile = path.join(require('os').tmpdir(), 'sv-live-' + Date.now());
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('PASS:', msg); } else { fail++; console.log('FAIL:', msg); } };
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getJson(url, tries) { for (let i = 0; i < (tries || 40); i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch (e) {} await sleep(250); } throw new Error('no cdp'); }
(async () => {
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--disable-logging','--no-first-run','--no-default-browser-check','--window-size=1600,900','--remote-debugging-port=' + PORT,'--user-data-dir=' + profile, URL], { stdio: 'ignore' });
  try {
    const targets = await getJson('http://127.0.0.1:' + PORT + '/json');
    const page = targets.find(t => t.type === 'page' && t.url.indexOf('stellar-voyager') >= 0);
    ok(!!page, '线上页面已加载');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); const v = r.result && r.result.result; return v ? (v.value !== undefined ? v.value : v.description) : undefined; };
    // 就绪轮询（线上首访 SSL/脚本加载可能较慢）
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const rr = await ev('typeof STARFALL !== "undefined" && !!STARFALL.G && !!STARFALL.G.engine');
      if (rr === true) { ready = true; break; }
      await sleep(500);
    }
    ok(ready, '线上版脚本加载就绪');
    const waitScene = async (name, tries) => { for (let i = 0; i < (tries || 40); i++) { const s = await ev('STARFALL.G.engine.currentName'); if (s === name) return true; await sleep(250); } return false; };
    ok(await waitScene('menu', 40), '线上版冷启动进入主菜单');
    ok(await ev('!!document.querySelector(".menu-overlay")') === true, '菜单界面渲染');
    const errs = await ev('JSON.stringify((window.__loopErrs || []).slice(0, 4))');
    ok(errs === '[]', '零运行时异常' + (errs !== '[]' ? '（详情: ' + errs + '）' : ''));
    // 点击新的远征
    await ev('(function(){ var bs = document.querySelectorAll(".menu-buttons .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("新的远征") >= 0) { bs[i].click(); return i; } return -1; })()');
    ok(await waitScene('flight', 40), '线上版进入飞行场景');
    ok(await ev('document.getElementById("sys-info").innerText.indexOf("星系") >= 0') === true, '飞行 HUD 正常');
    // 存档写入验证（localStorage 在 Pages 域名下可用）
    ok(await ev('STARFALL.saveGame()') === true, '线上版存档写入正常');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      const file = path.join('D:\\BaiduNetdiskDownload\\stellar-voyager\\qa', 'live-deployed.png');
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      console.log('INFO: 线上实测截图 qa/live-deployed.png (' + fs.statSync(file).size + ' bytes)');
    }
    ws.close();
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  console.log('---');
  console.log(fail === 0 ? '✔ 线上部署实测全部通过 (' + pass + ' 项)' : '✖ ' + fail + ' 项失败');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });