// Landfall — prove Label the Map's two pieces of hidden logic.
//
//   node build/test-sweep.mjs
//
// Name matching and the held-region date arithmetic are both invisible from
// the outside and both easy to get subtly wrong. A matcher that is too strict
// marks "Eleuthra" wrong and the mode is unusable; one that is too loose
// accepts "Cayman" for all three Caymans and the discrimination that makes
// them worth learning is gone. Held is a five-week claim and must not be
// earnable in an afternoon.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'app', 'data');

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = { baseURI: 'file:///landfall/' };
globalThis.window = globalThis;

const realNow = Date.now;
let clock = realNow();
Date.now = () => clock;

const { DB } = await import('../app/js/data.js');
const { State, cardState } = await import('../app/js/schedule.js');
const { normalise, matchName, sweepStatus, recordSweep, sweepSets, GAP_2, GAP_3 } = await import('../app/js/sweep.js');

const core = JSON.parse(readFileSync(join(DATA, 'core.json'), 'utf8'));
DB.core = core;
for (const it of core.items) DB.items.set(it.i, it);
for (const p of core.packs) DB.packs.set(p.id, p);
for (const g of core.groups) DB.groups.set(g.id, g);
DB.byPack = new Map();
for (const it of core.items) for (const p of it.pk) {
  if (!DB.byPack.has(p)) DB.byPack.set(p, []);
  DB.byPack.get(p).push(it);
}
for (const f of readdirSync(join(DATA, 'maps'))) {
  const m = JSON.parse(readFileSync(join(DATA, 'maps', f), 'utf8'));
  DB.maps.set(m.id, m);
}
DB.ready = true;
State.load();

const fails = [];
const fail = (m) => fails.push(m);
const byName = (n) => [...DB.items.values()].find((x) => x.n === n);
const DAY = 24 * 3600e3;

// ── what must be accepted ────────────────────────────────────────────────
const caribbean = DB.byPack.get('caribbean');
const ACCEPT = [
  ['Curacao', 'Curaçao'], ['curaçao', 'Curaçao'],
  ['La Desirade', 'La Désirade'], ['la desirade', 'La Désirade'],
  ['St Kitts', 'Saint Kitts'], ['St. Kitts', 'Saint Kitts'], ['Saint Kitts', 'Saint Kitts'],
  ['Sint Maarten', 'Sint Maarten'], ['St Maarten', 'Sint Maarten'],
  ['Abaco', 'Great Abaco'], ['Great Abaco', 'Great Abaco'],
  ['Exuma', 'Great Exuma'],
  ['Eleuthra', 'Eleuthera'], ['Eleutheria', 'Eleuthera'], ['eleuthera', 'Eleuthera'],
  ['Andros Island', 'Andros'],
  ['Tortuga', 'Île de la Tortue'],
  ['Isle of Youth', 'Isla de la Juventud'],
  ['New Providence Island', 'New Providence'],
  ['Montserat', 'Montserrat'],
  ['Guadaloupe', 'Guadeloupe'],
  ['Marie Galante', 'Marie-Galante'],
  ['Jost van Dyke', 'Jost Van Dyke'],
  ['Roatan', 'Roatán'],
  ['San Andres', 'San Andrés'],
];
for (const [typed, target] of ACCEPT) {
  const it = byName(target);
  if (!it) { fail(`test target "${target}" is not in the corpus`); continue; }
  if (!matchName(typed, it, caribbean)) fail(`"${typed}" was not accepted for ${target}`);
}

