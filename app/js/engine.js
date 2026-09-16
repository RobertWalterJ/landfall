// Landfall — turning a (place, facet) into a question.
//
// Two things here do the real work.
//
// DISTRACTORS. A wrong answer chosen at random teaches nothing: if the options
// against Saba are Mongolia, Peru and Chad, the question is "which of these is
// in the Caribbean", which you already knew. Distractors are therefore scored
// for nearness — same island group, same country, same sub-region, physically
// close, and heavily weighted towards places you have actually confused with
// this one before. That is where mastery comes from.
//
// FACT QUESTIONS DEDUPE ON THE VALUE, not the item. Four options that all say
// "Europe" is not a question. Any kind whose answer is a shared property picks
// its distractors so that every option reads differently.

import { DB, item, inPack, kindLabel, withArticle, parentOf, distanceKm } from './data.js';
import { State } from './schedule.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── nearness ─────────────────────────────────────────────────────────────
function nearness(target, other) {
  if (target.i === other.i) return -Infinity;
  let s = 0;
  const tg = new Set(target.g || []), og = other.g || [];
  for (const g of og) if (tg.has(g)) s += 8;
  if (target.pr && target.pr === other.pr) s += 6;
  if (target.x?.sr && target.x.sr === other.x?.sr) s += 5;
  else if (target.x?.r && target.x.r === other.x?.r) s += 2;
  if (target.x?.admin && target.x.admin === other.x?.admin) s += 7;
  if (target.k === other.k) s += 3;
  if (Math.abs((target.t || 3) - (other.t || 3)) <= 1) s += 2;
  const d = distanceKm(target, other);
  if (d != null) s += Math.max(0, 7 - Math.log10(Math.max(d, 1)) * 1.6);
  // Places already confused with this one are the most useful wrong answers
  // there are: the drill is exactly the distinction that has not landed. The
  // weight is symmetric — mistaking St Lucia for St Vincent and the reverse are
  // the same confusion.
  s += State.confusionWeight(target.i, other.i) * 7;
  return s;
}

// Pick n wrong answers, ranked by nearness with a little slack so the same
// three do not recur. Cruel mode takes the three closest, full stop.
export function nearMisses(target, pool, n, { cruel = false, filter = null } = {}) {
  const scored = [];
  for (const o of pool) {
    if (o.i === target.i) continue;
    if (filter && !filter(o)) continue;
    scored.push({ o, s: nearness(target, o) });
  }
  if (scored.length <= n) return scored.map((x) => x.o);
  scored.sort((a, b) => b.s - a.s);
  if (cruel) return scored.slice(0, n).map((x) => x.o);
  const head = scored.slice(0, Math.max(n + 1, Math.min(14, Math.ceil(scored.length * 0.35))));
  const out = shuffle(head).slice(0, n).map((x) => x.o);
  // If the answer belongs to a curated group, at least one wrong answer must
  // come from that group. Otherwise the question quietly becomes "which of
  // these is in the Leewards" when it was meant to be "which Leeward island".
  const tg = new Set(target.g || []);
  if (tg.size && !out.some((o) => (o.g || []).some((g) => tg.has(g)))) {
    const sibling = scored.find((x) => (x.o.g || []).some((g) => tg.has(g)) && !out.includes(x.o));
    if (sibling) out[out.length - 1] = sibling.o;
  }
  return out;
}

// Same, but no two options may share the same answer VALUE.
function distinctByValue(target, pool, n, valueOf, { cruel = false } = {}) {
  const want = valueOf(target);
  const seen = new Set([String(want)]);
  const scored = pool
    .filter((o) => o.i !== target.i)
    .map((o) => ({ o, v: valueOf(o), s: nearness(target, o) }))
    .filter((x) => x.v != null && String(x.v).trim() !== '' && !seen.has(String(x.v)))
    .sort((a, b) => b.s - a.s);
  const out = [];
  const bag = cruel ? scored : shuffle(scored.slice(0, Math.max(n * 3, 10))).concat(scored);
  for (const x of bag) {
    if (out.length >= n) break;
    if (seen.has(String(x.v))) continue;
    seen.add(String(x.v));
    out.push(x);
  }
  return out;
}

