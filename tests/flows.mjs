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
const openSects = () => p.evaluate(() => document.querySelectorAll('details.sect').forEach((d) => { d.open = true; }));
const endPeriodNow = async () => { await p.evaluate(() => { const g = window.__goinfor.state.game; g.pending = null; g.t = 299; g.lastTick -= 1000; window.__goinfor.tick(); }); await p.waitForTimeout(300); };

await p.goto(BASE, { waitUntil: 'load' });
await p.waitForTimeout(600);
check(await p.title() === 'Go In For', 'page title');
check(await p.$eval('#setup', (e) => !e.hidden), 'setup screen shows first');
check(await noHScroll(p), 'no horizontal scroll on setup');
await shot('01-setup-light', true);
await openSects();
// Toggling attendance and settings must not duplicate the footer button
await (await p.$$('#attendList .btn.here'))[0].click(); await (await p.$$('#segSubs .btn'))[0].click(); await (await p.$$('#attendList .btn.here'))[0].click();
check((await p.$$('#footInner .btn')).length === 1, 'one Start button after several setup taps');
check((await p.$$('#attendList button[title^="Remove"]')).length === 0, 'Remove hidden until Edit team');
await p.click('#editRoster'); await p.waitForTimeout(150); check((await p.$$('#attendList button[title^="Remove"]')).length === 11, 'Edit team shows Remove'); await p.click('#editRoster');
check(await p.$eval('#attendList .btn.here[aria-pressed="true"]', (b) => { const c = getComputedStyle(b); return c.color !== c.backgroundColor; }), 'present kid name is readable');

// Load the coach roster through a roster link and shorten the clock for the test.
const enc = await p.evaluate((coach) => { const E = window.__goinfor.Engine; const S = E.defaults();
  E.importRoster(S, Object.assign({}, coach, { settings: { intervalSec: 60, periodSec: 300, periods: 2, checkBackSec: 60, warnSec: 30, repeatSec: 30 } }));
  return E.encodeRoster(S); }, COACH);
await p.goto(BASE + '#roster=' + enc, { waitUntil: 'load' }); await p.waitForTimeout(500); await openSects();
let s = await st();
check(s.players.length === 11 && s.rules.length === 4, 'roster link loaded 11 kids and 4 rules');
check(s.settings.intervalSec === 60, 'roster link carried settings');
check(!(await p.evaluate(() => location.hash)), 'hash cleared after import');

