// Landfall — what to ask next, and what the app remembers.
//
// The unit of knowledge is a (place, FACET) pair. Knowing where Saba is and
// knowing who governs it are different pieces of knowledge with different decay
// rates. A per-place score would call you master of the Caribbean on the
// strength of recognising Cuba.
//
// SCHEDULING is SM-2-lite: each card carries its own ease and its interval is
// multiplied rather than stepped up a fixed ladder. Three things about it are
// deliberate and worth stating.
//
//   The ceiling is 270 days, not 60. The corpus is about 5,000 cards; at a
//   60-day terminal interval a fully learned corpus generates 84 reviews every
//   day forever, which makes the whole-world ambition impossible. At 270 days
//   it is 19 a day — one round.
//
//   Ease moves on the DIFFICULTY OF THE QUESTION, never on self-rating and
//   never on response latency. SuperMemo and Anki ask the user to grade
//   themselves because they cannot see the question; this app builds the
//   question, so it knows exactly how hard it was. Latency is out of the
//   question for a dyslexic user — it would measure reading speed.
//
//   A miss multiplies (interval x 0.35, floor 1 day) instead of dropping a
//   fixed number of steps. A 60-day card that fails comes back at 21 days; a
//   5-day card comes back at 1. One rule that degrades gracefully at both ends.
//
// INTRODUCTION is scaffolded, not sorted by difficulty. Nothing is introduced
// until the thing that contains it is known and part of its group frame is up.
// Cognitive maps are stored as nested, clustered structures (Stevens & Coupe
// 1978; Hirtle & Jonides 1985; McNamara 1986) — people encode geography as
// frames with detail hung inside them either way, so teach the frame first.

const KEY = 'landfall.v1';

export const MAX_INTERVAL = 270;          // days
export const EASE_START = 2.2;
export const EASE_MIN = 1.35;
export const EASE_MAX = 3.0;
export const KNOWN_AT = 21;               // days — Cepeda's gap for a year's retention
// Getting something right three times running is worth saying out loud, even on
// the first day. It is NOT the same claim as "known" — that one means you will
// still have it in three weeks and cannot be earned in an afternoon — but a
// scoreboard that can only ever read zero for three weeks tells you nothing
// about the afternoon you just spent.
export const DOWN_PAT_AT = 3;
export const SECURE_AT = 90;
const FRONTIER_ITEMS = 12;                // places unsettled at once, per pool
const LOAD_CEILING = 25;                  // projected reviews per day
// ONE return inside the round, then tomorrow.
//
// It was [3, 9], which cost about three slots of a fourteen-question round per
// new card and made learning-step repeats 46% of everything asked — at 66%
// accuracy, the worst-performing trial type in the app. Karpicke & Roediger
// 2008, which the requeue comment cites, found that repeated retrieval WITHIN
// the initial session contributed little to one-week retention; the durable
// gain came from retrieval spread ACROSS sessions (Cepeda et al. 2006). So the
// third retrieval moves to tomorrow, where it is worth something.
const LEARN_STEPS = [5];                  // questions later, inside the round
// One slot a round is kept for a second facet. Measured over eight weeks on
// the Caribbean: at 0 the pack is fully met but locate is 62% of every question
// and flags and capitals are 2% each; at 2 the variety is lovely and only 54 of
// 93 places are ever met. At 1 — 71 met, 33 known, twelve question kinds,
// locate down from 62% to 43%, flags and capitals asked from day seven.
const DEPTH_PER_ROUND = 1;
const FACET_UNLOCK_AT = 5;                // days on the previous facet
// The order new material is met in, before difficulty is even considered.
const KIND_RANK = { country: 0, territory: 1, admin1: 1, island: 2, city: 3 };
const PARENT_KNOWN_AT = 5;                // days on the parent's place card

// The order facets are opened in. Where it is comes first: it is the retrieval
// cue everything else hangs on, and a capital learned before a location is a
// free-floating word pair.
export const FACET_ORDER = ['place', 'parent', 'group', 'flag', 'capital', 'facts'];
export const FACET_LABEL = {
  place: 'where it is', flag: 'its flag', capital: 'its capital',
  parent: 'who holds it', group: 'its group', facts: 'the detail',
};

