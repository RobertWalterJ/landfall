// Landfall — prove the question engine before anyone plays it.
//
//   node build/test-engine.mjs
//
// A quiz that ships a question with two right answers, or four options that
// all say the same thing, is worse than useless — it teaches the wrong thing
// and you cannot tell from playing a few rounds. So every kind is generated
// thousands of times against the real corpus and checked against the
// invariants that must hold for ALL of them.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'app', 'data');

// Minimal browser surface so the app modules load unchanged.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = { baseURI: 'file:///landfall/' };

const { DB } = await import('../app/js/data.js');
const { KINDS, buildQuestion, facetsFor, kindsFor } = await import('../app/js/engine.js');
const { State, Scheduler, cardState, cardScore } = await import('../app/js/schedule.js');

// Load the corpus the way the app would, but straight off disk.
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
for (const it of core.items) {
  if (!it.pr) continue;
  if (!DB.childrenOf.has(it.pr)) DB.childrenOf.set(it.pr, []);
  DB.childrenOf.get(it.pr).push(it);
}
for (const f of readdirSync(join(DATA, 'maps'))) {
  const m = JSON.parse(readFileSync(join(DATA, 'maps', f), 'utf8'));
  DB.maps.set(m.id, m);
}
DB.ready = true;
State.load();

const fails = [];
const fail = (msg, q) => fails.push(msg + (q ? `  [${q.kind} · ${q.itemId} · "${q.prompt}"]` : ''));

// ── invariants every question must satisfy ───────────────────────────────
function check(q, it, pack) {
  if (!q) return;
  if (!q.prompt || q.prompt.includes('undefined') || q.prompt.includes('null')) fail('prompt is broken', q);
  if (q.form === 'map') {
    const cands = q.map.candidates;
    if (cands.length !== 4) fail('map question has ' + cands.length + ' candidates', q);
    if (cands.filter((c) => c.correct).length !== 1) fail('map question has ' + cands.filter((c) => c.correct).length + ' correct', q);
    if (new Set(cands.map((c) => c.id)).size !== cands.length) fail('map candidate repeated', q);
    const m = DB.maps.get(q.map.id);
    if (!m) fail('map ' + q.map.id + ' does not exist', q);
    else for (const c of cands) if (!m.f[c.id]) fail('candidate ' + c.id + ' is not on map ' + q.map.id, q);
    if (!cands.some((c) => c.correct && c.id === it.i)) fail('map answer is not the item asked about', q);
  } else {
    if (q.options.length !== 4) fail('has ' + q.options.length + ' options', q);
    if (q.options.filter((o) => o.correct).length !== 1) fail('has ' + q.options.filter((o) => o.correct).length + ' correct options', q);
    if (new Set(q.options.map((o) => o.label)).size !== 4) fail('duplicate option labels: ' + q.options.map((o) => o.label).join(' / '), q);
    if (new Set(q.options.map((o) => o.id)).size !== 4) fail('duplicate option ids', q);
    if (q.options.some((o) => o.label == null || o.label === '')) fail('empty option label', q);
    const correct = q.options.find((o) => o.correct);
    if (correct.id !== q.correctId) fail('correctId does not match the correct option', q);
    if (q.form === 'flags' && q.options.some((o) => !o.flag)) fail('flag option without a flag', q);
  }
  // The prompt must not contain the answer — but only where the answer IS the
  // text. "Where is Cuba?" naming Cuba is the question, not a leak.
  if (q.form === 'options' && q.answerLabel && q.kind !== 'capital-is'
      && q.prompt.includes(q.answerLabel)) {
    fail('prompt gives away the answer: ' + q.answerLabel, q);
  }
}

