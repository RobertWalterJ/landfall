// Landfall — the flags individual islands fly.
//
//   node build/fetch-island-flags.mjs
//
// flag-icons covers ISO country codes, which is every Caribbean country and
// territory but none of the islands inside them. Yet Nevis, Barbuda, Saba,
// Sint Eustatius and Bonaire all fly their own flag, and those are exactly the
// twin-island countries — Saint Kitts AND Nevis, Antigua AND Barbuda — where
// "whose flag is this?" is a real question about a real distinction.
//
// Sources: Wikidata's P41 where it has one (harvest-islands.mjs), plus a short
// hand-checked list of Commons titles for the islands Wikidata has missed.
//
// NOT HERE, and deliberately: Tobago and Carriacou. Both fly a flag; neither
// has one on Commons under a title that can be verified automatically — a
// Commons search for Tobago returns eight Trinidad and Tobago national variants
// and Carriacou exists only as a PNG. Guessing a file is how you end up
// teaching the wrong flag, so they stay absent until a real file turns up.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'sources', 'island-flags');
mkdirSync(OUT, { recursive: true });
const UA = 'Landfall/1.0 (personal geography study app; local build)';

// Hand-checked, and each one verified to exist before being written down.
const EXTRA = {
  barbuda: 'Flag of Barbuda.svg',
  bonaire: 'Flag of Bonaire.svg',
};

const islands = JSON.parse(readFileSync(join(ROOT, 'sources', 'wikidata', 'islands.json'), 'utf8'));
const wanted = {};
for (const [id, rec] of Object.entries(islands)) if (rec.flag) wanted[id] = rec.flag;
Object.assign(wanted, EXTRA);

// Commons files reuse internal ids like "a" and "path1". The app inlines many
// flags into one document — the Atlas list, a four-flag question — so every id
// has to be namespaced per flag or the first definition wins everywhere.
// Halyard learned this the hard way across 336 flags.
function isolate(svg, id) {
  const ids = new Set();
  for (const m of svg.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  for (const old of ids) {
    const safe = id + '-' + old;
    svg = svg.split(`id="${old}"`).join(`id="${safe}"`)
      .split(`#${old})`).join(`#${safe})`)
      .split(`href="#${old}"`).join(`href="#${safe}"`)
      .split(`xlink:href="#${old}"`).join(`xlink:href="#${safe}"`);
  }
  // Strip anything that could execute or phone home, and any fixed size, so
  // the flag scales to whatever box it is dropped into.
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return svg;
}

// A flag with no viewBox cannot be scaled into a tile — it renders at whatever
// fixed size it was authored at, or not at all. Several Commons files (Nevis,
// Sint Eustatius among them) carry only width and height, which is enough to
// build one.
function ensureViewBox(svg) {
  if (/viewBox=/i.test(svg)) return svg;
  const w = parseFloat((svg.match(/\swidth="([\d.]+)/i) || [])[1]);
  const h = parseFloat((svg.match(/\sheight="([\d.]+)/i) || [])[1]);
  if (!w || !h) return null;
  return svg.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
}

const report = [];
let got = 0;
for (const [id, title] of Object.entries(wanted)) {
  const dest = join(OUT, id + '.svg');
  if (existsSync(dest)) { got++; continue; }
  const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(title);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) { report.push(`${id}: ${title} → HTTP ${r.status}`); continue; }
  const text = await r.text();
  if (!/^\s*<(\?xml|svg|!DOCTYPE)/i.test(text)) { report.push(`${id}: ${title} is not an SVG`); continue; }
  const fixed = ensureViewBox(text);
  if (!fixed) { report.push(`${id}: ${title} has no viewBox and no usable size — dropped`); continue; }
  writeFileSync(dest, isolate(fixed, id));
  got++;
  console.log(`  ${id.padEnd(18)} ${title}`);
  await new Promise((r) => setTimeout(r, 400));      // Commons rate-limits
}

console.log(`\n${got} island flags in sources/island-flags/`);
for (const r of report) console.log('  ! ' + r);
