// Landfall — a round.
//
// The round owns the loop: pick a card, build a question for it, grade the
// answer, feed the result back to the scheduler. Everything here is free of
// the DOM so the same object drives Quick Play, Training and a confusion
// drill, and so it can be exercised headlessly.

import { DB, inPack, loadMap, loadFlags, item, distanceKm, bearingFrom } from './data.js';
import { buildQuestion, facetsFor, KINDS, nearMisses } from './engine.js';
import { State, Scheduler } from './schedule.js';

export class Round {
  constructor({ packIds, length = 14, kinds = null, cruel = false, mode = 'quick', drill = null, detail = false }) {
    this.packIds = packIds.filter((p) => DB.packs.has(p));
    if (!this.packIds.length) this.packIds = ['caribbean'];
    this.mode = mode;
    this.length = mode === 'training' ? Infinity : length;
    this.drill = drill;
    const seen = new Set();
    this.pool = [];
    for (const p of this.packIds) {
      for (const it of inPack(p)) {
        if (seen.has(it.i)) continue;
        seen.add(it.i);
        this.pool.push(it);
      }
    }
    this.preferMap = DB.packs.get(this.packIds[0])?.map || null;
    this.ctx = { pool: this.pool, cruel, kinds, detail, preferMap: this.preferMap };
    this.sched = new Scheduler(this.pool, (it) => facetsFor(it, this.ctx),
      { groupById: DB.groups, length: this.length });
    this.asked = [];
    this.kindsAsked = new Map();     // (item|facet) -> kinds already used this round
    this.results = [];
    this.streak = 0;
    this.bestStreak = 0;
    this.current = null;
    this.startedAt = Date.now();
  }

  // Every map any pool item might be asked on, plus the flags. Loaded up front
  // so a question never waits on the network mid-round.
  async warm() {
    const maps = new Set();
    for (const it of this.pool) for (const m of it.m || []) maps.add(m);
    if (this.preferMap) maps.add(this.preferMap);
    const wanted = [...maps].slice(0, 6);
    await Promise.all([loadFlags().catch(() => null), ...wanted.map((m) => loadMap(m).catch(() => null))]);
  }

  get done() {
    if (this.asked.length >= this.length) return true;
    // Training runs until the pack is up to date rather than to a fixed count.
    if (this.mode === 'training' && this.asked.length >= 5 && !this.sched.hasWork()) return true;
    return false;
  }

  next() {
    if (this.done) return null;
    // A drill is a fixed head-to-head: the two places that keep being mistaken
    // for each other, asked against each other until it sticks.
    for (let tries = 0; tries < 24; tries++) {
      const card = this.drill ? this.drillCard(tries) : this.sched.next();
      if (!card) break;
      const it = card.item || item(card.itemId);
      if (!it) { this.sched.reject(card); continue; }
      const seenKinds = this.kindsAsked.get(card.itemId + '|' + card.facet);
      const ctx = this.drill ? { ...this.ctx, cruel: true } : this.ctx;
      const q = buildQuestion(it, card.facet, seenKinds ? { ...ctx, avoid: seenKinds } : ctx);
      // No question could be built for this card right now — hand it back to
      // the scheduler rather than silently spending it. See Scheduler.reject.
      if (!q) { this.sched.reject(card); continue; }
      q.why = card.why;
      if (!seenKinds) this.kindsAsked.set(card.itemId + '|' + card.facet, new Set([q.kind]));
      else seenKinds.add(q.kind);
      this.current = q;
      this.asked.push(q);
      return q;
    }
    this.length = this.asked.length;      // nothing left to ask — end cleanly
    return null;
  }

  drillCard(n) {
    const [a, b] = [this.drill.a, this.drill.b];
    const id = n % 2 === 0 ? a : b;
    const it = item(id);
    if (!it) return null;
    const facets = facetsFor(it, this.ctx);
    return { itemId: id, facet: facets[Math.floor(Math.random() * facets.length)], item: it, why: 'drill' };
  }

  // Grade. `choiceId` is an option id or a map feature id; null means the
  // question was skipped, which counts as wrong but is not recorded as a
  // confusion (no wrong answer was actually chosen).
  answer(choiceId) {
    const q = this.current;
    if (!q) return null;
    const right = choiceId === q.correctId;
    // Ease moves on how hard the QUESTION was, not on a self-rating: a cruel
    // distractor set or a free-recall answer is worth more than a standard
    // four-option one. The app built the question, so it knows.
    const bonus = right ? (q.recall ? 0.25 : q.cruel || this.ctx.cruel ? 0.15 : 0) : 0;

    // HOW FAR OUT WERE YOU. On a map question a wrong answer is not one thing:
    // tapping the island next door and tapping the wrong end of the Caribbean
    // are different mistakes, and only one of them means you do not know where
    // the place is. The distance is the honest measure of a map error, and —
    // unlike right-or-wrong — it keeps improving long after accuracy flattens,
    // which makes it the one number that can show progress month to month.
    const target = item(q.correctId);
    const hit = !right && choiceId && choiceId !== q.correctId ? item(choiceId) : null;
    const missKm = q.form === 'map' && hit ? distanceKm(hit, target) : null;
    const missDir = missKm != null ? bearingFrom(hit, target) : null;

    const card = State.answer(
      q.itemId, q.facet, right,
      right ? null : (choiceId && choiceId !== q.correctId ? choiceId : null),
      { bonus, practice: q.why === 'practice', missKm },
    );
    if (right) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      // Still inside its learning steps: bring it back later in this round.
      // Three successful retrievals with growing gaps, not one and gone.
      if (card.st === 'learning' && card.step) this.sched.requeue(q.itemId, q.facet, card.step, 'learning');
    } else {
      this.streak = 0;
      this.sched.missed(q.itemId, q.facet);
    }
    this.results.push({ q, choiceId, right, missKm });
    if (this.drill && right) this.drillHits = (this.drillHits || 0) + 1;
    if (this.drill && !right) this.drillHits = 0;
    return {
      right,
      correctId: q.correctId,
      chosen: choiceId,
      label: q.answerLabel,
      explain: q.explain || null,
      note: item(q.correctId)?.note || item(q.itemId)?.note || null,
      missKm, missDir,
    };
  }

  summary() {
    const right = this.results.filter((r) => r.right).length;
    const missed = this.results.filter((r) => !r.right).map((r) => r.q);
    return {
      asked: this.results.length,
      right,
      missed,
      pct: this.results.length ? right / this.results.length : 0,
      bestStreak: this.bestStreak,
      seconds: Math.round((Date.now() - this.startedAt) / 1000),
      newItems: this.asked.filter((q) => q.why === 'new').length,
      mapMisses: this.results.filter((r) => r.missKm != null).map((r) => r.missKm),
    };
  }
}
