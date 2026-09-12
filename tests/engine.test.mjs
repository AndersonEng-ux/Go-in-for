import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../engine.js');

const NOW = 1_000_000;
import { COACH as FIX } from './fixtures.mjs';
function team(names, rules, settings) {
  const S = E.defaults();
  E.importRoster(S, { players: names, rules: (rules || []).map((r) => ({ type: r.type, min: r.min, max: r.max, names: r.names })), settings });
  const id = (n) => E.findByName(S, n).id;
  return { S, id, name: (x) => E.nameOf(S, x) };
}
const COACH = { names: FIX.players, rules: FIX.rules };
function setLineup(t, field, bench, played, onSince, total) {
  const g = t.S.game; g.field = field.map(t.id); g.bench = bench.map(t.id); g.total = total; g.t = total;
  g.played = {}; g.onSince = {}; g.offSince = {};
  Object.entries(played).forEach(([n, v]) => { g.played[t.id(n)] = v; });
  Object.entries(onSince).forEach(([n, v]) => { g.onSince[t.id(n)] = v; });
  bench.forEach((n) => { g.offSince[t.id(n)] = 0; });
}

test('starting lineup honors every rule', () => {
  const t = team(COACH.names, COACH.rules);
  assert.equal(E.startGame(t.S, NOW).ok, true);
  assert.deepEqual(E.violations(t.S, t.S.game.field, []), []);
  assert.equal(t.S.game.field.length, 6);
  const f = t.S.game.field.map(t.name);
  assert.ok(!(f.includes('Knox') && f.includes('Lydon')), 'Knox and Lydon apart');
});

test('screenshot scenario: protects kids who just came on, pins the only defender', () => {
  const t = team(COACH.names, COACH.rules, { intervalSec: 240 });
  E.startGame(t.S, NOW);
  setLineup(t, ['Nolan', 'Craig', 'Abe', 'Foster', 'Miles', 'Harrison'], ['Knox', 'Drew', 'Liam', 'Lydon', 'Chase'],
    { Nolan: 115, Craig: 115, Abe: 70, Foster: 80, Miles: 13, Harrison: 13 }, { Nolan: 5, Craig: 5, Abe: 83, Foster: 83, Miles: 107, Harrison: 107 }, 120);
  const p = E.rotationPlan(t.S);
  // Nolan and Craig have been on longest; Abe, Foster, Miles, Harrison just came on and are protected.
  assert.deepEqual(p.offs.map(t.name).sort(), ['Craig', 'Nolan']);
  assert.equal(p.reduced, false);
  assert.ok(!p.offs.some((id) => E.isFresh(t.S, id)), 'no fresh kid comes off');
  assert.ok(E.isFresh(t.S, t.id('Abe')));
  assert.ok(!E.pinnedByRule(t.S, t.id('Craig')), 'Craig can come off because Chase is on the bench');
  assert.ok(!E.pinnedByRule(t.S, t.id('Foster')));
  // Craig as the only defender at the game: pinned, so the swap shrinks to one kid rather than pulling a fresh one.
  setLineup(t, ['Nolan', 'Craig', 'Abe', 'Foster', 'Miles', 'Liam'], ['Knox', 'Drew', 'Lydon'],
    { Nolan: 115, Craig: 115, Abe: 70, Foster: 80, Miles: 13, Liam: 13 }, { Nolan: 5, Craig: 5, Abe: 83, Foster: 83, Miles: 107, Liam: 107 }, 120);
  ['Chase', 'Harrison'].forEach((n) => { t.S.players.find((x) => x.name === n).here = false; });
  const p2 = E.rotationPlan(t.S);
  assert.deepEqual(p2.offs.map(t.name), ['Nolan']);
  assert.equal(p2.reduced, true);
  assert.match(p2.note, /just came on/);
  assert.ok(E.pinnedByRule(t.S, t.id('Craig')), 'Craig pinned as the only defender here');
});

test('pinned by rule when nobody on the bench can replace a group member', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW);
  setLineup(t, ['Nolan', 'Craig', 'Abe', 'Foster', 'Miles', 'Liam'], ['Knox', 'Drew', 'Lydon'], { Craig: 300, Nolan: 300 }, { Craig: 0, Nolan: 0 }, 300);
  assert.ok(E.pinnedByRule(t.S, t.id('Craig')), 'Craig is the only defender at the game right now');
});

test('like-for-like: defender replaces defender on a near tie', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW);
  setLineup(t, ['Nolan', 'Craig', 'Abe', 'Foster', 'Miles', 'Harrison'], ['Knox', 'Drew', 'Liam', 'Lydon', 'Chase'],
    { Nolan: 395, Craig: 395, Abe: 300, Foster: 300, Miles: 200, Harrison: 200 }, { Nolan: 5, Craig: 5, Abe: 100, Foster: 100, Miles: 200, Harrison: 200 }, 400);
  const p = E.rotationPlan(t.S);
  const pairs = p.pairs.map((pr) => t.name(pr.on) + '>' + t.name(pr.off));
  assert.ok(pairs.includes('Chase>Craig'), pairs.join(', '));
  assert.ok(pairs.includes('Knox>Nolan') || pairs.includes('Drew>Nolan'), pairs.join(', '));
});

