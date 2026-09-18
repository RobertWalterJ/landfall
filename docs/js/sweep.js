// Landfall — Label the Map: choosing a set, and answering by name.
//
// This is the mode the whole app is pointed at. Removing the four options
// converts the engine from RECOGNITION to PRODUCTION, and that distinction is
// the point: you get good at the format you practise (Slamecka & Graf's
// generation effect, 1978; transfer-appropriate processing). The rest of the
// app can be multiple choice. This is where naming every island in the Leewards
// is actually demonstrated.
//
// Two rules here are load-bearing:
//
//   A SET IS ONLY OFFERED WHEN MOST OF IT IS ALREADY MET. A sweep of sixty
//   unmet islands is sixty blank stares, and a blank stare is not retrieval
//   practice. Label the Map never introduces new places.
//
//   NAME MODE MUST BE GENEROUS OR IT IS USELESS. Accents, Saint/St/Sint,
//   trailing "Island", alternative names and ordinary misspellings are all
//   correct, and a near miss is marked correct with the spelling shown quietly
//   underneath. Never a half mark, never a red mark for orthography.

import { DB, item, inPack, withArticle } from './data.js';
import { State, cardState, DAY } from './schedule.js';

export const READY_AT = 0.7;          // share of a set that must be met
export const GAP_2 = 7 * DAY;         // second clean sweep, at least a week on
export const GAP_3 = 30 * DAY;        // third, at least a month after that

// ── the sets you can sweep ───────────────────────────────────────────────
//
// A pack, a curated group, or one place's children ("the islands of the
// Bahamas"). All three are just a list of items that appear on one map.
export function sweepSets(packIds, facetsFor) {
  const out = [];
  const seen = new Set();

  const build = (key, name, blurb, mapId, items) => {
    const onMap = items.filter((it) => DB.maps.get(mapId)?.f?.[it.i]?.d);
    if (onMap.length < 4 || seen.has(key)) return;
    // Only the most specific feature: the Bahamas and its named islands are
    // both here, and asking for "the Bahamas" when Andros is a separate target
    // is a question with two defensible answers.
    const parents = new Set(onMap.map((it) => it.pr).filter(Boolean));
    const members = onMap.filter((it) => !parents.has(it.i));
    if (members.length < 4) return;
    const met = members.filter((it) => cardState(State.card(it.i, 'place')) !== 'unseen');
    seen.add(key);
    out.push({
      key, name, blurb, mapId, members,
      met: met.length,
      ready: met.length / members.length >= READY_AT,
      status: sweepStatus(key),
    });
  };

  for (const pid of packIds) {
    const p = DB.packs.get(pid);
    if (!p) continue;
    build('pack:' + pid, p.name, p.blurb, p.map, inPack(pid));
  }

  // Groups whose members are mostly on one of these maps.
  const maps = new Set(packIds.map((p) => DB.packs.get(p)?.map).filter(Boolean));
  for (const g of DB.groups.values()) {
    for (const mapId of maps) {
      const items = g.members.map(item).filter((it) => it && DB.maps.get(mapId)?.f?.[it.i]);
      if (items.length >= 4) build('group:' + g.id, g.name, g.blurb, mapId, items);
    }
  }

  // A parent and its children, where there are enough of them to be a sweep.
  const byParent = new Map();
  for (const pid of packIds) {
    for (const it of inPack(pid)) {
      if (!it.pr) continue;
      if (!byParent.has(it.pr)) byParent.set(it.pr, []);
      byParent.get(it.pr).push(it);
    }
  }
  for (const [pid, kids] of byParent) {
    const parent = item(pid);
    if (!parent || kids.length < 4) continue;
    const mapId = (kids[0].m || [])[0];
    if (!mapId) continue;
    build('parent:' + pid, 'The islands of ' + withArticle(parent),
      kids.length + ' named islands of ' + withArticle(parent) + '.', mapId, kids);
  }

  // What he could probably do right now, first: ready sets before unready ones,
  // then the ones not swept recently, then the smaller ones.
  out.sort((a, b) => (b.ready - a.ready)
    || ((a.status.last || 0) - (b.status.last || 0))
    || (a.members.length - b.members.length));
  return out;
}

