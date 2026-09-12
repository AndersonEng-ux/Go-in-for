/* Go In For — planner engine.
 * Pure game logic with no DOM. Works as a browser global (window.Engine) and as a Node module.
 * Every function takes the whole app state `S` = { players, rules, settings, game, v, seq }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATE_VERSION = 3;
  const RULE_TYPES = ['apart', 'notOffTogether', 'keep'];
  const MAX_PLAYERS = 30, MAX_RULES = 20, MAX_NAME = 40;
  const cleanName = (raw) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '');
  const LIMITS = { fieldSize: [4, 7], subsPer: [1, 3], intervalSec: [60, 600], periods: [1, 4], periodSec: [300, 2700], checkBackSec: [60, 600], warnSec: [0, 60], repeatSec: [0, 60] };

  // ---------- Defaults and migration ----------
  function defaults() {
    // Example roster only. Load a real roster with a roster link (see importRoster).
    const names = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Finn', 'Gus', 'Hal', 'Ivy', 'Jude', 'Kit'];
    return {
      v: STATE_VERSION,
      seq: 100,
      screen: 'setup',
      players: names.map((n, i) => ({ id: 'p' + i, name: n, here: true })),
      rules: [
        { id: 'r1', type: 'keep', min: 1, ids: ['p7', 'p8', 'p10'] }, // defense group: keep at least one on
        { id: 'r2', type: 'keep', min: 1, ids: ['p2', 'p5', 'p0'] },  // offense group
        { id: 'r3', type: 'apart', ids: ['p0', 'p4'] },               // not on the field together
        { id: 'r4', type: 'notOffTogether', ids: ['p3', 'p5'] },      // never come off in the same swap
      ],
      settings: { fieldSize: 6, subsPer: 2, intervalSec: 240, periods: 4, periodSec: 600, checkBackSec: 180, announce: true, warnSec: 60, repeatSec: 30 },
      game: null,
    };
  }
  function cleanSettings(raw) {
    const d = defaults().settings; const out = Object.assign({}, d);
    Object.keys(LIMITS).forEach((k) => { const v = Number(raw && raw[k]); out[k] = Number.isFinite(v) ? Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], Math.round(v))) : d[k]; });
    out.announce = raw && raw.announce != null ? !!raw.announce : d.announce;
    return out;
  }
  const findByName = (S, name) => { const n = cleanName(name).toLowerCase(); return n ? S.players.find((p) => p.name.toLowerCase() === n) || null : null; };

  function migrate(S) {
    if (!S || !Array.isArray(S.players)) return defaults();
    S.players = S.players.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string').slice(0, MAX_PLAYERS)
      .map((p) => ({ id: p.id, name: cleanName(p.name) || '?', here: p.here !== false }));
    S.settings = cleanSettings(S.settings);
    S.rules = Array.isArray(S.rules) ? S.rules : [];
    S.seq = Number.isFinite(Number(S.seq)) ? Math.max(100, Math.round(Number(S.seq))) : 100;
    if (!S.v || S.v < 2) {
      // First draft shipped per-kid keep rules r3/r4/r5; replace with defense and offense groups when those kids exist.
      const ids = (names) => names.map((n) => findByName(S, n)).filter(Boolean).map((p) => p.id);
      S.rules = S.rules.filter((r) => !['r3', 'r4', 'r5'].includes(r.id));
      const def = ids(['Craig', 'Chase', 'Harrison']), off = ids(['Drew', 'Nolan', 'Knox']);
      if (def.length) S.rules.push({ id: 'r6', type: 'keep', min: 1, ids: def });
      if (off.length) S.rules.push({ id: 'r7', type: 'keep', min: 1, ids: off });
    }
    const known = new Set(S.players.map((p) => p.id));
    S.rules = S.rules.filter((r) => r && RULE_TYPES.includes(r.type) && Array.isArray(r.ids) && typeof r.id === 'string')
      .map((r) => ({ id: r.id, type: r.type, min: r.type === 'keep' ? cleanMin(r.min, r.ids.length) : undefined, ids: r.ids.filter((id) => known.has(id)) }))
      .filter((r) => r.ids.length >= (r.type === 'keep' ? 1 : 2)).slice(0, MAX_RULES);
    if (S.game) {
      const g = S.game; const isArr = (v) => Array.isArray(v);
      const ids = (v) => (isArr(v) ? v.filter((id) => known.has(id)) : []);
      if (!isArr(g.field) || !isArr(g.bench)) S.game = null;
      else {
        g.field = ids(g.field); g.bench = ids(g.bench); g.locked = ids(g.locked);
        g.away = (isArr(g.away) ? g.away : []).filter((a) => a && known.has(a.id));
        g.history = isArr(g.history) ? g.history : [];
        ['played', 'onSince', 'offSince'].forEach((k) => { g[k] = g[k] && typeof g[k] === 'object' ? g[k] : {}; });
        ['t', 'total', 'subT', 'period'].forEach((k) => { g[k] = Number.isFinite(Number(g[k])) ? Number(g[k]) : (k === 'period' ? 1 : 0); });
        g.running = false; g.lastTick = Date.now();
      }
    }
    if (S.game === null || !S.game) { if (S.screen === 'game' || S.screen === 'summary') S.screen = 'setup'; }
    S.v = STATE_VERSION;
    return S;
  }

  const uid = (S, prefix) => { S.seq += 1; return prefix + S.seq; };
  const cleanMin = (min, n) => Math.min(Math.max(1, n), Math.max(1, Math.round(Number(min)) || 1));
  const nameOf = (S, id) => { const p = S.players.find((x) => x.id === id); return p ? p.name : '?'; };
  const namesOf = (S, ids) => ids.map((id) => nameOf(S, id)).join(ids.length === 2 ? ' and ' : ', ');

  // ---------- Rules ----------
  function activeIds(S) {
    const g = S.game; const set = new Set([...g.field, ...g.bench]);
    g.away.forEach((a) => { if (a.status !== 'done') set.add(a.id); });
    return set;
  }
  // Rules narrowed to the kids who are actually at the game (rules about absent kids are ignored).
  function liveRules(S) {
    const act = activeIds(S);
    return S.rules.map((r) => ({ type: r.type, min: r.min, live: r.ids.filter((id) => act.has(id)) })).filter((r) => r.live.length > 0);
  }
  // Plain-English problems with a lineup. `offs` are the kids leaving in this move.
  function violations(S, fieldIds, offs) { return checkLineup(S, liveRules(S), new Set(fieldIds), offs || []); }
  function checkLineup(S, rules, set, offs) {
    const out = [];
    for (const r of rules) {
      const live = r.live;
      if (r.type === 'apart') {
        if (live.length === 2 && live.every((id) => set.has(id))) out.push(namesOf(S, live) + ' are both on');
      } else if (r.type === 'keep') {
        const need = Math.min(r.min || 1, live.length);
        const on = live.filter((id) => set.has(id)).length;
        if (on < need) out.push(need === 1 ? 'Nobody from ' + namesOf(S, live) + ' is on' : 'Fewer than ' + need + ' of ' + namesOf(S, live) + ' are on');
      } else if (r.type === 'notOffTogether') {
        if (live.length === 2 && live.every((id) => offs.includes(id))) out.push(namesOf(S, live) + ' would come off together');
      }
    }
    return out;
  }
  // Visit every k-combination of arr in order; stop early when fn returns true.
  function eachCombo(arr, k, fn) {
    const cur = [];
    return (function rec(start) {
      if (cur.length === k) return fn(cur.slice()) === true;
      for (let i = start; i < arr.length; i++) { cur.push(arr[i]); if (rec(i + 1)) return true; cur.pop(); }
      return false;
    })(0);
  }
  function combos(arr, k) { const out = []; eachCombo(arr, k, (c) => { out.push(c); }); return out; }
  const played = (S, id) => (S.game.played[id] || 0);
  const since = (S, map, id) => (map[id] == null ? 0 : S.game.total - map[id]);
  const stint = (S, id) => since(S, S.game.onSince, id);
  const rest = (S, id) => since(S, S.game.offSince, id);
  const freshSec = (S) => Math.min(90, Math.floor(S.settings.intervalSec / 3));
  const isFresh = (S, id) => stint(S, id) < freshSec(S);
  // Freshness only matters once somebody has been on long enough to be the obvious pick.
  const freshMatters = (S) => S.game.field.some((id) => !S.game.locked.includes(id) && !isFresh(S, id));

  const shareGroup = (S, a, b) => S.rules.some((r) => r.type === 'keep' && r.ids.includes(a) && r.ids.includes(b));
  // Pair each kid coming on with a kid going off so the coach can say "X in for Y". Same-group first.
  function pairUp(S, offs, ons) {
    const rem = offs.slice(); const pairs = []; const later = [];
    for (const on of ons) {
      const idx = rem.findIndex((off) => shareGroup(S, on, off));
      if (idx >= 0) pairs.push({ on, off: rem.splice(idx, 1)[0] }); else later.push(on);
    }
    for (const on of later) pairs.push({ on, off: rem.length ? rem.shift() : null });
    rem.forEach((off) => pairs.push({ on: null, off }));
    return pairs;
  }
  // Pick `on` kids to bring on and `off` kids to take off, honoring every rule.
  // forceOn/forceOff are fixed members. shrink lets it fall back to a smaller swap. protectFresh leaves out kids who just came on.
  function plan(S, o) {
    const g = S.game;
    const forceOn = o.forceOn || [], forceOff = o.forceOff || [];
    const offPool = g.field.filter((id) => !g.locked.includes(id) && !forceOff.includes(id) && (!o.protectFresh || !isFresh(S, id)));
    // Precompute what every candidate needs: live rules, per-kid scores, the current field set.
    const rules = liveRules(S); const fieldSet = new Set(g.field);
    const offScore = {}, onScore = {};
    g.field.forEach((id) => { offScore[id] = 2 * played(S, id) + stint(S, id); });
    g.bench.forEach((id) => { onScore[id] = rest(S, id) - 2 * played(S, id); });
    // Only the eight most-due bench kids, plus anyone a group rule may need, are worth searching.
    const grouped = new Set(rules.filter((r) => r.type === 'keep').flatMap((r) => r.live));
    const ranked = g.bench.filter((id) => !forceOn.includes(id)).sort((a, b) => onScore[b] - onScore[a]);
    const onPool = ranked.filter((id, i) => i < 8 || grouped.has(id));
    let on = o.on, off = o.off;
    while (on >= forceOn.length && off >= forceOff.length && (on > 0 || off > 0)) {
      const offC = combos(offPool, Math.max(0, off - forceOff.length)).map((c) => forceOff.concat(c));
      const onC = combos(onPool, Math.max(0, on - forceOn.length)).map((c) => forceOn.concat(c));
      let best = null;
      for (const offs of offC) for (const ons of onC) {
        const nf = new Set(fieldSet); offs.forEach((id) => nf.delete(id)); ons.forEach((id) => nf.add(id));
        if (checkLineup(S, rules, nf, offs).length) continue;
        const pairs = pairUp(S, offs, ons);
        // Like-for-like bonus: a defender replacing a defender wins a near tie (worth about 20 seconds of playing time).
        let sc = 20 * pairs.filter((pr) => pr.on && pr.off && shareGroup(S, pr.on, pr.off)).length;
        offs.forEach((id) => { sc += offScore[id] || 0; }); ons.forEach((id) => { sc += onScore[id] || 0; });
        if (!best || sc > best.sc) best = { offs, ons, pairs, sc };
      }
      if (best) return { offs: best.offs, ons: best.ons, pairs: best.pairs, reduced: (on < o.on || off < o.off) };
      if (!o.shrink) return null;
      // Shrink both sides together when both can give; otherwise whichever side still can.
      const canOn = on > forceOn.length, canOff = off > forceOff.length;
      if (canOn && canOff) { on--; off--; } else if (canOn) on--; else if (canOff) off--; else break;
    }
    return null;
  }
  // A kid the rules will not let come off right now (the only defender at the game, ...).
  function pinnedByRule(S, id) {
    const g = S.game; if (!g.field.includes(id)) return false;
    if (violations(S, g.field.filter((x) => x !== id), [id]).length === 0) return false;
    return plan(S, { on: 1, off: 1, forceOff: [id], shrink: false }) === null;
  }
  // The next timed swap, with a note explaining any compromise.
  function rotationPlan(S) {
    const g = S.game; const k = Math.min(S.settings.subsPer, g.bench.length, g.field.length);
    if (k <= 0) return null;
    const short = S.settings.fieldSize - g.field.length; // playing short: bring on extra without taking off
    if (short > 0) { const p = plan(S, { on: Math.min(g.bench.length, short), off: 0, shrink: true }); if (p) { p.note = ''; return p; } }
    let p = plan(S, { on: k, off: k, shrink: true, protectFresh: true });
    if (p) { p.note = p.reduced ? 'Smaller swap: the other kids just came on.' : ''; return p; }
    p = plan(S, { on: k, off: k, shrink: true });
    if (p) p.note = p.reduced ? 'Smaller swap so the rules hold.' : (freshMatters(S) && p.offs.some((id) => isFresh(S, id)) ? 'Someone who just came on has to come off so the rules hold.' : '');
    return p;
  }
  function planSpeech(S, p) {
    return p.pairs.map((pr) => pr.on && pr.off ? nameOf(S, pr.on) + ' in for ' + nameOf(S, pr.off) : pr.on ? nameOf(S, pr.on) + ', go in' : nameOf(S, pr.off) + ', come off').join('. ') + '.';
  }

  // ---------- Game mutations ----------
  // Undo snapshots cover the lineup only. The clock, total time and minutes played keep running.
  const SNAP_FIELDS = ['field', 'bench', 'away', 'locked', 'onSince', 'offSince', 'pending'];
  function snapshot(S) {
    const g = S.game;
    const copy = {}; SNAP_FIELDS.forEach((k) => { copy[k] = JSON.parse(JSON.stringify(g[k] == null ? null : g[k])); });
    g.history.push(copy); if (g.history.length > 15) g.history.shift();
  }
  function undo(S) {
    const g = S.game; if (!g || !g.history.length) return false;
    const prev = g.history.pop();
    SNAP_FIELDS.forEach((k) => { g[k] = prev[k]; });
    return true;
  }
  // Pull a kid out of every list. Callers push them where they go next.
  function detach(g, id) {
    g.field = g.field.filter((x) => x !== id); g.bench = g.bench.filter((x) => x !== id); g.away = g.away.filter((a) => a.id !== id);
  }
  const resetSubTimer = (S) => { S.game.subT = S.settings.intervalSec; S.game.warned = false; };
  function setPending(S, type, note, p, now) {
    S.game.pending = Object.assign({ type, note: [note, p.note].filter(Boolean).join(' '), since: now, spoken: 0 }, p);
  }
  function offerRotation(S, note, now) {
    const p = rotationPlan(S); if (!p) return false;
    setPending(S, 'rotation', note || '', p, now); return true;
  }
  // Run after every lineup change: drop a pending call the change made stale, then offer a due rotation.
  function settle(S, now) {
    const g = S.game; const p = g.pending;
    if (p) {
      // A return brings a kid in from the side; every other move brings kids in from the bench.
      const from = p.type === 'return' ? g.away.filter((a) => a.status !== 'done').map((a) => a.id) : g.bench;
      const stale = p.offs.some((id) => !g.field.includes(id) || g.locked.includes(id)) || p.ons.some((id) => !from.includes(id));
      if (stale) g.pending = null;
    }
    if (!g.pending && g.subT <= 0 && !g.breakPending) offerRotation(S, '', now);
  }
  function startGame(S, now) {
    const here = S.players.filter((p) => p.here).map((p) => p.id);
    const f = S.settings.fieldSize;
    if (here.length < f) return { ok: false, msg: 'You need at least ' + f + ' kids here for ' + f + 'v' + f + '.' };
    S.game = { running: true, t: 0, total: 0, period: 1, subT: S.settings.intervalSec, field: [], bench: here, away: [], locked: [],
      played: {}, onSince: {}, offSince: {}, pending: null, history: [], breakPending: false, lastTick: now, ended: false, warned: false };
    const g = S.game;
    // Starting lineup: first legal group of `f`, preferring roster order.
    let pick = null; const rules = liveRules(S);
    eachCombo(here, f, (c) => { if (checkLineup(S, rules, new Set(c), []).length === 0) { pick = c; return true; } return false; });
    g.field = pick || here.slice(0, f);
    g.bench = here.filter((id) => !g.field.includes(id));
    here.forEach((id) => { g.played[id] = 0; });
    g.field.forEach((id) => { g.onSince[id] = 0; });
    g.bench.forEach((id) => { g.offSince[id] = 0; });
    S.screen = 'game';
    return { ok: true };
  }
  function execute(S, now) {
    const g = S.game; const p = g.pending; if (!p) return false;
    snapshot(S);
    p.offs.forEach((id) => { detach(g, id); g.bench.push(id); g.offSince[id] = g.total; });
    p.ons.forEach((id) => { detach(g, id); g.field.push(id); g.onSince[id] = g.total; });
    if (p.type === 'rotation') resetSubTimer(S);
    g.pending = null;
    settle(S, now);
    return true;
  }
  // Coach waved off the pending call. A skipped timed swap restarts the timer; anything else just clears.
  function dismissPending(S, now) {
    const g = S.game; const wasRotation = g.pending && g.pending.type === 'rotation';
    g.pending = null;
    if (wasRotation) resetSubTimer(S); else settle(S, now);
  }
  function subNow(S, now) { S.game.pending = null; return offerRotation(S, '', now); }
  function toggleLock(S, id, now) {
    const g = S.game; g.locked = g.locked.includes(id) ? g.locked.filter((x) => x !== id) : g.locked.concat(id);
    if (g.pending && g.pending.type === 'rotation') g.pending = null; // the plan may change; settle re-offers if due
    settle(S, now);
  }
  function outEarly(S, id, fromBench, now) {
    const g = S.game; snapshot(S);
    detach(g, id);
    g.offSince[id] = g.total;
    g.away.push({ id, since: now, checkAt: now + S.settings.checkBackSec * 1000, status: 'left', prompted: false });
    settle(S, now);
    if (!fromBench && !g.pending) {
      const p = plan(S, { on: 1, off: 0, shrink: false });
      if (p) setPending(S, 'fill', nameOf(S, id) + ' came off. Send in the next kid.', p, now);
    }
  }
  function returnNow(S, id, now) {
    const g = S.game; const full = g.field.length >= S.settings.fieldSize;
    const p = plan(S, { on: 1, off: full ? 1 : 0, forceOn: [id], shrink: false });
    if (!p) {
      if (g.away.some((a) => a.id === id)) toBench(S, id);
      return { ok: false, msg: 'No legal swap for ' + nameOf(S, id) + ' right now. ' + nameOf(S, id) + ' is on the bench; tap a kid on the field, then ' + nameOf(S, id) + ', to swap by hand.' };
    }
    setPending(S, 'return', nameOf(S, id) + ' is ready. Goes in right away.', p, now);
    return { ok: true };
  }
  function toBench(S, id) { const g = S.game; snapshot(S); detach(g, id); g.bench.push(id); g.offSince[id] = g.total; }
  function doneToday(S, id) { const a = S.game.away.find((x) => x.id === id); if (a) a.status = 'done'; }
  function checkLater(S, id, now) { const a = S.game.away.find((x) => x.id === id); if (a) { a.checkAt = now + S.settings.checkBackSec * 1000; a.prompted = false; } }
  function manualSwap(S, a, b, now) { // a, b = { id, list }; exactly one is on the field
    const g = S.game; snapshot(S);
    const fieldP = a.list === 'field' ? a.id : b.id, otherP = a.list === 'field' ? b.id : a.id;
    detach(g, fieldP); detach(g, otherP);
    g.field.push(otherP); g.bench.push(fieldP); g.onSince[otherP] = g.total; g.offSince[fieldP] = g.total;
    g.pending = null;
    settle(S, now);
  }
  function addPlayer(S, name) {
    name = cleanName(name); if (!name) return null;
    let p = findByName(S, name);
    if (!p) { if (S.players.length >= MAX_PLAYERS) return null; p = { id: uid(S, 'p'), name, here: true }; S.players.push(p); } else p.here = true;
    return p;
  }
  function addLate(S, name) {
    const g = S.game; const p = addPlayer(S, name); if (!p) return null;
    if (g.field.includes(p.id) || g.bench.includes(p.id)) return p;
    snapshot(S); detach(g, p.id); g.bench.push(p.id); if (g.played[p.id] == null) g.played[p.id] = 0; g.offSince[p.id] = g.total;
    return p;
  }
  function removePlayer(S, id) {
    const g = S.game;
    if (g && !g.ended && activeIds(S).has(id)) return { ok: false, msg: nameOf(S, id) + ' is in the game. End the game first, or mark them Done for today.' };
    S.players = S.players.filter((x) => x.id !== id);
    S.rules = S.rules.map((r) => Object.assign({}, r, { ids: r.ids.filter((x) => x !== id) })).filter((r) => r.ids.length >= (r.type === 'keep' ? 1 : 2));
    return { ok: true };
  }
  function addRule(S, type, ids, min) {
    if (!RULE_TYPES.includes(type) || !Array.isArray(ids) || S.rules.length >= MAX_RULES) return null;
    ids = ids.filter((id, i) => typeof id === 'string' && ids.indexOf(id) === i && S.players.some((p) => p.id === id));
    const m = cleanMin(min, ids.length);
    if (type === 'keep' ? ids.length < m : ids.length !== 2) return null;
    const r = { id: uid(S, 'r'), type, ids: ids.slice() }; if (type === 'keep') r.min = m;
    S.rules.push(r); return r;
  }
  function togglePlay(S, now) { const g = S.game; if (g.breakPending || g.ended) return; g.running = !g.running; g.lastTick = now; }
  function endPeriod(S, now) {
    const g = S.game; g.running = false;
    if (g.period >= S.settings.periods) { g.ended = true; S.screen = 'summary'; return 'gameOver'; }
    g.breakPending = true; g.pending = null; offerRotation(S, 'Swap at the break.', now);
    return 'break';
  }
  function nextPeriod(S, now) { const g = S.game; g.period++; g.t = 0; g.breakPending = false; g.running = true; g.lastTick = now; if (g.subT <= 0) resetSubTimer(S); }
  function endGame(S) { S.game.running = false; S.game.ended = true; S.screen = 'summary'; }
  function newGame(S) { S.game = null; S.screen = 'setup'; }

  // One second of game clock. Returns events for the UI to announce.
  function step(S, now) {
    const g = S.game; const ev = [];
    g.t++; g.total++;
    g.field.forEach((id) => { g.played[id] = (g.played[id] || 0) + 1; });
    if (g.subT > 0) {
      g.subT--;
      if (S.settings.warnSec > 0 && g.subT === S.settings.warnSec && !g.pending && !g.warned) { g.warned = true; ev.push({ type: 'warn', plan: rotationPlan(S), secs: S.settings.warnSec }); }
      if (g.subT === 0) { if (g.pending || !offerRotation(S, '', now)) resetSubTimer(S); else ev.push({ type: 'subDue', plan: g.pending }); }
    }
    if (g.t >= S.settings.periodSec) ev.push({ type: endPeriod(S, now) });
    return ev;
  }
  // Wall-clock tick. Applies elapsed seconds, then wall-clock prompts. Returns events.
  function tick(S, now) {
    const g = S.game; if (!g || g.ended) return [];
    let ev = [];
    if (g.running) {
      const d = Math.floor((now - g.lastTick) / 1000);
      if (d > 0) {
        g.lastTick += d * 1000;
        for (let i = 0; i < d && !g.ended && g.running; i++) ev = ev.concat(step(S, now));
      }
    } else g.lastTick = now;
    g.away.forEach((a) => { if (a.status === 'left' && !a.prompted && now >= a.checkAt) { a.prompted = true; ev.push({ type: 'checkBack', id: a.id }); } });
    const p = g.pending;
    if (p && S.settings.repeatSec > 0 && now - (p.lastSpoken || p.since) >= S.settings.repeatSec * 1000 && (p.spoken || 0) < 4) ev.push({ type: 'repeat', plan: p });
    return ev;
  }
  function markSpoken(S, now) { const p = S.game && S.game.pending; if (p) { p.lastSpoken = now; p.spoken = (p.spoken || 0) + 1; } }

  // ---------- Roster import and export (names only; ids are rebuilt on import) ----------
  function exportRoster(S) {
    return {
      players: S.players.map((p) => p.name),
      rules: S.rules.map((r) => ({ type: r.type, min: r.min, names: r.ids.map((id) => nameOf(S, id)) })),
      settings: S.settings,
    };
  }
  // Returns true and replaces the roster only when the whole payload is well-formed.
  function importRoster(S, data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.players) || data.players.length > MAX_PLAYERS) return false;
    const rules = data.rules == null ? [] : data.rules;
    if (!Array.isArray(rules) || rules.length > MAX_RULES || !rules.every((r) => r && typeof r === 'object' && RULE_TYPES.includes(r.type) && Array.isArray(r.names))) return false;
    if (!data.players.every((n) => typeof n === 'string')) return false;
    const tmp = { players: [], rules: [], seq: 100 };
    data.players.forEach((n) => addPlayer(tmp, n));
    if (tmp.players.length === 0) return false;
    rules.forEach((r) => { const ids = r.names.map((n) => findByName(tmp, n)).filter(Boolean).map((p) => p.id); addRule(tmp, r.type, ids, r.min); });
    S.players = tmp.players; S.rules = tmp.rules; S.seq = tmp.seq;
    S.settings = cleanSettings(Object.assign({}, S.settings, data.settings && typeof data.settings === 'object' ? data.settings : {}));
    S.game = null; S.screen = 'setup';
    return true;
  }
  function encodeRoster(S) {
    const json = JSON.stringify(exportRoster(S));
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json) : Buffer.from(json, 'utf8');
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeRoster(str) {
    try {
      let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
      const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const json = typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  return { STATE_VERSION, LIMITS, MAX_PLAYERS, MAX_RULES, defaults, migrate, findByName, nameOf, activeIds, violations, played, stint, rest, isFresh, freshMatters,
    pinnedByRule, plan, rotationPlan, planSpeech, undo, startGame, execute, dismissPending, subNow, toggleLock, outEarly, returnNow, toBench,
    doneToday, checkLater, manualSwap, addPlayer, addLate, removePlayer, addRule, togglePlay, nextPeriod, endGame, newGame, tick, markSpoken,
    importRoster, encodeRoster, decodeRoster };
});