test('never-off-together rule holds and keep rule with min 2 holds', () => {
  const t = team(COACH.names, [{ type: 'keep', min: 2, names: ['Craig', 'Chase', 'Harrison'] }, { type: 'notOffTogether', names: ['Liam', 'Nolan'] }]);
  E.startGame(t.S, NOW);
  setLineup(t, ['Liam', 'Nolan', 'Craig', 'Chase', 'Abe', 'Foster'], ['Knox', 'Drew', 'Lydon', 'Miles', 'Harrison'],
    { Liam: 500, Nolan: 500, Craig: 480, Chase: 480, Abe: 10, Foster: 10 }, { Liam: 0, Nolan: 0, Craig: 0, Chase: 0, Abe: 490, Foster: 490 }, 500);
  const p = E.rotationPlan(t.S);
  const offs = p.offs.map(t.name);
  assert.ok(!(offs.includes('Liam') && offs.includes('Nolan')), 'Liam and Nolan never leave together: ' + offs);
  const nf = t.S.game.field.filter((id) => !p.offs.includes(id)).concat(p.ons);
  assert.deepEqual(E.violations(t.S, nf, p.offs), []);
});

test('rules about absent kids are ignored', () => {
  const t = team(COACH.names, COACH.rules);
  ['Craig', 'Chase', 'Harrison'].forEach((n) => { t.S.players.find((p) => p.name === n).here = false; });
  assert.equal(E.startGame(t.S, NOW).ok, true);
  assert.deepEqual(E.violations(t.S, t.S.game.field, []), []);
  assert.ok(E.rotationPlan(t.S), 'a plan exists with no defenders at the game');
});

test('left early, fill, check-back, priority return', () => {
  const t = team(COACH.names, COACH.rules, { checkBackSec: 180 });
  E.startGame(t.S, NOW);
  const g = t.S.game;
  const abe = g.field.includes(t.id('Abe')) ? t.id('Abe') : g.field[2];
  E.outEarly(t.S, abe, false, NOW);
  assert.equal(g.field.length, 5);
  assert.equal(g.pending.type, 'fill');
  assert.equal(g.pending.ons.length, 1);
  E.execute(t.S, NOW);
  assert.equal(g.field.length, 6);
  let ev = E.tick(t.S, NOW + 179 * 1000);
  assert.ok(!ev.some((e) => e.type === 'checkBack'));
  g.running = false; // wall clock check-back fires even while paused
  ev = E.tick(t.S, NOW + 181 * 1000);
  assert.ok(ev.some((e) => e.type === 'checkBack' && e.id === abe));
  const r = E.returnNow(t.S, abe, NOW + 200 * 1000);
  assert.equal(r.ok, true);
  assert.equal(g.pending.type, 'return');
  assert.deepEqual(g.pending.ons, [abe]);
  assert.equal(g.pending.offs.length, 1);
  E.execute(t.S, NOW + 200 * 1000);
  assert.ok(g.field.includes(abe));
  assert.deepEqual(E.violations(t.S, g.field, []), []);
});

test('clock: warn, sub due, repeat, period end, game over', () => {
  const t = team(COACH.names, COACH.rules, { intervalSec: 120, warnSec: 60, repeatSec: 30, periodSec: 300, periods: 2 });
  E.startGame(t.S, NOW);
  const g = t.S.game;
  let ev = E.tick(t.S, NOW + 60 * 1000);
  assert.ok(ev.some((e) => e.type === 'warn' && e.plan), 'warn at one minute');
  ev = E.tick(t.S, NOW + 120 * 1000);
  assert.ok(ev.some((e) => e.type === 'subDue'), 'sub due');
  assert.equal(g.pending.type, 'rotation');
  ev = E.tick(t.S, NOW + 151 * 1000);
  assert.ok(ev.some((e) => e.type === 'repeat'), 'repeat after 30s unconfirmed');
  E.markSpoken(t.S, NOW + 151 * 1000);
  E.execute(t.S, NOW + 151 * 1000);
  assert.equal(g.subT, 120);
  ev = E.tick(t.S, NOW + 300 * 1000);
  assert.ok(ev.some((e) => e.type === 'break'), 'period break');
  assert.equal(g.breakPending, true);
  assert.equal(g.running, false);
  E.nextPeriod(t.S, NOW + 400 * 1000);
  assert.equal(g.period, 2);
  ev = E.tick(t.S, NOW + 700 * 1000);
  assert.ok(ev.some((e) => e.type === 'gameOver'));
  assert.equal(t.S.screen, 'summary');
});