// ── clean sweeps and held regions ────────────────────────────────────────
//
// A clean sweep is every feature named first time: no misses, no gives. A
// region is HELD when it has been cleanly swept three times at expanding gaps
// — any first, a second at least a week later, a third at least a month after
// that. That takes five weeks at minimum and cannot be faked in an afternoon,
// which is the whole reason the word means anything.
export function sweepStatus(key) {
  const rec = State.data.sweeps[key] || {};
  const clean = (rec.clean || []).slice().sort((a, b) => a - b);
  let stage = 0, since = null;
  for (const t of clean) {
    if (stage === 0) { stage = 1; since = t; }
    else if (stage === 1 && t - since >= GAP_2) { stage = 2; since = t; }
    else if (stage === 2 && t - since >= GAP_3) { stage = 3; since = t; }
  }
  const held = stage >= 3 && !rec.droppedAt;
  let waitFor = null;
  if (!held && clean.length) {
    const last = clean[clean.length - 1];
    const need = stage === 1 ? GAP_2 : stage === 2 ? GAP_3 : 0;
    if (need) waitFor = Math.max(0, Math.ceil((last + need - Date.now()) / DAY));
  }
  return {
    clean: clean.length, stage, held, heldSince: held ? since : null,
    droppedAt: rec.droppedAt || null, droppedNames: rec.droppedNames || [],
    best: rec.best || 0, last: rec.last || 0, waitFor,
  };
}

export function recordSweep(key, { cleanSweep, named, total, failed }) {
  const rec = State.data.sweeps[key] || { clean: [], best: 0 };
  rec.clean = rec.clean || [];
  rec.last = Date.now();
  rec.best = Math.max(rec.best || 0, named);
  const before = sweepStatus(key);
  if (cleanSweep) {
    rec.clean.push(Date.now());
    rec.droppedAt = null;
    rec.droppedNames = [];
  } else if (before.held) {
    // Held is revocable. That is what makes it worth holding.
    rec.droppedAt = Date.now();
    rec.droppedNames = failed.slice(0, 6);
  }
  State.data.sweeps[key] = rec;
  State.save();
  return { was: before, now: sweepStatus(key) };
}

// ── name matching ────────────────────────────────────────────────────────
const STRIP = /\b(island|islands|isle|isles|isla|islas|ile|iles|cay|cays|key|keys|the|of)\b/g;

export function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')       // Curacao = Curaçao
    .replace(/[''`]/g, '')
    .replace(/\bs(ain)?t\.?\b/g, 'st')                       // Saint / St. / St
    .replace(/\bsint\b/g, 'st')                              // Sint Maarten
    .replace(STRIP, '')
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// HOW IT SOUNDS, not how it is spelled.
//
// Edit distance forgives TYPOS — a dropped letter, a doubled one. It does not
// forgive the error dyslexia actually produces, which is a phonetically
// plausible respelling; and a phonetic attempt at a French, Spanish or Carib
// name costs three to five edits. Measured against the real Caribbean set,
// "Eluthra", "Tortolla", "Angwilla" and "Bonnair" all passed, while "Anteega",
// "Beckway", "Musteek", "Mayrow", "Carrycoo", "Kurasow" and "Gwadaloop" were
// all marked wrong. The mode's own promise is "spelling is never marked", and
// for the one speller it was written for, it was.
//
// This is a consonant skeleton with the spelling conventions that vary between
// languages folded together. It is deliberately not Double Metaphone: the
// corpus is a few thousand place names, the failure mode that matters is a
// FALSE accept, and every key is checked for collisions across the set before
// it is allowed to decide anything.
export function phonetic(raw) {
  let s = String(raw || '')
    .toLowerCase()
    .replace(/ç/g, 's')                    // Curaçao sounds like an s, and the
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accent is gone by here
    .replace(/[''`]/g, '')
    .replace(/s(ain)?t\.?/g, 'st')
    .replace(/sint/g, 'st')
    .replace(STRIP, '')
    .replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s
    .replace(/(.)\1+/g, '$1')             // Tortolla -> Tortola, Barboooda -> Barboda
    .replace(/ph/g, 'f')
    .replace(/qu?/g, 'k')                  // Bequia / Beckway, Mustique / Musteek
    .replace(/ck/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/c(?=[eiy])/g, 's')           // Vieques, Ponce
    .replace(/c/g, 'k')
    .replace(/gw/g, 'g')                   // Guadeloupe / Gwadaloop
    .replace(/v/g, 'b')                    // Vieques / "Beeakes" — Spanish b and v
    .replace(/h/g, '');
  const head = s[0];
  const rest = s.slice(1).replace(/[aeiouwy]/g, '');   // w and y ride with the vowels
  // The trailing r goes LAST, once the vowels are out, so that Saba and
  // "Saber", Bonaire and "Bonnair", land in the same place whichever side of
  // the written schwa the r happens to fall.
  const key = (head + rest).replace(/(.)\1+/g, '$1');
  // ...but never down to a single letter: a one-character key is too lossy to
  // be allowed to decide anything, and keysOf drops it, which would leave
  // Mayreau/"Mayrow" with nothing to match on at all.
  return key.length > 2 ? key.replace(/r$/, '') : key;
}

