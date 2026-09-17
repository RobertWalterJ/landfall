// Landfall — do the app's modules actually parse, AS MODULES?
//
//   node build/check-syntax.mjs
//
// `node --check app/js/map.js` parses a .js file as CommonJS and waved through
// a duplicated method signature that the browser rejected outright, leaving the
// app frozen on the boot screen with the error only visible as a failed dynamic
// import. Checking every module the way the browser will is two seconds and
// removes a whole class of "it just hangs".

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'app', 'js');
let bad = 0;
for (const f of readdirSync(JS).filter((x) => x.endsWith('.js'))) {
  const tmp = join(tmpdir(), 'landfall-check-' + f.replace('.js', '.mjs'));
  writeFileSync(tmp, readFileSync(join(JS, f), 'utf8'));
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('  ok   ' + f);
  } catch (err) {
    bad++;
    const msg = String(err.stderr || err).split('\n').filter((l) => l.trim()).slice(0, 3).join('\n       ');
    console.log('  FAIL ' + f + '\n       ' + msg);
  } finally { try { unlinkSync(tmp); } catch { /* fine */ } }
}
if (bad) { console.error(`\n${bad} module(s) will not parse in a browser`); process.exit(1); }
console.log('\nevery module parses as a module');