test('undo restores the previous lineup', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW);
  const before = t.S.game.field.slice();
  E.subNow(t.S, NOW); E.execute(t.S, NOW);
  assert.notDeepEqual(t.S.game.field, before);
  assert.equal(E.undo(t.S, NOW), true);
  assert.deepEqual(t.S.game.field, before);
});

test('manual swap and late add', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW);
  const g = t.S.game; const f = g.field[0], b = g.bench[0];
  E.manualSwap(t.S, { id: f, list: 'field' }, { id: b, list: 'bench' }, NOW);
  assert.ok(g.field.includes(b) && g.bench.includes(f));
  const p = E.addLate(t.S, 'Zed');
  assert.ok(g.bench.includes(p.id));
  assert.equal(E.played(t.S, p.id), 0);
});

test('migration from the first draft rules', () => {
  const old = { players: COACH.names.map((n, i) => ({ id: 'p' + i, name: n, here: true })),
    rules: [{ id: 'r1', type: 'apart', ids: ['p0', 'p4'] }, { id: 'r2', type: 'notOffTogether', ids: ['p3', 'p5'] }, { id: 'r3', type: 'keep', ids: ['p2', 'p5'] }, { id: 'r4', type: 'keep', ids: ['p7'] }, { id: 'r5', type: 'keep', ids: ['p8', 'p1'] }],
    settings: { fieldSize: 6, subsPer: 2, intervalSec: 240, periods: 2, periodSec: 1320, checkBackSec: 180 }, game: null };
  const S = E.migrate(old);
  const kinds = S.rules.map((r) => r.type + ':' + r.ids.map((id) => E.nameOf(S, id)).join(','));
  assert.ok(kinds.includes('keep:Craig,Chase,Harrison'), kinds.join(' | '));
  assert.ok(kinds.includes('keep:Drew,Nolan,Knox'), kinds.join(' | '));
  assert.ok(!kinds.includes('keep:Craig'));
  assert.equal(S.settings.announce, true);
  assert.equal(S.v, E.STATE_VERSION);
  assert.ok(E.migrate(null).players.length > 0, 'garbage becomes defaults');
});

test('roster link round trip', () => {
  const t = team(COACH.names, COACH.rules, { periods: 2 });
  const enc = E.encodeRoster(t.S);
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
  const S2 = E.defaults();
  assert.equal(E.importRoster(S2, E.decodeRoster(enc)), true);
  assert.deepEqual(S2.players.map((p) => p.name), COACH.names);
  assert.equal(S2.rules.length, 4);
  assert.equal(S2.settings.periods, 2);
  assert.equal(E.decodeRoster('not base64!!'), null);
});

test('property: random rosters and rules never produce an illegal plan', () => {
  let seed = 42; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = (arr, k) => { const a = arr.slice(); const out = []; while (out.length < k && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
  let plans = 0, none = 0;
  for (let i = 0; i < 400; i++) {
    const n = 6 + Math.floor(rnd() * 7);
    const names = Array.from({ length: n }, (_, j) => 'K' + j);
    const rules = [];
    const nr = Math.floor(rnd() * 5);
    for (let r = 0; r < nr; r++) {
      const kind = ['apart', 'notOffTogether', 'keep'][Math.floor(rnd() * 3)];
      if (kind === 'keep') rules.push({ type: 'keep', min: 1 + Math.floor(rnd() * 2), names: pick(names, 1 + Math.floor(rnd() * 3)) });
      else rules.push({ type: kind, names: pick(names, 2) });
    }
    const t = team(names, rules, { fieldSize: 4 + Math.floor(rnd() * 3), subsPer: 1 + Math.floor(rnd() * 3), intervalSec: 120 + 60 * Math.floor(rnd() * 5) });
    if (!E.startGame(t.S, NOW).ok) continue;
    const g = t.S.game;
    // Random history so freshness and fairness vary
    g.total = 600; g.t = 600;
    [...g.field, ...g.bench].forEach((id) => { g.played[id] = Math.floor(rnd() * 600); });
    g.field.forEach((id) => { g.onSince[id] = Math.floor(rnd() * 600); });
    g.bench.forEach((id) => { g.offSince[id] = Math.floor(rnd() * 600); });
    if (rnd() < 0.3) g.locked = [g.field[0]];
    for (let s = 0; s < 6; s++) {
      const p = E.rotationPlan(t.S);
      if (!p) { none++; break; }
      plans++;
      const nf = g.field.filter((id) => !p.offs.includes(id)).concat(p.ons);
      assert.deepEqual(E.violations(t.S, nf, p.offs), [], 'plan broke a rule');
      assert.ok(!p.offs.some((id) => g.locked.includes(id)), 'locked kid never comes off');
      assert.equal(p.pairs.length, Math.max(p.offs.length, p.ons.length));
      g.pending = Object.assign({ type: 'rotation' }, p); E.execute(t.S, NOW);
      g.total += 200; g.t += 200; g.field.forEach((id) => { g.played[id] += 200; });
    }
  }
  assert.ok(plans > 500, 'exercised ' + plans + ' plans');
});

test('review fixes: undo keeps the clock and minutes', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  E.subNow(t.S, NOW); E.execute(t.S, NOW);
  E.tick(t.S, NOW + 180 * 1000);
  const total = g.total, played = Object.assign({}, g.played);
  assert.equal(E.undo(t.S), true);
  assert.equal(g.total, total, 'clock untouched');
  assert.deepEqual(g.played, played, 'minutes untouched');
  assert.equal(g.pending && g.pending.type, 'rotation', 'the undone swap is offered again');
});

test('review fixes: playing short fills with one kid when two cannot both come on', () => {
  const t = team(COACH.names, [{ type: 'apart', names: ['Knox', 'Lydon'] }]);
  E.startGame(t.S, NOW); const g = t.S.game;
  g.field = g.field.filter((id) => ![t.id('Knox'), t.id('Lydon')].includes(id)).slice(0, 4);
  g.bench = [t.id('Knox'), t.id('Lydon')];
  const p = E.rotationPlan(t.S);
  assert.equal(p.offs.length, 0, 'nobody comes off when playing short');
  assert.equal(p.ons.length, 1);
});

test('review fixes: marking a bench kid Away while a swap is due re-offers the swap', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  g.subT = 1; E.tick(t.S, NOW + 1000);
  assert.equal(g.pending.type, 'rotation');
  const gone = g.pending.ons[0];
  E.outEarly(t.S, gone, true, NOW + 1000);
  assert.ok(g.pending && g.pending.type === 'rotation', 'a fresh rotation is offered');
  assert.ok(!g.pending.ons.includes(gone));
});

