// Landfall — does playing it actually make you better?
//
//   node build/test-round.mjs
//
// The engine test proves individual questions are sound. This one plays the
// game: a simulated learner, whose chance of getting a card right rises with
// how often they have seen it, plays daily sessions over a simulated eight
// weeks. What we are checking is that the scheduler converges — that mastery
// goes up, that the shaky set stays bounded rather than piling up into a wall
// of reviews, and that the whole pack eventually gets introduced.

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
globalThis.fetch = async (u) => {
  const p = String(u).replace('file:///landfall/', '');
  return { ok: true, json: async () => JSON.parse(readFileSync(join(ROOT, 'app', p), 'utf8')) };
};

// A virtual clock, so eight weeks pass in a second.
const realNow = Date.now;
let clock = realNow();
Date.now = () => clock;

// A SEEDED learner, so a failure means something.
//
// The scheduler picks with Math.random in several places, so an unseeded run
// gave a different answer every time and the thresholds below had to be set
// loose enough to clear the low tail. That made the suite cry wolf on good
// code and — worse — let a real back-to-back-question bug hide inside the
// noise for several runs at a time. Seeding it costs four lines and makes
// every number here reproducible; the seed is reset per scenario so results
// do not depend on what ran before. Pass a different seed to sample the
// distribution:  node build/test-round.mjs 7
const SEED = Number(process.argv[2] || 1);
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const reseed = () => { Math.random = mulberry32(SEED); };
reseed();

const { DB } = await import('../app/js/data.js');
const { facetsFor } = await import('../app/js/engine.js');
const { State, cardState, KNOWN_AT } = await import('../app/js/schedule.js');
const { Round } = await import('../app/js/session.js');

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
DB.childrenOf = new Map();
for (const f of readdirSync(join(DATA, 'maps'))) {
  const m = JSON.parse(readFileSync(join(DATA, 'maps', f), 'utf8'));
  DB.maps.set(m.id, m);
}
DB.ready = true;

const fails = [];
const fail = (m) => fails.push(m);

// How likely our learner is to get a card right, given how well they know it.
// Deliberately imperfect: 55% on first sight, and never certain.
let SKILL = 0.5;                     // chance on first sight
function willGetRight(itemId, facet) {
  const c = State.card(itemId, facet);
  const iv = c ? c.iv : 0;
  const reps = c ? c.reps : 0;
  const p = Math.min(0.97, SKILL + Math.min(Math.log(1 + iv) / Math.log(60), 1) * 0.28 + Math.min(reps, 6) * 0.03);
  return Math.random() < p;
}

async function simulate(packId, days, perDay) {
  State.reset();
  reseed();                            // each scenario starts from the same draw
  const history = [];
  for (let day = 0; day < days; day++) {
    clock = realNow() + day * 24 * 3600e3 + 9 * 3600e3;
    const round = new Round({ packIds: [packId], length: perDay, mode: 'quick' });
    await round.warm();
    const seenThisRound = new Map();
    let lastKey = null;
    let q;
    while ((q = round.next())) {
      const key = q.itemId + '|' + q.facet + '|' + q.kind;
      // A lapse is allowed to repeat the card, but not the identical question.
      // A card in its learning steps, or one just missed, is meant to come back
      // — but never as the same question twice running, and never more than
      // twice in a round. (A facet with only two kinds cannot do better.)
      if (lastKey === key) fail(`${packId}: the same question ran back to back (${key})`);
      if (q.form === 'recall' && !q.correctId) fail(`${packId}: a recall question had nothing to match against`);
      seenThisRound.set(key, (seenThisRound.get(key) || 0) + 1);
      // Legitimate: first sight, +3, +9, plus a requeue if it is missed again.
      if (seenThisRound.get(key) > 4) fail(`${packId}: the same question ran ${seenThisRound.get(key)}x in one round (${key})`);
      lastKey = key;
      const right = willGetRight(q.itemId, q.facet);
      const choice = right
        ? q.correctId
        // A free-recall miss is a blank, not a wrong option: there is nothing
        // to pick, so it is graded as null exactly as the app does.
        : (q.form === 'recall' ? null
          : q.form === 'map' ? q.map.candidates.find((c) => !c.correct).id
            : q.options.find((o) => !o.correct).id);
      round.answer(choice);
      clock += 25e3;                    // 25 seconds a question
    }
    const pool = DB.byPack.get(packId);
    const facetsOf = (it) => facetsFor(it, { pool, cruel: false, kinds: null, preferMap: DB.packs.get(packId).map });
    let cards = 0, shaky = 0, mastered = 0; const touched = new Set();
    for (const it of pool) {
      for (const f of facetsOf(it)) {
        const c = State.card(it.i, f);
        if (!c || c.st === 'new') continue;
        cards++;
        touched.add(it.i);
        if (c.iv < KNOWN_AT) shaky++; else mastered++;
      }
    }
    history.push({
      day: day + 1,
      pct: State.packLedger(pool, facetsOf).pct,
      known: State.packLedger(pool, facetsOf).itemsKnown,
      items: touched.size,
      cards, shaky, mastered,
      right: round.summary().right,
      asked: round.summary().asked,
    });
  }
  return history;
}