const now = () => Date.now();
export const DAY = 24 * 3600e3;
const dayKey = (t = now()) => new Date(t).toISOString().slice(0, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blank() {
  return {
    v: 2,
    cards: {},
    conf: {},
    days: {},
    stats: { answered: 0, right: 0 },
    sweeps: {},
    settings: {
      packs: ['caribbean'],
      kinds: null,
      length: 14,
      clock: 0,              // seconds per question; 0 = no clock. The default.
      speech: 'manual',      // off | manual | prompt | both — manual = buttons, nothing speaks at you
      sound: false,
      advance: 'auto',       // auto | tap
      theme: 'system',
      detail: false,         // the `facts` facet — opt-in
    },
  };
}

const newCard = () => ({ iv: 0, e: EASE_START, reps: 0, lapses: 0, due: 0, last: 0, st: 'new', step: 0, ok: false, run: 0, lapseRep: -9 });

// What the app is allowed to claim about a card. Four words, defined on the
// interval, and they are the only words the app uses.
// Right three times in a row, most recently. Says nothing about next week.
export const isLapsing = (c) => !!c && c.st !== 'new' && c.iv > 0 && now() - c.due > c.iv * DAY * 0.5;

// Three right in a row, AND not already fading. Without the second clause a
// place answered right three times in March still reads "down pat" in
// September — cardScore fades with time and this did not, so the two rungs of
// the same ladder disagreed with each other.
export const cardDownPat = (c) => !!c && c.ok && (c.run || 0) >= DOWN_PAT_AT && !isLapsing(c);

export function cardState(c) {
  if (!c || c.st === 'new') return 'unseen';
  if (c.iv >= SECURE_AT && c.reps - c.lapseRep >= 2) return 'secure';
  if (c.iv >= KNOWN_AT && c.ok) return 'known';
  return 'met';
}

// 0..1, for rings and for inking the map. Logarithmic in the interval, because
// the difference between 1 day and 21 is the whole game and the difference
// between 200 and 270 is nothing.
export function cardScore(c) {
  if (!c || c.st === 'new') return 0;
  let s = Math.min(1, Math.log(1 + c.iv) / Math.log(1 + SECURE_AT));
  // Decay shown BEFORE re-testing. Stop for three months and the map fades and
  // the counts fall, because that is what has happened to the memory.
  if (isLapsing(c)) s *= 0.6;
  return s;
}

export const State = {
  data: blank(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        this.data = { ...blank(), ...p, settings: { ...blank().settings, ...(p.settings || {}) } };
        if (p.v !== 2) this.data.cards = {};        // the old box model does not convert
        this.data.v = 2;
      }
    } catch { /* private mode or cleared storage — carry on blank */ }
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* not fatal */ } },
  settings() { return this.data.settings; },
  set(patch) { Object.assign(this.data.settings, patch); this.save(); },
  card(itemId, facet) { return this.data.cards[itemId + '|' + facet] || null; },

  // Two different questions, two different answers.
  //
  // itemMastery is the PICTURE: how far through this place you are, scored over
  // the facets it actually supports with an unopened facet counting zero. It
  // rises smoothly and can never exceed the share of facets opened, so it is
  // honest without being useless on day three.
  //
  // itemState is the CLAIM: the minimum across supported facets. "Known" means
  // known on every facet, because a mean lets a known location paper over an
  // unknown capital. The ring uses the first; the word uses the second.
  itemMastery(itemId, facets) {
    const fs = (facets || FACET_ORDER).filter(Boolean);
    if (!fs.length) return 0;
    let sum = 0, any = false;
    for (const f of fs) {
      const c = this.data.cards[itemId + '|' + f];
      if (c) any = true;
      sum += cardScore(c);
    }
    return any ? sum / fs.length : 0;
  },

  itemState(itemId, facets) {
    const fs = facets || FACET_ORDER;
    const states = fs.map((f) => cardState(this.data.cards[itemId + '|' + f]));
    if (states.every((s) => s === 'unseen')) return 'unseen';
    const rank = { unseen: 0, met: 1, known: 2, secure: 3 };
    return states.reduce((a, b) => (rank[b] < rank[a] ? b : a), 'secure');
  },

  // Three counts and one sentence. The sentence is the headline: it is a count,
  // it can go down, and it is what he actually wants to be able to say.
  packLedger(items, facetsFor) {
    let cards = 0, met = 0, known = 0, secure = 0, pat = 0;
    let itemsKnown = 0, itemsDeep = 0, itemsMet = 0, itemsPat = 0, sum = 0;
    const rank = { unseen: 0, met: 1, known: 2, secure: 3 };
    for (const it of items) {
      const fs = (facetsFor ? facetsFor(it) : FACET_ORDER).filter(Boolean);
      // "Down pat" is a claim about what you have actually been asked: every
      // facet that HAS come up is three-right-in-a-row. "Known" keeps the
      // strict rule (every facet the place supports, unopened ones counting
      // against it) because it is the stronger claim. Measuring down pat the
      // strict way made it structurally zero too, which was the whole problem.
      let worst = 'secure', any = false, allPat = false, patFail = false;
      for (const f of fs) {
        const card = this.data.cards[it.i + '|' + f];
        const st = cardState(card);
        if (card) { allPat = true; if (!cardDownPat(card)) patFail = true; }
        if (st === 'unseen') { worst = 'unseen'; continue; }
        any = true; cards++;
        if (st === 'met') met++;
        else if (st === 'known') known++;
        else if (st === 'secure') secure++;
        if (cardDownPat(card)) pat++;
        if (rank[st] < rank[worst]) worst = st;
      }
      if (any) itemsMet++;
      if (allPat && !patFail) itemsPat++;
      // "You can name it" is a claim about WHERE IT IS, not about knowing every
      // fact attached to it. Taking the minimum across all supported facets —
      // with a locked facet counting as unseen — made the headline structurally
      // unreachable: after six months of daily play it read "you can name 1 of
      // 93" when the truth on the place facet was 49. The strict reading is
      // kept below as `itemsDeep` for anyone who wants it.
      const primary = cardState(this.data.cards[it.i + '|' + fs[0]]);
      if (primary === 'known' || primary === 'secure') itemsKnown++;
      if (fs.length && (worst === 'known' || worst === 'secure')) itemsDeep++;
      sum += this.itemMastery(it.i, fs);
    }
    return {
      cards, met, known, secure, pat,
      items: items.length, itemsMet, itemsKnown, itemsDeep, itemsPat,
      pct: items.length ? sum / items.length : 0,
    };
  },

  dueCount(items, facetsFor) {
    const t = now();
    let n = 0;
    for (const it of items) {
      for (const f of (facetsFor ? facetsFor(it) : FACET_ORDER)) {
        const c = this.data.cards[it.i + '|' + f];
        if (c && c.st !== 'new' && c.due <= t) n++;
      }
    }
    return n;
  },

  // ── grading ────────────────────────────────────────────────────────────
  // `bonus` is the ease adjustment the QUESTION earned: cruel distractors or a
  // free-recall answer are worth more than a standard four-option one.
  answer(itemId, facet, right, wrongChoiceId, { bonus = 0, practice = false, missKm = null } = {}) {
    const k = itemId + '|' + facet;
    const c = this.data.cards[k] || newCard();
    c.last = now();
    c.ok = right;
    c.run = right ? (c.run || 0) + 1 : 0;

    if (practice) {
      // Practice does not advance an interval. Answering a card ahead of
      // schedule and counting it as a successful spaced retrieval is how a
      // scheduler quietly destroys its own spacing.
      this.data.cards[k] = c;
      this.recordAnswer(right, itemId, wrongChoiceId, missKm);
      return c;
    }

    if (right) {
      c.reps++;
      if (c.st === 'new' || c.st === 'learning') {
        c.st = 'learning';
        c.step++;
        if (c.step > LEARN_STEPS.length) { c.st = 'review'; c.iv = 1; c.due = now() + DAY; c.step = 0; }
        else c.due = now();                         // the round holds it
      } else if (c.st === 'relearning') {
        c.iv = Math.max(1, Math.round((c.ivBefore || c.iv || 1) * 0.35));
        c.st = 'review';
        c.due = now() + c.iv * DAY;
      } else {
        c.iv = Math.min(MAX_INTERVAL, Math.max(1, Math.round(c.iv * c.e)));
        c.due = now() + c.iv * DAY;
        // EASE HAD NO WAY UP. The bonus below is real, but it is paid for
        // `q.recall` or `q.cruel` and no question kind ever sets either flag —
        // so ease only ever came off, 0.25 at a time, and a third of all cards
        // ended up pinned to the 1.35 floor, where reaching the ceiling takes
        // nineteen flawless reviews instead of eight.
        //
        // RECOVERY, NOT GROWTH. This only climbs back toward the starting ease,
        // never past it: the fault was a ratchet with no pawl, not a scheduler
        // that was too cautious. Letting it run free stretched the seventh
        // correct answer from about a month to sixty-seven days, which is a
        // different and worse bug.
        if (c.reps - c.lapseRep >= 3 && c.e < EASE_START) {
          c.e = Math.min(EASE_START, c.e + 0.05);
        }
      }
      if (bonus) c.e = clamp(c.e + bonus, EASE_MIN, EASE_MAX);
      // The high-water interval: how settled this card has EVER been. The
      // frontier uses it to tell "never learned" from "learned and lapsed".
      c.top = Math.max(c.top || 0, c.iv);
    } else {
      if (c.st === 'review' || c.st === 'relearning') {
        if (c.st === 'review') { c.ivBefore = c.iv; c.lapses++; c.lapseRep = c.reps; }
        c.st = 'relearning';
        c.e = clamp(c.e - 0.25, EASE_MIN, EASE_MAX);
      } else {
        c.st = 'learning';
        c.step = 0;
      }
      c.due = now();
    }
    this.data.cards[k] = c;
    this.recordAnswer(right, itemId, wrongChoiceId, missKm);
    return c;
  },

  // WHAT HAPPENED TODAY, not just how much of it.
  //
  // This used to store a bare count of answers per day, which meant the app
  // could say "practised 43 of the last 50 days" and could NEVER say whether
  // any of it was working — the accuracy was thrown away as it arrived, and
  // no amount of later cleverness can reconstruct it. Old saves hold a number;
  // they are migrated in place on the next answer and simply start from there.
  //
  // `miss` is the total kilometres of map error and `missN` the count, so the
  // mean is a number that keeps falling long after right-or-wrong has
  // flattened out. It is the most sensitive progress signal the app has.
  recordAnswer(right, itemId, wrongChoiceId, missKm = null) {
    if (!right && wrongChoiceId && wrongChoiceId !== itemId) this.confuse(itemId, wrongChoiceId);
    this.data.stats.answered++;
    if (right) this.data.stats.right++;
    const key = dayKey();
    const prev = this.data.days[key];
    const day = (prev && typeof prev === 'object')
      ? prev
      : { n: typeof prev === 'number' ? prev : 0, right: 0 };
    day.n++;
    if (right) day.right++;
    if (missKm != null && Number.isFinite(missKm)) {
      day.missN = (day.missN || 0) + 1;
      day.miss = Math.round((day.miss || 0) + missKm);
    }
    this.data.days[key] = day;
    this.save();
  },

  // Your typical map error before today, so a round can say whether it was
  // closer than usual. Excludes today, or the comparison would include itself.
  priorMissKm(window = 30) {
    let km = 0, n = 0;
    for (let i = 1; i < window; i++) {
      const d = this.data.days[dayKey(now() - i * DAY)];
      if (d && typeof d === 'object' && d.missN) { km += d.miss; n += d.missN; }
    }
    return n >= 4 ? km / n : null;      // too few to be a "usual" anything
  },

  // The last `window` days that were actually played, newest last. The shape
  // is what a chart needs and what "am I getting better?" needs.
  trend(window = 60) {
    const out = [];
    for (let i = window - 1; i >= 0; i--) {
      const d = this.data.days[dayKey(now() - i * DAY)];
      if (!d) continue;
      const day = typeof d === 'object' ? d : { n: d, right: 0 };
      out.push({
        daysAgo: i,
        n: day.n || 0,
        right: day.right || 0,
        pct: day.n ? (day.right || 0) / day.n : null,
        missKm: day.missN ? day.miss / day.missN : null,
      });
    }
    return out;
  },

  // ── confusions ─────────────────────────────────────────────────────────
  // The key is SYMMETRIC. Mistaking Saint Lucia for Saint Vincent once and
  // Saint Vincent for Saint Lucia once is the same confusion twice; a
  // directional key would never reach the threshold.
  pairKey(a, b) { return [a, b].sort().join('~'); },

  confuse(a, b) {
    const k = this.pairKey(a, b);
    const rec = this.data.conf[k] || { n: 0, t: 0 };
    if (rec.t) {
      const months = (now() - rec.t) / (30 * DAY);
      if (months >= 1) rec.n *= Math.pow(0.5, Math.floor(months));
    }
    rec.n += 1;
    rec.t = now();
    this.data.conf[k] = rec;
  },

  confusionWeight(a, b) {
    const rec = this.data.conf[this.pairKey(a, b)];
    if (!rec) return 0;
    const months = rec.t ? (now() - rec.t) / (30 * DAY) : 0;
    return months >= 1 ? rec.n * Math.pow(0.5, Math.floor(months)) : rec.n;
  },

  confusions() {
    return Object.entries(this.data.conf)
      .map(([k, rec]) => {
        const [a, b] = k.split('~');
        return { a, b, n: this.confusionWeight(a, b), t: rec.t };
      })
      .filter((x) => x.n >= 2)
      .sort((x, y) => y.n - x.n);
  },

  // Clearing a drill leaves a residual: the pair stays a preferred distractor,
  // because that distinction is exactly the one worth continuing to test.
  clearConfusion(a, b) {
    this.data.conf[this.pairKey(a, b)] = { n: 0.5, t: now() };
    this.save();
  },

  // Seed from the groupings that are genuinely arguable — they are confusions
  // waiting to happen and the data already says where they are.
  seedConfusions(groups) {
    for (const g of groups || []) {
      for (const c of g.contested || []) {
        for (const m of (g.members || []).slice(0, 2)) {
          const k = this.pairKey(c, m);
          if (!this.data.conf[k]) this.data.conf[k] = { n: 0.5, t: now() };
        }
      }
    }
  },

  // ── days ───────────────────────────────────────────────────────────────
  // Not a streak that resets to zero and punishes one missed day. "Practised
  // 41 of the last 50 days" is the same information without the hostage-taking.
  practiceRecord(window = 50) {
    let n = 0;
    for (let i = 0; i < window; i++) if (this.data.days[dayKey(now() - i * DAY)]) n++;
    let run = 0;
    for (let i = 0; i < 400; i++) {
      if (this.data.days[dayKey(now() - i * DAY)]) run++;
      else if (i > 0) break;
    }
    return { of: window, days: n, run };
  },

  reset() { this.data = blank(); this.save(); },
};

