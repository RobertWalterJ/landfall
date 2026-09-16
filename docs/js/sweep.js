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
import { State, cardState } from './schedule.js';

const DAY = 24 * 3600e3;
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

const namesOf = (it) => [it.n, ...(it.alt || [])].filter(Boolean);

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
    for (const other of setItems) {
      if (other.i === target.i) continue;
      if (distanceTo(inp, other) <= mine) return null;
    }
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
