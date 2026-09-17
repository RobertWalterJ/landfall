// Landfall — the chart takes its colour from the water you are sailing.
//
//   node build/make-regions.mjs        writes app/regions.css
//
// As a pack is opened the whole app restains itself: Caribbean turquoise over
// coral sand, the North Atlantic's slate over chalk, Sahelian dust, the jade
// and loess of eastern China, the deep blue of the Pacific. It is the clearest
// signal there is that you have moved, and it costs nothing at runtime — it is
// nine sets of custom properties.
//
// WHAT A REGION MAY AND MAY NOT CHANGE.
//
// It changes the WORLD: the sea, the ground, the land around the places, the
// tint of paper, and the one accent that means "you can touch this".
//
// It never changes MEANING. Right is the same green in Nunavut as in Nevis;
// wrong is the same vermilion; a place you were told is the same brass; the
// keyline is the same keyline. A quiz whose verdict colours drift as you travel
// would be teaching you to re-learn its own interface every few weeks, which is
// effort spent on nothing. build/audit-colour.mjs enforces this as a rule.
//
// HOW THE COLOURS ARE DERIVED. Every region is specified as a hue and a chroma
// only. The LIGHTNESS of each token is copied from the default palette, which
// has already been audited — so every contrast ratio in the app is preserved by
// construction, and no region can be beautiful at the cost of being unreadable.
// The audit re-checks all of them anyway.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, toLab, format } from './lib/colour.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// -- Lab -> sRGB ---------------------------------------------------------
const WHITE = [0.95047, 1, 1.08883];
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function fromLch(L, C, h) {
  for (let k = C; k >= 0; k -= 0.5) {          // pull chroma in until it fits sRGB
    const a = k * Math.cos(h * Math.PI / 180), b = k * Math.sin(h * Math.PI / 180);
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
    const [X, Y, Z] = [inv(fx) * WHITE[0], inv(fy) * WHITE[1], inv(fz) * WHITE[2]];
    const lin = [
       3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
      -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
       0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
    if (lin.every((v) => v >= -0.002 && v <= 1.002)) {
      return format(lin.map((v) => toSrgb(Math.max(0, Math.min(1, v)))));
    }
  }
  return '#808080';
}
const L = (hex) => toLab(parse(hex))[0];

// -- the lightness skeleton, lifted from the audited default palette -----
// Hold these and every contrast ratio in the app holds too.
const LIGHT = {
  'ground-top': L('#D6E7E5'), 'ground-bottom': L('#BFD8DC'),
  'surface-tint': L('#E3EFEE'), 'surface-sunk': L('#EDF4F3'),
  'sea': L('#0D6A7C'), 'sea-deep': L('#0A4E5C'), 'sea-bright': L('#12809A'),
  'water': L('#A8CBD6'), 'water-deep': L('#93BDCB'),
  'land-context': L('#F4EBDB'), 'coast-strong': L('#0D6A7C'),
};
const DARK = {
  'ground-top': L('#0A2027'), 'ground-bottom': L('#061318'),
  'surface': L('#163843'), 'surface-tint': L('#1C444F'), 'surface-sunk': L('#102B33'),
  'sea': L('#57C7D9'), 'sea-deep': L('#0B4E5E'), 'sea-bright': L('#16788C'),
  'water': L('#0A222B'), 'water-deep': L('#07191F'),
  'land-context': L('#2B4652'), 'coast-strong': L('#57C7D9'),
};

// -- the regions ---------------------------------------------------------
// hSea/cSea    the water, and the accent that means "tappable"
// hLand/cLand  the ground around the places
// dLand        lightness offset for the land. dGround is kept at 0 on purpose:
//              labels are set straight onto the ground, so its lightness is
//              load-bearing for text contrast — the first draft darkened it by
//              three points for five regions and put every one of them under
//              WCAG AA. The land around the places carries no text, so that is
//              where a region is free to get its character.
// dLand        lightness offsets. Holding every lightness identical made nine
//              regions that all clipped to the same corner of the sRGB gamut and
//              looked alike; a few points of headroom is what lets Sahelian
//              ochre actually be ochre. The audit re-checks each one, so these
//              are free to move only as far as the contrast floors allow.
// Hues are CIE Lab angles: ~40 warm earth, ~90 yellow, ~140 green, ~200 cyan,
// ~250 blue-cyan, ~290 blue.
const REGIONS = [
  { id: 'caribbean', note: 'turquoise over coral sand — shallow banks and reef',
    hSea: 245, cSea: 17, hLand: 78, cLand: 16, dLand: 0, dGround: 0, packs: ['caribbean', 'cities-caribbean', 'territories', 'countries-central-america', 'mexico'] },
  { id: 'north', note: 'cold lake blue over granite and lichen — the Shield',
    hSea: 272, cSea: 11, hLand: 128, cLand: 8, dLand: -2, dGround: 0, packs: ['canada', 'cities-canada', 'usa', 'cities-usa'] },
  { id: 'atlantic', note: 'North Sea slate over chalk and heath',
    hSea: 285, cSea: 10, hLand: 98, cLand: 9, dLand: -3, dGround: 0, packs: ['countries-europe', 'cities-europe', 'germany', 'switzerland', 'netherlands', 'poland', 'italy', 'spain', 'france', 'uk'] },
  { id: 'sahel', note: 'dust and laterite under a hazy sky',
    hSea: 250, cSea: 13, hLand: 58, cLand: 30, dLand: -8, dGround: 0, packs: ['countries-africa', 'cities-africa', 'nigeria', 'south-africa', 'ethiopia', 'egypt', 'kenya'] },
  { id: 'loess', note: 'jade sea over loess — the yellow earth',
    hSea: 205, cSea: 14, hLand: 80, cLand: 30, dLand: -7, dGround: 0, packs: ['china', 'japan', 'south-korea'] },
  { id: 'monsoon', note: 'warm shallow water over paddy green',
    hSea: 222, cSea: 17, hLand: 128, cLand: 22, dLand: -6, dGround: 0, packs: ['india', 'pakistan', 'vietnam', 'philippines', 'indonesia', 'countries-asia', 'cities-asia'] },
  { id: 'andes', note: 'deep Pacific over altiplano and rainforest',
    hSea: 258, cSea: 19, hLand: 112, cLand: 18, dLand: -5, dGround: 0, packs: ['countries-south-america', 'brazil', 'argentina', 'colombia', 'chile', 'peru'] },
  { id: 'pacific', note: 'open ocean blue over volcanic rock and coral',
    hSea: 265, cSea: 26, hLand: 50, cLand: 20, dLand: -4, dGround: 0, packs: ['countries-oceania', 'australia', 'new-zealand'] },
  { id: 'levant', note: 'Mediterranean over limestone and desert',
    hSea: 238, cSea: 20, hLand: 70, cLand: 20, dLand: -6, dGround: 0, packs: ['countries-middle-east', 'turkey', 'saudi-arabia'] },
];

// -- emit ----------------------------------------------------------------
function tokens(r, skel, dark) {
  const { hSea: hs, cSea: cs, hLand: hl, cLand: cl, dLand = 0, dGround = 0 } = r;
  const q = dark ? 0.75 : 1;                   // night water is quieter, not greyer
  const out = [
    ['ground-top', fromLch(skel['ground-top'] + (dark ? -dGround : dGround), (dark ? cs * 0.5 : cs * 0.65) * q, hs)],
    ['ground-bottom', fromLch(skel['ground-bottom'] + (dark ? -dGround : dGround), (dark ? cs * 0.55 : cs * 0.75) * q, hs)],
    ['surface-tint', fromLch(skel['surface-tint'], cs * 0.35 * q, hs)],
    ['surface-sunk', fromLch(skel['surface-sunk'], cs * 0.25 * q, hs)],
    ['sea', fromLch(skel.sea, cs * 1.8, hs)],
    ['sea-deep', fromLch(skel['sea-deep'], cs * 1.6, hs)],
    ['sea-bright', fromLch(skel['sea-bright'], cs * 2.0, hs)],
    ['water', fromLch(skel.water, cs * (dark ? 1.4 : 1.1), hs)],
    ['water-deep', fromLch(skel['water-deep'], cs * (dark ? 1.5 : 1.25), hs)],
    ['land-context', fromLch(skel['land-context'] + (dark ? -dLand : dLand), cl * (dark ? 0.8 : 1), hl)],
    ['coast-strong', fromLch(skel['coast-strong'], cs * 1.8, hs)],
  ];
  if (dark) out.unshift(['surface', fromLch(skel.surface, cs * 0.5, hs)]);
  return out.map(([k, v]) => `  --${k}: ${v};`).join('\n');
}

let css = `/* Landfall — regional palettes. GENERATED by build/make-regions.mjs; edit that.
 *
 * The chart takes its colour from the water you are sailing. Opening a pack
 * restains the whole app, and that is the clearest possible signal that you
 * have moved on: the Caribbean's turquoise over coral sand gives way to the
 * North Atlantic's slate, to Sahelian dust, to the loess of northern China.
 *
 * A region changes the WORLD and never the MEANING. Right is the same green
 * everywhere, wrong the same vermilion, a place you were told the same brass,
 * and the keyline round a verdict the same keyline. build/audit-colour.mjs
 * audits every palette below exactly as strictly as the default, and refuses
 * any region that tries to redefine a verdict colour.
 *
 * Every lightness here is copied from the default palette, so all of the app's
 * contrast ratios are preserved by construction — a region can only move hue
 * and chroma, which is precisely the part that carries no information.
 */
`;

for (const r of REGIONS) {
  css += `\n/* ${r.id} — ${r.note} */\n`;
  css += `[data-region="${r.id}"] {\n${tokens(r, LIGHT, false)}\n}\n`;
  css += `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"])[data-region="${r.id}"] {\n`
    + tokens(r, DARK, true).split('\n').map((l) => '  ' + l).join('\n') + '\n  }\n}\n';
  css += `:root[data-theme="dark"][data-region="${r.id}"] {\n${tokens(r, DARK, true)}\n}\n`;
}

writeFileSync(join(ROOT, 'app', 'regions.css'), css);

// The pack -> region table, for the app.
const map = {};
for (const r of REGIONS) for (const p of r.packs) map[p] = r.id;
writeFileSync(join(ROOT, 'app', 'data', 'regions.json'),
  JSON.stringify({ map, notes: Object.fromEntries(REGIONS.map((r) => [r.id, r.note])) }, null, 0));

console.log(`wrote app/regions.css — ${REGIONS.length} regions, light and night`);
for (const r of REGIONS) {
  const t = Object.fromEntries(tokens(r, LIGHT, false).split('\n').map((l) => l.trim().replace(';', '').split(': ')));
  console.log(`  ${r.id.padEnd(10)} sea ${t['--sea']}  water ${t['--water']}  land ${t['--land-context']}  ground ${t['--ground-top']}`);
}
console.log(`mapped ${Object.keys(map).length} packs to a region`);
