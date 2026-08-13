/* 星海远航 · 真实输入级试玩测试：键盘事件 + 鼠标点击驱动完整游戏流程 */
const { spawn } = require('child_process');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///D:/BaiduNetdiskDownload/stellar-voyager/index.html';
const PORT = 9236;
const profile = path.join(require('os').tmpdir(), 'sv-play-' + Date.now());
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
    const sendKey = (type, code, k, vk) => send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    const pressKey = async (code, k, vk, holdMs) => { await sendKey('keyDown', code, k, vk); if (holdMs) await sleep(holdMs); await sendKey('keyUp', code, k, vk); };
    const clickAt = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await sleep(80); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };

    // 1. 冷启动 → 主菜单
    ok(await waitScene('menu', 40), '冷启动进入主菜单');

    // 2. 真实点击「新的远征」按钮
    const btnPos = await ev('(function(){ var bs = document.querySelectorAll(".menu-buttons .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("新的远征") >= 0) { var r = bs[i].getBoundingClientRect(); return Math.round(r.left + r.width/2) + "," + Math.round(r.top + r.height/2); } return "-1,-1"; })()');
    const [bx, by] = String(btnPos).split(',').map(Number);
    await clickAt(bx, by);
    ok(await waitScene('flight', 40), '真实点击「新的远征」→ 进入飞行');

    // 3. 传送到行星旁，按 F 键扫描（真实键盘事件）
    await ev('(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var pl = sy.planets[0]; var wp = sc.planetWorldPos(pl); sc.ship.x = wp.x; sc.ship.y = wp.y - pl.radius - 320; sc.ship.vx = 0; sc.ship.vy = 0; return pl.name; })()');
    await pressKey('KeyF', 'f', 70, 0);
    await sleep(1800);
    const scanProg = await ev('(function(){ var sc = STARFALL.G.engine.current; return sc.scan ? sc.scan.prog.toFixed(2) : "-1"; })()');
    ok(parseFloat(scanProg) > 0.3, '真实按键 F 启动扫描（进度 ' + scanProg + '）');
    await ev('(function(){ STARFALL.G.engine.current.scan = null; return 1; })()');

    // 4. 传送到空间站，按 Q 对接（真实键盘）
    await ev('(function(){ var sc = STARFALL.G.engine.current; var sy = STARFALL.getSystem(sc.p.sysId); var a = sy.station.angle + STARFALL.G.time * sy.station.orbitSpeed; sc.ship.x = Math.cos(a) * sy.station.orbitRadius; sc.ship.y = Math.sin(a) * sy.station.orbitRadius; sc.ship.vx = 0; sc.ship.vy = 0; return 1; })()');
    await pressKey('KeyQ', 'q', 81, 0);
    await sleep(700);
    ok(await ev('document.body.innerText.indexOf("贸易码头") >= 0') === true, '真实按键 Q 对接空间站');
    await ev('(function(){ var x = document.querySelector(".modal .x-btn"); if (x) x.click(); return 1; })()');
    await sleep(400);

    // 5. 按 M 打开星图，真实鼠标点击相邻星系 → 跃迁
    await pressKey('KeyM', 'm', 77, 0);
    await sleep(700);
    ok(await waitScene('galaxymap', 20), '真实按键 M 打开银河星图');
    const targetPos = await ev('(function(){ var gm = STARFALL.G.engine.current; var cur = gm.galaxy.systems.find(function(s){ return s.id === gm.p.sysId; }); var nb = gm.galaxy.systems[cur.links[0]]; var sx = (nb.x - gm.camX) * gm.zoom + window.innerWidth / 2; var sy = (nb.y - gm.camY) * gm.zoom + window.innerHeight / 2; return Math.round(sx) + "," + Math.round(sy); })()');
    const [mx, my] = String(targetPos).split(',').map(Number);
    await clickAt(mx, my);
    await sleep(500);
    ok(await ev('document.querySelectorAll(".modal").length') === 1, '点击星系弹出面板');
    const jumped = await ev('(function(){ var bs = document.querySelectorAll(".modal .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("超空间跃迁") >= 0) { bs[i].click(); return true; } return false; })()');
    ok(jumped === true, '点击超空间跃迁按钮');
    await sleep(4200);
    ok(await waitScene('flight', 20), '跃迁完成回到飞行场景');
    ok(await ev('STARFALL.G.player.jumps') >= 1, '跃迁计数 +1');

    // 6. 真实按键 W 推进 + T 巡航
    const pos1 = await ev('(function(){ var s = STARFALL.G.player.ship; return Math.round(s.x) + "," + Math.round(s.y); })()');
    await pressKey('KeyW', 'w', 87, 1500);
    const pos2 = await ev('(function(){ var s = STARFALL.G.player.ship; return Math.round(s.x) + "," + Math.round(s.y); })()');
    ok(pos1 !== pos2, '真实按键 W 推进生效（位置变化）');
    // 巡航会被“敌舰接近”规则阻止（正确行为）——清场后验证按键绑定本身
    await ev('(function(){ STARFALL.G.engine.current.pirates = []; STARFALL.G.engine.current.target = null; return 1; })()');
    await pressKey('KeyT', 't', 84, 0);
    await sleep(350);
    ok(await ev('STARFALL.G.engine.current.cruise') === true, '真实按键 T 切换巡航');

    // 7. Esc 暂停菜单 → 继续航行
    await pressKey('Escape', 'Escape', 27, 0);
    await sleep(400);
    ok(await ev('document.body.innerText.indexOf("暂停") >= 0') === true, '真实按键 Esc 打开暂停菜单');
    await ev('(function(){ var bs = document.querySelectorAll(".modal .btn"); for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf("继续航行") >= 0) { bs[i].click(); return i; } return -1; })()');
    await sleep(400);
    ok(await ev('STARFALL.G.engine.current.paused') === false, '暂停菜单关闭恢复游戏');

    // 8. 无异常、无残留
    console.log('LOOP ERRORS:', await ev('JSON.stringify((window.__loopErrs || []).slice(0, 3))'));
    ok(await ev('document.querySelectorAll(".modal").length') === 0, '无残留弹窗');
    ws.close();
  } finally {
    edge.kill();
    try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('---');
  console.log(fail === 0 ? '✔ 真实输入试玩测试全部通过 (' + pass + ' 项)' : '✖ ' + fail + ' 项失败 / ' + pass + ' 项通过');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('试玩崩溃:', e.message); process.exit(2); });