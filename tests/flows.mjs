// Phone-size flow test against a local server. Usage: node tests/flows.mjs [baseUrl]
import { chromium, devices } from './pw.mjs';
import { COACH } from './fixtures.mjs';
import fs from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = process.env.SHOTS || 'tests/shots'; fs.mkdirSync(OUT, { recursive: true });
const iphone = devices['iPhone 13'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iphone, colorScheme: 'light' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
p.on('dialog', (d) => d.accept());
const fails = []; const check = (cond, msg) => { if (!cond) fails.push(msg); console.log((cond ? 'ok   ' : 'FAIL ') + msg); };
const names = (sel) => p.$eval(sel, (e) => [...e.querySelectorAll('.pname')].map((x) => x.firstChild.textContent));
const st = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__goinfor.state)));
const hold = async (sel, ms) => { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); const box = await el.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); };
const shot = (name, full) => p.screenshot({ path: OUT + '/' + name + '.png', fullPage: !!full });
const rowName = (r) => r.$eval('.pname', (e) => e.firstChild.textContent);
const noHScroll = async (page) => !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
const endPeriodNow = async () => { await p.evaluate(() => { const g = window.__goinfor.state.game; g.pending = null; g.t = 299; g.lastTick -= 1000; window.__goinfor.tick(); }); await p.waitForTimeout(300); };

await p.goto(BASE, { waitUntil: 'load' });
await p.waitForTimeout(600);
check(await p.title() === 'Go In For', 'page title');
check(await p.$eval('#setup', (e) => !e.hidden), 'setup screen shows first');
check(await noHScroll(p), 'no horizontal scroll on setup');
await shot('01-setup-light', true);
// Toggling attendance and settings must not duplicate the footer button
await (await p.$$('#attendList .btn.here'))[0].click(); await (await p.$$('#segSubs .btn'))[0].click(); await (await p.$$('#attendList .btn.here'))[0].click();
check((await p.$$('#footInner .btn')).length === 1, 'one Start button after several setup taps');
check(await p.$eval('#attendList .btn.here[aria-pressed="true"]', (b) => { const c = getComputedStyle(b); return c.color !== c.backgroundColor; }), 'present kid name is readable');

// Load the coach roster through a roster link and shorten the clock for the test.
const enc = await p.evaluate((coach) => { const E = window.__goinfor.Engine; const S = E.defaults();
  E.importRoster(S, Object.assign({}, coach, { settings: { intervalSec: 60, periodSec: 300, periods: 2, checkBackSec: 60, warnSec: 30, repeatSec: 30 } }));
  return E.encodeRoster(S); }, COACH);
await p.goto(BASE + '#roster=' + enc, { waitUntil: 'load' }); await p.waitForTimeout(500);
let s = await st();
check(s.players.length === 11 && s.rules.length === 4, 'roster link loaded 11 kids and 4 rules');
check(s.settings.intervalSec === 60, 'roster link carried settings');
check(!(await p.evaluate(() => location.hash)), 'hash cleared after import');

// Paste box loads the same code
await p.evaluate(() => { const S = window.__goinfor.state; S.players = S.players.slice(0, 6); });
await p.fill('#pasteLink', 'https://example.test/#roster=' + enc); await p.click('#pasteBtn'); await p.waitForTimeout(400);
s = await st(); check(s.players.length === 11, 'paste box loaded the roster');
// Start the game
await p.click('#startBtn'); await p.waitForTimeout(400);
s = await st();
check(s.screen === 'game', 'game screen after start');
check(s.game.field.length === 6 && s.game.bench.length === 5, 'six on, five on the bench');
const field0 = await names('#fieldList');
check(!(field0.includes('Knox') && field0.includes('Lydon')), 'Knox and Lydon not both starting');
check((await p.$eval('#planCard', (e) => e.innerText)).includes('IN FOR'), 'next swap preview names a pair');
await shot('02-game-start');

// Fast-forward the clock by moving lastTick back, then tick.
const ff = async (sec) => { await p.evaluate((n) => { const g = window.__goinfor.state.game; g.lastTick -= n * 1000; window.__goinfor.tick(); }, sec); await p.waitForTimeout(150); };
await ff(31); s = await st(); check(s.game.warned === true && !s.game.pending, 'one-minute style heads-up fired before the swap');
await ff(30); s = await st();
check(s.game.pending && s.game.pending.type === 'rotation', 'swap due creates a pending rotation');
check(await p.$('#goBtn') !== null, 'hold-to-confirm button shown');
await shot('03-swap-due');
// A quick tap must NOT confirm
await p.click('#goBtn'); await p.waitForTimeout(200); s = await st(); check(!!s.game.pending, 'quick tap does not confirm the swap');
await hold('#goBtn', 800); await p.waitForTimeout(300); s = await st(); check(!s.game.pending, 'press-and-hold confirms the swap');
check(s.game.subT > 50 && s.game.subT <= 60, 'swap timer reset after confirm (' + s.game.subT + ')');
check(s.game.history.length >= 1, 'undo history recorded');