// ── the scheduler ────────────────────────────────────────────────────────
//
// One instance per round. It owns the round's composition as well as its
// selection: a warm-up review, then reviews with new material placed in the
// middle, relearning folded back in, and nothing repeated back to back.
export class Scheduler {
  constructor(pool, facetsFor, { groupById = null, length = 14 } = {}) {
    this.pool = pool;
    this.facetsFor = facetsFor;
    this.groupById = groupById;
    this.lapses = [];
    this.held = new Map();            // item|facet -> question number it may return at
    this.serve = null;                // the last card handed out, so it can be handed back
    this.unaskable = new Set();       // no question can be built for these today
    this.requeues = new Map();        // item|facet -> times brought back this round
    this.asked = new Set();
    this.n = 0;
    this.lastKey = null;              // never the same place twice running
    this.served = { new: 0, review: 0, relearn: 0, depth: 0 };
    this.length = length;
  }

  // ── the scaffold rule ────────────────────────────────────────────────
  // Nothing is introduced until the thing that contains it is known and part
  // of its group frame is up. This replaces sorting new material by difficulty
  // tier, which in the Caribbean would have introduced sixty tiny islands
  // before it reached Dominica.
  ready(it) {
    if (it.pr) {
      const parentInPool = this.pool.some((p) => p.i === it.pr);
      if (parentInPool) {
        const pc = State.card(it.pr, 'place');
        if (!pc || pc.iv < PARENT_KNOWN_AT) return false;
      }
    }
    const gid = (it.g || [])[0];
    if (gid && this.groupById) {
      const g = this.groupById.get(gid);
      if (g) {
        const inPool = g.members.filter((m) => this.pool.some((p) => p.i === m));
        if (inPool.length > 2) {
          const met = inPool.filter((m) => { const c = State.card(m, 'place'); return c && c.st !== 'new'; }).length;
          // Two members of the group must be up before the rest arrive — which
          // is what makes the SSS islands a group rather than three dots.
          if (met < 2 && !inPool.slice(0, 2).some((m) => m === it.i)) return false;
        }
      }
    }
    return true;
  }

