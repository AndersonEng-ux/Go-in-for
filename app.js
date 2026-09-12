/* Go In For — sideline UI. All game logic lives in engine.js (window.Engine). */
(function () {
  'use strict';
  const E = window.Engine;
  const KEY = 'goinfor_v2';
  const OLD_KEY = 'goinfor_v1';
  const APP_VERSION = '1.0.0';
  const SAVE_EVERY_MS = 5000;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => Date.now();
  const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; };
  const mins = (sec) => Math.round(sec / 60) + 'm';
  const SECS_OPTS = [{ label: 'Off', value: 0 }, { label: '30 s', value: 30 }, { label: '1 min', value: 60 }];
  const SWAP_HINT = 'Tap a kid on the field, then a kid on the bench, to swap by hand.';

  let S = null;
  // Per-render view model: the move being shown (pending or preview) and what every row needs.
  const ui = { sel: null, sheet: false, pocket: false, viewKey: '', view: null, screen: '', els: new Map(), toastTimer: null, lastSave: 0 };
  const ruleDraft = { open: false, type: 'apart', ids: [], min: 1 };
  const liveGame = () => !!(S.game && !S.game.ended);
  const homeScreen = () => (liveGame() ? 'game' : 'setup');

  // ---------- Persistence ----------
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY); } catch (e) {}
    let s = null;
    if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
    try { S = E.migrate(s); } catch (e) { S = E.defaults(); setTimeout(() => toast('Saved data could not be read. Starting fresh.'), 300); }
    if (!S.screen || S.screen === 'help') S.screen = homeScreen();
  }
  function save() { ui.lastSave = now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save. The phone may be out of storage.'); } }
  // Every handler goes through commit: mutate, persist, redraw.
  const commit = (fn) => { fn(); save(); render(); };

  // ---------- Sound, speech, wake lock ----------
  let audioCtx = null, speechArmed = false;
  function arm() {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
    if (!speechArmed && window.speechSynthesis) {
      try { const u = new SpeechSynthesisUtterance('ready'); u.volume = 0.01; u.rate = 2; speechSynthesis.speak(u); speechArmed = true; } catch (e) {}
    }
  }
  function beep(notes) {
    try {
      if (!audioCtx || audioCtx.state !== 'running') return; const t0 = audioCtx.currentTime;
      notes.forEach(([freq, at, dur]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.4, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g); g.connect(audioCtx.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
      });
    } catch (e) {}
  }
  const BUZZ = { swap: [[880, 0, 0.15], [880, 0.25, 0.15], [1175, 0.5, 0.45]], soft: [[660, 0, 0.2], [880, 0.3, 0.25]], end: [[523, 0, 0.3], [392, 0.35, 0.5]] };
  function buzz(kind) { try { if (navigator.vibrate) navigator.vibrate(kind === 'swap' ? [200, 100, 200, 100, 400] : [150, 80, 150]); } catch (e) {} beep(BUZZ[kind] || BUZZ.soft); }
  let voice = null;
  function pickVoice() {
    // Prefer a voice that runs on the phone so the kids' names never leave it.
    try { const vs = speechSynthesis.getVoices().filter((v) => v.localService !== false); voice = vs.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Siri/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null; } catch (e) {}
  }
  function speak(text, force) {
    if (!window.speechSynthesis || (!S.settings.announce && !force)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; if (voice) u.voice = voice; speechSynthesis.speak(u); } catch (e) {}
  }
  let wake = null, wakeBusy = false;
  async function keepAwake(on) {
    if (wakeBusy) return; wakeBusy = true;
    try {
      if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
      else if (!on && wake) { const w = wake; wake = null; await w.release(); }
    } catch (e) { wake = null; }
    wakeBusy = false;
  }

  // ---------- Announcements from engine events ----------
  const callText = (p) => (p ? E.planSpeech(S, p) : '');
  function announce(ev) {
    const due = ev.some((e) => e.type === 'subDue');
    ev.forEach((e) => {
      if (e.type === 'warn' && e.plan && !due) speak((e.secs >= 60 ? 'One minute' : e.secs + ' seconds') + '. Next swap: ' + callText(e.plan));
      else if (e.type === 'subDue') { buzz('swap'); speak('Swap now. ' + callText(e.plan)); E.markSpoken(S, now()); }
      else if (e.type === 'repeat') { speak('Still waiting. ' + callText(e.plan)); E.markSpoken(S, now()); }
      else if (e.type === 'checkBack') { buzz('soft'); speak('Check on ' + E.nameOf(S, e.id) + '. Ready to go back in?'); }
      else if (e.type === 'break') { buzz('end'); speak('End of the period. Water break.' + (S.game.pending ? ' Swap at the break: ' + callText(S.game.pending) : '')); }
      else if (e.type === 'gameOver') { buzz('end'); speak('Final whistle. Great game.'); }
    });
  }

  // ---------- Small UI helpers ----------
  function toast(msg) {
    let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(ui.toastTimer); ui.toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function btn(label, cls, onClick, opts) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || ''); b.textContent = label;
    if (onClick) b.onclick = onClick;
    if (opts) { if (opts.id) b.id = opts.id; if (opts.title) { b.title = opts.title; b.setAttribute('aria-label', opts.title); } if (opts.pressed != null) b.setAttribute('aria-pressed', String(opts.pressed)); }
    return b;
  }
  // Press-and-hold gesture: fires after `ms` of continuous press. Keyboard Enter/Space fires at once. A quick tap shows `hint`.
  function onHold(el, ms, fn, hint) {
    let t = null;
    const stop = () => { if (t) { clearTimeout(t); t = null; } el.classList.remove('holding'); };
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); el.classList.add('holding'); t = setTimeout(() => { t = null; el.classList.remove('holding'); fn(); }, ms); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => el.addEventListener(n, stop));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    if (hint) el.addEventListener('click', (e) => { if (e.detail !== 0 && !el.dataset.hinted) { el.dataset.hinted = '1'; setTimeout(() => { delete el.dataset.hinted; }, 3000); toast(hint); } });
    return el;
  }
  function holdBtn(label, cls, ms, fn, id) {
    const b = btn('', 'hold ' + (cls || ''), null, { id });
    b.innerHTML = '<span class="fill"></span><span class="lbl">' + esc(label) + '</span>';
    return onHold(b, ms, fn, 'Press and hold');
  }
  function seg(el, options, current, onPick) {
    el.innerHTML = '';
    options.forEach((o) => el.appendChild(btn(o.label, '', () => onPick(o.value), { pressed: o.value === current })));
  }
  function stepper(el, value, fmt, [min, max], stepBy, onChange) {
    el.innerHTML = '';
    const dn = btn('−', '', () => onChange(Math.max(min, value - stepBy)), { title: 'Less' }); dn.disabled = value <= min;
    const v = document.createElement('div'); v.className = 'val num'; v.textContent = fmt(value);
    const up = btn('+', '', () => onChange(Math.min(max, value + stepBy)), { title: 'More' }); up.disabled = value >= max;
    el.append(dn, v, up);
  }
  const RULE_TEXT = {
    apart: { kind: 'Not on the field together', hint: 'Pick two kids who should never be on the field at the same time.' },
    notOffTogether: { kind: 'Never come off at the same time', hint: 'Pick two kids who should never be swapped off in the same move.' },
    keep: { kind: 'Always keep some of a group on', hint: 'Pick the group, like your defenders. The plan never lets them all come off at once.' },
  };
  const ruleKind = (r) => (r.type === 'keep' ? 'Always keep at least ' + (r.min || 1) + ' on' : RULE_TEXT[r.type].kind);

  // ---------- Setup screen ----------
  function renderSetup() {
    const st = S.settings;
    const set = (k) => (v) => { st[k] = v; save(); renderSetup(); };
    const minutes = (v) => (v / 60) + ' min';
    const list = $('attendList'); list.innerHTML = '';
    S.players.forEach((p) => {
      const row = document.createElement('div'); row.className = 'attend';
      row.appendChild(btn(p.name, 'here', () => { p.here = !p.here; save(); renderSetup(); }, { pressed: !!p.here }));
      row.appendChild(btn('Remove', 'sm quiet', () => { if (!confirm('Remove ' + p.name + ' from the roster?')) return; const r = E.removePlayer(S, p.id); if (!r.ok) { toast(r.msg); return; } save(); renderSetup(); }, { title: 'Remove ' + p.name }));
      list.appendChild(row);
    });
    const here = S.players.filter((p) => p.here).length;
    const gameMin = st.periods * st.periodSec / 60;
    const share = here > 0 ? Math.min(1, st.fieldSize / here) : 0;
    $('calc').innerHTML = here < st.fieldSize
      ? '<b>' + here + '</b> here. You need ' + st.fieldSize + ' to start.'
      : '<b>' + here + '</b> here, <b>' + st.fieldSize + '</b> on the field. Each kid plays about <b>' + Math.round(share * gameMin) + '</b> of ' + gameMin + ' minutes.';
    seg($('segSize'), [4, 5, 6, 7].map((n) => ({ label: n + 'v' + n, value: n })), st.fieldSize, set('fieldSize'));
    seg($('segSubs'), [1, 2, 3].map((n) => ({ label: String(n), value: n })), st.subsPer, set('subsPer'));
    stepper($('stInterval'), st.intervalSec, minutes, E.LIMITS.intervalSec, 30, set('intervalSec'));
    seg($('segPeriods'), [{ label: 'Halves', value: 2 }, { label: 'Quarters', value: 4 }], st.periods, set('periods'));
    stepper($('stPeriod'), st.periodSec, minutes, E.LIMITS.periodSec, 60, set('periodSec'));
    stepper($('stCheck'), st.checkBackSec, minutes, E.LIMITS.checkBackSec, 30, set('checkBackSec'));
    const ta = $('tglAnnounce'); ta.textContent = st.announce ? 'On' : 'Off'; ta.setAttribute('aria-pressed', String(!!st.announce)); ta.onclick = () => set('announce')(!st.announce);
    seg($('segWarn'), SECS_OPTS, st.warnSec, set('warnSec'));
    seg($('segRepeat'), SECS_OPTS, st.repeatSec, set('repeatSec'));
    $('testVoice').onclick = () => { arm(); pickVoice(); speak('Swap now. Ava in for Ben. Cal in for Dee.', true); };

    const rl = $('ruleList'); rl.innerHTML = '';
    S.rules.forEach((r) => {
      const row = document.createElement('div'); row.className = 'rule';
      const txt = document.createElement('div'); txt.innerHTML = '<div class="kind">' + esc(ruleKind(r)) + '</div><div class="who">' + esc(r.ids.map((id) => E.nameOf(S, id)).join(r.type === 'keep' ? ', ' : ' + ')) + '</div>';
      row.append(txt, btn('Remove', 'sm quiet', () => { S.rules = S.rules.filter((x) => x.id !== r.id); save(); renderSetup(); }));
      rl.appendChild(row);
    });
    $('ruleForm').hidden = !ruleDraft.open; $('ruleAdd').hidden = ruleDraft.open;
    if (ruleDraft.open) {
      seg($('ruleKind'), Object.keys(RULE_TEXT).map((k) => ({ label: RULE_TEXT[k].kind, value: k })), ruleDraft.type, (v) => { ruleDraft.type = v; ruleDraft.ids = []; renderSetup(); });
      $('ruleHint').textContent = RULE_TEXT[ruleDraft.type].hint;
      $('ruleMinWrap').hidden = ruleDraft.type !== 'keep';
      if (ruleDraft.type === 'keep') seg($('ruleMin'), [{ label: 'At least 1 on', value: 1 }, { label: 'At least 2 on', value: 2 }], ruleDraft.min, (v) => { ruleDraft.min = v; renderSetup(); });
      const pick = $('rulePick'); pick.innerHTML = '';
      S.players.forEach((p) => pick.appendChild(btn(p.name, '', () => { const max = ruleDraft.type === 'keep' ? 99 : 2; if (ruleDraft.ids.includes(p.id)) ruleDraft.ids = ruleDraft.ids.filter((x) => x !== p.id); else if (ruleDraft.ids.length < max) ruleDraft.ids.push(p.id); renderSetup(); }, { pressed: ruleDraft.ids.includes(p.id) })));
      $('ruleSave').disabled = ruleDraft.type === 'keep' ? ruleDraft.ids.length < ruleDraft.min : ruleDraft.ids.length !== 2;
    }
    const resume = liveGame();
    $('footInner').appendChild(btn(resume ? 'Back to the game' : 'Start the game', 'primary big', () => {
      if (resume) { commit(() => { S.screen = 'game'; }); return; }
      arm(); pickVoice();
      const r = E.startGame(S, now()); if (!r.ok) { alert(r.msg); return; }
      save(); render(); speak('Game on. First swap in ' + Math.round(S.settings.intervalSec / 60) + ' minutes.');
    }, { id: 'startBtn' }));
  }

  // ---------- Game screen ----------
  // Everything the game screen is built from. Computed once per redraw and once per tick (to decide whether to redraw).
  function buildView() {
    const g = S.game; const move = g.pending || E.rotationPlan(S);
    const fm = E.freshMatters(S);
    const key = [S.screen, g.pending ? g.pending.type : '', move ? move.offs.join(',') + '>' + move.ons.join(',') + '|' + (move.note || '') : '', g.field.filter((id) => fm && E.isFresh(S, id)).join(','),
      g.away.filter((a) => a.prompted || a.status === 'done').map((a) => a.id + a.status).join(','), g.breakPending, g.running, g.field.join(','), g.bench.join(','), g.locked.join(','), ui.sel && ui.sel.id, ui.sheet, ui.pocket].join('#');
    return { move, fm, key };
  }
  const pairLine = (pr) => pr.on && pr.off
    ? '<div class="pair"><span class="on">' + esc(E.nameOf(S, pr.on)) + '</span><span class="for">in for</span><span class="off">' + esc(E.nameOf(S, pr.off)) + '</span></div>'
    : pr.on ? '<div class="pair"><span class="on">' + esc(E.nameOf(S, pr.on)) + '</span><span class="for">goes in</span></div>'
    : '<div class="pair"><span class="off">' + esc(E.nameOf(S, pr.off)) + '</span><span class="for">comes off</span></div>';
  const pairsHtml = (p) => '<div class="pairs">' + p.pairs.map(pairLine).join('') + '</div>' + (p.note ? '<p class="note">' + esc(p.note) + '</p>' : '');
  const confirmSwap = () => commit(() => E.execute(S, now()));
  const swapNow = () => commit(() => { if (!E.subNow(S, now())) toast('No legal swap right now'); });
  const togglePlay = () => commit(() => E.togglePlay(S, now()));
  const doneBtn = (id) => holdBtn('Done, they swapped', 'primary big', 600, confirmSwap, id);
  function returnNow(id) {
    const r = E.returnNow(S, id, now()); save(); render();
    if (r.ok) speak(callText(S.game.pending)); else toast(r.msg);
  }
  function renderPlan(view) {
    const g = S.game; const card = $('planCard'); card.innerHTML = '';
    const p = g.pending; const row = document.createElement('div'); row.className = 'row';
    if (p) {
      card.className = 'card plan live';
      card.innerHTML = '<div class="eyebrow"><span>' + (p.type === 'rotation' ? 'Swap now' : p.type === 'fill' ? 'Send in' : 'Back in') + '</span><span class="num" id="subTimer"></span></div>' + pairsHtml(p);
      row.append(doneBtn('goBtn'), btn('Say it', 'quiet', () => { arm(); speak(callText(p), true); }),
        btn(p.type === 'rotation' ? 'Skip this one' : 'Never mind', 'quiet', () => commit(() => E.dismissPending(S, now()))));
    } else {
      card.className = 'card plan';
      card.innerHTML = '<div class="eyebrow"><span>Next swap</span><span class="num" id="subTimer"></span></div>' + (view.move ? pairsHtml(view.move) : '<p class="note">Nobody on the bench to swap in.</p>');
      const b = btn('Swap now', '', swapNow); b.disabled = !view.move; row.appendChild(b);
    }
    card.appendChild(row);
  }
  function banner(cls, html) { const b = document.createElement('div'); b.className = 'banner ' + cls; b.innerHTML = html; return b; }
  function renderBanners() {
    const g = S.game; const box = $('banners'); box.innerHTML = '';
    if (g.breakPending) {
      const half = S.settings.periods === 2;
      const b = banner('info', '<div class="title">End of ' + (half ? 'the half' : 'quarter ' + g.period) + '. Water break.</div><p>Do the swap below during the break, then start the next period.</p>');
      b.appendChild(btn('Start ' + (half ? 'second half' : 'quarter ' + (g.period + 1)), 'primary big', () => { commit(() => E.nextPeriod(S, now())); speak((half ? 'Second half' : 'Quarter ' + g.period) + '. Go.'); }));
      box.appendChild(b);
    }
    g.away.filter((a) => a.status === 'left' && a.prompted).forEach((a) => {
      const b = banner('check', '<div class="title">Check on ' + esc(E.nameOf(S, a.id)) + '</div><p>Off for <span data-off="' + a.id + '"></span>. Ready to go back in?</p>');
      const row = document.createElement('div'); row.className = 'row';
      row.append(btn('Yes, in now', 'primary', () => returnNow(a.id)),
        btn('Ask again in ' + (S.settings.checkBackSec / 60) + ' min', '', () => commit(() => E.checkLater(S, a.id, now()))),
        btn('Done for today', 'quiet', () => commit(() => E.doneToday(S, a.id))));
      b.appendChild(row); box.appendChild(b);
    });
    const v = E.violations(S, g.field, []);
    if (v.length) box.appendChild(banner('warn', '<div class="title">Heads up</div><p>' + esc(v.join('. ')) + '. ' + SWAP_HINT + '</p>'));
    if (ui.sel) box.appendChild(banner('info', '<p>' + esc(E.nameOf(S, ui.sel.id)) + ' selected. Tap who to swap with, or tap ' + esc(E.nameOf(S, ui.sel.id)) + ' again to cancel.</p>'));
  }
  function playerRow(id, list, view) {
    const g = S.game; const ref = view.move;
    const isOff = ref && ref.offs.includes(id), isOn = ref && ref.ons.includes(id), gk = g.locked.includes(id);
    const row = document.createElement('div');
    row.className = 'prow selectable' + (ui.sel && ui.sel.id === id ? ' selected' : '') + (isOff ? ' next-off' : '') + (isOn ? ' next-on' : '') + (gk ? ' gk' : '');
    let chip = '';
    if (gk) chip = '<span class="chip gk">Goalie, stays</span>';
    else if (isOff) chip = '<span class="chip off">Next off</span>';
    else if (isOn) chip = '<span class="chip on">Next in</span>';
    else if (list === 'field' && E.pinnedByRule(S, id)) chip = '<span class="chip gk">Rule, stays</span>';
    else if (list === 'field' && view.fm && E.isFresh(S, id)) chip = '<span class="chip soft">Just came on</span>';
    const info = document.createElement('div');
    info.innerHTML = '<div class="pname">' + esc(E.nameOf(S, id)) + chip + '</div><div class="pmeta num"></div>';
    ui.els.set(id, info.lastChild);
    const acts = document.createElement('div'); acts.className = 'pacts';
    const act = (label, title, fn, pressed) => { const b = btn(label, '', (e) => { e.stopPropagation(); fn(); }, { title, pressed }); b.className = 'icon' + (pressed ? ' active' : ''); return b; };
    if (list === 'field') {
      acts.append(act('GK', 'Goalie: keep on the field', () => commit(() => E.toggleLock(S, id, now())), gk),
        act('Left', 'Came off on their own', () => { commit(() => E.outEarly(S, id, false, now())); const p = S.game.pending; speak(E.nameOf(S, id) + ' came off. ' + (p ? callText(p) : 'Nobody on the bench.')); }));
    } else {
      acts.append(act('In now', 'Put in right away', () => returnNow(id)), act('Away', 'Wandered off from the bench', () => commit(() => E.outEarly(S, id, true, now()))));
    }
    row.append(info, acts);
    row.onclick = () => {
      if (!ui.sel) { ui.sel = { id, list }; render(); return; }
      if (ui.sel.id === id) { ui.sel = null; render(); return; }
      if (ui.sel.list === list) { ui.sel = { id, list }; render(); return; }
      const a = ui.sel; ui.sel = null; commit(() => E.manualSwap(S, a, { id, list }, now()));
    };
    return row;
  }
  function renderGame(view) {
    const g = S.game; ui.els.clear();
    $('playBtn').textContent = g.running ? 'Pause' : 'Play'; $('playBtn').disabled = !!g.breakPending;
    renderBanners(); renderPlan(view);
    const fl = $('fieldList'); fl.innerHTML = ''; g.field.forEach((id) => fl.appendChild(playerRow(id, 'field', view)));
    const bl = $('benchList'); bl.innerHTML = '';
    g.bench.slice().sort((a, b) => (E.played(S, a) - E.played(S, b)) || (E.rest(S, b) - E.rest(S, a))).forEach((id) => bl.appendChild(playerRow(id, 'bench', view)));
    $('fieldCount').textContent = '(' + g.field.length + ' of ' + S.settings.fieldSize + ')';
    $('benchCount').textContent = '(' + g.bench.length + ')';
    const aw = $('awayList'); aw.innerHTML = ''; $('awayWrap').hidden = g.away.length === 0;
    g.away.forEach((a) => {
      const row = document.createElement('div'); row.className = 'prow';
      const info = document.createElement('div');
      const status = a.status === 'done' ? '<span class="chip away">Done today</span>' : '<span class="chip away">Check <span data-check="' + a.id + '"></span></span>';
      info.innerHTML = '<div class="pname">' + esc(E.nameOf(S, a.id)) + status + '</div><div class="pmeta num">' + mins(E.played(S, a.id)) + ' played · off for <span data-off="' + a.id + '"></span></div>';
      const acts = document.createElement('div'); acts.className = 'pacts';
      acts.append(btn('In now', 'sm primary', () => returnNow(a.id)), btn('Bench', 'sm', () => commit(() => E.toBench(S, a.id))));
      row.append(info, acts); aw.appendChild(row);
    });
    const foot = $('footInner');
    if (g.pending) foot.appendChild(doneBtn());
    else { foot.appendChild(btn('Swap now', 'big', swapNow)); const pp = btn(g.running ? 'Pause' : 'Play', 'primary big', togglePlay); pp.disabled = !!g.breakPending; foot.appendChild(pp); }
    foot.appendChild(onHold(btn('⋯', 'menu quiet', null, { id: 'menuBtn', title: 'Menu (press and hold)' }), 500, openSheet, 'Hold to open the menu'));
  }
  // Text that changes every second, written into elements the last redraw created.
  function renderTimers() {
    const g = S.game; if (!g || S.screen !== 'game') return;
    const t = now();
    $('clock').textContent = mmss(S.settings.periodSec - g.t);
    $('periodLbl').textContent = (S.settings.periods === 2 ? 'H' : 'Q') + g.period + ' of ' + S.settings.periods + (g.running ? '' : ' · paused');
    const st = $('subTimer'); if (st) st.textContent = g.pending ? (g.pending.type === 'rotation' ? 'timer resets on Done' : '') : 'in ' + mmss(g.subT);
    g.field.forEach((id) => { const el = ui.els.get(id); if (el) el.textContent = mins(E.played(S, id)) + ' played · on for ' + mmss(E.stint(S, id)); });
    g.bench.forEach((id) => { const el = ui.els.get(id); if (el) el.textContent = mins(E.played(S, id)) + ' played · resting ' + mmss(E.rest(S, id)); });
    g.away.forEach((a) => {
      const id = CSS.escape(a.id);
      document.querySelectorAll('[data-off="' + id + '"]').forEach((el) => { el.textContent = mmss((t - a.since) / 1000); });
      const c = document.querySelector('[data-check="' + id + '"]'); if (c) c.textContent = a.prompted ? 'now' : 'in ' + mmss((a.checkAt - t) / 1000);
    });
    if (ui.pocket) renderPocket();
  }

  // ---------- Menu sheet and pocket screen ----------
  function openSheet() {
    ui.sheet = true; const ov = $('overlay'); ov.innerHTML = '';
    const sh = document.createElement('div'); sh.className = 'sheet'; const panel = document.createElement('div'); panel.className = 'panel';
    const u = btn('Undo last move', 'quiet', () => { if (E.undo(S)) { save(); toast('Undone'); } closeSheet(); }); u.disabled = !(S.game && S.game.history.length);
    panel.append(u,
      btn('Pocket screen', 'quiet', () => { closeSheet(); openPocket(); }),
      btn('Roster & rules', 'quiet', () => { ui.sheet = false; commit(() => { S.screen = 'setup'; }); }),
      btn('Help & setup', 'quiet', () => { ui.sheet = false; commit(() => { S.screen = 'help'; }); }),
      btn('End game', 'danger', () => { if (!confirm('End the game and show minutes?')) return; ui.sheet = false; commit(() => E.endGame(S)); }),
      btn('Close', 'primary', closeSheet));
    sh.appendChild(panel); sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(); }); ov.appendChild(sh);
  }
  function closeSheet() { ui.sheet = false; render(); }
  function openPocket() {
    ui.pocket = true; ui.pocketKey = ''; const ov = $('overlay'); ov.innerHTML = '';
    const pk = document.createElement('div'); pk.className = 'pocket'; pk.id = 'pocket';
    pk.innerHTML = '<div class="pclock num" id="pclock"></div><div class="pcall" id="pcall"></div><div class="phint" id="phint"></div><div class="pbar"><i></i></div><div class="phint">Hold anywhere for one second to unlock</div>';
    onHold(pk, 1000, closePocket);
    pk.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    ov.appendChild(pk); renderPocket();
  }
  function closePocket() { ui.pocket = false; render(); }
  function renderPocket() {
    const g = S.game; if (!g || !ui.pocket || !$('pclock')) return;
    $('pclock').textContent = mmss(S.settings.periodSec - g.t);
    const p = g.pending || (ui.view && ui.view.move);
    const key = p ? p.offs.join(',') + '>' + p.ons.join(',') : '';
    if (key !== ui.pocketKey) { ui.pocketKey = key; $('pcall').innerHTML = p ? '<div class="pairs">' + p.pairs.map(pairLine).join('') + '</div>' : '<span>No swap available</span>'; }
    $('phint').textContent = g.pending ? (g.pending.type === 'rotation' ? 'SWAP NOW. Unlock to confirm.' : g.pending.note) : g.breakPending ? 'Water break' : 'Next swap in ' + mmss(g.subT) + (g.running ? '' : ' · paused');
  }

  // ---------- Summary and help ----------
  function renderSummary() {
    const g = S.game; const ids = Object.keys(g.played).sort((a, b) => E.played(S, b) - E.played(S, a));
    const max = Math.max(1, g.total);
    const min = ids.length ? Math.min.apply(null, ids.map((id) => E.played(S, id))) : 0;
    $('sumLine').textContent = ids.length + ' kids played. Everyone got at least ' + mins(min) + '. Game clock ran ' + mins(g.total) + '.';
    $('sumTable').innerHTML = '<tr><th>Kid</th><th>Played</th><th style="width:40%"></th></tr>' + ids.map((id) => '<tr><td class="name">' + esc(E.nameOf(S, id)) + '</td><td class="num">' + mins(E.played(S, id)) + '</td><td><div class="bar-track"><div class="bar-fill" style="width:' + Math.round(100 * E.played(S, id) / max) + '%"></div></div></td></tr>').join('');
  }
  function renderHelp() { $('verLine').textContent = 'Go In For ' + APP_VERSION; }

  function render(view) {
    ['setup', 'game', 'summary', 'help'].forEach((id) => { $(id).hidden = S.screen !== id; });
    $('footInner').innerHTML = '';
    if (!ui.sheet && !ui.pocket) $('overlay').innerHTML = '';
    if (S.screen === 'game') { ui.view = view || buildView(); ui.viewKey = ui.view.key; renderGame(ui.view); renderTimers(); }
    else if (S.screen === 'setup') renderSetup(); else if (S.screen === 'summary') renderSummary(); else renderHelp();
    keepAwake(S.screen === 'game' && liveGame() && S.game.running);
    if (ui.screen !== S.screen) { ui.screen = S.screen; window.scrollTo(0, 0); }
  }

  // ---------- Clock ----------
  function tick() {
    if (!S.game || S.screen !== 'game') return;
    const g = S.game;
    const ev = E.tick(S, now());
    announce(ev);
    if (ev.length || (g.running && now() - ui.lastSave >= SAVE_EVERY_MS)) save();
    if (S.screen !== 'game') { render(); return; }
    if (ui.sheet) { renderTimers(); return; }
    const view = buildView();
    if (view.key !== ui.viewKey) render(view); else renderTimers();
  }

  // ---------- Roster link ----------
  const rosterLink = () => location.origin + location.pathname + '#roster=' + E.encodeRoster(S);
  // Load a roster from a pasted link or bare code (same payload as the hash link).
  function loadRosterCode(text) {
    const m = /roster=([A-Za-z0-9_-]+)/.exec(text || '') || /^\s*([A-Za-z0-9_-]{20,})\s*$/.exec(text || '');
    if (!m) { toast('That is not a roster link'); return; }
    applyRoster(E.decodeRoster(m[1]));
  }
  function applyRoster(data) {
    try {
      const n = data && Array.isArray(data.players) ? data.players.length : 0, r = data && Array.isArray(data.rules) ? data.rules.length : 0;
      if (!data || !n || n > E.MAX_PLAYERS || r > E.MAX_RULES) { toast('That roster link is not valid'); return; }
      if (liveGame() && !confirm('A game is in progress. Replace the roster anyway?')) return;
      if (!confirm('Load a roster with ' + n + ' kids and ' + r + ' rules? This replaces the current roster.')) return;
      let ok = false; commit(() => { ok = E.importRoster(S, data); }); toast(ok ? 'Roster loaded' : 'That roster link is not valid');
    } catch (e) { toast('That roster link is not valid'); }
  }
  function handleHash() {
    try {
      const m = /[#&]roster=([^&]+)/.exec(location.hash || ''); if (!m) return;
      const data = E.decodeRoster(m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      applyRoster(data);
    } catch (e) { toast('That roster link is not valid'); }
  }
  // ---------- Wiring ----------
  function boot() {
    load();
    $('addBtn').onclick = () => { const v = $('newName').value.trim(); if (!v) return; if (E.findByName(S, v)) { toast(v + ' is already on the roster'); return; } E.addPlayer(S, v); $('newName').value = ''; save(); renderSetup(); $('newName').focus(); };
    $('newName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addBtn').click(); });
    $('lateBtn').onclick = () => { const v = $('lateName').value.trim(); if (!v) return; $('lateName').value = ''; commit(() => E.addLate(S, v)); };
    $('lateName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lateBtn').click(); });
    $('ruleAdd').onclick = () => { ruleDraft.open = true; ruleDraft.ids = []; ruleDraft.min = 1; renderSetup(); };
    $('ruleCancel').onclick = () => { ruleDraft.open = false; renderSetup(); };
    $('ruleSave').onclick = () => { if (E.addRule(S, ruleDraft.type, ruleDraft.ids, ruleDraft.min)) { ruleDraft.open = false; save(); renderSetup(); } };
    $('copyLink').onclick = async () => { const l = rosterLink(); try { await navigator.clipboard.writeText(l); toast('Link copied'); } catch (e) { $('linkBox').value = l; $('linkBox').hidden = false; toast('Copy it from the box below'); } };
    $('showLink').onclick = () => { $('linkBox').value = rosterLink(); $('linkBox').hidden = false; };
    $('pasteBtn').onclick = () => { const v = $('pasteLink').value; if (!v.trim()) return; loadRosterCode(v); $('pasteLink').value = ''; };
    $('pasteLink').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('pasteBtn').click(); });
    $('helpBtn').onclick = () => commit(() => { S.screen = 'help'; });
    $('helpBack').onclick = () => commit(() => { S.screen = homeScreen(); });
    $('playBtn').onclick = togglePlay;
    $('newGameBtn').onclick = () => commit(() => E.newGame(S));
    document.addEventListener('pointerdown', arm, { passive: true });
    document.addEventListener('keydown', arm);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); render(); } else save(); });
    window.addEventListener('pagehide', save);
    if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    render();
    setInterval(tick, 1000);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('hashchange', handleHash);
    handleHash();
  }
  // Small hook for tests.
  window.__goinfor = { get state() { return S; }, tick, Engine: E };
  boot();
})();