// Left early -> fill -> check back -> return
const leftName = (await names('#fieldList')).find((n) => n !== 'Craig');
for (const r of await p.$$('#fieldList .prow')) { if ((await rowName(r)) === leftName) { await (await r.$('button:has-text("Left")')).click(); break; } }
await p.waitForTimeout(250); s = await st();
check(s.game.field.length === 5 && s.game.pending && s.game.pending.type === 'fill', leftName + ' left: fill move offered');
check(s.game.away.length === 1, 'kid listed as off to the side');
await shot('04-left-early');
await hold('#goBtn', 800); await p.waitForTimeout(300); s = await st(); check(s.game.field.length === 6, 'fill confirmed, six on again');
await p.evaluate(() => { const g = window.__goinfor.state.game; g.away[0].checkAt = Date.now() - 1000; window.__goinfor.tick(); }); await p.waitForTimeout(250);
check((await p.$eval('#banners', (e) => e.innerText)).includes('Check on ' + leftName), 'check-back banner appears');
await shot('05-check-back');
await p.click('#banners button:has-text("Yes, in now")'); await p.waitForTimeout(250); s = await st();
check(s.game.pending && s.game.pending.type === 'return' && s.game.pending.ons.length === 1, 'priority return offered');
await hold('#goBtn', 800); await p.waitForTimeout(300); s = await st();
check(s.game.field.map((id) => s.players.find((x) => x.id === id).name).includes(leftName), leftName + ' back on the field');
check(s.game.away.length === 0, 'off-to-the-side list cleared');

// Manual swap by tapping
const f1 = (await p.$$('#fieldList .prow'))[1]; const b1 = (await p.$$('#benchList .prow'))[0];
const fName = await rowName(f1); const bName = await rowName(b1);
await f1.click(); await p.waitForTimeout(150); await (await p.$$('#benchList .prow'))[0].click(); await p.waitForTimeout(250);
const fieldNow = await names('#fieldList');
check(fieldNow.includes(bName) && !fieldNow.includes(fName), 'tap-to-swap moved ' + bName + ' in for ' + fName);

// Menu: long-press opens, undo works
await hold('#menuBtn', 700); await p.waitForTimeout(250);
check(await p.$('.sheet') !== null, 'long-press opens the menu');
await shot('06-menu');
await p.click('.sheet button:has-text("Undo")'); await p.waitForTimeout(250);
const fieldUndo = await names('#fieldList');
check(fieldUndo.includes(fName), 'undo restored ' + fName);

// Drag: bench kid onto the field area (move, no pairing), then a field kid onto a bench kid (swap)
// A finger cannot leave the screen: park it at the edge and let the app auto-scroll until the target is in view.
const dragTo = async (fromSel, toSel) => {
  const from = await p.$(fromSel); await from.scrollIntoViewIfNeeded(); const a = await from.boundingBox();
  const x = a.x + a.width / 2; const H = iphone.viewport.height;
  await p.mouse.move(x, a.y + a.height / 2); await p.mouse.down(); await p.waitForTimeout(60);
  await p.mouse.move(x + 4, a.y + a.height / 2 + 8, { steps: 3 });
  for (let i = 0; i < 60; i++) {
    const bb = await (await p.$(toSel)).boundingBox(); const ty = bb.y + Math.min(30, bb.height / 2);
    if (ty < 100) { await p.mouse.move(x + 20, 30, { steps: 2 }); await p.waitForTimeout(80); continue; }
    if (ty > H - 130) { await p.mouse.move(x + 20, H - 40, { steps: 2 }); await p.waitForTimeout(80); continue; }
    await p.mouse.move(bb.x + bb.width / 2, ty, { steps: 8 }); await p.waitForTimeout(80);
    const b2 = await (await p.$(toSel)).boundingBox(); // the page may have kept scrolling on the way down; re-aim once it is still
    if (Math.abs(b2.y - bb.y) < 2) break;
  }
  await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(300);
};
const dragged = (await names('#benchList'))[0];
await dragTo('#benchList .prow:first-child .grip', '#fieldZone h2');
s = await st(); check(s.game.field.length === 7 && s.game.bench.length === 4, 'drag moved ' + dragged + ' onto the field with no swap (' + s.game.field.length + ' on)');
check((await p.$eval('#banners', (e) => e.innerText)).includes('7 on the field'), 'too-many banner shows');
check((await p.$eval('#planCard', (e) => e.textContent)).includes('comes off'), 'plan offers who comes off');
check(await p.$('.prow.ghost') === null, 'ghost removed after drop');
check(!(await p.$eval('#banners', (e) => e.innerText)).includes('selected'), 'no phantom selection after a drop');
await shot('06b-drag-over');
const swapOn = (await names('#fieldList'))[0]; const swapOff = (await names('#benchList'))[0];
await dragTo('#fieldList .prow:first-child .grip', '#benchList .prow:first-child');
s = await st(); const fAfter = await names('#fieldList');
check(s.game.field.length === 7 && fAfter.includes(swapOff) && !fAfter.includes(swapOn), 'drop on a kid swaps ' + swapOff + ' in for ' + swapOn);
await dragTo('#fieldList .prow:first-child .grip', '#benchZone h2');
s = await st(); check(s.game.field.length === 6, 'drag back to the bench leaves six on');
// A tap on the grip is not a move
await p.click('#benchList .prow:first-child .grip'); await p.waitForTimeout(150); s = await st(); check(s.game.field.length === 6, 'a tap on the grip moves nobody');

