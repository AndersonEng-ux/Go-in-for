// Fails when a text/background token pair drops below its WCAG target. Reads styles.css directly.
import fs from 'fs';
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
function tokens(block) { const out = {}; for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2]; return out; }
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
const darkStart = css.indexOf(':root[data-theme="dark"]');
const dark = Object.assign({}, Object.fromEntries(Object.entries(light).filter(([k]) => k.startsWith('pocket-'))), tokens(css.slice(darkStart, css.indexOf('}', darkStart))));
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
// [text token, background token, minimum ratio, what it is]
const PAIRS = [
  ['ink', 'bg', 7, 'body text on page'], ['ink', 'surface', 7, 'names on cards'], ['ink', 'surface-2', 7, 'button labels'],
  ['muted', 'bg', 7, 'secondary text on page'], ['muted', 'surface', 7, 'secondary text on cards'],
  ['accent-ink', 'accent', 4.5, 'primary button label'], ['bg', 'ink', 7, 'pressed toggle label'], ['pitch-ink', 'pitch', 4.5, 'blue chip label'], ['pitch-text', 'pitch-soft', 7, 'green chip text'], ['pitch-text', 'surface', 4.5, 'green names in the call'],
  ['amber-ink', 'amber', 4.5, 'next-off chip'], ['amber-text', 'amber-soft', 7, 'check banner'], ['amber-text', 'surface', 4.5, 'amber names in the call'],
  ['red-ink', 'red', 4.5, 'away chip'], ['red-text', 'red-soft', 7, 'warning banner and danger button'],
  ['ink', 'amber-soft', 7, 'text in the check banner'], ['ink', 'red-soft', 7, 'text in the warning banner'], ['ink', 'pitch-soft', 7, 'text in the info banner'],
  ['pocket-ink', 'pocket-bg', 7, 'pocket screen text'], ['pocket-on', 'pocket-bg', 7, 'pocket screen name coming on'], ['pocket-off', 'pocket-bg', 7, 'pocket screen name going off'], ['pocket-line', 'pocket-bg', 3, 'pocket screen "in for" label'],
];
let fail = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min, what] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log('MISSING', name, fg, bg); fail++; continue; }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) fail++;
    console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name.padEnd(5) + ' ' + r.toFixed(2).padStart(5) + ' (min ' + min + ')  ' + what + '  ' + fg + ' on ' + bg);
  }
}
if (fail) { console.error(fail + ' contrast pair(s) below target'); process.exit(1); }
console.log('contrast: all pairs pass');
