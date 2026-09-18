// Landfall — build the copies that get published.
//
//   node build/make-deploy.mjs
//
// Writes docs/ (GitHub Pages serves this from main) and dist/web (a plain copy).
//
// It FAILS the build on any absolute path. A project site lives at
// /landfall/, so a single href="/styles.css" or a service worker registered at
// '/sw.js' works perfectly on localhost and breaks completely once deployed —
// which is the one mistake that is invisible until it is live.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stamp as versionStamp } from './lib/stamp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const targets = [join(ROOT, 'docs'), join(ROOT, 'dist', 'web')];

// A build you can point at. "Is the thing I am looking at the thing you just
// pushed?" is not a question anyone should have to answer by feel, so the
// version, the moment it was built and the commit it came from all ship with
// it and are visible in the app.
const { text: stamp, build } = versionStamp(ROOT);
const problems = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Absolute-path check over the text files only.
for (const f of walk(APP)) {
  if (!/\.(html|css|js|webmanifest|json)$/.test(f)) continue;
  if (f.endsWith('.json') && f.includes('data')) continue;      // corpus, no URLs
  const text = readFileSync(f, 'utf8');
  const rel = relative(APP, f);
  const patterns = [
    [/(?:href|src)=["']\/(?!\/)/g, 'an absolute href/src'],
    [/register\(\s*["']\//g, 'a service worker registered from /'],
    [/fetch\(\s*["']\//g, 'a fetch from /'],
    [/url\(\s*["']?\/(?!\/)/g, 'a CSS url() from /'],
  ];
  for (const [re, what] of patterns) {
    const hits = text.match(re);
    if (hits) problems.push(`${rel}: ${what} (${hits.length}x) — breaks at a subpath`);
  }
}

if (problems.length) {
  console.error('deploy refused:\n' + problems.map((p) => '  x ' + p).join('\n'));
  process.exit(1);
}

for (const out of targets) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(APP, out, { recursive: true });
  // Stamp the build so "About" can say which one is on the phone.
  const appjs = join(out, 'js', 'app.js');
  writeFileSync(appjs, readFileSync(appjs, 'utf8').replace("'dev (unstamped)'", JSON.stringify(stamp)));
  const sw = join(out, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replace("'landfall-v1-dev'", JSON.stringify('landfall-v1-' + build)));
  writeFileSync(join(out, '.nojekyll'), '');
  // The notices have to travel with the thing they cover. ODbL asks for them on
  // the Produced Work, and MIT asks for its notice to accompany the flags —
  // which are deployed, while the licence text was sitting in sources/ and
  // was not.
  for (const f of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) {
    try { writeFileSync(join(out, f), readFileSync(join(ROOT, f), 'utf8')); }
    catch { console.error('deploy refused: ' + f + ' is missing'); process.exit(1); }
  }
}

// Make sure everything the service worker precaches actually exists.
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const missing = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
  .filter((p) => p !== './')
  .filter((p) => { try { statSync(join(APP, p)); return false; } catch { return true; } });
if (missing.length) {
  console.error('deploy refused: the service worker precaches files that do not exist:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const size = (dir) => walk(dir).reduce((s, f) => s + statSync(f).size, 0);
console.log('built', targets.map((t) => relative(ROOT, t)).join(' and '));
console.log('stamp', stamp);
console.log('size ', (size(join(ROOT, 'docs')) / 1024 / 1024).toFixed(1) + 'MB total,',
  (walk(join(ROOT, 'docs')).filter((f) => !f.includes('maps')).reduce((s, f) => s + statSync(f).size, 0) / 1024 / 1024).toFixed(1) + 'MB without the lazy maps');