// Pocket screen
await hold('#menuBtn', 700); await p.waitForTimeout(250); await p.click('.sheet button:has-text("Pocket")'); await p.waitForTimeout(250);
check(await p.$('#pocket') !== null, 'pocket screen opens');
await shot('07-pocket');
await p.click('#pocket'); await p.waitForTimeout(200); check(await p.$('#pocket') !== null, 'pocket ignores a tap');
await hold('#pocket', 1300); await p.waitForTimeout(300); check(await p.$('#pocket') === null, 'pocket unlocks on a one-second hold');

// Period end and final whistle
await endPeriodNow();
s = await st(); check(s.game.breakPending === true && s.game.running === false, 'clock stops at the break');
check((await p.$eval('#banners', (e) => e.innerText)).includes('Water break'), 'break banner');
await shot('08-break');
await p.click('#banners button:has-text("Start second half")'); await p.waitForTimeout(250); s = await st(); check(s.game.period === 2 && s.game.running, 'second half running');
await endPeriodNow();
s = await st(); check(s.screen === 'summary', 'final whistle shows the summary');
check((await p.$eval('#sumTable', (e) => e.querySelectorAll('tr').length)) === 12, 'summary lists every kid');
await shot('09-summary', true);

// Reload keeps state; help screen renders
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400); s = await st(); check(s.screen === 'summary', 'state survives a reload');
const endField = s.game.field.slice(); const leastPlayed = Object.keys(s.game.played).sort((a, b) => s.game.played[a] - s.game.played[b])[0];
await p.click('#nextGameBtn'); await p.waitForTimeout(250); s = await st();
check(s.screen === 'setup' && !!s.carry, 'next game keeps the carry-over');
check(await p.$eval('#carryCard', (e) => !e.hidden && e.innerText.includes('Start with:')), 'setup shows who starts next');
check((await p.$eval('#startBtn', (e) => e.textContent)).includes('game 2'), 'start button says game 2');
await shot('12-carry-setup', true);
await p.click('#startBtn'); await p.waitForTimeout(400); s = await st();
check(s.game.games === 2 && s.game.field.includes(leastPlayed) && s.game.field.join() !== endField.join(), 'game 2 starts with the kid who played least (' + (await names('#fieldList')).join(', ') + ')');
check(Object.values(s.game.played).some((v) => v > 0), 'minutes carried into game 2');
await hold('#menuBtn', 700); await p.waitForTimeout(250); await p.click('.sheet button:has-text("End game")'); await p.waitForTimeout(300); s = await st();
check(s.screen === 'summary' && (await p.$eval('#sumTable', (e) => e.textContent)).includes('This game'), 'summary shows today and this game');
await shot('13-summary-today', true);
await p.click('#newGameBtn'); await p.waitForTimeout(200); s = await st(); check(!s.carry, 'fresh start drops the carry');
check(await p.$eval('#carryCard', (e) => e.hidden), 'carry card hidden after a fresh start');
await p.click('#helpBtn'); await p.waitForTimeout(200);
check(await p.$eval('#help', (e) => !e.hidden), 'help screen opens');
await shot('10-help', true);
await p.click('#helpBack');

// Dark theme screenshot
const ctxD = await b.newContext({ ...iphone, colorScheme: 'dark' }); const pd = await ctxD.newPage(); pd.on('dialog', (d) => d.accept());
await pd.goto(BASE + '#roster=' + enc, { waitUntil: 'load' }); await pd.waitForTimeout(400); await pd.click('#startBtn'); await pd.waitForTimeout(400);
await pd.screenshot({ path: OUT + '/11-game-dark.png' });
check(await noHScroll(pd), 'no horizontal scroll on game (dark)');
await ctxD.close();

// Offline: service worker installed, then reload with the network off
if (BASE.startsWith('http')) {
  await p.waitForTimeout(1500);
  const swReady = await p.evaluate(async () => { if (!navigator.serviceWorker) return 'none'; const r = await navigator.serviceWorker.ready; return r.active ? r.active.state : 'no-active'; });
  check(swReady === 'activated', 'service worker activated (' + swReady + ')');
  const cached = await p.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); const req = await c.keys(); return req.length; });
  check(cached >= 17, 'app shell cached (' + cached + ' files)');
  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  check(await p.title() === 'Go In For', 'page loads offline');
  const fontOk = await p.evaluate(() => document.fonts.check('800 20px "Barlow Condensed"'));
  check(fontOk, 'fonts available offline');
  check(await p.$('#startBtn') !== null, 'app works offline');
  await ctx.setOffline(false);
}
await b.close();
const realErrs = errs.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
check(realErrs.length === 0, 'no page errors' + (realErrs.length ? ': ' + realErrs.join(' | ') : ''));
console.log(fails.length ? '\n' + fails.length + ' FLOW CHECK(S) FAILED' : '\nall flow checks passed');
process.exit(fails.length ? 1 : 0);