  supported(it) {
    const s = this.facetsFor(it);
    return FACET_ORDER.filter((f) => s.includes(f));
  }

  // A facet opens once the PLACE holds for five days — not once the facet
  // before it does.
  //
  // The chain was six deep, and the only part of it the evidence supports is
  // the first gate: location is the retrieval cue, so a capital learned before
  // a location is a free-floating word pair. Nothing in Stevens & Coupe or
  // Hirtle & Jonides says a flag must wait behind a capital; that is spatial
  // CONTAINMENT, and it is handled separately by ready().
  //
  // The chain also made depth an accident of shape. A plain country supports
  // [place, flag, capital] and saw flags on day 9; a Caribbean territory
  // supports [place, parent, group, flag, capital] and saw them on day 27 —
  // identical content, three weeks apart, because of how many facets it
  // happened to have. And every facet was hostage to the weakest link: one
  // leech on `parent` sealed off flag, capital and facts for good.
  facetOpen(it, facet) {
    const order = this.supported(it);
    const idx = order.indexOf(facet);
    if (idx <= 0) return true;
    const place = State.card(it.i, order[0]);
    return !!place && place.iv >= FACET_UNLOCK_AT;
  }

  // Places still being learned, measured on the PRIMARY facet only.
  //
  // Two mistakes here, both found by simulation. Counting cards meant a new
  // island brought three cards with it and a frontier of fourteen cards was
  // barely three places. Then counting ANY facet meant that the moment a
  // settled place opened its second facet it fell back into "learning" — so
  // after five weeks every place in flight was permanently unsettled and the
  // pack stopped introducing anything at all, forever. Depth must not block
  // breadth: the frontier asks how many places you cannot yet find, and going
  // deeper on a place you can find is not one of them.
  learningCount() {
    let n = 0;
    for (const it of this.pool) {
      const primary = this.supported(it)[0];
      if (!primary) continue;
      const c = State.card(it.i, primary);
      if (!c || c.st === 'new') continue;
      // Unsettled means the first facet has not yet reached the five-day
      // interval that opens the next one, or it has broken and is being
      // relearned. Using "short of 21 days" instead held the pack at ten
      // places for five weeks at a time: a place at ten days with five clean
      // retrievals is not occupying any working memory, and counting it as
      // in-flight put the whole Caribbean out of reach.
      // And a THIRD mistake, found the same way: counting relearning cards
      // meant the frontier filled with broken ones. A mature collection always
      // holds about a dozen in relearning, so the frontier jammed shut and the
      // pack stopped introducing anything — permanently, at 35 to 102 places
      // of 197, after which the collection slowly decayed while he played
      // daily. Relearning a card that once settled is REVIEW work, not
      // frontier work. `top` is the high-water interval, so the test is
      // "has this place ever settled", not "is it settled right now".
      if ((c.top || c.iv || 0) < FACET_UNLOCK_AT) n++;
    }
    return n;
  }

