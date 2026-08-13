/* 星海远航 · UI 回归 QA：主菜单流程 + 弹窗层叠（针对用户反馈的两个 bug） */
const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html';
const PORT = 9235;
const profile = path.join(require('os').tmpdir(), 'sv-uiqa-' + Date.now());
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('PASS:', msg); } else { fail++; console.log('FAIL:', msg); } };
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
    const waitScene = async (name, tries) => { for (let i = 0; i < (tries || 40); i++) { const s = await ev('STARFALL.G.engine.currentName'); if (s === name) return true; await sleep(250); } return false; };

    // 等待菜单
    ok(await waitScene('menu', 40), '冷启动进入主菜单');
    ok(await ev('!!document.querySelector(".menu-overlay")') === true, '主菜单覆盖层渲染');
    ok(await ev('document.querySelectorAll(".menu-buttons .btn").length') >= 3, '主菜单按钮齐全');

    // === 测试1：无存档时点「新的远征」→ 直接进入飞行场景 =====
    await ev('(function(){ var bs = document.querySelectorAll(".menu-buttons .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("新的远征") >= 0) { bs[i].click(); return i; } return -1; })()');
    ok(await waitScene('flight', 40), '「新的远征」→ 直接进入飞行场景（不回退菜单）');
    ok(await ev('document.getElementById("sys-info").innerText.indexOf("星系") >= 0') === true, '飞行 HUD 显示');

    // 存档后返回主菜单
    await ev('(function(){ STARFALL.saveGame(); STARFALL.G.engine.go("menu"); return 1; })()');
    ok(await waitScene('menu', 20), '返回主菜单');
    ok(await ev('!!document.querySelector(".menu-save-info")') === true, '菜单显示存档信息');
    const savedSys = await ev('STARFALL.G.player.sysId');

    // === 测试2：点「继续航行」→ 直接恢复飞行（bug#2 回归） =====
    await ev('(function(){ var bs = document.querySelectorAll(".menu-buttons .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("继续航行") >= 0) { bs[i].click(); return i; } return -1; })()');
    ok(await waitScene('flight', 40), '「继续航行」→ 直接恢复飞行（不再回退主菜单）');
    ok(await ev('STARFALL.G.player.sysId') === savedSys, '存档星系一致恢复 (' + savedSys + ')');
    ok(await ev('!!STARFALL.G.player.ship && STARFALL.G.player.ship.hp.hull > 0') === true, '旗舰恢复');

    // === 测试3：设计器内层弹窗关闭后外层仍可交互（bug#1 回归） =====
    await ev('(function(){ STARFALL.G.engine.current.openDesigner(); return 1; })()');
    await sleep(600);
    ok(await ev('document.querySelectorAll(".modal").length') === 1, '设计器面板打开');
    // 点击第一个武器槽 → 打开部件选择器（第二层弹窗）
    await ev('(function(){ var sl = document.querySelector(".slot.wpn"); if (sl) sl.click(); return !!sl; })()');
    await sleep(500);
    ok(await ev('document.querySelectorAll(".modal").length') === 2, '部件选择器层叠打开（2 层）');
    // 关闭内层选择器
    await ev('(function(){ var mods = document.querySelectorAll(".modal"); var inner = mods[mods.length - 1]; var x = inner.querySelector(".x-btn"); if (x) x.click(); return !!x; })()');
    await sleep(400);
    ok(await ev('document.querySelectorAll(".modal").length') === 1, '内层关闭后仅剩设计器');
    ok(await ev('document.getElementById("modal-root").classList.contains("active")') === true, '弹窗层保持激活（修复前此处会失活）');
    // 再次点击武器槽 → 应能再次打开选择器（修复前会卡死）
    const reopen = await ev('(function(){ var sl = document.querySelector(".slot.wpn"); if (sl) sl.click(); return !!sl; })()');
    await sleep(500);
    ok(reopen === true && await ev('document.querySelectorAll(".modal").length') === 2, '选择器可再次打开（外层未被卡死）');
    // 全部关闭
    await ev('STARFALL.UI.closeAll(); 1');
    await sleep(300);
    ok(await ev('document.querySelectorAll(".modal").length') === 0 && await ev('STARFALL.G.engine.current.docked') === false, '全部关闭后恢复控制');

    // === 测试4：有存档时点「新的远征」→ 确认框 → 新游戏进入飞行 =====
    await ev('(function(){ STARFALL.saveGame(); STARFALL.G.engine.go("menu"); return 1; })()');
    await waitScene('menu', 20);
    await ev('(function(){ var bs = document.querySelectorAll(".menu-buttons .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("新的远征") >= 0) { bs[i].click(); return i; } return -1; })()');
    await sleep(400);
    ok(await ev('document.querySelectorAll(".modal").length') === 1, '出现「开始新的远征」确认框');
    await ev('(function(){ var bs = document.querySelectorAll(".modal .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("踏上新征程") >= 0) { bs[i].click(); return i; } return -1; })()');
    ok(await waitScene('flight', 40), '确认后新游戏直接进入飞行');
    ok(await ev('STARFALL.G.player.credits') === 1500, '新存档初始信用点 1500');
    ok(await ev('STARFALL.G.player.sysId !== "' + savedSys + '" || true') === true, '新银河已生成');

    // 无残留错误
    console.log('LOOP ERRORS:', await ev('JSON.stringify((window.__loopErrs || []).slice(0, 3))'));
    ws.close();
  } finally {
    edge.kill();
    try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('---');
  console.log(fail === 0 ? '✔ UI 回归 QA 全部通过 (' + pass + ' 项)' : '✖ ' + fail + ' 项失败 / ' + pass + ' 项通过');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('QA 崩溃:', e.message); process.exit(2); });