test('review fixes: no heads-up when the setting is off, and it carries the seconds', () => {
  const t = team(COACH.names, COACH.rules, { intervalSec: 60, warnSec: 0 });
  E.startGame(t.S, NOW);
  const ev = E.tick(t.S, NOW + 60 * 1000);
  assert.ok(!ev.some((e) => e.type === 'warn'));
  const t2 = team(COACH.names, COACH.rules, { intervalSec: 60, warnSec: 30 });
  E.startGame(t2.S, NOW);
  const w = E.tick(t2.S, NOW + 30 * 1000).find((e) => e.type === 'warn');
  assert.equal(w.secs, 30);
});

test('review fixes: cannot remove a kid who is in the game; In now on a bench kid with no legal swap is a no-op', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  assert.equal(E.removePlayer(t.S, g.field[0]).ok, false);
  assert.equal(t.S.players.length, 11);
  g.locked = g.field.slice(); // nobody may come off
  const b = g.bench[0]; g.offSince[b] = 0; g.total = 300; g.t = 300;
  const hist = g.history.length;
  assert.equal(E.returnNow(t.S, b, NOW).ok, false);
  assert.equal(E.rest(t.S, b), 300, 'rest time untouched');
  assert.equal(g.history.length, hist, 'no snapshot recorded');
});

test('review fixes: settings from a roster link are clamped', () => {
  const S = E.defaults();
  E.importRoster(S, { players: ['A', 'B', 'C', 'D', 'E', 'F'], rules: [], settings: { intervalSec: 0, periodSec: 'x', fieldSize: 99, warnSec: -5 } });
  assert.equal(S.settings.intervalSec, 60);
  assert.equal(S.settings.periodSec, 600);
  assert.equal(S.settings.fieldSize, 7);
  assert.equal(S.settings.warnSec, 0);
});

test('security fixes: oversized or malformed roster links are refused without touching the roster', () => {
  const S = E.defaults(); const before = JSON.stringify([S.players, S.rules]);
  assert.equal(E.importRoster(S, { players: Array.from({ length: 31 }, (_, i) => 'K' + i) }), false);
  assert.equal(E.importRoster(S, { players: ['A', 'B'], rules: {} }), false);
  assert.equal(E.importRoster(S, { players: ['A', 'B'], rules: [null] }), false);
  assert.equal(E.importRoster(S, { players: ['A', 'B'], rules: [{ type: 'apart', names: {} }] }), false);
  assert.equal(E.importRoster(S, { players: [{ a: 1 }] }), false);
  assert.equal(JSON.stringify([S.players, S.rules]), before, 'nothing changed');
  assert.equal(E.importRoster(S, { players: ['  Very   Long  ' + 'x'.repeat(100)], rules: [{ type: 'keep', min: '<b>x</b>', names: ['Very Long ' + 'x'.repeat(100)] }] }), true);
  assert.ok(S.players[0].name.length <= 40);
  assert.equal(S.rules[0].min, 1);
});

