/* Go In For — sideline UI. All game logic lives in engine.js (window.Engine). */
(function () {
  'use strict';
  const E = window.Engine;
  const KEY = 'goinfor_v2';
  const OLD_KEY = 'goinfor_v1';
  const APP_VERSION = '1.6.0';
  const SAVE_EVERY_MS = 5000;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => Date.now();
  const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; };
  const mins = (sec) => Math.round(sec / 60) + 'm';
  const SECS_OPTS = [{ label: 'Off', value: 0 }, { label: '30 s', value: 30 }, { label: '1 min', value: 60 }];
  const SWAP_HINT = 'Drag a kid by the handle to the field or the bench, or tap a kid on the field, then a kid on the bench, to swap.';
  const ago = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
  // One icon family (Lucide-style outlines, 2px stroke). Always decorative beside a visible label.
  const ICON_PATHS = {
    menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
    pocket: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    roster: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    play: '<path d="M6 3l14 9-14 9z"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    speak: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    skip: '<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    in: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    away: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/>',
    bench: '<path d="M3 10h18"/><path d="M5 10v9"/><path d="M19 10v9"/><path d="M3 15h18"/>',
    grip: '<circle cx="9" cy="5" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="19" r="1.3"/><circle cx="15" cy="5" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="19" r="1.3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  };
  const icon = (name) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON_PATHS[name] + '</svg>';

  let S = null;
  // Per-render view model: the move being shown (pending or preview) and what every row needs.
  const ui = { sel: null, open: null, sheet: false, pocket: false, viewKey: '', view: null, screen: '', els: new Map(), toastTimer: null, lastSave: 0 };
  const ruleDraft = { open: false, type: 'apart', ids: [], min: 1 };
  let editRoster = false; // setup screen: show Remove buttons only while editing the team
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
  const commit = (fn) => { ui.open = null; fn(); save(); render(); };

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
  // Voices that run on the phone (the kids' names never leave it), best first: downloaded Premium and Enhanced voices beat the compact defaults.
  const voiceRank = (v) => (/premium/i.test(v.name) ? 0 : /enhanced/i.test(v.name) ? 1 : /Samantha|Siri/i.test(v.name) ? 2 : /en[-_]US/i.test(v.lang) ? 3 : 4);
  function localVoices() {
    try { return speechSynthesis.getVoices().filter((v) => v.localService !== false && /^en/i.test(v.lang)).sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name)); } catch (e) { return []; }
  }
  function pickVoice() {
    const vs = localVoices();
    voice = (S.settings.voice && vs.find((v) => v.name === S.settings.voice)) || vs[0] || null;
    if (S.screen === 'setup') renderVoices();
  }
  function renderVoices() {
    const sel = $('voiceSel'); if (!sel) return; const vs = localVoices();
    sel.innerHTML = '<option value="">Automatic' + (vs[0] ? ' (' + esc(vs[0].name) + ')' : '') + '</option>' + vs.map((v) => '<option value="' + esc(v.name) + '">' + esc(v.name) + '</option>').join('');
    sel.value = vs.some((v) => v.name === S.settings.voice) ? S.settings.voice : '';
    $('voiceNote').textContent = vs.some((v) => /premium|enhanced/i.test(v.name)) ? 'Premium and Enhanced voices sound the most natural.' : 'For a natural voice, download one on the phone: Settings, Accessibility, Spoken Content, Voices, English, then pick an Enhanced or Premium voice. It shows up here.';
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
  // A short message; with `action` ({ label, fn }) it also carries one button and stays up longer.
  function toast(msg, action) {
    let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(ui.toastTimer);
    if (action) { const b = btn(action.label, 'sm', () => { t.hidden = true; action.fn(); }, { id: 'toastAct', icon: 'undo' }); t.appendChild(b); }
    ui.toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2200);
  }
  function btn(label, cls, onClick, opts) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || '');
    if (opts && opts.icon) { b.innerHTML = icon(opts.icon) + '<span>' + esc(label) + '</span>'; } else b.textContent = label;
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
    apart: { kind: 'Never on the field together', hint: 'Pick two kids who should never be on the field at the same time.' },
    notOffTogether: { kind: 'Never come off together', hint: 'Pick two kids who should never be swapped off in the same move.' },
    keep: { kind: 'Always keep some of a group on', hint: 'Pick the group, like your defenders. The plan never lets them all come off at once.' },
    limit: { kind: 'Never too many of a group on', hint: 'Pick the group and how many can be on at once. Good for kids who need a stronger teammate beside them.' },
  };
  const ruleKind = (r) => (r.type === 'keep' ? 'At least ' + (r.min || 1) + ' on' : r.type === 'limit' ? 'At most ' + (r.max || 1) + ' on' : r.type === 'apart' ? 'Never on together' : 'Never off together');

  // ---------- Fairness check (plays today's game in memory) ----------
  const fairCache = new Map();
  function fair(rules) {
    const key = JSON.stringify([S.players.filter((p) => p.here).map((p) => p.id), rules, S.settings]);
    if (!fairCache.has(key)) { if (fairCache.size > 40) fairCache.clear(); fairCache.set(key, E.fairness(S, rules)); }
    return fairCache.get(key);
  }
  const range = (f) => mins(f.lo) + ' to ' + mins(f.hi);
  const lowestNames = (f) => f.lowest.slice(0, 3).map((id) => E.nameOf(S, id)).join(', ') + (f.lowest.length > 3 ? ' and others' : '');
  // Whole-set verdict for the Rules card; class warn when someone ends a stint or more behind.
  function fairText(f) {
    if (!f) return { text: 'Not enough kids here to play a game.', warn: false };
    const warn = f.spread >= S.settings.intervalSec;
    return { warn, text: warn ? 'With today\'s kids these rules leave ' + lowestNames(f) + ' at ' + mins(f.lo) + ' while others get ' + mins(f.hi) + '.' : 'With today\'s kids everyone gets ' + range(f) + '.' };
  }

  // ---------- Setup screen ----------
  function renderSetup() {
    const st = S.settings;
    const set = (k) => (v) => { st[k] = v; save(); renderSetup(); };
    const minutes = (v) => (v / 60) + ' min';
    const list = $('attendList'); list.innerHTML = '';
    S.players.forEach((p) => {
      const inRules = S.rules.filter((r) => r.ids.includes(p.id)).length;
      if (!editRoster) list.appendChild(btn(p.name, 'here', () => { p.here = !p.here; save(); renderSetup(); }, { pressed: !!p.here, title: p.name + (p.here ? ': here. Tap if not here today.' : ': not here today. Tap when they arrive.') }));
      else list.appendChild(btn(p.name, 'here rm', () => {
        if (!confirm('Remove ' + p.name + ' from the team for good?' + (inRules ? ' ' + inRules + ' rule' + (inRules > 1 ? 's' : '') + ' about ' + p.name + ' will go too.' : '') + ' Not here today? Cancel and use Done editing, then tap the name instead.')) return;
        const r = E.removePlayer(S, p.id); if (!r.ok) { toast(r.msg); return; } save(); renderSetup(); toast(p.name + ' removed');
      }, { title: 'Remove ' + p.name + ' from the team', icon: 'trash' }));
    });
    const ed = $('editRoster'); ed.innerHTML = icon(editRoster ? 'check' : 'roster') + '<span>' + (editRoster ? 'Done editing' : 'Edit team') + '</span>'; ed.setAttribute('aria-pressed', String(editRoster));
    $('newKid').hidden = !editRoster;
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
    renderVoices();
    $('voiceSel').onchange = () => { S.settings.voice = $('voiceSel').value; save(); arm(); pickVoice(); speak('Swap now. Ava in for Ben.', true); };

    const rl = $('ruleList'); rl.innerHTML = '';
    const fAll = fair(S.rules); const verdict = fairText(fAll);
    $('rulesFair').textContent = verdict.text; $('rulesFair').className = 'calc' + (verdict.warn ? ' warn' : '');
    S.rules.forEach((r) => {
      const row = document.createElement('div'); row.className = 'rule';
      const fW = fAll ? fair(S.rules.filter((x) => x.id !== r.id)) : null;
      const cost = fAll && fW ? fAll.spread - fW.spread : 0;
      const costLine = cost >= 60 ? '<div class="cost">Costs ' + mins(cost) + ' of even time today</div>' : '';
      const txt = document.createElement('div'); txt.innerHTML = '<div class="kind">' + esc(ruleKind(r)) + '</div><div class="who">' + esc(r.ids.map((id) => E.nameOf(S, id)).join(r.type === 'keep' || r.type === 'limit' ? ', ' : ' + ')) + '</div>' + costLine;
      row.append(txt, btn('', 'sm quiet iconOnly', () => { S.rules = S.rules.filter((x) => x.id !== r.id); save(); renderSetup(); toast('Rule removed'); }, { title: 'Remove rule: ' + ruleKind(r), icon: 'trash' }));
      rl.appendChild(row);
    });
    $('ruleForm').hidden = !ruleDraft.open; $('ruleAdd').hidden = ruleDraft.open;
    if (ruleDraft.open) {
      seg($('ruleKind'), Object.keys(RULE_TEXT).map((k) => ({ label: RULE_TEXT[k].kind, value: k })), ruleDraft.type, (v) => { ruleDraft.type = v; ruleDraft.ids = []; renderSetup(); });
      $('ruleHint').textContent = RULE_TEXT[ruleDraft.type].hint;
      const grouped = ruleDraft.type === 'keep' || ruleDraft.type === 'limit';
      $('ruleMinWrap').hidden = !grouped;
      if (ruleDraft.type === 'keep') seg($('ruleMin'), [{ label: 'At least 1 on', value: 1 }, { label: 'At least 2 on', value: 2 }], ruleDraft.min, (v) => { ruleDraft.min = v; renderSetup(); });
      if (ruleDraft.type === 'limit') seg($('ruleMin'), [1, 2, 3].map((n) => ({ label: 'Max ' + n + ' on', value: n })), ruleDraft.min, (v) => { ruleDraft.min = v; renderSetup(); });
      const pick = $('rulePick'); pick.innerHTML = '';
      S.players.forEach((p) => pick.appendChild(btn(p.name, '', () => { const max = grouped ? 99 : 2; if (ruleDraft.ids.includes(p.id)) ruleDraft.ids = ruleDraft.ids.filter((x) => x !== p.id); else if (ruleDraft.ids.length < max) ruleDraft.ids.push(p.id); renderSetup(); }, { pressed: ruleDraft.ids.includes(p.id) })));
      $('ruleSave').disabled = ruleDraft.type === 'keep' ? ruleDraft.ids.length < ruleDraft.min : ruleDraft.type === 'limit' ? ruleDraft.ids.length <= ruleDraft.min : ruleDraft.ids.length !== 2;
      const rf = $('ruleFair'); rf.className = 'calc';
      if ($('ruleSave').disabled) rf.textContent = '';
      else {
        const draft = { id: 'draft', type: ruleDraft.type, ids: ruleDraft.ids.slice() }; if (ruleDraft.type === 'keep') draft.min = ruleDraft.min; if (ruleDraft.type === 'limit') draft.max = ruleDraft.min;
        const before = fair(S.rules), after = fair(S.rules.concat(draft));
        if (!after) rf.textContent = 'Not enough kids here to check this rule.';
        else if (!before || after.spread - before.spread < 60) rf.textContent = 'Even time check: with today\'s kids everyone still gets ' + range(after) + '.';
        else { rf.className = 'calc warn'; rf.textContent = 'Even time check: this rule costs ' + mins(after.spread - before.spread) + '. ' + lowestNames(after) + ' would get ' + mins(after.lo) + ' while others get ' + mins(after.hi) + ' (without it, ' + range(before) + ').'; }
      }
    }
    const per = st.periods === 2 ? 'two ' + (st.periodSec / 60) + '-min halves' : 'four ' + (st.periodSec / 60) + '-min quarters';
    $('sectGameSum').textContent = st.fieldSize + 'v' + st.fieldSize + ' · ' + st.subsPer + ' per swap · every ' + (st.intervalSec / 60) + ' min · ' + per;
    $('sectVoiceSum').textContent = st.announce ? 'On · ' + (voice ? voice.name.replace(/\s*\(.*$/, '') : 'automatic') + (st.warnSec ? ' · heads-up ' + (st.warnSec >= 60 ? '1 min' : st.warnSec + ' s') : '') : 'Off';
    $('sectRulesSum').textContent = (S.rules.length ? S.rules.length + ' rule' + (S.rules.length > 1 ? 's' : '') : 'No rules') + (fAll ? ' · ' + range(fAll) + (verdict.warn ? ' !' : '') : '');
    $('sectLinkSum').textContent = 'Copy or load';
    if (ruleDraft.open) $('sectRules').open = true;
    renderCarry();
    const resume = liveGame(); const cp = E.carryPreview(S, now());
    const foot = $('footInner'); foot.innerHTML = ''; foot.className = 'fbar';
    foot.appendChild(btn(resume ? 'Back to the game' : cp ? 'Start game ' + (cp.games + 1) : 'Start the game', 'primary big', () => {
      if (resume) { commit(() => { S.screen = 'game'; }); return; }
      arm(); pickVoice();
      const r = E.startGame(S, now()); if (!r.ok) { alert(r.msg); return; }
      save(); render(); speak('Game on. First swap in ' + Math.round(S.settings.intervalSec / 60) + ' minutes.');
    }, { id: 'startBtn', icon: 'play' }));
  }

  // The lineup carried over from the last game today, with a switch to start fresh instead.
  function renderCarry() {
    const card = $('carryCard'); const cp = S.carry ? E.carryPreview(S, now()) : null;
    card.hidden = !S.carry || (S.carryOn !== false && !cp);
    if (card.hidden) return;
    const names = (ids) => ids.map((id) => esc(E.nameOf(S, id))).join(', ');
    const on = S.carryOn !== false;
    $('carryText').innerHTML = on && cp
      ? '<p>Game ' + cp.games + ' ended ' + ago(cp.ago) + '. The kids who were waiting start next, longest wait first. Today\'s minutes carry over.</p>'
        + '<p><b>Start with:</b> ' + (names(cp.waiting) || 'nobody yet') + '</p><p><b>Were on at the end:</b> ' + (names(cp.onAtEnd) || 'nobody') + '</p>'
      : '<p>The last game\'s lineup and minutes are set aside. This game starts from the roster.</p>';
    seg($('carrySeg'), [{ label: 'Carry on', value: true }, { label: 'Fresh start', value: false }], on, (v) => { S.carryOn = v; save(); renderSetup(); });
  }

  // ---------- Game screen ----------
  // Everything the game screen is built from. Computed once per redraw and once per tick (to decide whether to redraw).
  function buildView() {
    const g = S.game; const move = g.pending || E.rotationPlan(S);
    const fm = E.freshMatters(S);
    const key = [S.screen, g.pending ? g.pending.type : '', move ? move.offs.join(',') + '>' + move.ons.join(',') + '|' + (move.note || '') : '', g.field.filter((id) => fm && E.isFresh(S, id)).join(','),
      g.away.filter((a) => a.prompted || a.status === 'done').map((a) => a.id + a.status).join(','), g.breakPending, g.running, g.field.join(','), g.bench.join(','), g.locked.join(','), ui.sel && ui.sel.id, ui.open, ui.sheet, ui.pocket].join('#');
    return { move, fm, key };
  }
  const pairLine = (pr) => pr.on && pr.off
    ? '<div class="pair"><span class="on">' + esc(E.nameOf(S, pr.on)) + '</span><span class="for">in for</span><span class="off">' + esc(E.nameOf(S, pr.off)) + '</span></div>'
    : pr.on ? '<div class="pair"><span class="on">' + esc(E.nameOf(S, pr.on)) + '</span><span class="for">goes in</span></div>'
    : '<div class="pair"><span class="off">' + esc(E.nameOf(S, pr.off)) + '</span><span class="for">comes off</span></div>';
  const pairsHtml = (p) => '<div class="pairs">' + p.pairs.map(pairLine).join('') + '</div>' + (p.note ? '<p class="note">' + esc(p.note) + '</p>' : '');
  const confirmSwap = () => { commit(() => E.execute(S, now())); toast('Swapped.', { label: 'Undo', fn: () => { if (E.undo(S)) { save(); render(); toast('Undone'); } } }); };
  const swapNow = () => commit(() => { if (!E.fixNow(S, now()) && !E.subNow(S, now())) toast('No legal swap right now'); });
  const togglePlay = () => commit(() => E.togglePlay(S, now()));
  const doneBtn = (id) => btn('Done', 'primary big', confirmSwap, { id, icon: 'check' });
  function returnNow(id) {
    const r = E.returnNow(S, id, now()); save(); render();
    if (r.ok) speak(callText(S.game.pending)); else toast(r.msg);
  }
  function renderPlan(view) {
    const g = S.game; const card = $('planCard'); card.innerHTML = ''; card.hidden = false;
    const p = g.pending; const row = document.createElement('div'); row.className = 'row';
    if (p) {
      card.className = 'card plan live';
      const eyebrow = { rotation: 'Swap now', fill: 'Send in', fix: 'Fix it', return: 'Back in' }[p.type] || 'Swap now';
      card.innerHTML = '<div class="eyebrow"><span>' + eyebrow + '</span><span class="num" id="subTimer"></span></div>' + pairsHtml(p);
      row.append(btn('Say it', 'sm quiet', () => { arm(); speak(callText(p), true); }, { icon: 'speak' }),
        btn(p.type === 'rotation' ? 'Skip this one' : p.type === 'fix' || p.type === 'fill' ? 'Leave it' : 'Never mind', 'sm quiet', () => commit(() => E.dismissPending(S, now())), { icon: p.type === 'rotation' ? 'skip' : 'close' }));
    } else {
      card.className = 'card plan';
      card.innerHTML = '<div class="eyebrow"><span>Next swap</span><span class="num" id="subTimer"></span></div>' + (view.move ? pairsHtml(view.move) : '<p class="note">Nobody on the bench to swap in.</p>');
      const b = btn('Swap now', 'sm', swapNow, { icon: 'swap' }); b.disabled = !view.move; row.appendChild(b);
    }
    card.appendChild(row);
  }
  function banner(cls, html) { const b = document.createElement('div'); b.className = 'banner ' + cls; b.innerHTML = html; return b; }
  function renderBanners() {
    const g = S.game; const box = $('banners'); box.innerHTML = ''; box.setAttribute('aria-live', 'polite');
    if (g.breakPending) {
      const half = S.settings.periods === 2;
      const b = banner('info', '<div class="title">End of ' + (half ? 'the half' : 'quarter ' + g.period) + '. Water break.</div><p>Do the swap below during the break, then start the next period.</p>');
      b.appendChild(btn('Start ' + (half ? 'second half' : 'quarter ' + (g.period + 1)), 'primary big', () => { commit(() => E.nextPeriod(S, now())); speak((half ? 'Second half' : 'Quarter ' + g.period) + '. Go.'); }, { icon: 'play' }));
      box.appendChild(b);
    }
    const returning = g.pending && g.pending.type === 'return' ? g.pending.ons : [];
    g.away.filter((a) => a.status === 'left' && a.prompted && !returning.includes(a.id)).forEach((a) => {
      const b = banner('check', '<div class="title">Check on ' + esc(E.nameOf(S, a.id)) + '</div><p>Off for <span data-off="' + a.id + '"></span>. Ready to go back in?</p>');
      const row = document.createElement('div'); row.className = 'row';
      row.append(btn('Yes, in now', 'primary', () => returnNow(a.id), { icon: 'in' }),
        btn('Ask again in ' + (S.settings.checkBackSec / 60) + ' min', '', () => commit(() => E.checkLater(S, a.id, now()))),
        btn('Done for today', 'quiet', () => commit(() => E.doneToday(S, a.id)), { icon: 'close' }));
      b.appendChild(row); box.appendChild(b);
    });
    const over = g.field.length - S.settings.fieldSize;
    if (over > 0) box.appendChild(banner('warn', '<div class="title">' + g.field.length + ' on the field for ' + S.settings.fieldSize + 'v' + S.settings.fieldSize + '</div><p>Drag ' + (over === 1 ? 'one kid' : over + ' kids') + ' to the bench, or use the swap above.</p>'));
    const v = E.violations(S, g.field, []);
    if (v.length && !(g.pending && g.pending.type === 'fix')) box.appendChild(banner('warn', '<div class="title">Heads up</div><p>' + esc(v.join('. ')) + '. ' + (E.fixPlan(S) ? 'Tap Swap now for the fix.' : 'No legal fix with who is here. ' + SWAP_HINT) + '</p>'));
    if (ui.sel) box.appendChild(banner('info', '<p>' + esc(E.nameOf(S, ui.sel.id)) + ' picked. Tap the kid who swaps with ' + esc(E.nameOf(S, ui.sel.id)) + ', or tap ' + esc(E.nameOf(S, ui.sel.id)) + ' again to cancel.</p>'));
  }
  // One kid as a compact tile. Tap it to open its actions; tap again to close.
  function tile(id, list, view) {
    const g = S.game; const ref = view.move; const name = E.nameOf(S, id);
    const isOff = ref && ref.offs.includes(id), isOn = ref && ref.ons.includes(id), gk = g.locked.includes(id);
    const away = list === 'away' ? g.away.find((a) => a.id === id) : null;
    const open = ui.open === id, sel = ui.sel && ui.sel.id === id;
    const el = document.createElement('div'); el.dataset.id = id; el.dataset.list = list;
    el.className = 'prow tile' + (sel ? ' selected' : '') + (open ? ' open' : '') + (isOff ? ' next-off' : '') + (isOn ? ' next-on' : '') + (gk ? ' gk' : '') + (away ? ' away' : '');
    let state = '';
    if (away) state = away.status === 'done' ? 'Done today' : 'Left';
    else if (gk) state = 'Goalie';
    else if (isOff) state = 'Next off';
    else if (isOn) state = 'Next in';
    else if (list === 'field' && E.pinnedByRule(S, id)) state = 'Rule, stays';
    else if (list === 'field' && view.fm && E.isFresh(S, id)) state = 'Just came on';
    const body = document.createElement('div'); body.className = 'body';
    body.innerHTML = '<div class="pname">' + esc(name) + '</div><div class="pmeta num"></div>';
    ui.els.set(id, { el: body.lastChild, state, list });
    el.append(grip(id, list), body);
    if (open) {
      const acts = document.createElement('div'); acts.className = 'acts';
      const act = (label, ic, title, fn, pressed) => acts.appendChild(btn(label, '', (e) => { e.stopPropagation(); fn(); }, { title, pressed, icon: ic }));
      if (list === 'field') {
        act('Sub', 'swap', 'Take ' + name + ' off now; the plan names who goes in', () => { ui.open = null; let ok = false; commit(() => { ok = E.offNow(S, id, now()); }); if (ok) speak(callText(S.game.pending)); else toast('No legal swap for ' + name + ' right now'); });
        act('Goalie', 'shield', 'Goalie: keep ' + name + ' on the field', () => { ui.open = null; commit(() => E.toggleLock(S, id, now())); }, gk);
        act('Left', 'out', name + ' came off on their own', () => { ui.open = null; commit(() => E.outEarly(S, id, false, now())); const p = S.game.pending; speak(name + ' came off. ' + (p ? callText(p) : 'Nobody on the bench.')); });
        act('Pick', 'roster', 'Pick who swaps with ' + name, () => { ui.open = null; ui.sel = { id, list }; render(); });
      } else if (list === 'bench') {
        act('In now', 'in', 'Put ' + name + ' in right away', () => { ui.open = null; returnNow(id); });
        act('Away', 'away', name + ' wandered off from the bench', () => { ui.open = null; commit(() => E.outEarly(S, id, true, now())); });
        act('Pick', 'roster', 'Pick who swaps with ' + name, () => { ui.open = null; ui.sel = { id, list }; render(); });
      } else {
        act('In now', 'in', 'Put ' + name + ' in right away', () => { ui.open = null; returnNow(id); });
        act('Bench', 'bench', name + ' is back on the bench', () => { ui.open = null; commit(() => E.toBench(S, id)); });
        if (away && away.status !== 'done') act('Done today', 'close', name + ' is done for today', () => { ui.open = null; commit(() => E.doneToday(S, id)); });
      }
      el.appendChild(acts);
    }
    el.onclick = () => {
      if (ui.sel) { // picking a swap partner
        if (ui.sel.id === id) { ui.sel = null; render(); return; }
        if (ui.sel.list === list || ((ui.sel.list !== 'field') === (list !== 'field'))) { ui.sel = { id, list }; render(); return; } // one side must be on the field
        const a = ui.sel; ui.sel = null; commit(() => E.manualSwap(S, a, { id, list }, now())); return;
      }
      ui.open = open ? null : id; render();
    };
    return el;
  }
  // ---------- Drag a kid between the field and the bench ----------
  // Pointer-based so it works on a phone: the grip has touch-action none, the row is cloned as a ghost, the page auto-scrolls near the edges.
  const drag = { id: null, from: '', ghost: null, row: null, zone: null, target: null, x: 0, y: 0, moved: false, raf: 0, endedAt: 0 };
  // The click that follows a mouse drop would land on a freshly rebuilt row and select it. Swallow it.
  document.addEventListener('click', (e) => { if (now() - drag.endedAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  function grip(id, list) {
    const other = list === 'field' ? 'bench' : 'field';
    const h = btn('', 'grip', null, { title: 'Drag ' + E.nameOf(S, id) + ' to the ' + other, icon: 'grip' });
    h.addEventListener('pointerdown', (e) => startDrag(e, h, id, list));
    h.addEventListener('click', (e) => { e.stopPropagation(); if (e.detail === 0) commit(() => E.movePlayer(S, id, other, now())); else if (!drag.moved) toast('Drag ' + E.nameOf(S, id) + ' to the field or the bench'); });
    return h;
  }
  function startDrag(e, h, id, list) {
    if (drag.id || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const row = h.closest('.prow'); const r = row.getBoundingClientRect();
    const ghost = row.cloneNode(true); ghost.className = 'prow ghost tile'; ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = r.width + 'px'; ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px';
    Object.assign(drag, { id, from: list, ghost, row, zone: null, target: null, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false });
    document.body.appendChild(ghost); row.classList.add('lifted'); document.body.classList.add('dragging');
    try { h.setPointerCapture(e.pointerId); } catch (err) {}
    // Listeners live on the document so the drag survives even if pointer capture was refused.
    const pid = e.pointerId;
    const move = (ev) => { if (ev.pointerId !== pid) return; drag.x = ev.clientX; drag.y = ev.clientY; if (Math.abs(ev.clientX - drag.x0) + Math.abs(ev.clientY - drag.y0) > 6) drag.moved = true; ev.preventDefault(); };
    const end = (ev) => {
      if (ev.pointerId !== pid) return;
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
      if (ev.type === 'pointercancel') drag.moved = false; // the system took the gesture (swipe back, call): put the kid back
      finishDrag();
    };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    drag.raf = requestAnimationFrame(dragFrame);
  }
  function dragFrame() {
    if (!drag.id) return;
    const g = drag.ghost; g.style.transform = 'translate(' + (drag.x - drag.x0) + 'px,' + (drag.y - drag.y0) + 'px)';
    // Auto-scroll when the pointer is near the top or the footer.
    const edge = 90, bottom = window.innerHeight - 120, speed = (d) => Math.min(12, Math.ceil(d / 8));
    if (drag.moved && drag.y < edge) window.scrollBy(0, -speed(edge - drag.y));
    else if (drag.moved && drag.y > bottom) window.scrollBy(0, speed(drag.y - bottom));
    const el = document.elementFromPoint(drag.x, drag.y);
    const rowEl = el && el.closest('.prow[data-id]'); const zoneEl = el && el.closest('[data-drop]');
    const target = rowEl && rowEl.dataset.id !== drag.id && rowEl.dataset.list !== drag.from && rowEl.dataset.list !== 'away' && drag.from !== 'away' ? rowEl : null;
    const zone = zoneEl && zoneEl.dataset.drop !== drag.from ? zoneEl : null;
    if (drag.target !== target) { if (drag.target) drag.target.classList.remove('drop-target'); if (target) target.classList.add('drop-target'); drag.target = target; }
    if (drag.zone !== zone) { if (drag.zone) drag.zone.classList.remove('drop-over'); if (zone && !target) zone.classList.add('drop-over'); drag.zone = zone; }
    if (target && zone) zone.classList.remove('drop-over');
    drag.raf = requestAnimationFrame(dragFrame);
  }
  function finishDrag() {
    if (!drag.id) return;
    cancelAnimationFrame(drag.raf);
    const { id, from, target, zone, moved } = drag;
    if (drag.ghost) drag.ghost.remove(); if (drag.row) drag.row.classList.remove('lifted');
    if (target) target.classList.remove('drop-target'); if (zone) zone.classList.remove('drop-over');
    document.body.classList.remove('dragging');
    drag.id = null; drag.ghost = null; drag.row = null; drag.target = null; drag.zone = null;
    if (!moved) return;
    drag.endedAt = now();
    ui.sel = null;
    if (target) { const to = target.dataset.list; commit(() => E.manualSwap(S, { id, list: from }, { id: target.dataset.id, list: to }, now())); toast(E.nameOf(S, id) + ' in for ' + E.nameOf(S, target.dataset.id)); }
    else if (zone) { const to = zone.dataset.drop; commit(() => E.movePlayer(S, id, to, now())); toast(E.nameOf(S, id) + (to === 'field' ? ' is on the field' : ' is on the bench')); }
    else render();
  }
  function renderGame(view) {
    const g = S.game; ui.els.clear();
    renderBanners(); renderPlan(view);
    const fl = $('fieldList'); fl.innerHTML = ''; g.field.forEach((id) => fl.appendChild(tile(id, 'field', view)));
    if (!g.field.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Nobody on. Drag kids here or tap Who\'s on?'; fl.appendChild(e); }
    const bl = $('benchList'); bl.innerHTML = '';
    g.bench.slice().sort((a, b) => (E.played(S, a) - E.played(S, b)) || (E.rest(S, b) - E.rest(S, a))).forEach((id) => bl.appendChild(tile(id, 'bench', view)));
    if (!g.bench.length && !g.away.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Everyone is on the field.'; bl.appendChild(e); }
    const aw = $('awayList'); aw.innerHTML = ''; g.away.forEach((a) => aw.appendChild(tile(a.id, 'away', view)));
    const nh = $('notHere'); nh.innerHTML = ''; const absent = S.players.filter((p) => !p.here && !g.field.includes(p.id) && !g.bench.includes(p.id) && !g.away.some((a) => a.id === p.id));
    $('notHereWrap').hidden = absent.length === 0;
    absent.forEach((p) => { const b = btn(p.name, 'tile absent', () => { commit(() => E.arrive(S, p.id)); toast(p.name + ' is here and on the bench. Their rules are on.'); }, { title: p.name + ' arrived: put them on the bench', icon: 'plus' }); b.className = 'tile absent'; b.innerHTML = '<div class="body"><div class="pname">' + icon('plus') + esc(p.name) + '</div><div class="pmeta">Tap when here</div></div>'; nh.appendChild(b); });
    $('fieldCount').textContent = g.field.length + '/' + S.settings.fieldSize;
    $('sizeBtn').textContent = S.settings.fieldSize + 'v' + S.settings.fieldSize; $('sizeBtn').onclick = openSize;
    $('benchCount').textContent = String(g.bench.length);
    // Control row: one big round action in the middle (Done when a call is up, else Pause/Play), labeled round buttons either side.
    const foot = $('footInner'); foot.className = 'ctrl';
    foot.appendChild(roundBtn("Who's on", 'roster', 'side', openWhoOn, { id: 'whoOnBtn' }));
    if (g.pending) foot.appendChild(roundBtn('Done', 'check', 'main', confirmSwap, { id: 'goBtn' }));
    else { const pp = roundBtn(g.running ? 'Pause' : 'Play', g.running ? 'pause' : 'play', 'main', togglePlay, { id: 'playBtn' }); pp.disabled = !!g.breakPending; foot.appendChild(pp); }
    foot.appendChild(onHold(roundBtn('Menu', 'menu', 'side', null, { id: 'menuBtn', title: 'Menu (press and hold)' }), 500, openSheet, 'Hold to open the menu'));
  }
  // Strava-style round control: a circle with the icon, the label underneath.
  function roundBtn(label, ic, cls, onClick, opts) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rbtn ' + cls;
    b.innerHTML = '<span class="circ">' + icon(ic) + '</span><span class="rlbl">' + esc(label) + '</span>';
    if (onClick) b.onclick = onClick; if (opts && opts.id) b.id = opts.id; if (opts && opts.title) { b.title = opts.title; b.setAttribute('aria-label', opts.title); }
    return b;
  }
  // Text that changes every second, written into elements the last redraw created.
  // The bottom block changes height with the call; keep the page's bottom padding in step with it.
  function fitFoot() { const h = $('foot').offsetHeight + 8; if (ui.footH !== h) { ui.footH = h; document.body.style.paddingBottom = h + 'px'; } }
  function renderTimers() {
    const g = S.game; if (!g || S.screen !== 'game') return;
    fitFoot();
    const t = now();
    $('clock').textContent = mmss(g.t); // counts up, like the match clock
    $('periodLbl').textContent = (S.settings.periods === 2 ? 'Half ' : 'Quarter ') + g.period + ' of ' + S.settings.periods + (g.running ? '' : ' · paused');
    const top = $('subTimerTop'); top.textContent = g.breakPending ? 'break' : g.pending ? 'now' : mmss(g.subT); top.classList.toggle('due', !!g.pending);
    const st = $('subTimer'); if (st) st.textContent = g.pending ? '' : 'in ' + mmss(g.subT);
    ui.els.forEach((m, id) => {
      const played = mins(E.played(S, id));
      if (m.list === 'field') m.el.textContent = m.state ? m.state + ' · ' + played : played + ' · on ' + mmss(E.stint(S, id));
      else if (m.list === 'bench') m.el.textContent = m.state ? m.state + ' · ' + played : played + ' · resting ' + mmss(E.rest(S, id));
      else { const a = g.away.find((x) => x.id === id); if (a) m.el.textContent = a.status === 'done' ? 'Done today · ' + played : 'Left · check ' + (a.prompted ? 'now' : mmss((a.checkAt - t) / 1000)); }
    });
    document.querySelectorAll('[data-off]').forEach((el) => { const a = g.away.find((x) => x.id === el.dataset.off); if (a) el.textContent = mmss((t - a.since) / 1000); });
    if (ui.pocket) renderPocket();
  }

  // ---------- Menu sheet and pocket screen ----------
  function openSheet() {
    ui.sheet = true; const ov = $('overlay'); ov.innerHTML = '';
    const sh = document.createElement('div'); sh.className = 'sheet'; const panel = document.createElement('div'); panel.className = 'panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Game menu');
    const u = btn('Undo last move', 'quiet', () => { if (E.undo(S)) { save(); toast('Undone'); } closeSheet(); }, { icon: 'undo' }); u.disabled = !(S.game && S.game.history.length);
    panel.append(u,
      btn("Who's on right now", 'quiet', () => { ui.sheet = false; openWhoOn(); }, { icon: 'roster' }),
      btn('Add a kid who is not on the team', 'quiet', () => { const v = (prompt('First name of the new kid') || '').trim(); ui.sheet = false; if (!v) { render(); return; } const known = E.findByName(S, v); commit(() => E.addLate(S, v)); toast(known ? v + ' is here and on the bench.' : v + ' added to the team and the bench.'); }, { icon: 'plus' }),
      btn('Pocket screen', 'quiet', () => { closeSheet(); openPocket(); }, { icon: 'pocket' }),
      btn('Roster & rules', 'quiet', () => { ui.sheet = false; commit(() => { S.screen = 'setup'; }); }, { icon: 'roster' }),
      btn('Help & setup', 'quiet', () => { ui.sheet = false; commit(() => { S.screen = 'help'; }); }, { icon: 'help' }),
      btn('End game', 'danger', () => { if (!confirm('End the game and show minutes?')) return; ui.sheet = false; commit(() => E.endGame(S, now())); }, { icon: 'flag' }),
      btn('Close', 'primary', closeSheet, { icon: 'close' }));
    sh.appendChild(panel); sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(); }); ov.appendChild(sh);
    const first = panel.querySelector('button:not([disabled])'); if (first) first.focus();
  }
  function closeSheet() { ui.sheet = false; render(); }
  // Match the other side: how many a side are we playing right now?
  function openSize() {
    ui.sheet = true; const ov = $('overlay'); ov.innerHTML = '';
    const sh = document.createElement('div'); sh.className = 'sheet'; const panel = document.createElement('div'); panel.className = 'panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Playing how many a side');
    panel.innerHTML = '<h3>Playing how many a side?</h3><p class="muted">Match the other team. The app says who goes in or comes off.</p>';
    const segEl = document.createElement('div'); segEl.className = 'seg'; segEl.id = 'sizePick';
    [4, 5, 6, 7].forEach((n) => segEl.appendChild(btn(n + 'v' + n, '', () => { ui.sheet = false; commit(() => E.setFieldSize(S, n, now())); const p = S.game.pending; if (p) speak('Playing ' + n + ' v ' + n + '. ' + callText(p)); else toast('Playing ' + n + 'v' + n); }, { pressed: n === S.settings.fieldSize })));
    panel.append(segEl, btn('Close', 'quiet', closeSheet, { icon: 'close' }));
    sh.appendChild(panel); sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(); }); ov.appendChild(sh);
  }
  // "No idea what happened, but these six are on": tap the kids on the field, everyone else goes to the bench.
  function openWhoOn() {
    const g = S.game; ui.sheet = true; ui.sel = null; const ov = $('overlay'); ov.innerHTML = '';
    const picked = new Set(g.field);
    const sh = document.createElement('div'); sh.className = 'sheet'; const panel = document.createElement('div'); panel.className = 'panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Who is on the field right now');
    panel.innerHTML = '<h3>Who is on right now?</h3><p class="muted">Tap the kids you can see on the field. Everyone else goes to the bench.</p><div class="pick" id="whoPick"></div><p class="calc" id="whoCount" aria-live="polite"></p>';
    const kids = [...g.field, ...g.bench, ...g.away.map((a) => a.id)];
    const pick = panel.querySelector('#whoPick'); const count = panel.querySelector('#whoCount');
    const draw = () => {
      pick.innerHTML = ''; kids.forEach((id) => pick.appendChild(btn(E.nameOf(S, id), '', () => { if (picked.has(id)) picked.delete(id); else picked.add(id); draw(); }, { pressed: picked.has(id) })));
      const v = E.violations(S, [...picked], []);
      count.innerHTML = '<b>' + picked.size + '</b> of ' + S.settings.fieldSize + ' on' + (v.length ? '. ' + esc(v.join('. ')) + '.' : '');
      ok.disabled = picked.size === 0;
    };
    const row = document.createElement('div'); row.className = 'row';
    const ok = btn("That's who's on", 'primary big', () => { const ids = kids.filter((id) => picked.has(id)); ui.sheet = false; commit(() => E.setLineup(S, ids, now())); toast('Lineup set. ' + ids.length + ' on.'); }, { id: 'whoOk', icon: 'check' });
    row.append(btn('Cancel', 'quiet', closeSheet, { icon: 'close' }), ok);
    panel.appendChild(row); draw();
    sh.appendChild(panel); sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(); }); ov.appendChild(sh);
  }
  function openPocket() {
    ui.pocket = true; ui.pocketKey = ''; const ov = $('overlay'); ov.innerHTML = '';
    const pk = document.createElement('div'); pk.className = 'pocket'; pk.id = 'pocket';
    const C = Math.round(2 * Math.PI * 108);
    pk.innerHTML = '<div class="ptop num" id="ptop"></div>'
      + '<div class="ring"><svg viewBox="0 0 240 240" width="240" height="240" aria-hidden="true"><circle cx="120" cy="120" r="108" fill="none" stroke="#1E2A22" stroke-width="14"></circle><circle id="pring" cx="120" cy="120" r="108" fill="none" stroke="var(--pocket-on)" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0"></circle></svg>'
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><div class="lbl" id="plbl">Next swap</div><div class="pclock num" id="pclock"></div></div></div>'
      + '<div class="pcall" id="pcall"></div><div class="phint" id="phint"></div><div class="pbar"><i></i></div><div class="phint">Hold anywhere for one second to unlock</div>';
    pk.dataset.c = C;
    onHold(pk, 1000, closePocket);
    pk.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    ov.appendChild(pk); renderPocket();
  }
  function closePocket() { ui.pocket = false; render(); }
  function renderPocket() {
    const g = S.game; if (!g || !ui.pocket || !$('pclock')) return;
    const C = Number($('pocket').dataset.c); const p = g.pending || (ui.view && ui.view.move);
    $('ptop').textContent = (S.settings.periods === 2 ? 'H' : 'Q') + g.period + ' · ' + mmss(g.t) + (g.running ? '' : ' · paused');
    const due = !!g.pending;
    $('plbl').textContent = due ? ({ rotation: 'Swap now', fill: 'Send in', fix: 'Fix it', return: 'Back in' }[g.pending.type] || 'Swap now') : g.breakPending ? 'Water break' : 'Next swap';
    $('pclock').textContent = due ? 'NOW' : mmss(g.subT);
    const frac = due ? 1 : 1 - g.subT / Math.max(1, S.settings.intervalSec);
    $('pring').setAttribute('stroke-dashoffset', String(Math.round(C * (1 - Math.max(0, Math.min(1, frac))))));
    const key = p ? p.offs.join(',') + '>' + p.ons.join(',') : '';
    if (key !== ui.pocketKey) { ui.pocketKey = key; $('pcall').innerHTML = p ? '<div class="pairs">' + p.pairs.map(pairLine).join('') + '</div>' : '<span>No swap available</span>'; }
    $('phint').textContent = due ? 'Unlock to confirm.' : '';
  }

  // ---------- Summary and help ----------
  function renderSummary() {
    const g = S.game; const ids = Object.keys(g.played).sort((a, b) => E.played(S, b) - E.played(S, a));
    const max = Math.max(1, g.total);
    const min = ids.length ? Math.min.apply(null, ids.map((id) => E.played(S, id))) : 0;
    const multi = (g.games || 1) > 1; const before = g.playedBefore || {};
    $('sumLine').textContent = ids.length + ' kids played. Everyone got at least ' + mins(min) + (multi ? ' today over ' + g.games + ' games' : '') + '. Game clock ran ' + mins(g.total) + '.';
    $('sumTable').innerHTML = '<tr><th>Kid</th><th>' + (multi ? 'Today' : 'Played') + '</th>' + (multi ? '<th>This game</th>' : '') + '<th style="width:' + (multi ? 30 : 40) + '%"></th></tr>'
      + ids.map((id) => '<tr><td class="name">' + esc(E.nameOf(S, id)) + '</td><td class="num">' + mins(E.played(S, id)) + '</td>' + (multi ? '<td class="num">' + mins(E.played(S, id) - (before[id] || 0)) + '</td>' : '')
        + '<td><div class="bar-track"><div class="bar-fill" style="width:' + Math.round(100 * E.played(S, id) / max) + '%"></div></div></td></tr>').join('');
  }
  function renderHelp() { const off = 'serviceWorker' in navigator && navigator.serviceWorker.controller; $('verLine').textContent = 'Go In For ' + APP_VERSION + (off ? ' · saved on this phone, works offline' : ' · open once with a signal to save it for offline use'); }

  function render(view) {
    if (drag.id) { drag.moved = false; finishDrag(); } // a redraw mid-drag (tab switch, dialog) drops the kid back where they were
    ['setup', 'game', 'summary', 'help'].forEach((id) => { $(id).hidden = S.screen !== id; });
    $('footInner').innerHTML = '';
    if (!ui.sheet && !ui.pocket) $('overlay').innerHTML = '';
    $('planCard').hidden = S.screen !== 'game';
    if (S.screen === 'game') { ui.view = view || buildView(); ui.viewKey = ui.view.key; renderGame(ui.view); renderTimers(); }
    else if (S.screen === 'setup') renderSetup(); else if (S.screen === 'summary') renderSummary(); else renderHelp();
    fitFoot();
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
    if (ui.sheet || drag.id) { renderTimers(); return; }
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
    $('editRoster').onclick = () => { editRoster = !editRoster; renderSetup(); };
    $('ruleAdd').onclick = () => { ruleDraft.open = true; ruleDraft.ids = []; ruleDraft.min = 1; renderSetup(); };
    $('ruleCancel').onclick = () => { ruleDraft.open = false; renderSetup(); };
    $('ruleSave').onclick = () => { if (E.addRule(S, ruleDraft.type, ruleDraft.ids, ruleDraft.min)) { ruleDraft.open = false; save(); renderSetup(); } };
    $('copyLink').onclick = async () => { const l = rosterLink(); try { await navigator.clipboard.writeText(l); toast('Link copied'); } catch (e) { $('linkBox').value = l; $('linkBox').hidden = false; toast('Copy it from the box below'); } };
    $('showLink').onclick = () => { $('linkBox').value = rosterLink(); $('linkBox').hidden = false; };
    $('pasteBtn').onclick = () => { const v = $('pasteLink').value; if (!v.trim()) return; loadRosterCode(v); $('pasteLink').value = ''; };
    $('pasteLink').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('pasteBtn').click(); });
    $('helpBtn').onclick = () => commit(() => { S.screen = 'help'; });
    $('helpBack').onclick = () => commit(() => { S.screen = homeScreen(); });
    $('nextGameBtn').onclick = () => commit(() => E.newGame(S, true));
    $('newGameBtn').onclick = () => commit(() => E.newGame(S, false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (ui.sheet) closeSheet(); else if (ui.pocket) closePocket(); } });
    [['addBtn', 'plus'], ['pasteBtn', 'link'], ['copyLink', 'link'], ['helpBtn', 'help'], ['helpBack', 'undo'], ['nextGameBtn', 'play'], ['newGameBtn', 'undo'], ['ruleAdd', 'plus'], ['testVoice', 'speak']].forEach(([id, ic]) => { const b = $(id); if (b) b.innerHTML = icon(ic) + '<span>' + b.textContent.trim().replace(/^\+\s*/, '') + '</span>'; });
    document.addEventListener('pointerdown', arm, { passive: true });
    document.addEventListener('keydown', arm);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); render(); } else save(); });
    window.addEventListener('pagehide', save);
    window.addEventListener('resize', fitFoot);
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
