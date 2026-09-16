// Landfall — fold the whole app into one HTML file.
//
//   node build/bundle-single.mjs
//
// This is the artifact build: no server, no service worker, no second request.
// Fonts become data URIs, the ES modules are concatenated in dependency order
// with their imports stripped, and the corpus is inlined as a preloaded cache
// that data.js reads instead of fetching.
//
// Only the CORE maps go in. All 43 would be 7MB of geometry nobody has asked
// for; the packs that ship here are the ones the app opens on.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const read = (p) => readFileSync(join(APP, p), 'utf8');

const CORE_MAPS = ['caribbean', 'world', 'canada', 'usa', 'china', 'africa', 'europe',
  'central-america', 'south-america', 'asia'];

// ── fonts as data URIs ───────────────────────────────────────────────────
let fontCss = read('fonts/fonts.css');
fontCss = fontCss.replace(/url\((([\w-]+)\.woff2)\)/g, (_, file) => {
  const b64 = readFileSync(join(APP, 'fonts', file)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

// ── modules, in dependency order, with imports removed ───────────────────
const MODULES = ['data.js', 'schedule.js', 'engine.js', 'map.js', 'speech.js', 'sound.js',
  'hero.js', 'sweep.js', 'session.js', 'app.js'];
let js = '';
// `import * as sound from './sound.js'` cannot survive flattening: the import
// line goes and every `sound.right()` then references nothing, which is a
// blank screen with no error anywhere useful. Rebuild the namespace as a plain
// object from that module's own export list, so a future namespace import
// cannot silently break this build either.
const namespaces = [];
// Aliased named imports have the same problem, quietly: `import { stop as
// stopSpeech }` leaves `stop` defined and every call to stopSpeech throwing.
const aliases = [];
for (const m of MODULES) {
  const raw = read('js/' + m);
  for (const [, name, mod] of raw.matchAll(/^\s*import\s+\*\s+as\s+(\w+)\s+from\s+'\.\/([\w.-]+)';/gm)) {
    namespaces.push({ name, mod });
  }
  for (const [, names, mod] of raw.matchAll(/^\s*import\s+\{([^}]+)\}\s+from\s+'\.\/([\w.-]+)';/gm)) {
    for (const part of names.split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      if (bits.length === 2) aliases.push({ from: bits[0].trim(), to: bits[1].trim(), mod });
    }
  }
}
for (const m of MODULES) {
  let src = read('js/' + m);
  const exported = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm)].map((x) => x[1]);
  src = src.replace(/^\s*import\s[^;]*;$/gm, '');
  src = src.replace(/^export\s+/gm, '');
  js += `\n// ── ${m} ${'─'.repeat(Math.max(0, 60 - m.length))}\n` + src + '\n';
  for (const ns of namespaces) {
    if (ns.mod !== m) continue;
    if (!exported.length) throw new Error('namespace import of ' + m + ' but nothing detectable is exported');
    js += `const ${ns.name} = { ${exported.join(', ')} };\n`;
  }
  const aliased = new Set();
  for (const a of aliases) {
    if (a.mod !== m || aliased.has(a.to)) continue;
    if (!exported.includes(a.from)) throw new Error(`aliased import "${a.from} as ${a.to}" but ${m} does not export ${a.from}`);
    aliased.add(a.to);
    js += `const ${a.to} = ${a.from};\n`;
  }
}

// ── corpus ───────────────────────────────────────────────────────────────
const preload = {
  'data/core.json': JSON.parse(read('data/core.json')),
  'data/flags.json': JSON.parse(read('data/flags.json')),
};
for (const m of CORE_MAPS) {
  try { preload['data/maps/' + m + '.json'] = JSON.parse(read('data/maps/' + m + '.json')); }
  catch { console.warn('  (no map ' + m + ')'); }
}

const html = read('index.html')
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="stylesheet" href="fonts\/fonts.css">\s*/, '')
  .replace(/<link rel="stylesheet" href="styles.css">/, '<style>\n' + fontCss + '\n' + read('styles.css') + '\n</style>')
  .replace(/<link rel="icon"[^>]*>\s*/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '')
  .replace(/<script type="module" src="js\/app.js"><\/script>/,
    '<script>window.__LANDFALL__ = ' + JSON.stringify(preload) + ';</script>\n'
    + '<script type="module">\n' + js + '\n</script>');

mkdirSync(join(ROOT, 'dist'), { recursive: true });
const out = join(ROOT, 'dist', 'landfall.html');
writeFileSync(out, html);
console.log('wrote dist/landfall.html —', (html.length / 1024 / 1024).toFixed(2) + 'MB');
if (html.length > 15.5 * 1024 * 1024) console.error('  ! over the 16MB artifact limit');