// ── what must NOT be accepted ────────────────────────────────────────────
const REJECT = [
  ['South Caicos', 'North Caicos'],
  ['North Caicos', 'Middle Caicos'],
  ['Grand Cayman', 'Little Cayman'],
  ['Little Cayman', 'Cayman Brac'],
  ['Saint Thomas', 'Saint John'],
  ['Saint Lucia', 'Saint Vincent'],
  ['Antigua', 'Barbuda'],
  ['Trinidad', 'Tobago'],
  ['Barbados', 'Barbuda'],
  ['Nevis', 'Saint Kitts'],
  ['Aruba', 'Bonaire'],
  ['Cuba', 'Aruba'],
  ['Grand Bahama', 'Great Abaco'],
  ['Basse-Terre', 'Grande-Terre'],
];
for (const [typed, target] of REJECT) {
  const it = byName(target);
  if (!it) { fail(`test target "${target}" is not in the corpus`); continue; }
  const r = matchName(typed, it, caribbean);
  // An `ambiguous` result is a question, not an acceptance — but none of these
  // should even reach that, because each one answers some OTHER place better.
  if (r) fail(`"${typed}" was wrongly ${r.ambiguous ? 'called ambiguous' : 'accepted'} for ${target}`);
}

// A fragment that fits more than one island in the set must not pass for any
// of them — this is the rule that keeps the Caymans worth learning.
for (const t of ['Cayman Brac', 'Little Cayman', 'Grand Cayman']) {
  const it = byName(t);
  if (it && matchName('Cayman', it, caribbean)) fail(`the bare word "Cayman" was accepted for ${t}`);
}
for (const t of ['North Caicos', 'Middle Caicos', 'South Caicos']) {
  const it = byName(t);
  if (it && matchName('Caicos', it, caribbean)) fail(`the bare word "Caicos" was accepted for ${t}`);
}
// But outside that set it is a perfectly good answer.
const brac = byName('Cayman Brac');
if (brac && !matchName('Cayman Brac', brac, [brac])) fail('the full name failed against a one-item set');

// Nothing empty or trivial gets through.
for (const junk of ['', ' ', 'a', 'x', '??']) {
  if (matchName(junk, byName('Cuba'), caribbean)) fail(`junk input "${junk}" was accepted`);
}

// ── held regions ─────────────────────────────────────────────────────────
const KEY = 'group:test';
const sweepClean = () => recordSweep(KEY, { cleanSweep: true, named: 10, total: 10, failed: [] });
const sweepDirty = (failed = ['Saba']) => recordSweep(KEY, { cleanSweep: false, named: 8, total: 10, failed });

State.data.sweeps = {};
clock = realNow();
sweepClean();
if (sweepStatus(KEY).held) fail('one clean sweep should not hold a region');
// Three clean sweeps in one afternoon must not count.
clock += 20 * 60e3; sweepClean();
clock += 20 * 60e3; sweepClean();
if (sweepStatus(KEY).held) fail('three clean sweeps in an afternoon held the region');
if (sweepStatus(KEY).clean !== 3) fail('clean sweeps were not all counted');

State.data.sweeps = {};
clock = realNow();
sweepClean();
clock += GAP_2 + DAY; sweepClean();
if (sweepStatus(KEY).held) fail('two clean sweeps a week apart held the region');
const waiting = sweepStatus(KEY).waitFor;
if (!(waiting >= 29 && waiting <= 31)) fail(`after the second sweep it should be about 30 days to the third, got ${waiting}`);
clock += GAP_3 + DAY; sweepClean();
const held = sweepStatus(KEY);
if (!held.held) fail('three clean sweeps at expanding gaps did not hold the region');
if (!held.heldSince) fail('a held region has no date');

// Held is revocable, and says what dropped it.
clock += 10 * DAY;
const res = sweepDirty(['Sint Eustatius', 'Marie-Galante']);
if (!res.was.held) fail('the region was not held going into the failed sweep');
if (res.now.held) fail('a failed sweep did not drop a held region');
if (res.now.droppedNames.length !== 2) fail('the dropped region did not record what failed');

// And it can be won back.
clock += DAY; sweepClean();
if (sweepStatus(KEY).droppedAt) fail('a later clean sweep did not clear the dropped mark');