const opt = (id, label, extra = {}) => ({ id, label, ...extra });

// ── the question kinds ───────────────────────────────────────────────────
//
// Every kind returns the same shape, so grading, scheduling and the verdict
// screen never learn what kind of question they are looking at. Adding a kind
// is adding an entry here and nothing else.
export const KINDS = {
  locate: {
    facet: 'place', form: 'map', label: 'Find it',
    can: (it, ctx) => !!mapFor(it, ctx),
    build(it, ctx) {
      const mapId = mapFor(it, ctx);
      const others = nearMisses(it, ctx.pool, 3, {
        cruel: ctx.cruel,
        filter: (o) => (o.m || []).includes(mapId) && o.i !== it.i,
      });
      if (others.length < 3) return null;
      return {
        form: 'map',
        prompt: 'Where is ' + withArticle(it) + '?',
        frame: 'Where is', subject: it.n,
        promptSub: 'Tap it on the map',
        speak: 'Where is ' + it.n,
        map: { id: mapId, candidates: shuffle([it, ...others]).map((o) => ({ id: o.i, correct: o.i === it.i })) },
        answerLabel: it.n,
      };
    },
  },

  shape: {
    facet: 'place', form: 'options', label: 'Name the shape',
    can: (it, ctx) => !!mapFor(it, ctx) && hasShape(it, ctx),
    build(it, ctx) {
      const mapId = mapFor(it, ctx);
      const others = nearMisses(it, ctx.pool, 3, { cruel: ctx.cruel });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Which ' + kindLabel(it) + ' is this?',
        frame: 'Which ' + kindLabel(it) + ' is this', subject: null,
        speak: 'Which ' + kindLabel(it) + ' is this?',
        figure: { type: 'shape', mapId, id: it.i },
        options: shuffle([it, ...others]).map((o) => opt(o.i, o.n, { correct: o.i === it.i })),
        answerLabel: it.n,
      };
    },
  },

  'flag-name': {
    facet: 'flag', form: 'options', label: 'Whose flag?',
    can: (it) => !!it.fl,
    build(it, ctx) {
      const others = nearMisses(it, ctx.pool, 3, { cruel: ctx.cruel, filter: (o) => !!o.fl });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Whose flag is this?',
        frame: 'Whose flag is this', subject: null,
        speak: 'Whose flag is this?',
        figure: { type: 'flag', code: it.fl },
        options: shuffle([it, ...others]).map((o) => opt(o.i, o.n, { correct: o.i === it.i })),
        answerLabel: it.n,
      };
    },
  },

  'name-flag': {
    facet: 'flag', form: 'options', label: 'Pick the flag',
    can: (it) => !!it.fl,
    build(it, ctx) {
      const others = nearMisses(it, ctx.pool, 3, { cruel: ctx.cruel, filter: (o) => !!o.fl });
      if (others.length < 3) return null;
      return {
        form: 'flags',
        prompt: 'Which flag belongs to ' + withArticle(it) + '?',
        frame: 'Find the flag of', subject: it.n,
        speak: 'Which flag belongs to ' + it.n,
        options: shuffle([it, ...others]).map((o) => opt(o.i, o.n, { flag: o.fl, correct: o.i === it.i })),
        answerLabel: it.n,
      };
    },
  },

  'capital-of': {
    facet: 'capital', form: 'options', label: 'Capital',
    can: (it) => !!it.cap,
    build(it, ctx) {
      const others = distinctByValue(it, ctx.pool, 3, (o) => o.cap, { cruel: ctx.cruel });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: 'What is the capital of ' + withArticle(it) + '?',
        frame: 'Capital of', subject: it.n,
        speak: 'What is the capital of ' + it.n,
        options: shuffle([{ id: it.i, label: it.cap, correct: true }, ...others.map((x) => opt(x.o.i, x.v))])
          .map((o) => ({ ...o, correct: !!o.correct })),
        answerLabel: it.cap,
        explain: it.caps?.length > 1 ? it.n + ' has ' + it.caps.length + ' capitals: ' + it.caps.join(', ') + '.' : null,
      };
    },
  },

  'capital-is': {
    facet: 'capital', form: 'options', label: 'Capital of what?',
    can: (it) => !!it.cap,
    build(it, ctx) {
      const others = distinctByValue(it, ctx.pool, 3, (o) => o.cap, { cruel: ctx.cruel });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: it.cap + ' is the capital of…',
        frame: 'Capital of what', subject: it.cap,
        speak: it.cap + ' is the capital of what?',
        options: shuffle([it, ...others.map((x) => x.o)]).map((o) => opt(o.i, o.n, { correct: o.i === it.i })),
        answerLabel: it.n,
      };
    },
  },

  parent: {
    facet: 'parent', form: 'options', label: 'Who holds it',
    can: (it) => !!answerParent(it),
    build(it, ctx) {
      const answer = answerParent(it);
      if (!answer) return null;
      // Distractors are the other things of the same sort: other provinces for
      // a city, other sovereigns for a territory. Drawn from the whole corpus,
      // not just the active packs — otherwise a Canadian-cities round has one
      // possible answer and no question.
      const siblings = [];
      for (const o of DB.items.values()) {
        if (o.i === answer.i) continue;
        if (o.k !== answer.k) continue;
        if (answer.k === 'admin1' && o.x?.admin !== answer.x?.admin) continue;
        siblings.push(o);
      }
      const wrong = nearMisses(answer, siblings, 3, { cruel: ctx.cruel });
      if (wrong.length < 3) return null;
      const noun = answer.k === 'admin1' ? (answer.x?.type || 'region').toLowerCase() : 'country';
      const prompt = it.k === 'territory'
        ? 'Which country administers ' + withArticle(it) + '?'
        : it.k === 'city' || it.k === 'admin1'
          ? 'Which ' + noun + ' is ' + it.n + ' in?'
          : withArticle(it) + ' belongs to…';
      const frame = it.k === 'territory' ? 'Who administers'
        : it.k === 'city' || it.k === 'admin1' ? 'Which ' + noun + ' holds'
          : 'Who holds';
      return {
        form: 'options',
        prompt,
        frame, subject: it.n,
        speak: prompt.replace('…', '?'),
        options: shuffle([answer, ...wrong]).map((o) => opt(o.i, o.n, { correct: o.i === answer.i })),
        answerLabel: answer.n,
      };
    },
  },

  'group-of': {
    facet: 'group', form: 'options', label: 'Which group',
    can: (it) => (it.g || []).some((g) => DB.groups.get(g)),
    build(it, ctx) {
      const mine = (it.g || []).map((g) => DB.groups.get(g)).filter(Boolean);
      if (!mine.length) return null;
      const g = pick(mine);
      const others = [...DB.groups.values()]
        .filter((o) => o.id !== g.id && !(it.g || []).includes(o.id) && !(it.gc || []).includes(o.id))
        .filter((o) => o.scope === g.scope || Math.random() < 0.3);
      if (others.length < 3) return null;
      const wrong = shuffle(others).slice(0, 3);
      return {
        form: 'options',
        prompt: withArticle(it) + ' is one of…',
        frame: 'Which group holds', subject: it.n,
        speak: it.n + ' is one of which group',
        options: shuffle([g, ...wrong]).map((o) => opt('g:' + o.id, o.name, { correct: o.id === g.id })),
        answerLabel: g.name,
        explain: g.blurb,
      };
    },
  },

  'group-member': {
    facet: 'group', form: 'options', label: 'In the group',
    can: (it) => (it.g || []).some((g) => DB.groups.get(g)),
    build(it, ctx) {
      const g = pick((it.g || []).map((x) => DB.groups.get(x)).filter(Boolean));
      if (!g) return null;
      // Outsiders must be genuinely outside: never a contested member, because
      // the honest answer there is "it depends".
      const inside = new Set([...g.members, ...(g.contested || [])]);
      const outsiders = ctx.pool.filter((o) => !inside.has(o.i));
      const wrong = nearMisses(it, outsiders, 3, { cruel: ctx.cruel });
      if (wrong.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Which of these is in ' + g.name.replace(/^The /, 'the ') + '?',
        frame: 'Which of these is in', subject: g.name,
        speak: 'Which of these is in ' + g.name,
        options: shuffle([it, ...wrong]).map((o) => opt(o.i, o.n, { correct: o.i === it.i })),
        answerLabel: it.n,
        explain: g.blurb,
      };
    },
  },

  border: {
    facet: 'facts', form: 'options', label: 'Neighbours',
    can: (it) => (it.x?.bd || []).length > 0,
    build(it, ctx) {
      const neighbours = (it.x.bd || []).map((c) => item('c:' + c)).filter(Boolean);
      if (!neighbours.length) return null;
      const answer = pick(neighbours);
      const nset = new Set(it.x.bd);
      const pool = ctx.pool.filter((o) => (o.k === 'country') && o.i !== it.i && !nset.has(o.x?.i2));
      const wrong = nearMisses(answer, pool, 3, { cruel: ctx.cruel });
      if (wrong.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Which of these borders ' + withArticle(it) + '?',
        frame: 'Which of these borders', subject: it.n,
        speak: 'Which of these borders ' + it.n,
        options: shuffle([answer, ...wrong]).map((o) => opt(o.i, o.n, { correct: o.i === answer.i })),
        answerLabel: answer.n,
        explain: it.n + ' borders ' + neighbours.map((n) => n.n).join(', ') + '.',
        correctId: answer.i,
      };
    },
  },

  region: {
    facet: 'facts', form: 'options', label: 'Sub-region',
    can: (it) => !!(it.x?.sr || '').trim() && (it.k === 'country' || it.k === 'territory'),
    build(it, ctx) {
      const others = distinctByValue(it, ctx.pool, 3, (o) => o.x?.sr, { cruel: ctx.cruel });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Which sub-region is ' + withArticle(it) + ' in?',
        frame: 'Which sub-region holds', subject: it.n,
        speak: 'Which sub region is ' + it.n + ' in',
        options: shuffle([{ id: 'v:' + it.x.sr, label: it.x.sr, correct: true },
          ...others.map((x) => opt('v:' + x.v, x.v))]).map((o) => ({ ...o, correct: !!o.correct })),
        answerLabel: it.x.sr,
      };
    },
  },

  currency: {
    facet: 'facts', form: 'options', label: 'Currency',
    can: (it) => !!it.x?.curN,
    build(it, ctx) {
      const others = distinctByValue(it, ctx.pool, 3, (o) => o.x?.curN, { cruel: ctx.cruel });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: 'What money do you spend in ' + withArticle(it) + '?',
        frame: 'Money spent in', subject: it.n,
        speak: 'What currency is used in ' + it.n,
        options: shuffle([{ id: 'v:' + it.x.curN, label: it.x.curN, correct: true },
          ...others.map((x) => opt('v:' + x.v, x.v))]).map((o) => ({ ...o, correct: !!o.correct })),
        answerLabel: it.x.curN,
        explain: it.x.cur ? 'The code is ' + it.x.cur + '.' : null,
      };
    },
  },

  language: {
    facet: 'facts', form: 'options', label: 'Language',
    can: (it) => (it.x?.lang || []).length > 0,
    build(it, ctx) {
      const mine = new Set(it.x.lang);
      const answer = pick(it.x.lang);
      const seen = new Set(it.x.lang);
      const wrong = [];
      for (const o of shuffle(ctx.pool)) {
        for (const l of o.x?.lang || []) {
          if (seen.has(l)) continue;
          seen.add(l); wrong.push(l);
          if (wrong.length >= 3) break;
        }
        if (wrong.length >= 3) break;
      }
      if (wrong.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Which language is official in ' + withArticle(it) + '?',
        frame: 'Official language of', subject: it.n,
        speak: 'Which language is official in ' + it.n,
        options: shuffle([{ id: 'v:' + answer, label: answer, correct: true },
          ...wrong.map((w) => opt('v:' + w, w))]).map((o) => ({ ...o, correct: !!o.correct })),
        answerLabel: answer,
        explain: it.x.lang.length > 1 ? 'Official languages: ' + it.x.lang.join(', ') + '.' : null,
      };
    },
  },

  demonym: {
    facet: 'facts', form: 'options', label: 'What you call them',
    // Only when the demonym is not simply the name plus a suffix. "Someone from
    // Canada is… Canadian" tests nothing; Dutch, Manx, Kittitian and Basotho do.
    can: (it) => !!it.x?.dem && !derivable(it.n, it.x.dem),
    build(it, ctx) {
      const others = distinctByValue(it, ctx.pool, 3, (o) => o.x?.dem, { cruel: ctx.cruel });
      if (others.length < 3) return null;
      return {
        form: 'options',
        prompt: 'Someone from ' + withArticle(it) + ' is…',
        frame: 'Someone from', subject: it.n, promptSub: 'is called…',
        speak: 'What do you call someone from ' + it.n,
        options: shuffle([{ id: 'v:' + it.x.dem, label: it.x.dem, correct: true },
          ...others.map((x) => opt('v:' + x.v, x.v))]).map((o) => ({ ...o, correct: !!o.correct })),
        answerLabel: it.x.dem,
      };
    },
  },

  'odd-one-out': {
    facet: 'group', form: 'options', label: 'Odd one out',
    can: (it) => (it.g || []).some((g) => (DB.groups.get(g)?.members.length || 0) >= 4),
    build(it, ctx) {
      const g = pick((it.g || []).map((x) => DB.groups.get(x)).filter((x) => x && x.members.length >= 4));
      if (!g) return null;
      const family = shuffle(g.members.filter((m) => m !== it.i).map(item).filter(Boolean)).slice(0, 3);
      if (family.length < 3) return null;
      const inside = new Set([...g.members, ...(g.contested || [])]);
      const outsider = nearMisses(it, ctx.pool.filter((o) => !inside.has(o.i)), 1, { cruel: ctx.cruel })[0];
      if (!outsider) return null;
      return {
        form: 'options',
        prompt: 'Which of these is NOT in ' + g.name.replace(/^The /, 'the ') + '?',
        frame: 'Which of these is NOT in', subject: g.name, negate: true,
        speak: 'Which of these is not in ' + g.name,
        options: shuffle([outsider, ...family]).map((o) => opt(o.i, o.n, { correct: o.i === outsider.i })),
        answerLabel: outsider.n,
        explain: g.blurb,
        correctId: outsider.i,
      };
    },
  },

  // The twin-island question. Nevis and Saint Kitts, Antigua and Barbuda,
  // Trinidad and Tobago, Basse-Terre and Grande-Terre, Saba and Sint Eustatius,
  // Tortola and Virgin Gorda — the Caribbean is full of countries that are two
  // or three islands wearing one flag, and knowing which halves go together is
  // most of knowing the region.
  sibling: {
    facet: 'parent', form: 'options', label: 'Shares a country',
    can: (it) => it.k === 'island' && siblingsOf(it).length > 0,
    build(it, ctx) {
      const kin = siblingsOf(it);
      if (!kin.length) return null;
      const answer = pick(kin);
      const kinSet = new Set([it.i, ...kin.map((k) => k.i)]);
      // Wrong answers are islands from OTHER countries — ideally other halves
      // of other twins, which is what makes it a question about which pairs go
      // together rather than about which islands exist.
      const pool = ctx.pool.filter((o) => o.k === 'island' && !kinSet.has(o.i));
      const wrong = nearMisses(answer, pool, 3, { cruel: ctx.cruel });
      if (wrong.length < 3) return null;
      const parent = parentOf(it);
      return {
        form: 'options',
        prompt: withArticle(it) + ' shares a country with…',
        frame: 'Shares a country with', subject: it.n,
        speak: 'Which island shares a country with ' + it.n,
        options: shuffle([answer, ...wrong]).map((o) => opt(o.i, o.n, { correct: o.i === answer.i })),
        answerLabel: answer.n,
        explain: parent
          ? (kin.length === 1
            ? parent.n + ' is two islands: ' + it.n + ' and ' + answer.n + '.'
            : parent.n + ' is ' + (kin.length + 1) + ' islands: ' + [it.n, ...kin.map((k) => k.n)].join(', ') + '.')
          : null,
        correctId: answer.i,
      };
    },
  },

  // Where something sits in the chain. The Lesser Antilles run almost exactly
  // north to south, so this is the question that turns a set of names into an
  // ordered arc — which is what "naming every island in the Leewards" actually
  // means.
  northernmost: {
    facet: 'place', form: 'options', label: 'Furthest north',
    can: (it) => Array.isArray(it.ll) && Number.isFinite(it.ll[0]),
    build(it, ctx) {
      const near = nearMisses(it, ctx.pool.filter((o) => Number.isFinite(o.ll?.[0])), 3, { cruel: ctx.cruel });
      if (near.length < 3) return null;
      const all = [it, ...near];
      const ranked = all.slice().sort((a, b) => b.ll[0] - a.ll[0]);
      // Separated enough that the answer is a fact rather than a guess about
      // two islands ten kilometres apart.
      for (let i = 1; i < ranked.length; i++) {
        if (ranked[i - 1].ll[0] - ranked[i].ll[0] < 0.35) return null;
      }
      const answer = ranked[0];
      return {
        form: 'options',
        prompt: 'Which of these is furthest north?',
        frame: 'Which of these is furthest north', subject: null,
        speak: 'Which of these is furthest north',
        options: shuffle(all).map((o) => opt(o.i, o.n, { correct: o.i === answer.i })),
        answerLabel: answer.n,
        explain: 'North to south: ' + ranked.map((o) => o.n).join(', ') + '.',
        correctId: answer.i,
      };
    },
  },

  largest: {
    facet: 'facts', form: 'options', label: 'Largest',
    can: (it) => (it.x?.pop || 0) > 0,
    build(it, ctx) {
      const near = nearMisses(it, ctx.pool.filter((o) => (o.x?.pop || 0) > 0), 3, { cruel: ctx.cruel });
      if (near.length < 3) return null;
      const all = [it, ...near];
      const ranked = all.slice().sort((a, b) => (b.x.pop || 0) - (a.x.pop || 0));
      const answer = ranked[0];
      if (new Set(all.map((a) => a.x.pop)).size < 4) return null;
      // A 2x gap between first and second, or there is no defensible answer:
      // "which is bigger, Dominica or Grenada" is a coin toss with a score.
      if ((ranked[0].x.pop || 0) < (ranked[1].x.pop || 0) * 2) return null;
      return {
        form: 'options',
        prompt: 'Which has the most people?',
        frame: 'Which has the most people', subject: null,
        speak: 'Which of these has the most people',
        options: shuffle(all).map((o) => opt(o.i, o.n, { correct: o.i === answer.i })),
        answerLabel: answer.n,
        explain: all.slice().sort((a, b) => (b.x.pop || 0) - (a.x.pop || 0))
          .map((o) => o.n + ' ' + fmtPop(o.x.pop)).join(' · '),
        correctId: answer.i,
      };
    },
  },
};