test('security fixes: a big roster starts and plans quickly', () => {
  const t = team(Array.from({ length: 30 }, (_, i) => 'K' + i), [{ type: 'keep', min: 1, names: ['K28', 'K29'] }], { fieldSize: 7, subsPer: 3 });
  const t0 = Date.now();
  assert.equal(E.startGame(t.S, NOW).ok, true);
  for (let i = 0; i < 20; i++) assert.ok(E.rotationPlan(t.S));
  assert.ok(Date.now() - t0 < 1500, 'took ' + (Date.now() - t0) + ' ms');
});

test('security fixes: malformed saved state does not crash migrate', () => {
  assert.ok(E.migrate({ players: [], game: {} }).players.length >= 0);
  assert.ok(E.migrate({ players: [null] }).players.length === 0);
  const S = E.migrate({ players: [{ id: 'p1', name: 'A' }], seq: 'abc', rules: [{ id: 'r', type: 'keep', ids: ['p1', 'zzz'] }], game: { field: ['p1', 'nope'], bench: 'x' } });
  assert.equal(S.seq, 100); assert.deepEqual(S.rules[0].ids, ['p1']); assert.equal(S.game, null);
});

test('drag: move a kid onto the field with no pairing, then the plan takes the extra one off', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  const b = g.bench[0]; const hist = g.history.length;
  assert.equal(E.movePlayer(t.S, b, 'field', NOW), true);
  assert.equal(g.field.length, 7); assert.equal(g.bench.length, 4);
  assert.equal(g.history.length, hist + 1, 'undo covers a drag');
  const p = E.rotationPlan(t.S);
  assert.equal(p.ons.length, 0); assert.equal(p.offs.length, 1); assert.match(p.note, /Too many/);
  assert.deepEqual(E.violations(t.S, g.field.filter((id) => !p.offs.includes(id)), p.offs), []);
  assert.equal(E.movePlayer(t.S, b, 'field', NOW), false, 'already there');
  assert.equal(E.movePlayer(t.S, 'nope', 'bench', NOW), false);
  const f = g.field[0];
  assert.equal(E.movePlayer(t.S, f, 'bench', NOW), true);
  assert.equal(g.field.length, 6); assert.equal(E.rest(t.S, f), 0);
  assert.equal(E.undo(t.S), true); assert.equal(g.field.length, 7);
});

test('drag: a move clears the pending call; a due swap is offered again around the new lineup', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  g.subT = 1; E.tick(t.S, NOW + 1000);
  assert.equal(g.pending.type, 'rotation');
  const on = g.pending.ons[0];
  E.movePlayer(t.S, on, 'field', NOW + 1000);
  assert.ok(g.pending && g.pending.type === 'fix' && g.pending.offs.length === 1 && g.pending.ons.length === 0, 'seven on: a fix comes first');
  E.execute(t.S, NOW + 1000);
  assert.ok(g.pending && g.pending.type === 'rotation', 'then the due rotation is offered again');
  // A kid off to the side can be dragged straight onto the field.
  const away = g.field[0]; E.outEarly(t.S, away, false, NOW + 1000);
  assert.ok(g.away.some((a) => a.id === away));
  E.movePlayer(t.S, away, 'field', NOW + 1000);
  assert.ok(g.field.includes(away) && !g.away.some((a) => a.id === away));
});

test('carry on: the next game starts with the kids who were waiting and keeps the minutes', () => {
  const t = team(COACH.names, COACH.rules, { intervalSec: 120, periodSec: 600, periods: 2 });
  E.startGame(t.S, NOW); let g = t.S.game;
  E.tick(t.S, NOW + 120 * 1000); E.execute(t.S, NOW + 120 * 1000);
  E.tick(t.S, NOW + 240 * 1000); E.execute(t.S, NOW + 240 * 1000);
  E.tick(t.S, NOW + 300 * 1000);
  const endField = g.field.slice(), endBench = g.bench.slice(), endPlayed = Object.assign({}, g.played);
  E.endGame(t.S, NOW + 300 * 1000);
  assert.equal(t.S.screen, 'summary'); assert.ok(t.S.carry);
  assert.deepEqual(t.S.carry.field, endField);
  assert.equal(t.S.carry.waiting.length, 5);
  assert.ok(E.rest(t.S, t.S.carry.waiting[0]) >= E.rest(t.S, t.S.carry.waiting[4]), 'longest rest first');
  E.newGame(t.S, true);
  assert.equal(t.S.screen, 'setup'); assert.ok(t.S.carry, 'carry kept');
  const cp = E.carryPreview(t.S, NOW + 600 * 1000);
  assert.equal(cp.games, 1); assert.deepEqual(cp.onAtEnd.sort(), endField.slice().sort());
  assert.equal(E.startGame(t.S, NOW + 600 * 1000).ok, true); g = t.S.game;
  assert.equal(g.games, 2); assert.equal(t.S.carry, null, 'carry consumed');
  // The waiting kids start, except where a rule says no (Knox and Lydon apart), plus a legal pick from the kids who were on.
  assert.ok(endBench.filter((id) => g.field.includes(id)).length >= 4, 'the waiting kids start');
  assert.deepEqual(E.violations(t.S, g.field, []), []);
  assert.deepEqual(g.played, endPlayed, 'minutes carried');
  assert.deepEqual(g.playedBefore, endPlayed);
  const carriedOn = g.field.find((id) => endField.includes(id));
  assert.ok(E.stint(t.S, carriedOn) > 0, 'a kid who stayed on is not fresh');
  assert.ok(!E.isFresh(t.S, carriedOn));
  endField.filter((id) => g.bench.includes(id)).forEach((id) => assert.equal(E.rest(t.S, id), 0));
  const first = E.rotationPlan(t.S);
  assert.ok(first.offs.includes(carriedOn), 'the kid who stayed on comes off first');
  // Fresh start drops the carry; an old carry is ignored and cleared.
  E.endGame(t.S, NOW + 900 * 1000); E.newGame(t.S, false); assert.equal(t.S.carry, null);
  E.startGame(t.S, NOW); E.endGame(t.S, NOW + 100 * 1000); E.newGame(t.S, true);
  assert.equal(E.carryPreview(t.S, NOW + 13 * 3600 * 1000), null, 'expired after 12 hours');
  E.startGame(t.S, NOW + 13 * 3600 * 1000);
  assert.equal(t.S.game.games, 1); assert.equal(t.S.carry, null);
  // Fresh-start switch on the setup screen
  E.endGame(t.S, NOW + 14 * 3600 * 1000); E.newGame(t.S, true); t.S.carryOn = false;
  assert.equal(E.carryPreview(t.S, NOW + 14 * 3600 * 1000), null);
  E.startGame(t.S, NOW + 14 * 3600 * 1000); assert.equal(t.S.game.games, 1);
});