  // What is actually owed RIGHT NOW. projectedLoad divides a week's reviews by
  // seven, so a backlog of 56 reads as 8 a day and the ceiling never fires; a
  // debt you cannot clear in one sitting is the thing that should slow
  // introduction down, and this measures it directly.
  backlog() {
    const t = now();
    let n = 0;
    for (const it of this.pool) {
      for (const f of this.facetsFor(it)) {
        const c = State.card(it.i, f);
        if (c && c.st !== 'new' && c.due <= t) n++;
      }
    }
    return n;
  }

  // Reviews already booked for the next seven days, per day. The item cap
  // paces the opening of a pack; this paces its middle.
  projectedLoad() {
    const t = now();
    let n = 0;
    for (const it of this.pool) {
      for (const f of this.facetsFor(it)) {
        const c = State.card(it.i, f);
        if (c && c.st !== 'new' && c.due < t + 7 * DAY) n++;
      }
    }
    return n / 7;
  }

  // Just the frontier. A backlog gate was tried here and measured worse on
  // every axis that matters: over six months of the world pack it held the
  // player at 39 places met and 30 known, against 68 and 41 with no gate, and
  // saved only 17 cards of debt for it. The plateau it was meant to prevent
  // turned out to be entirely caused by counting relearning cards as frontier
  // work — fix that, and the debt looks after itself.
  frontierOpen() {
    return this.learningCount() < FRONTIER_ITEMS && this.projectedLoad() < LOAD_CEILING;
  }