function fmtPop(n) {
  if (!n) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'bn';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'm';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
}

// Does the question hand you the answer? Eponymous capitals (Djibouti,
// Luxembourg, Monaco), languages named after the country (Somali, Thai,
// Kazakh) and neighbours sharing a name (Guinea-Bissau / Guinea) all produce
// questions that look real and test nothing. Checked here rather than in each
// kind, so it cannot be forgotten when a kind is added.
function leaks(prompt, answer, name) {
  if (!answer) return false;
  const p = prompt.toLowerCase();
  const a = String(answer).toLowerCase();
  if (a.length >= 3 && p.includes(a)) return true;
  if (name && derivable(name, answer)) return true;
  for (const w of a.split(/[^a-zÀ-ɏ]+/i)) {
    if (w.length >= 5 && p.includes(w.toLowerCase())) return true;
  }
  return false;
}

// Is the demonym just the place name with an ending stuck on it?
function derivable(name, dem) {
  const a = name.toLowerCase().replace(/[^a-z]/g, '');
  const b = dem.toLowerCase().replace(/[^a-z]/g, '');
  const n = Math.min(5, a.length, b.length);
  return a.slice(0, n) === b.slice(0, n);
}

// The other islands of the same country, as the corpus actually holds them.
// Two or three is a twin-island country; more than four is an archipelago and
// the question stops being about pairs.
function siblingsOf(it) {
  if (!it.pr) return [];
  const kin = [];
  for (const o of DB.items.values()) {
    if (o.i !== it.i && o.k === 'island' && o.pr === it.pr) kin.push(o);
  }
  return kin.length <= 3 ? kin : [];
}