// ── set selection ────────────────────────────────────────────────────────
State.data.sweeps = {};
State.data.cards = {};
let sets = sweepSets(['caribbean']);
if (!sets.length) fail('no sweepable sets at all');
if (sets.some((s) => s.ready)) fail('a set was offered as ready with nothing met');
if (sets.some((s) => s.members.length < 4)) fail('a set smaller than four features was offered');
// The Bahamas must not be a target in a set that also names its islands.
const pack = sets.find((s) => s.key === 'pack:caribbean');
if (pack && pack.members.some((m) => m.i === 'c:BS')) {
  fail('the Bahamas is a target in the same sweep as its own islands');
}
// Meeting most of a group opens it.
const lee = DB.groups.get('leeward-islands');
for (const id of lee.members) {
  State.data.cards[id + '|place'] = { iv: 3, e: 2.2, reps: 2, lapses: 0, due: Date.now(), last: Date.now(), st: 'review', step: 0, ok: true, lapseRep: -9 };
}
sets = sweepSets(['caribbean']);
const leeSet = sets.find((s) => s.key === 'group:leeward-islands');
if (!leeSet) fail('the Leeward Islands is not offered as a set');
else if (!leeSet.ready) fail(`the Leewards did not open with ${leeSet.met} of ${leeSet.members.length} met`);
// A contested member is not smuggled in as a target.
if (leeSet && leeSet.members.some((m) => m.i === 'c:DM')) {
  fail('Dominica, whose membership is contested, is a sweep target for the Leewards');
}
// Ready sets sort to the top.
if (sets[0] && !sets[0].ready) fail('a ready set did not sort above the unready ones');

// SOUNDS RIGHT, SPELLED WRONG. Edit distance forgives typos and nothing else;
// these are the errors dyslexia actually produces, and every one of them was
// marked wrong before the phonetic pass existed.
const SOUNDS = [
  ['Anteega', 'Antigua'], ['Beckway', 'Bequia'], ['Musteek', 'Mustique'],
  ['Mayrow', 'Mayreau'], ['Carrycoo', 'Carriacou'], ['Kurasow', 'Curaçao'],
  ['Gwadaloop', 'Guadeloupe'], ['Saber', 'Saba'], ['Barboooda', 'Barbuda'],
  ['Martineek', 'Martinique'], ['Domineeka', 'Dominica'],
];
let heard = 0;
for (const [typed, target] of SOUNDS) {
  const it = byName(target);
  if (!it) { fail(`test target "${target}" is not in the corpus`); continue; }
  const r = matchName(typed, it, caribbean);
  if (!r) fail(`"${typed}" was rejected for ${target} — it is how the name sounds`);
  else if (r.ambiguous) fail(`"${typed}" was called ambiguous for ${target}`);
  else heard++;
}

// TORN, NOT WRONG. Sint Maarten and Saint Martin are two halves of one island
// under two flags and normalise to within two edits of each other, so a single
// slip sits equally close to both. That must ask, never mark.
for (const [typed, a, b] of [
  ['Sint Marten', 'Sint Maarten', 'Saint Martin'],
  ['St Marten', 'Saint Martin', 'Sint Maarten'],
]) {
  const it = byName(a);
  if (!it) { fail(`test target "${a}" is not in the corpus`); continue; }
  const r = matchName(typed, it, caribbean);
  if (!r?.ambiguous) fail(`"${typed}" did not offer a choice for ${a}`);
  else if (!r.ambiguous.some((o) => o.n === b)) fail(`"${typed}" offered a choice without ${b}`);
}

console.log(`sounds-like matching: ${heard} of ${SOUNDS.length} phonetic spellings accepted, 2 near-identical pairs ask which`);
console.log(`name matching: ${ACCEPT.length} accepted, ${REJECT.length} rejected, fragment rules checked`);
console.log(`sets from the Caribbean pack: ${sets.length} (${sets.filter((s) => s.ready).length} ready)`);
console.log('\n' + (fails.length ? fails.length + ' FAILURES' : 'Label the Map holds up'));
for (const f of fails) console.log('  x ' + f);
process.exit(fails.length ? 1 : 0);