// Paste box loads the same code
await p.evaluate(() => { const S = window.__goinfor.state; S.players = S.players.slice(0, 6); });
await p.fill('#pasteLink', 'https://example.test/#roster=' + enc); await p.click('#pasteBtn'); await p.waitForTimeout(400);
s = await st(); check(s.players.length === 11, 'paste box loaded the roster');
// Add a "never more than 2 of a group on" rule from the setup screen
await p.click('#ruleAdd'); await p.waitForTimeout(150);
await p.click('#ruleKind .btn:has-text("Never too many")'); await p.waitForTimeout(150);
await p.click('#ruleMin .btn:has-text("Max 2")'); await p.waitForTimeout(100);
for (const n of ['Lydon', 'Liam', 'Foster', 'Abe']) { await p.click('#rulePick .btn:has-text("' + n + '")'); await p.waitForTimeout(60); }
check((await p.$eval('#ruleFair', (e) => e.textContent)).includes('Even time check'), 'the rule form shows the even-time check: ' + (await p.$eval('#ruleFair', (e) => e.textContent)));
await p.click('#ruleSave'); await p.waitForTimeout(200); s = await st();
check((await p.$eval('#rulesFair', (e) => e.textContent)).includes("today's kids"), 'the rules card shows the minutes range for today');
check(s.rules.length === 5 && s.rules[4].type === 'limit' && s.rules[4].max === 2 && s.rules[4].ids.length === 4, 'limit rule saved from the setup screen');
check((await p.$eval('#ruleList', (e) => e.textContent)).includes('At most 2 on'), 'limit rule listed');
// Start the game
await p.click('#startBtn'); await p.waitForTimeout(400);
s = await st();
check(s.screen === 'game', 'game screen after start');
check(s.game.started === false && s.game.running === false, 'the game waits at kickoff with the clock stopped');
check((await p.$eval('#periodLbl', (e) => e.textContent)).includes('kickoff'), 'header says kickoff');
check((await p.$eval('#playBtn', (e) => e.textContent)).includes('Kick off'), 'main button says Kick off');
check(s.game.field.length === 6 && s.game.bench.length === 5, 'six on, five on the bench');
const field0 = await names('#fieldList');
check(!(field0.includes('Knox') && field0.includes('Lydon')), 'Knox and Lydon not both starting');
check((await p.$eval('#planCard', (e) => e.innerText)).includes('IN FOR'), 'next swap preview names a pair');
await shot('02-kickoff');
// Change the starters before the whistle: pick the whole lineup from the banner
check((await p.$eval('#whoOnBtn', (e) => e.textContent)).includes('Starters'), 'side button says Starters before kickoff');
await p.click('#whoOnBtn'); await p.waitForTimeout(200);
check((await p.$eval('.sheet .panel h3', (e) => e.textContent)) === 'Who starts?', 'starters picker opens from the Starters button');
const benchKid = (await names('#benchList'))[0]; const fieldKid = field0[0];
await p.click('#whoPick .btn:has-text("' + fieldKid + '")'); await p.click('#whoPick .btn:has-text("' + benchKid + '")'); await p.waitForTimeout(100);
await p.click('#whoOk'); await p.waitForTimeout(300); s = await st();
const field1 = await names('#fieldList');
check(field1.includes(benchKid) && !field1.includes(fieldKid) && field1.length === 6, 'starters changed: ' + benchKid + ' in for ' + fieldKid);
check(s.game.started === false && Object.values(s.game.played).every((v) => v === 0), 'still at kickoff, nobody has minutes');
await shot('02b-starters-changed');
check(!s.game.pending, 'no calls before kickoff');
await p.click('#playBtn'); await p.waitForTimeout(300); s = await st();
check(s.game.started === true && s.game.running === true, 'Kick off starts the clock');
check((await p.$eval('#banners', (e) => e.textContent)).indexOf('Starting lineup') < 0 && (await p.$eval('#whoOnBtn', (e) => e.textContent)).includes("Who's on"), 'starters banner gone after kickoff, side button back to Who\'s on');
// A lineup that breaks a rule gets its fix called at the whistle; otherwise the main button is Pause.
if (s.game.pending) { check(s.game.pending.type === 'fix' && await p.$('#goBtn') !== null, 'kickoff calls the fix for the hand-picked lineup'); await p.click('#goBtn'); await p.waitForTimeout(250); s = await st(); }
else check((await p.$eval('#playBtn', (e) => e.textContent)).includes('Pause'), 'main button becomes Pause');
await shot('02-game-start');

// Fast-forward the clock by moving lastTick back, then tick.
const ff = async (sec) => { await p.evaluate((n) => { const g = window.__goinfor.state.game; g.lastTick -= n * 1000; window.__goinfor.tick(); }, sec); await p.waitForTimeout(150); };
await ff(31); s = await st(); check(s.game.warned === true && !s.game.pending, 'one-minute style heads-up fired before the swap');
await ff(30); s = await st();
check(s.game.pending && s.game.pending.type === 'rotation', 'swap due creates a pending rotation');
check(await p.$('#goBtn') !== null, 'hold-to-confirm button shown');
await shot('03-swap-due');
// One tap confirms; the toast offers Undo
const beforeTap = s.game.field.slice();
await p.click('#goBtn'); await p.waitForTimeout(250); s = await st(); check(!s.game.pending, 'a single tap confirms the swap');
check(await p.$('#toastAct') !== null && !(await p.$eval('.toast', (e) => e.hidden)), 'Undo offered on the toast');
await p.click('#toastAct'); await p.waitForTimeout(250); s = await st(); check(s.game.field.join() === beforeTap.join() && !!s.game.pending, 'Undo on the toast restores the lineup and the call');
await p.click('#goBtn'); await p.waitForTimeout(250); s = await st(); check(!s.game.pending, 'confirmed again');
check(await p.$eval('#voiceSel', (e) => e.options.length >= 1), 'voice picker present');
check(s.game.subT > 50 && s.game.subT <= 60, 'swap timer reset after confirm (' + s.game.subT + ')');
check(s.game.history.length >= 1, 'undo history recorded');