const namesOf = (it) => [it.n, ...(it.alt || [])].filter(Boolean);
const keysOf = (it) => namesOf(it).map(phonetic).filter((k) => k.length >= 2);

// How wrong the typed name is for this place: 0 is exact, Infinity is not a
// match at all. Tolerance rises with length, because a one-letter slip in
// "Eleuthera" is a typo and a one-letter slip in "Saba" is a different island.
function distanceTo(inp, it) {
  let best = Infinity;
  for (const n of namesOf(it)) {
    const norm = normalise(n);
    if (!norm) continue;
    const tol = norm.length <= 5 ? 1 : norm.length <= 9 ? 2 : 3;
    const d = levenshtein(inp, norm);
    if (d <= tol) best = Math.min(best, d);
  }
  return best;
}

// Returns null for no match, or { exact, spelling } where `spelling` is the
// correct form to show quietly when what was typed was not quite it.
//
// THE BEST MATCH IN THE SET WINS, and a tie is a refusal. Without that rule
// generosity turns into nonsense: "South Caicos" is two edits from North
// Caicos and "Cuba" is two from Aruba, so both were being marked correct for
// the wrong island. Nothing may be accepted for one place when it is at least
// as good an answer for another place in the same sweep.
export function matchName(input, target, setItems = []) {
  const inp = normalise(input);
  if (inp.length < 3) return null;

  const mine = distanceTo(inp, target);
  if (Number.isFinite(mine)) {
    // A TIE IS A QUESTION, NOT A REFUSAL.
    //
    // The rule is right — nothing may be accepted for one place when it is at
    // least as good an answer for another — but refusing outright marks a
    // correct memory wrong. Sint Maarten and Saint Martin both normalise to
    // st-ma(a)rt(e/i)n, two edits apart, so a single dropped letter in either
    // sat one edit from BOTH and was marked wrong: the two halves of one island
    // under two flags, the most confusable pair in the corpus, and the pair he
    // most needs to be able to answer. Now it asks which he meant.
    // A place that answers BETTER is not ambiguity, it is a wrong answer:
    // typing "South Caicos" when the target is North Caicos matches South
    // exactly, and offering a choice there would simply hand over the answer.
    // Only a genuine TIE — equally good for two places — is a question.
    if (setItems.some((o) => o.i !== target.i && distanceTo(inp, o) < mine)) return null;
    const ties = setItems.filter((o) => o.i !== target.i && distanceTo(inp, o) === mine);
    if (ties.length) return { ambiguous: [target, ...ties] };
    return { exact: mine === 0, spelling: target.n };
  }

  // "Abaco" for "Great Abaco", "Exuma" for "Great Exuma". Accepted only if no
  // OTHER place in this sweep answers to the same fragment — otherwise typing
  // "Cayman" passes for all three of them and the discrimination that makes
  // the Caymans worth learning is lost.
  if (inp.length >= 4 && namesOf(target).some((n) => normalise(n).includes(inp))) {
    const others = setItems.filter((it) => it.i !== target.i
      && namesOf(it).some((n) => normalise(n).includes(inp)));
    if (!others.length) return { exact: false, spelling: target.n };
  }

  // SECOND PASS: does it SOUND right? Edit distance forgives typos; this
  // forgives a phonetically plausible respelling, which is the error that
  // actually turns up. Same uniqueness rule, and it has to be exclusive — the
  // key is deliberately lossy (in a world pack it puts China and Kenya
  // together), so anything it matches for more than one place in the set is
  // handed back as ambiguous rather than guessed at.
  const key = phonetic(input);
  if (key.length >= 2 && keysOf(target).includes(key)) {
    const rivals = setItems.filter((it) => it.i !== target.i && keysOf(it).includes(key));
    if (!rivals.length) return { exact: false, spelling: target.n, heard: true };
    return { ambiguous: [target, ...rivals] };
  }
  return null;
}

// ── speech input ─────────────────────────────────────────────────────────
// Output is speech.js; input is the same API surface, and absent on plenty of
// browsers, so everything here degrades to "the button is not offered".
export function listenAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listen(onResult, onEnd) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) return null;
  try {
    const r = new Rec();
    r.lang = 'en-CA';
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      const alts = [...e.results[0]].map((x) => x.transcript);
      onResult(alts);
    };
    r.onend = () => onEnd && onEnd();
    r.onerror = () => onEnd && onEnd();
    r.start();
    return r;
  } catch { onEnd && onEnd(); return null; }
}