function report(name, h) {
  const last = h[h.length - 1];
  const mid = h[Math.floor(h.length / 2)];
  console.log(`\n${name}`);
  console.log('  day   mastery   items met   named   cards   learning   known   score');
  for (const d of [h[0], h[4], h[13], mid, last].filter(Boolean)) {
    console.log(`  ${String(d.day).padStart(3)}   ${(d.pct * 100).toFixed(1).padStart(6)}%   ${String(d.items).padStart(9)}   ${String(d.known).padStart(5)}   ${String(d.cards).padStart(5)}   ${String(d.shaky).padStart(8)}   ${String(d.mastered).padStart(5)}   ${d.right}/${d.asked}`);
  }
  return last;
}

// ── the runs ─────────────────────────────────────────────────────────────
const caribbean = await simulate('caribbean', 56, 14);
const last = report('Caribbean · 14 questions a day for 8 weeks', caribbean);

if (last.pct <= caribbean[0].pct) fail('Caribbean mastery did not rise over eight weeks');
// Deliberately not a target percentage. The frontier caps how many places are
// unsettled at once and reviews take most of a 14-question round, so eight
// weeks is early: what has to be true is that it keeps moving and never stalls.
if (last.items < 18) fail(`only ${last.items} Caribbean places met in eight weeks`);
if (caribbean[55].pct <= caribbean[27].pct) fail('Caribbean mastery stalled in the second month');
const peakShaky = Math.max(...caribbean.map((d) => d.shaky));
if (peakShaky > 70) fail(`the learning pile grew to ${peakShaky} cards — the frontier is not holding`);


const canada = await simulate('canada', 28, 12);
report('Canada · 12 questions a day for 4 weeks', canada);
// Thirteen units: all of them should have been met inside a fortnight, and
// mastery should still be climbing at four weeks rather than plateauing.
if (canada[13].items < 13) fail(`only ${canada[13].items} of 13 Canadian units met in two weeks`);
if (canada[27].pct <= canada[13].pct) fail('Canada plateaued between weeks two and four');

const world = await simulate('countries-world', 56, 20);
report('Countries of the world · 20 a day for 8 weeks', world);
// Meeting the world is deliberately slow: the frontier caps how many places
// are unsettled at once, and reviews of what is already met take most of a
// 20-question round. What matters is that it keeps moving and that the pack
// does not stall.
// A floor, not a target. The simulation is stochastic — repeated runs land
// between about 27 and 35 — so this catches a real regression and not the low
// tail of a normal run. The stall check below is the assertion that matters.
if (world[world.length - 1].items < 24) fail(`only ${world[world.length - 1].items} countries met in eight weeks`);
if (world[world.length - 1].items <= world[27].items) fail('country introduction stalled in the second month');

// Someone who already half-knows the material — which is the actual case here:
// he could name every Leeward island as a child. Cards graduate faster, so the
// frontier opens faster and the pack should move visibly quicker.
SKILL = 0.75;
const rusty = await simulate('caribbean', 56, 14);
report('Caribbean · someone who already half-knows it', rusty);
if (rusty[55].items <= last.items) fail('a stronger learner did not meet more places than a weaker one');
// Someone who half-knows the Caribbean should meet most of it in two months.
if (rusty[55].items < 55) fail(`a strong learner met only ${rusty[55].items} of 88 places in eight weeks`);
SKILL = 0.5;

// Training mode must not run away: it has no length, so it ends when the
// scheduler runs dry. Check it terminates on a small pack.
clock = realNow();
State.reset();
const t = new Round({ packIds: ['canada'], mode: 'training' });
await t.warm();
let n = 0;
while (t.next() && n < 4000) { t.answer(t.current.correctId); n++; }
if (n >= 4000) fail('training mode never ended on a 13-item pack');
console.log(`\ntraining on Canada ran ${n} questions before the pool was exhausted`);

console.log('\n' + (fails.length ? fails.length + ' FAILURES' : 'the learning loop converges'));
for (const f of fails) console.log('  x ' + f);
process.exit(fails.length ? 1 : 0);