// A kid on the team who was marked not here arrives mid-game: one tap, rules intact
await p.evaluate(() => { const S = window.__goinfor.state; const E = window.__goinfor.Engine; const g = S.game; const late = g.bench[g.bench.length - 1]; g.bench = g.bench.filter((id) => id !== late); S.players.find((x) => x.id === late).here = false; window.__goinfor.tick(); });
await p.evaluate(() => window.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(300);
const rulesBefore = (await st()).rules.length;
check(await p.$eval('#notHereWrap', (e) => !e.hidden && e.querySelectorAll('button').length === 1), 'not-here-yet list shows the absent kid');
await p.click('#notHere button'); await p.waitForTimeout(300); s = await st();
check(s.game.bench.length === 5 && s.players.every((x) => x.here) && s.rules.length === rulesBefore, 'one tap puts the late kid on the bench with the rules intact');
check(await p.$eval('#notHereWrap', (e) => e.hidden), 'not-here-yet list hides when everyone is here');

// Left early -> fill -> check back -> return
const leftName = (await names('#fieldList')).find((n) => n !== 'Craig');
for (const r of await p.$$('#fieldList .prow')) { if ((await rowName(r)) === leftName) { await (await r.$('.pname')).click(); await p.waitForTimeout(150); await p.click('#fieldList .prow.open button:has-text("Left")'); break; } }
await p.waitForTimeout(250); s = await st();
check(s.game.field.length === 5 && s.game.pending && s.game.pending.type === 'fill', leftName + ' left: fill move offered');
check(s.game.away.length === 1, 'kid listed as off to the side');
await shot('04-left-early');
await p.click('#goBtn'); await p.waitForTimeout(300); s = await st(); check(s.game.field.length === 6, 'fill confirmed, six on again');
await p.evaluate(() => { const g = window.__goinfor.state.game; g.away[0].checkAt = Date.now() - 1000; window.__goinfor.tick(); }); await p.waitForTimeout(250);
check((await p.$eval('#banners', (e) => e.innerText)).includes('Check on ' + leftName), 'check-back banner appears');
await shot('05-check-back');
await p.click('#banners button:has-text("Yes, in now")'); await p.waitForTimeout(250); s = await st();
check(s.game.pending && s.game.pending.type === 'return' && s.game.pending.ons.length === 1, 'priority return offered');
await p.click('#goBtn'); await p.waitForTimeout(300); s = await st();
check(s.game.field.map((id) => s.players.find((x) => x.id === id).name).includes(leftName), leftName + ' back on the field');
check(s.game.away.length === 0, 'off-to-the-side list cleared');

// Manual swap by tapping
const f1 = (await p.$$('#fieldList .prow'))[1]; const b1 = (await p.$$('#benchList .prow'))[0];
const fName = await rowName(f1); const bName = await rowName(b1);
await (await f1.$('.pname')).click(); await p.waitForTimeout(150); await p.click('#fieldList .prow.open button:has-text("Pick")'); await p.waitForTimeout(150);
check((await p.$eval('#banners', (e) => e.innerText)).includes(fName + ' picked'), 'Pick shows who is picked');
await (await (await p.$$('#benchList .prow'))[0].$('.pname')).click(); await p.waitForTimeout(250);
const fieldNow = await names('#fieldList');
s = await st(); check(fieldNow.includes(bName) && !fieldNow.includes(fName), 'tap-to-swap moved ' + bName + ' in for ' + fName + ' [field: ' + fieldNow.join(',') + '; pending: ' + (s.game.pending ? s.game.pending.type : 'none') + '; sel banner: ' + (await p.$eval('#banners', (e) => e.innerText)).slice(0, 80) + ']');

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
s = await st(); check(s.game.field.length === 7 && s.game.bench.length === 4, 'drag moved ' + dragged + ' onto the field with no swap (' + s.game.field.length + ' on, ' + s.game.bench.length + ' bench, away ' + s.game.away.length + ')');
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

// Live field size: 4v4 takes two off, back to 6v6 sends two in
await p.click('#sizeBtn'); await p.waitForTimeout(200); await p.click('#sizePick .btn:has-text("4v4")'); await p.waitForTimeout(250); s = await st();
check(s.settings.fieldSize === 4 && s.game.pending && s.game.pending.type === 'fix' && s.game.pending.offs.length - s.game.pending.ons.length === 2, '4v4: fix call nets two off [size ' + s.settings.fieldSize + ', pending ' + (s.game.pending ? s.game.pending.type + ' offs ' + s.game.pending.offs.length + ' ons ' + s.game.pending.ons.length + ' note ' + s.game.pending.note : 'none') + ', field ' + s.game.field.length + ']');
await p.click('#goBtn'); await p.waitForTimeout(250); s = await st(); check(s.game.field.length === 4, 'four on the field');
await p.click('#sizeBtn'); await p.waitForTimeout(200); await p.click('#sizePick .btn:has-text("6v6")'); await p.waitForTimeout(250); s = await st();
check(s.settings.fieldSize === 6 && s.game.pending && s.game.pending.type === 'fill' && s.game.pending.ons.length === 2, '6v6: send-in call brings two on');
await p.click('#goBtn'); await p.waitForTimeout(250); s = await st(); check(s.game.field.length === 6, 'six on again');
// Sub: take a named kid off now, then Leave it
const subName = (await names('#fieldList'))[0];
await p.click('#fieldList .prow:first-child .pname'); await p.waitForTimeout(150); await p.click('#fieldList .prow.open button[title^="Take"]'); await p.waitForTimeout(250); s = await st();
check(s.game.pending && s.game.pending.type === 'fix' && s.players.find((x) => x.id === s.game.pending.offs[0]).name === subName && s.game.pending.ons.length === 1, 'Sub offers a swap for ' + subName);
await p.click('#planCard button:has-text("Leave it")'); await p.waitForTimeout(250); s = await st();
check(!s.game.pending && (await names('#fieldList'))[0] === subName, 'Leave it keeps ' + subName + ' on with no call');
await shot('06c-sub');

// Who's on right now: pick six, everyone else to the bench
await p.click('#whoOnBtn'); await p.waitForTimeout(250);
check(await p.$('#whoPick') !== null && (await p.$$('#whoPick .btn[aria-pressed="true"]')).length === 6, "Who's on sheet opens with the current six picked");
const whoName = (i) => p.$eval('#whoPick .btn:nth-child(' + (i + 1) + ')', (e) => e.textContent);
const swappedOut = await whoName(0), swappedIn = await whoName(10);
await p.click('#whoPick .btn:nth-child(1)'); await p.waitForTimeout(100); await p.click('#whoPick .btn:nth-child(11)'); await p.waitForTimeout(150);
await p.click('#whoOk'); await p.waitForTimeout(300); s = await st(); const fWho = await names('#fieldList');
check(s.game.field.length === 6 && fWho.includes(swappedIn) && !fWho.includes(swappedOut) && await p.$('.sheet') === null, "That's who's on sets the lineup (" + swappedIn + ' on, ' + swappedOut + ' off)');

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
await p.click('#startBtn'); await p.waitForTimeout(400); await p.click('#playBtn'); await p.waitForTimeout(200); s = await st();
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
await pd.goto(BASE + '#roster=' + enc, { waitUntil: 'load' }); await pd.waitForTimeout(400); await pd.click('#startBtn'); await pd.waitForTimeout(400); await pd.click('#playBtn'); await pd.waitForTimeout(300);
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
  const fontOk = await p.evaluate(() => document.fonts.check('700 20px "Barlow"'));
  check(fontOk, 'fonts available offline');
  check(await p.$('#startBtn') !== null, 'app works offline');
  await ctx.setOffline(false);
}
await b.close();
const realErrs = errs.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
check(realErrs.length === 0, 'no page errors' + (realErrs.length ? ': ' + realErrs.join(' | ') : ''));
console.log(fails.length ? '\n' + fails.length + ' FLOW CHECK(S) FAILED' : '\nall flow checks passed');
process.exit(fails.length ? 1 : 0);