// Kind-specific truths.
function checkKind(q, it) {
  if (!q) return;
  if (q.kind === 'group-member' || q.kind === 'odd-one-out') {
    const g = [...DB.groups.values()].find((x) => q.explain && x.blurb === q.explain);
    if (g) {
      const inside = new Set([...g.members, ...(g.contested || [])]);
      for (const o of q.options) {
        const isMember = inside.has(o.id);
        if (q.kind === 'group-member' && o.correct && !isMember) fail('group answer is not a member of ' + g.id, q);
        if (q.kind === 'group-member' && !o.correct && isMember) fail('group distractor IS a member of ' + g.id + ': ' + o.label, q);
        // Contested members must never be the answer in either direction.
        if ((g.contested || []).includes(o.id)) fail('contested member used as an option: ' + o.label + ' in ' + g.id, q);
      }
    }
  }
  if (q.kind === 'capital-of') {
    const correct = q.options.find((o) => o.correct);
    if (correct.label !== it.cap) fail('capital-of answer is not the capital', q);
  }
  if (q.kind === 'border') {
    const answer = q.options.find((o) => o.correct);
    const iso = DB.items.get(answer.id)?.x?.i2;
    if (!it.x.bd.includes(iso)) fail('border answer is not a neighbour', q);
    for (const o of q.options) {
      if (o.correct) continue;
      const oiso = DB.items.get(o.id)?.x?.i2;
      if (it.x.bd.includes(oiso)) fail('border distractor IS a neighbour: ' + o.label, q);
    }
  }
  if (q.kind === 'largest') {
    const answer = DB.items.get(q.options.find((o) => o.correct).id);
    for (const o of q.options) {
      const other = DB.items.get(o.id);
      if (other && other.x.pop > answer.x.pop) fail('largest answer is not the largest', q);
    }
  }
}

// ── generate ─────────────────────────────────────────────────────────────
const packsToTest = core.packs.map((p) => p.id);
const counts = {};
const byPack = {};
let built = 0, attempted = 0;

for (const packId of packsToTest) {
  const pool = DB.byPack.get(packId) || [];
  if (!pool.length) { fail('pack ' + packId + ' is empty'); continue; }
  const pk = DB.packs.get(packId);
  // detail on, so the opt-in `facts` kinds are exercised too.
  const ctx = { pool, cruel: false, kinds: null, detail: true, preferMap: pk.map };
  byPack[packId] = { n: 0, kinds: new Set(), items: pool.length };

  // Every item, every facet it supports, several times over.
  const reps = pool.length > 200 ? 1 : pool.length > 60 ? 2 : 4;
  for (let r = 0; r < reps; r++) {
    for (const it of pool) {
      for (const facet of facetsFor(it, ctx)) {
        attempted++;
        const q = buildQuestion(it, facet, ctx);
        if (!q) continue;
        built++;
        counts[q.kind] = (counts[q.kind] || 0) + 1;
        byPack[packId].n++;
        byPack[packId].kinds.add(q.kind);
        check(q, it, pk);
        checkKind(q, it);
      }
    }
  }
}

// Cruel mode must not change any invariant.
for (const packId of ['caribbean', 'countries-world', 'canada', 'usa', 'china', 'countries-africa']) {
  const pool = DB.byPack.get(packId) || [];
  const ctx = { pool, cruel: true, kinds: null, detail: true, preferMap: DB.packs.get(packId)?.map };
  for (const it of pool) {
    for (const facet of facetsFor(it, ctx)) {
      const q = buildQuestion(it, facet, ctx);
      if (!q) continue;
      built++;
      check(q, it);
      checkKind(q, it);
    }
  }
}

// The `facts` layer is opt-in: with it off, no currency/language/demonym
// question may be generated at all.
{
  const pool = DB.byPack.get('countries-world');
  const off = { pool, cruel: false, kinds: null, detail: false, preferMap: 'world' };
  for (const it of pool.slice(0, 60)) {
    for (const facet of facetsFor(it, off)) {
      const q = buildQuestion(it, facet, off);
      if (q && ['currency', 'language', 'demonym', 'region', 'largest'].includes(q.kind)) {
        fail('the detail layer is off but a ' + q.kind + ' question was built', q);
      }
    }
  }
}