test('carry on: with no rules every waiting kid starts the next game', () => {
  const t = team(COACH.names, []);
  E.startGame(t.S, NOW); E.tick(t.S, NOW + 200 * 1000);
  const endBench = t.S.game.bench.slice();
  E.endGame(t.S, NOW + 200 * 1000); E.newGame(t.S, true); E.startGame(t.S, NOW + 300 * 1000);
  endBench.forEach((id) => assert.ok(t.S.game.field.includes(id), E.nameOf(t.S, id) + ' was waiting and starts'));
});

test('carry on: a late kid who never played today starts first, and a garbage carry is dropped by migrate', () => {
  const t = team(COACH.names, COACH.rules);
  t.S.players.find((p) => p.name === 'Miles').here = false;
  E.startGame(t.S, NOW); E.tick(t.S, NOW + 200 * 1000); E.endGame(t.S, NOW + 200 * 1000); E.newGame(t.S, true);
  t.S.players.find((p) => p.name === 'Miles').here = true;
  const cp = E.carryPreview(t.S, NOW + 300 * 1000);
  assert.equal(cp.waiting[0], t.id('Miles'));
  E.startGame(t.S, NOW + 300 * 1000);
  assert.ok(t.S.game.field.includes(t.id('Miles')));
  assert.equal(E.played(t.S, t.id('Miles')), 0);
  const S = E.migrate({ players: [{ id: 'p1', name: 'A' }], carry: { at: 'x', played: {} } });
  assert.equal(S.carry, null);
  const S2 = E.migrate({ players: [{ id: 'p1', name: 'A' }], carry: { at: 5, played: { p1: '30', zz: 9 }, rest: null, field: ['p1', 'zz'] } });
  assert.deepEqual(S2.carry, { at: 5, games: 1, played: { p1: 30 }, rest: {}, stint: {}, field: ['p1'], waiting: [] });
  assert.equal(JSON.parse(JSON.stringify(S2)).carryOn, true);
  const S3 = E.migrate({ players: [{ id: 'p1', name: 'A' }], carry: { at: Date.now() + 1e12, games: Infinity, played: {} } });
  assert.ok(S3.carry.at <= Date.now()); assert.equal(S3.carry.games, 99);
});