// What a place belongs TO: a city to its province (or country if it has none),
// a territory to the sovereign that administers it, anything else to its parent.
function answerParent(it) {
  if (it.k === 'territory') return sovereignOf(it);
  if (it.k === 'city') return (it.a1 ? item(it.a1) : null) || parentOf(it);
  if (it.k === 'island' || it.k === 'admin1') return parentOf(it);
  return null;
}

function sovereignOf(it) {
  const name = it.x?.sov;
  if (!name) return null;
  for (const o of DB.items.values()) {
    if ((o.k === 'country') && (o.n === name || (o.alt || []).includes(name))) return o;
  }
  return null;
}

// The map this item should be asked on: the pack's own map if the item is on
// it, otherwise whichever map it does appear on.
function mapFor(it, ctx) {
  const on = it.m || [];
  if (!on.length) return null;
  if (ctx.preferMap && on.includes(ctx.preferMap)) return ctx.preferMap;
  return on[0];
}
function hasShape(it, ctx) {
  const mapId = mapFor(it, ctx);
  const m = DB.maps.get(mapId);
  if (!m) return true;                 // not loaded yet — assume yes, checked at build
  const f = m.f[it.i];
  return !!(f && f.d);                 // a marker-only feature has no shape to show
}

// `facts` — currency, language, demonym, sub-region — is an opt-in layer, off
// by default. Three currency questions in a fourteen-question round crowd out
// three islands, and this app is about places, not about the Bosnia and
// Herzegovina convertible mark.
const allowed = (id, k, ctx) => {
  if (ctx.kinds && !ctx.kinds.includes(id)) return false;
  if (k.facet === 'facts' && !ctx.detail && id !== 'border') return false;
  return true;
};

