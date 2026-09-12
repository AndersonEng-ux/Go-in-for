// Builds artifact.html: the same app as one body-only file for the claude.ai artifact host (which supplies its own <head>).
import fs from 'fs';
const root = new URL('../', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), 'utf8');
const b64 = (f) => fs.readFileSync(new URL(f, root)).toString('base64');
let css = read('styles.css').replace(/url\('fonts\/([^']+)'\)/g, (m, f) => "url('data:font/woff2;base64," + b64('fonts/' + f) + "')");
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script src="engine\.js"><\/script>\s*<script src="app\.js"><\/script>/, '');
const out = '<title>Go In For</title>\n<style>\n' + css + '\n</style>\n' + body + '\n<script>\n' + read('engine.js') + '\n</script>\n<script>\n' + read('app.js') + '\n</script>\n';
fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../dist/artifact.html', import.meta.url), out);
console.log('dist/artifact.html', out.length, 'bytes');