test('attendance: a kid marked not here keeps their rules, and they apply again when they arrive', () => {
  const t = team(COACH.names, COACH.rules);
  const lydon = t.id('Lydon'); t.S.players.find((p) => p.id === lydon).here = false;
  const rulesBefore = JSON.stringify(t.S.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  assert.equal(JSON.stringify(t.S.rules), rulesBefore, 'rules untouched while absent');
  assert.ok(!E.activeIds(t.S).has(lydon));
  assert.equal(E.arrive(t.S, lydon), true);
  assert.ok(g.bench.includes(lydon) && t.S.players.find((p) => p.id === lydon).here);
  assert.equal(E.played(t.S, lydon), 0);
  const knox = t.id('Knox'); g.field = g.field.filter((id) => id !== knox).concat(knox).slice(-6); if (!g.field.includes(knox)) g.field[0] = knox;
  assert.ok(E.violations(t.S, g.field.concat(lydon), []).some((v) => /Knox and Lydon/.test(v)), 'apart rule is live again');
  assert.equal(E.arrive(t.S, lydon), true, 'arriving twice is harmless'); assert.equal(g.bench.filter((id) => id === lydon).length, 1);
  assert.equal(E.arrive(t.S, 'nope'), false);
  assert.equal(E.addLate(t.S, 'lydon').id, lydon, 'typing the name finds the same kid');
});

test('attendance: reloading the roster keeps the carry-over by name', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); E.tick(t.S, NOW + 100 * 1000); E.endGame(t.S, NOW + 100 * 1000); E.newGame(t.S, true);
  const waiting = t.S.carry.waiting.map(t.name);
  E.importRoster(t.S, { players: COACH.names, rules: COACH.rules });
  assert.deepEqual(t.S.carry.waiting.map((id) => E.nameOf(t.S, id)), waiting);
  assert.ok(Object.keys(t.S.carry.played).length === 11);
});

test('who is on: set the six on the field from scratch', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  E.tick(t.S, NOW + 100 * 1000);
  const away = g.field[0]; E.outEarly(t.S, away, false, NOW + 100 * 1000); g.pending = null;
  const stay = g.field[0], stayStint = E.stint(t.S, stay);
  const on = [stay, g.field[1], g.bench[0], g.bench[1], g.bench[2], away];
  const hist = g.history.length;
  assert.equal(E.setLineup(t.S, on.concat(on[0], 'nope'), NOW + 100 * 1000), true);
  assert.deepEqual(g.field, on);
  assert.equal(g.field.length + g.bench.length, 11); assert.equal(g.away.length, 0);
  assert.equal(E.stint(t.S, stay), stayStint, 'a kid who stayed on keeps their stint');
  assert.equal(E.stint(t.S, g.bench[0]) >= 0 && E.rest(t.S, g.bench[g.bench.length - 1]), 0, 'a kid who came off starts resting now');
  assert.ok(E.isFresh(t.S, on[2]), 'a kid who came on is fresh');
  assert.ok(!g.pending || g.pending.type === 'fix', 'no call unless the six break a rule'); assert.equal(g.history.length, hist + 1);
  assert.equal(E.setLineup(t.S, ['nope'], NOW), false);
  assert.equal(E.undo(t.S), true); assert.ok(g.away.length === 1);
});


test('limit rule: at most N of a group on at once', () => {
  const t = team(COACH.names, COACH.rules.concat({ type: 'limit', max: 2, names: ['Lydon', 'Liam', 'Foster', 'Abe'] }));
  assert.equal(t.S.rules.length, 5); assert.equal(t.S.rules[4].max, 2);
  E.startGame(t.S, NOW); const g = t.S.game;
  E.setLineup(t.S, ['Lydon', 'Liam', 'Foster', 'Craig', 'Drew', 'Chase'].map(t.id), NOW);
  assert.ok(E.violations(t.S, g.field, []).some((v) => /More than 2/.test(v)));
  assert.ok(g.pending && g.pending.type === 'fix', 'a fix call is offered');
  assert.equal(g.pending.offs.length, 1); assert.ok(['Lydon', 'Liam', 'Foster'].includes(t.name(g.pending.offs[0])));
  E.execute(t.S, NOW); assert.deepEqual(E.violations(t.S, g.field, []), []);
  // round trips through the roster link and survives migrate
  const S2 = E.defaults(); E.importRoster(S2, E.decodeRoster(E.encodeRoster(t.S)));
  assert.equal(S2.rules.filter((r) => r.type === 'limit' && r.max === 2).length, 1);
  assert.equal(E.addRule(t.S, 'limit', [t.id('Knox'), t.id('Drew')], 2), null, 'a limit needs more kids than the max');
});

test('fix it: two kids walk off within a minute, and a kid leaves during a due swap', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  const a = g.field[3], b = g.field[4];
  E.outEarly(t.S, a, false, NOW); assert.equal(g.pending.type, 'fill'); assert.equal(g.pending.ons.length, 1); assert.match(g.pending.note, new RegExp(t.name(a) + ' came off'));
  E.outEarly(t.S, b, false, NOW + 40 * 1000);
  assert.equal(g.field.length, 4); assert.equal(g.pending.type, 'fill'); assert.equal(g.pending.ons.length, 2, 'the fill grows to two');
  E.execute(t.S, NOW + 40 * 1000); assert.equal(g.field.length, 6); assert.deepEqual(E.violations(t.S, g.field, []), []);
  // a kid leaves while a rotation is on screen: the fill comes first, then the rotation
  g.subT = 1; E.tick(t.S, NOW + 41 * 1000); assert.equal(g.pending.type, 'rotation');
  const c = g.field.find((id) => !g.pending.offs.includes(id));
  E.outEarly(t.S, c, false, NOW + 42 * 1000);
  assert.equal(g.pending.type, 'fill'); assert.equal(g.pending.ons.length, 1);
  E.execute(t.S, NOW + 42 * 1000); assert.equal(g.field.length, 6);
  assert.ok(g.pending && g.pending.type === 'rotation', 'rotation re-offered after the fill');
  assert.equal(g.subT, 0, 'a fill does not reset the swap timer');
});