  candidates() {
    const t = now();
    const due = [], fresh = [], relearn = [];
    for (const it of this.pool) {
      const order = this.supported(it);
      const first = order[0];
      for (const f of this.facetsFor(it)) {
        const key = it.i + '|' + f;
        if (this.asked.has(key) || this.unaskable.has(key)) continue;
        // A card waiting out its spacing gap is not a candidate. Without this
        // the requeue frees it from `asked` and the relearning branch serves it
        // on the very next question — the gap is the entire mechanism.
        if ((this.held.get(key) || 0) > this.n) continue;
        if (key === this.lastKey) continue;
        const c = State.card(it.i, f);
        if (!c || c.st === 'new') {
          if (this.facetOpen(it, f) && this.ready(it)) {
            fresh.push({ itemId: it.i, facet: f, item: it, tier: it.t || 3, first: f === first ? 1 : 0 });
          }
        } else if (c.st === 'relearning' || c.st === 'learning') {
          if (c.due <= t) relearn.push({ itemId: it.i, facet: f, item: it, over: t - c.due, iv: c.iv });
        } else if (c.due <= t) {
          due.push({ itemId: it.i, facet: f, item: it, over: t - c.due, iv: c.iv });
        }
      }
    }
    return { due, fresh, relearn };
  }

  hasWork() {
    const { due, fresh, relearn } = this.candidates();
    return due.length > 0 || relearn.length > 0 || (fresh.length > 0 && this.frontierOpen());
  }