// Which facets a given item can support at all.
export function facetsFor(it, ctx) {
  const set = new Set();
  for (const [id, k] of Object.entries(KINDS)) {
    if (!allowed(id, k, ctx)) continue;
    if (k.can(it, ctx)) set.add(k.facet);
  }
  return [...set];
}

export function kindsFor(it, facet, ctx) {
  return Object.entries(KINDS)
    .filter(([id, k]) => k.facet === facet && allowed(id, k, ctx) && k.can(it, ctx))
    .map(([id]) => id);
}

// Build a question for a (item, facet). Tries the applicable kinds in random
// order and returns the first that can actually assemble four options.
export function buildQuestion(it, facet, ctx) {
  let ids = shuffle(kindsFor(it, facet, ctx));
  // When a card comes back inside the same round, ask it a DIFFERENT way where
  // one exists. Repeating the identical question tests recognition of the
  // question, not knowledge of the place.
  if (ctx.avoid?.size) {
    const unseen = ids.filter((k) => !ctx.avoid.has(k));
    if (unseen.length) ids = unseen;
  }
  for (const id of ids) {
    const q = KINDS[id].build(it, ctx);
    if (!q) continue;
    if (q.form !== 'map') {
      const correct = q.options.filter((o) => o.correct);
      if (correct.length !== 1 || q.options.length !== 4) continue;
      if (new Set(q.options.map((o) => o.label)).size !== 4) continue;
      // A text answer that is visible in the question is not a question.
      // The name check only applies when the answer is something OTHER than the
      // place being asked about — otherwise "which island is this? Saba" is
      // rejected for the crime of answering itself.
      if (q.form === 'options'
          && leaks(q.prompt, q.answerLabel, q.answerLabel === it.n ? null : it.n)) continue;
    } else if (q.map.candidates.filter((c) => c.correct).length !== 1) continue;
    return {
      ...q,
      kind: id,
      facet,
      itemId: it.i,
      // Most questions grade against the item asked about, but some do not:
      // "which of these borders Nigeria" is answered by a neighbour, and the
      // odd one out is by definition not the item the card is for.
      correctId: q.correctId || (q.form === 'map'
        ? q.map.candidates.find((c) => c.correct).id
        : q.options.find((o) => o.correct).id),
    };
  }
  return null;
}