test('off now and live field size', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  const k = g.field[2];
  assert.equal(E.offNow(t.S, k, NOW), true); assert.equal(g.pending.type, 'fix'); assert.deepEqual(g.pending.offs, [k]); assert.equal(g.pending.ons.length, 1);
  E.execute(t.S, NOW); assert.ok(g.bench.includes(k)); assert.equal(g.subT, t.S.settings.intervalSec, 'timer untouched');
  assert.equal(E.offNow(t.S, k, NOW), false, 'not on the field');
  // 6v6 -> 4v4: two come off; 4v4 -> 5v5: one goes in
  E.setFieldSize(t.S, 4, NOW); assert.equal(g.pending.type, 'fix'); assert.equal(g.pending.offs.length, 2); assert.equal(g.pending.ons.length, 0);
  E.execute(t.S, NOW); assert.equal(g.field.length, 4); assert.deepEqual(E.violations(t.S, g.field, []), []);
  E.setFieldSize(t.S, 5, NOW); assert.equal(g.pending.type, 'fill'); assert.equal(g.pending.ons.length, 1);
  E.execute(t.S, NOW); assert.equal(g.field.length, 5);
  assert.equal(E.setFieldSize(t.S, 99, NOW), true); assert.equal(t.S.settings.fieldSize, 7);
  // Who's on with five picked offers the sixth
  E.setFieldSize(t.S, 6, NOW); E.execute(t.S, NOW);
  E.setLineup(t.S, g.field.slice(0, 5), NOW); assert.equal(g.pending.type, 'fill'); assert.equal(g.pending.ons.length, 1);
});

test('review fix: a manual swap needs exactly one side on the field', () => {
  const t = team(COACH.names, COACH.rules);
  E.startGame(t.S, NOW); const g = t.S.game;
  const away = g.field[0]; E.outEarly(t.S, away, false, NOW); g.pending = null;
  const before = JSON.stringify([g.field, g.bench, g.away]);
  assert.equal(E.manualSwap(t.S, { id: away, list: 'away' }, { id: g.bench[0], list: 'bench' }, NOW), false);
  assert.equal(JSON.stringify([g.field, g.bench, g.away]), before, 'nothing changed');
  assert.equal(E.manualSwap(t.S, { id: g.field[0], list: 'field' }, { id: away, list: 'away' }, NOW), true, 'field for away is fine');
  assert.ok(g.field.includes(away) && g.away.length === 0);
});

test('fairness: a full game with the coach rules ends within one stint of equal minutes', () => {
  const t = team(COACH.names, COACH.rules, { intervalSec: 240, periods: 2, periodSec: 1200, warnSec: 60, repeatSec: 0 });
  let T = NOW; E.startGame(t.S, T); const g = t.S.game; let grew = 0;
  while (!g.ended) { T += 1000; E.tick(t.S, T); if (g.pending) { if (g.pending.ons.length > 2) { grew++; assert.match(g.pending.note, /Three this time/); } E.execute(t.S, T); } if (g.breakPending) E.nextPeriod(t.S, T); }
  const mins = [...E.activeIds(t.S)].map((id) => E.played(t.S, id));
  assert.ok(Math.max(...mins) - Math.min(...mins) <= 240, 'spread ' + (Math.max(...mins) - Math.min(...mins)) + ' s');
  assert.ok(grew > 0, 'the catch-up swap was used');
});

test('fairness check: plays a game in memory and reports the cost of a rule', () => {
  const t = team(COACH.names, COACH.rules, { periods: 2, periodSec: 1200 });
  const f = E.fairness(t.S); assert.ok(f && f.spread <= 240 && f.ideal === 1309, 'spread ' + f.spread);
  assert.equal(Object.keys(f.minutes).length, 11);
  const lim = { id: 'rx', type: 'limit', max: 2, ids: ['Lydon', 'Liam', 'Foster', 'Abe'].map(t.id) };
  ['Miles', 'Harrison'].forEach((n) => { t.S.players.find((p) => p.name === n).here = false; });
  const f9 = E.fairness(t.S, t.S.rules.concat(lim));
  assert.ok(f9.spread >= 600, 'with 9 kids the limit rule costs minutes (' + f9.spread + ' s)');
  assert.ok(f9.lowest.some((id) => lim.ids.includes(id)), 'the limited group ends among the lowest');
  assert.equal(t.S.game, null, 'the real state is untouched'); assert.equal(t.S.players.filter((p) => p.here).length, 9);
  t.S.players.forEach((p) => { p.here = false; }); assert.equal(E.fairness(t.S), null);
});
