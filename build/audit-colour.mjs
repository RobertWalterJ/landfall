// Landfall — does the palette still carry its information without colour?
//
//   node build/audit-colour.mjs            report, and fail on any loss
//   node build/audit-colour.mjs --full     every check, including the passes
//
// It reads the tokens straight out of app/styles.css, so it audits what ships
// rather than a copy of it that can drift.
//
// THE RULE THIS ENFORCES. Two things the app needs you to tell apart must be
// separated by something that is not hue. There are two ways to earn that:
//
//   CHANNEL 'lightness'  the two colours differ in luminance by at least 3:1.
//                        This is the strong form — it survives every colour
//                        vision including none at all — and it is required
//                        wherever colour is the ONLY difference between two
//                        marks: two dots of the same size, two fills on a map.
//
//   CHANNEL 'shape'      a fill, an outline or a glyph already carries the
//                        meaning, so the colour is reinforcement. The bar here
//                        is that the two stay visibly different colours under
//                        every vision (CIEDE2000 >= 15), so a dichromat still
//                        gets the reinforcement rather than two swatches that
//                        look identical.
//
//   CHANNEL 'tint'       the meaning is in WORDS — the sheet says "Right" or
//                        "Not quite" above a tick or a cross — and the colour
//                        is atmosphere. Two pale washes cannot be pulled 15
//                        apart without one of them going muddy, and they do not
//                        need to be. The bar is only that they are not the same
//                        colour (CIEDE2000 >= 6).
//
// A 'shape' or 'tint' claim is not free. Whenever this file says a cue carries
// the meaning, there is also a 'lightness' pair below proving that cue is
// itself visible — the keyline against the fill it is drawn on, the coastline
// against the sea. Otherwise the classification would just be a way of
// excusing a failure.
//
// Text is checked separately, against the surface behind it, at WCAG AA.
//
// The point is NOT to arrive at a safe, desaturated palette. It is to let the
// palette be as regional and as saturated as it likes — Caribbean water,
// Sahelian dust, Canadian granite — while proving nothing rides on hue alone.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, over, contrast, deltaE, simulate, VISIONS } from './lib/colour.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Both stylesheets, so the regional palettes are audited as strictly as the
// default one. (No separator needed: styles.css ends with a newline.)
const src = [
  readFileSync(join(ROOT, 'app', 'styles.css'), 'utf8'),
  readFileSync(join(ROOT, 'app', 'regions.css'), 'utf8'),
].join('');
const FULL = process.argv.includes('--full');