// ── scheduler behaviour ──────────────────────────────────────────────────
function schedulerChecks() {
  const pool = DB.byPack.get('caribbean');
  const ctx = { pool, cruel: false, kinds: null, detail: true, preferMap: 'caribbean' };
  const groupById = DB.groups;
  const mk = () => new Scheduler(pool, (it) => facetsFor(it, ctx), { groupById });
  const DAY = 24 * 3600e3;

  // The scaffold rule: the first places introduced are the frame — the big
  // islands that everything else is positioned against — never a curated islet.
  State.reset();
  const s1 = mk();
  const opening = [];
  for (let i = 0; i < 6; i++) {
    const p = s1.next();
    if (!p) break;
    opening.push(p.item);
    State.answer(p.itemId, p.facet, true);
  }
  if (!opening.length) fail('the scheduler produced nothing on a fresh profile');
  for (const it of opening) {
    if (it.k === 'island' && it.pr) {
      const pc = State.card(it.pr, 'place');
      if (!pc) fail('introduced the island ' + it.n + ' before its parent ' + it.pr);
    }
  }
  if (opening[0] && opening[0].t > 2) fail('the round opened on a tier ' + opening[0].t + ' place');

  // A facet does not open until the one before it is five days old.
  State.reset();
  const s2 = mk();
  const cuba = pool.find((p) => p.i === 'c:CU');
  const order = s2.supported(cuba);
  if (order[0] !== 'place') fail('Cuba is not introduced by where it is (got ' + order[0] + ')');
  if (s2.facetOpen(cuba, order[1])) fail('a second facet was open before the first had any card');
  State.data.cards['c:CU|place'] = { iv: 2, e: 2.2, reps: 2, lapses: 0, due: Date.now() + DAY, last: Date.now(), st: 'review', step: 0, ok: true, lapseRep: -9 };
  if (s2.facetOpen(cuba, order[1])) fail('a second facet opened at a two-day interval');
  State.data.cards['c:CU|place'].iv = 6;
  if (!s2.facetOpen(cuba, order[1])) fail('a second facet did not open at a six-day interval');

  // Reviews come back most overdue first.
  State.reset();
  const s3 = mk();
  const t = Date.now();
  const marks = pool.slice(0, 5);
  marks.forEach((it, i) => {
    State.data.cards[it.i + '|place'] = { iv: 4, e: 2.2, reps: 3, lapses: 0, due: t - (5 - i) * 3600e3, last: t - 9e6, st: 'review', step: 0, ok: true, lapseRep: -9 };
  });
  const first = s3.next();
  if (first.itemId !== marks[0].i) fail('most overdue card was not asked first (' + first.itemId + ' vs ' + marks[0].i + ')');

  // A miss comes back inside the same round.
  State.reset();
  const s4 = mk();
  const q = s4.next();
  s4.missed(q.itemId, q.facet);
  let again = false;
  for (let i = 0; i < 6; i++) {
    const p = s4.next();
    if (p && p.itemId === q.itemId && p.facet === q.facet) { again = true; break; }
  }
  if (!again) fail('a missed card never came back in the same round');

  // The frontier closes: never learn anything and new material must stop.
  State.reset();
  const s5 = mk();
  for (let i = 0; i < 60; i++) {
    const p = s5.next();
    if (!p) break;
    State.answer(p.itemId, p.facet, false);
  }
  if (s5.learningCount() < 8) fail('frontier test did not produce enough places in learning (' + s5.learningCount() + ')');
  if (s5.frontierOpen() && s5.learningCount() >= 10) fail('the frontier stayed open at ' + s5.learningCount() + ' places in learning');

  // A miss multiplies rather than resets: a 60-day card comes back at 21, not
  // at the bottom of the ladder.
  State.reset();
  State.data.cards['c:CU|place'] = { iv: 60, e: 2.2, reps: 6, lapses: 0, due: Date.now(), last: 0, st: 'review', step: 0, ok: true, lapseRep: -9 };
  State.answer('c:CU', 'place', false, 'c:JM');
  const lapsed = State.card('c:CU', 'place');
  if (lapsed.st !== 'relearning') fail('a missed review did not go to relearning');
  if (Math.abs(lapsed.e - 1.95) > 0.001) fail('ease did not fall by 0.25 on a miss (got ' + lapsed.e + ')');
  State.answer('c:CU', 'place', true);
  const back = State.card('c:CU', 'place');
  if (back.iv !== 21) fail('a lapsed 60-day card came back at ' + back.iv + ' days, expected 21');

  // The confusion key is symmetric, and clearing leaves a residual.
  State.reset();
  State.answer('c:LC', 'place', false, 'c:VC');
  State.answer('c:VC', 'place', false, 'c:LC');
  if (State.confusionWeight('c:LC', 'c:VC') < 2) fail('a both-ways confusion did not reach the threshold');
  if (!State.confusions().some((x) => x.a.includes('LC') || x.b.includes('LC'))) fail('the confusion was not listed');
  State.clearConfusion('c:LC', 'c:VC');
  if (State.confusionWeight('c:LC', 'c:VC') !== 0.5) fail('clearing a confusion did not leave a residual weight');

  // Practice must not advance an interval.
  State.reset();
  State.data.cards['c:CU|place'] = { iv: 10, e: 2.2, reps: 4, lapses: 0, due: Date.now() + 9 * DAY, last: 0, st: 'review', step: 0, ok: true, lapseRep: -9 };
  State.answer('c:CU', 'place', true, null, { practice: true });
  if (State.card('c:CU', 'place').iv !== 10) fail('a practice answer advanced the interval');

  // The interval ladder reaches a sane place: five correct answers from new
  // should be weeks, not days, and the cap must hold.
  State.reset();
  let card = null;
  const ladder = [];
  for (let i = 0; i < 14; i++) { card = State.answer('c:CU', 'place', true); ladder.push(card.iv); }
  if (card.iv !== 270) fail('the interval did not reach the 270-day cap (' + card.iv + ')');
  if (Math.max(...ladder) > 270) fail('interval exceeded the cap');
  // Three retrievals to graduate, then roughly a month by the seventh answer.
  if (ladder[6] < 15 || ladder[6] > 30) fail('the seventh correct answer landed at ' + ladder[6] + ' days');

  // Mastery is the minimum across supported facets, not the mean.
  State.reset();
  State.data.cards['c:CU|place'] = { iv: 200, e: 2.2, reps: 8, lapses: 0, due: Date.now() + 99 * DAY, last: 0, st: 'review', step: 0, ok: true, lapseRep: 0 };
  State.data.cards['c:CU|capital'] = { iv: 1, e: 2.2, reps: 1, lapses: 0, due: Date.now() + DAY, last: 0, st: 'review', step: 0, ok: true, lapseRep: -9 };
  // Two different questions. The RING is the picture — how far through the
  // place you are, averaged over the facets it supports. The WORD is the claim
  // — the minimum, so one weak facet keeps the whole place at "met".
  const m = State.itemMastery('c:CU', ['place', 'capital']);
  if (m <= 0.4 || m >= 0.8) fail('item mastery should sit between its two facets, got ' + m.toFixed(2));
  if (State.itemState('c:CU', ['place', 'capital']) !== 'met') fail('an item with one weak facet was not reported as met');
  State.data.cards['c:CU|capital'].iv = 200;
  State.data.cards['c:CU|capital'].lapseRep = 0;
  State.data.cards['c:CU|capital'].reps = 8;
  if (State.itemState('c:CU', ['place', 'capital']) !== 'secure') fail('an item strong on every facet was not reported as secure');
  State.reset();
}
schedulerChecks();

// ── report ───────────────────────────────────────────────────────────────
console.log('generated', built.toLocaleString(), 'questions from', attempted.toLocaleString(), 'attempts\n');
console.log('by kind:');
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(14) + String(n).padStart(7));
}
const missing = Object.keys(KINDS).filter((k) => !counts[k]);
if (missing.length) console.log('\nKINDS THAT NEVER BUILT: ' + missing.join(', '));

const thin = Object.entries(byPack).filter(([, v]) => v.kinds.size < 2);
if (thin.length) {
  console.log('\npacks with fewer than two question kinds:');
  for (const [p, v] of thin) console.log('  ' + p.padEnd(24) + [...v.kinds].join(', ') + '  (' + v.items + ' items)');
}

console.log('\n' + (fails.length ? fails.length + ' FAILURES' : 'all invariants held'));
for (const f of fails.slice(0, 40)) console.log('  x ' + f);
if (fails.length > 40) console.log('  … and ' + (fails.length - 40) + ' more');
process.exit(fails.length ? 1 : 0);