  // What this position in the round wants. New material never lands in the
  // first three (not warmed up) or the last two (nothing left to space it
  // against), so its in-round repeat at +3 always fits inside the round.
  wants(pos) {
    const late = this.length !== Infinity && pos > this.length - 2;
    const early = pos <= 3;
    if (!early && !late && this.served.new < 5) return 'new';
    return 'review';
  }

  next() {
    this.n++;
    const pos = this.n;

    // 1. A card missed — or still in its learning steps — from earlier in this
    //    round, once enough has happened in between that it is recall rather
    //    than echo.
    const lapse = this.lapses.find((l) => l.notBefore <= pos
      && (l.itemId + '|' + l.facet) !== this.lastKey
      && !this.unaskable.has(l.itemId + '|' + l.facet));
    if (lapse) {
      this.lapses = this.lapses.filter((l) => l !== lapse);
      const key = lapse.itemId + '|' + lapse.facet;
      // Put it back in `asked` and clear the hold, or the ordinary path picks
      // it up again on the very next question — which is how the same card
      // ended up asked six times in one round.
      this.serve = { key, prev: this.lastKey, why: 'relearn', lapse, held: this.held.get(key) };
      this.asked.add(key);
      this.held.delete(key);
      this.served.relearn++;
      this.lastKey = key;
      return { ...lapse, why: lapse.why || 'relearn' };
    }

    const { due, fresh, relearn } = this.candidates();
    const want = this.wants(pos);

    // 2. Relearning carried over from previous sessions, before ordinary
    //    reviews: a broken card is worth more than a due one.
    if (relearn.length && (want !== 'new' || !fresh.length)) {
      relearn.sort((a, b) => b.over - a.over);
      return this.take(relearn[0], 'relearn');
    }

    // 3. New material, when the position wants it and the frontier is open.
    if (want === 'new' && fresh.length && this.frontierOpen()) {
      // The frame before the detail: a place's first facet outranks a second
      // facet on a place already met. Tier breaks ties inside a rung, and
      // latitude breaks those — the Bahamian chain, the Grenadines and the
      // Lesser Antilles arc are all monotonic north to south.
      // Sovereign states and territories are the frame; named islands are
      // detail hung on them. Mixing "San Andrés" into a round before Colombia
      // — or before the Dominican Republic — asks you to tell an obscure island
      // from a country, which is a different and much harder question than the
      // one intended.
      // DEPTH NEEDS RESERVED CAPACITY, NOT A RANKING.
      //
      // Sorting `first` ahead of everything meant a flag card that had
      // legitimately unlocked lost every contest to the opening facet of any
      // island never seen — and with ninety-three places in the pack there is
      // always such an island. So second facets were never served at all: the
      // reachable question space stayed about a dozen places on one facet with
      // three kinds, churned fourteen times a day, and eleven of eighteen
      // question kinds never appeared in four weeks.
      //
      // One new slot per round is kept for depth. It is not a ranking tweak,
      // because a ranking can always be starved.
      const depth = fresh.filter((f) => !f.first);
      if (depth.length && this.served.depth < DEPTH_PER_ROUND) {
        depth.sort((a, b) => (a.tier - b.tier) || ((b.item.ll?.[0] || 0) - (a.item.ll?.[0] || 0)));
        this.served.depth++;
        return this.take(depth[0], 'new', true);
      }
      fresh.sort((a, b) => (b.first - a.first)
        || (KIND_RANK[a.item.k] - KIND_RANK[b.item.k])
        || (a.tier - b.tier)
        || ((b.item.ll?.[0] || 0) - (a.item.ll?.[0] || 0)));
      return this.take(fresh[0], 'new');
    }

    // 4. Reviews, most overdue first, with a little variety at the head.
    if (due.length) {
      due.sort((a, b) => (b.over - a.over) || (a.iv - b.iv));
      const idx = due.length > 6 && Math.random() < 0.3 ? 1 + Math.floor(Math.random() * 2) : 0;
      return this.take(due[Math.min(idx, due.length - 1)], 'review');
    }

    // Nothing due, nothing relearning. The frontier exists to keep the pile of
    // unsettled places inside what a day can actually consolidate — but when
    // the round has no other work left, the pile is not what is binding, and
    // one more place beats grinding something already answered. A small overrun
    // only, so a large pack still cannot flood. (Without this a pack barely
    // larger than the frontier — Canada is thirteen units against a frontier of
    // twelve — holds its last unit back behind a settle that may not come.)
    if (fresh.length && this.learningCount() < FRONTIER_ITEMS + 3) return this.take(fresh[0], 'new');

    // 5. Nothing due and nothing new allowed. Practice, which is explicitly
    //    NOT credited to the schedule — see State.answer({ practice: true }).
    const any = [];
    for (const it of this.pool) {
      for (const f of this.facetsFor(it)) {
        const key = it.i + '|' + f;
        if (this.asked.has(key) || this.unaskable.has(key) || key === this.lastKey) continue;
        if ((this.held.get(key) || 0) > this.n) continue;
        const c = State.card(it.i, f);
        if (c && c.st !== 'new') any.push({ itemId: it.i, facet: f, item: it, iv: c.iv });
      }
    }
    if (!any.length) return null;
    any.sort((a, b) => a.iv - b.iv);
    return this.take(any[Math.floor(Math.random() * Math.min(5, any.length))], 'practice');
  }