// -- pull the token blocks out of the stylesheet -------------------------
function block(selector, optional) {
  // A literal selector, not a pattern: escaping CSS selectors into regexes is
  // its own small nightmare and buys nothing here.
  const at = src.indexOf(selector + ' {');
  if (at < 0) {
    if (optional) return {};
    throw new Error('could not find token block: ' + selector);
  }
  const from = src.indexOf('{', at) + 1;
  let depth = 1, i = from;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  const out = {};
  for (const [, k, v] of src.slice(from, i - 1).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}

const light = block(':root');
const dark = { ...light, ...block(':root[data-theme="dark"]') };

// Region palettes override a handful of tokens each. Every one of them is
// audited exactly as strictly as the default, which is the whole reason a
// region is allowed its own colours at all.
const regions = {}, regionOwn = {}, regionsDark = {};
for (const m of src.matchAll(/\[data-region="([\w-]+)"\] \{/g)) {
  const id = m[1];
  if (regions[id]) continue;
  const own = block('[data-region="' + id + '"]');
  regionOwn[id] = own;
  regions[id] = { ...light, ...own };
  regionsDark[id] = { ...dark, ...block(':root[data-theme="dark"][data-region="' + id + '"]', true) };
}

// -- resolve a token to an rgb triple ------------------------------------
function colourOf(tokens, name, onto) {
  let v = tokens[name];
  if (!v) throw new Error('no such token: ' + name);
  let guard = 0;
  while (v.startsWith('var(') && guard++ < 8) v = (tokens[v.slice(4, v.indexOf(')'))] || v).trim();
  const rgba = v.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/);
  if (rgba) {
    const rgb = [rgba[1], rgba[2], rgba[3]].map((n) => Number(n) / 255);
    const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
    return a === 1 ? rgb : over(rgb, a, onto);
  }
  return parse(v);
}

// -- what must stay tellable apart ---------------------------------------
// `channel` is how the meaning is carried once hue is gone (see the header).
const PAIRS = [
  // -- hue is the ONLY channel ------------------------------------------
  { a: '--land-shaky', b: '--land-known', channel: 'lightness',
    where: 'the home chart: an island you are working on against one you know — two solid fills' },
  { a: '--coast', b: '--water', channel: 'lightness', onto: '--water',
    where: 'the coastline against the sea — this is what makes an island visible at all' },
  { a: '--coast', b: '--land-context', channel: 'lightness', onto: '--land-context',
    where: 'the coastline against the land it encloses' },
  { a: '--coast-strong', b: '--ground-top', channel: 'lightness',
    where: 'the home chart: the outline of an island you have never met, against the ground' },
  { a: '--land-unseen', b: '--surface', channel: 'lightness',
    where: 'the hollow "not met" pip, drawn as a ring on a card' },
  // The keylines that carry right / wrong / given on the map must themselves
  // be legible on the fill they are drawn over, or the claim below is empty.
  { a: '--mark-line', b: '--verdigris', channel: 'lightness',
    where: 'the solid keyline round the right answer, on its own fill' },
  { a: '--mark-line', b: '--vermilion', channel: 'lightness',
    where: 'the dashed keyline round the place you actually hit' },
  { a: '--mark-line', b: '--brass-mark', channel: 'lightness',
    where: 'the dotted keyline round a place you were told' },

  // -- a fill, outline or glyph carries it; colour reinforces -------------
  { a: '--verdigris', b: '--vermilion', channel: 'shape',
    where: 'dots (solid / hollow), options (tick / cross plus a strike-through), map (solid / dashed keyline)' },
  { a: '--verdigris', b: '--brass-mark', channel: 'shape',
    where: 'pack pips: known is a solid disc, met is a heavy ring' },
  { a: '--vermilion', b: '--brass-mark', channel: 'shape',
    where: 'map keylines: dashed for what you hit, dotted for what you were told' },
  { a: '--land-known', b: '--brass-mark', channel: 'shape',
    where: 'Label the Map: what you named (solid ink) against what you were given (dotted)' },

  // -- words carry it; colour is atmosphere ------------------------------
  { a: '--wash-right', b: '--wash-wrong', channel: 'tint',
    where: 'the wash behind the verdict heading and its tick or cross' },
];

// Text that has to be readable, and what it sits on.
const TEXT = [
  { fg: '--ink', bg: '--surface', where: 'place names, questions, numbers' },
  { fg: '--ink-2', bg: '--surface', where: 'supporting sentences' },
  { fg: '--ink-3', bg: '--surface', where: 'row subtitles, the version line' },
  { fg: '--ink-3', bg: '--ground-top', where: 'labels straight on the ground' },
  { fg: '--ink', bg: '--surface-sunk', where: 'sunk panels' },
  { fg: '--ink', bg: '--surface-tint', where: 'tinted panels' },
  { fg: '--brass', bg: '--surface', where: '"met, not known" said in words' },
  { fg: '--sea', bg: '--surface', where: 'links and tappable text' },
  { fg: '--verdigris', bg: '--wash-right', where: 'the right-answer sheet' },
  { fg: '--vermilion', bg: '--wash-wrong', where: 'the wrong-answer sheet' },
];

const MIN_LIGHTNESS = 3.0;        // ratio between the two marks themselves
const MIN_DELTA_E = 15;           // perceptual difference under every vision
const MIN_TINT = 6;               // atmosphere: different, but words carry the meaning
const MIN_TEXT = 4.5;             // WCAG 2.1 AA, body size
const problems = [];
const rows = [];

function auditTheme(label, tokens) {
  const surface = colourOf(tokens, '--surface', [1, 1, 1]);
  for (const p of PAIRS) {
    const under = p.onto ? colourOf(tokens, p.onto, surface) : surface;
    const A = colourOf(tokens, p.a, under), B = colourOf(tokens, p.b, under);
    const ratio = contrast(A, B);
    // The weakest CIEDE2000 across every vision. Greyscale is excluded here
    // because for a 'shape' pair the glyph is what carries it once colour is
    // gone entirely — that case is covered by the lightness rule instead.
    let worst = Infinity, worstVision = '';
    for (const v of VISIONS) {
      if (v === 'greyscale') continue;
      const d = deltaE(simulate(A, v), simulate(B, v));
      if (d < worst) { worst = d; worstVision = v; }
    }
    const need = p.channel === 'tint' ? MIN_TINT : MIN_DELTA_E;
    const ok = p.channel === 'lightness' ? ratio >= MIN_LIGHTNESS : worst >= need;
    rows.push({ label, name: `${p.a} / ${p.b}`, channel: p.channel, ratio, worst, worstVision, ok });
    if (!ok) {
      problems.push(p.channel === 'lightness'
        ? `${label}: ${p.a} and ${p.b} differ by only ${ratio.toFixed(2)}:1 in lightness (need ${MIN_LIGHTNESS}:1)\n`
          + `      ${p.where}\n`
          + `      Hue is the only thing telling these apart, so anyone who cannot separate those\n`
          + `      hues — or anyone outdoors in bright sun — loses the distinction completely.`
        : `${label}: ${p.a} and ${p.b} collapse to deltaE ${worst.toFixed(1)} under ${worstVision} (need ${MIN_DELTA_E})\n`
          + `      ${p.where}`.replace('deltaE ' + worst.toFixed(1), 'deltaE ' + worst.toFixed(1)));
    }
  }
  for (const t of TEXT) {
    const under = t.bg.includes('ground') ? colourOf(tokens, '--ground-top', [1, 1, 1]) : surface;
    const B = colourOf(tokens, t.bg, under);
    const A = colourOf(tokens, t.fg, B);
    const ratio = contrast(A, B);
    const ok = ratio >= MIN_TEXT;
    rows.push({ label, name: `${t.fg} on ${t.bg}`, channel: 'text', ratio, worst: null, ok });
    if (!ok) problems.push(`${label}: ${t.fg} on ${t.bg} is ${ratio.toFixed(2)}:1, below WCAG AA ${MIN_TEXT}:1 — ${t.where}`);
  }
}

// A region may restain the world. It may not redefine what a colour MEANS —
// right, wrong, "you were told this", and the keyline that carries all three
// have to be the same everywhere, or travelling would mean relearning the
// interface. This is the rule; the palettes above are just where it is applied.
const FIXED = ['--verdigris', '--vermilion', '--brass-mark', '--brass', '--mark-line', '--land-known'];
for (const [name, tokens] of Object.entries(regionOwn)) {
  for (const t of FIXED) {
    if (tokens[t]) problems.push(`region ${name} redefines ${t}. A region changes the world, never the meaning:
`
      + `      right, wrong and "you were told this" must be the same colour in every part of the atlas.`);
  }
}

auditTheme('light', light);
auditTheme('dark', dark);
for (const [name, tokens] of Object.entries(regions)) auditTheme('region: ' + name, tokens);
for (const [name, tokens] of Object.entries(regionsDark)) auditTheme('region: ' + name + ' (night)', tokens);

// -- report ---------------------------------------------------------------
let last = '';
for (const r of rows) {
  if (!FULL && r.ok) continue;
  if (r.label !== last) { console.log('\n' + r.label); last = r.label; }
  const num = (r.channel === 'shape' || r.channel === 'tint')
    ? `dE ${r.worst.toFixed(1)} (${r.worstVision})` : `${r.ratio.toFixed(2)}:1`;
  console.log(`  ${r.ok ? 'ok ' : 'X  '} ${r.name.padEnd(36)} ${num.padEnd(24)} ${r.channel}`);
}

console.log('');
if (problems.length) {
  console.error(`colour audit FAILED — ${problems.length} place(s) where meaning rides on hue alone:\n`);
  for (const p of problems) console.error('  x ' + p + '\n');
  process.exit(1);
}
console.log(`colour audit passed — ${rows.length} checks across ${2 + Object.keys(regions).length * 2} palettes.`);
console.log('Nothing depends on hue alone, under deuteranopia, protanopia, tritanopia, or no colour at all.');
