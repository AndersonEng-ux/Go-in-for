// Renders the app icon at the sizes iOS and the manifest need. Run from football-subs/.
import { chromium } from './pw.mjs';
import fs from 'fs';
const font = fs.readFileSync('fonts/BarlowCondensed-800.woff2').toString('base64');
const html = (size, pad) => `<!doctype html><html><head><style>
@font-face{font-family:BC;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:800}
html,body{margin:0;background:#D64000}
.ic{width:${size}px;height:${size}px;background:#D64000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:${size*0.02}px;font-family:BC;color:#fff;font-weight:800}
.go{font-size:${size*0.46}px;line-height:1;letter-spacing:.02em}
.sub{font-size:${size*0.13}px;letter-spacing:.14em;color:#FFD6C2;line-height:1}
.line{width:${size*0.5}px;height:${size*0.035}px;background:#FFD6C2;border-radius:${size}px}
</style></head><body><div class="ic"><div class="go">GO</div><div class="line"></div><div class="sub">IN FOR</div></div></body></html>`;
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-512-maskable.png', 512], ['apple-touch-icon.png', 180]]) {
  await p.setViewportSize({ width: size, height: size }); await p.setContent(html(size)); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: 'icons/' + name, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close(); console.log(fs.readdirSync('icons'));