  take(card, why, depth = false) {
    const key = card.itemId + '|' + card.facet;
    this.serve = { key, prev: this.lastKey, why, lapse: null, held: undefined, depth };
    this.lastKey = key;
    this.asked.add(key);
    if (why === 'new') this.served.new++;
    else if (why === 'review') this.served.review++;
    return { ...card, why };
  }

  // A card whose question could not be built was never actually asked, so give
  // it back whole.
  //
  // Leaving it consumed did two bad things. It burned the card for the round —
  // and, because the spacing guard keys off the LAST card served, it let the
  // card asked before it return as the very next question: the caller never saw
  // the discarded one, so from the player's side the identical question ran
  // twice in a row. That is the single most obviously broken thing a drill can
  // do, and it was invisible because the discard happened between two calls.
  reject(card) {
    const key = card.itemId + '|' + card.facet;
    const s = this.serve;
    if (!s || s.key !== key) return;
    this.lastKey = s.prev;
    this.asked.delete(key);
    this.n--;
    if (s.why === 'new') { this.served.new--; if (s.depth) this.served.depth--; }
    else if (s.why === 'review') this.served.review--;
    else if (s.why === 'relearn' && s.lapse) this.served.relearn--;
    // Set aside, not merely released. A card no question can be built for is
    // unaskable for the rest of the round, and putting it straight back in the
    // pool just means picking it again on the next pass — twenty-four times,
    // and then ending the round with material left unasked.
    this.unaskable.add(key);
    this.lapses = this.lapses.filter((l) => l !== s.lapse);
    this.serve = null;
  }

  // A miss comes back inside the round, at +3 questions and then +9. Three
  // successful retrievals with increasing gaps, at least one across a sleep,
  // before a card is called learned (Karpicke & Roediger 2008).
  requeue(itemId, facet, step = 0, why = 'relearn') {
    const item = this.pool.find((p) => p.i === itemId);
    if (!item) return;
    // Do not grind. A card that has already come back twice in this round is
    // not going to be fixed by a third go at it — that is a leech, and the
    // answer is a different question kind tomorrow or a drill, not repetition.
    const seen = (this.requeues.get(itemId + '|' + facet) || 0) + 1;
    this.requeues.set(itemId + '|' + facet, seen);
    if (seen > 2) return;
    const gap = LEARN_STEPS[Math.min(Math.max(step - 1, 0), LEARN_STEPS.length - 1)];
    const key = itemId + '|' + facet;
    this.asked.delete(key);
    this.held.set(key, this.n + gap);
    this.lapses.push({ itemId, facet, item, notBefore: this.n + gap, why });
  }

  missed(itemId, facet) { this.requeue(itemId, facet, 0, 'relearn'); }
}
