// Landfall — THE CHAIN, the home screen's hero.
//
// Halyard strung real flags along a catenary. Wordhoard drifted real words.
// Landfall strings REAL ISLAND SILHOUETTES — the same pre-projected path data
// the quiz draws its maps from — along a dotted survey traverse.
//
// Two decisions make it work:
//
//   Each silhouette is normalised to ITS OWN bounding box, so Saba (0.9 units
//   across) and Cuba (320) appear at the same size. The hero is about shape
//   recognition, not area.
//
//   The fill is mastery. Pale outline = never met, brass = met, inked = known.
//   So the hero IS the progress display, which is why the status chips below it
//   can stay small — and why day 1 (a pale, unsurveyed coast with one mark on
//   it) is the correct picture of an empty state rather than a sad one.

import { DB, item } from './data.js';
import { State } from './schedule.js';

// A tiny deterministic PRNG, so a re-render inside one visit is stable while
// every new visit reshuffles.
function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const svgNS = 'http://www.w3.org/2000/svg';

export function heroCandidates(packIds) {
  const out = [];
  const seen = new Set();
  for (const pid of packIds) {
    const pack = DB.packs.get(pid);
    const map = pack && DB.maps.get(pack.map);
    if (!map) continue;
    for (const [id, f] of Object.entries(map.f)) {
      if (!f.d || seen.has(id)) continue;
      const bb = f.mb || f.bb;
      if (!bb) continue;
      const w = bb[2] - bb[0], h = bb[3] - bb[1];
      if (Math.max(w, h) < 2) continue;          // a dot is not a silhouette
      const it = item(id);
      if (!it) continue;
      seen.add(id);
      out.push({ id, it, d: f.d, bb });
    }
  }
  return out;
}

export function renderHero(host, { packIds, markId = null, onPick = null, visit = 0, facetsFor = null } = {}) {
  host.replaceChildren();
  const pool = heroCandidates(packIds);
  if (!pool.length) return;

  const width = host.clientWidth || 340;
  const n = width >= 380 ? 9 : 7;
  const rand = rng(new Date().toISOString().slice(0, 10) + ':' + visit + ':' + packIds.join());

  // Always a mix of what you know and what you do not, at every stage.
  const mastery = (c) => State.itemMastery(c.id, facetsFor ? facetsFor(c.it) : null);
  const met = pool.filter((c) => mastery(c) > 0);
  const fresh = pool.filter((c) => mastery(c) === 0);
  const shuffle = (a) => a.map((v) => [rand(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const wantMet = Math.min(met.length, Math.round(n * 0.6));
  const chosen = shuffle([...shuffle(met).slice(0, wantMet), ...shuffle(fresh).slice(0, n - wantMet)]).slice(0, n);
  if (markId && !chosen.some((c) => c.id === markId)) {
    const m = pool.find((c) => c.id === markId);
    if (m) chosen[chosen.length - 1] = m;
  }

  const h = host.clientHeight || 180;
  const pad = 34;
  const span = Math.max(width - pad * 2, 80);
  const pts = chosen.map((c, i) => {
    const t = chosen.length === 1 ? 0.5 : i / (chosen.length - 1);
    const x = pad + t * span;
    // A shallow catenary, plus jitter so they sit ON the line rather than in a
    // row. Alternating above and below reads as a survey traverse.
    const sag = (Math.pow(2 * t - 1, 2) - 0.34) * (h * 0.16);
    const y = h * 0.5 + sag + (rand() * 20 - 10) + (i % 2 ? 7 : -7);
    return { x, y, c };
  });

  const line = document.createElementNS(svgNS, 'svg');
  line.setAttribute('class', 'line');
  line.setAttribute('viewBox', `0 0 ${width} ${h}`);
  line.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(''));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--vermilion)');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-dasharray', '1 7');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('opacity', '.45');
  line.append(path);
  host.append(line);

  const chain = document.createElement('div');
  chain.className = 'chain';
  pts.forEach((p, i) => {
    const { c } = p;
    const m = mastery(c);
    const fill = m === 0 ? 'var(--land-unseen)' : m > 0.55 ? 'var(--land-known)' : 'var(--land-shaky)';
    const box = document.createElement(onPick ? 'button' : 'div');
    box.className = 'isle tap small';
    box.style.cssText = `left:${p.x}px; top:${p.y}px; --i:${i}`;
    if (onPick) {
      box.setAttribute('aria-label', c.it.n);
      box.addEventListener('click', () => onPick(c.id));
    }
    const [x0, y0, x1, y1] = c.bb;
    const w = Math.max(x1 - x0, 0.4), hh = Math.max(y1 - y0, 0.4);
    const padX = w * 0.08, padY = hh * 0.08;
    const swell = document.createElementNS(svgNS, 'svg');
    swell.setAttribute('class', 'swell');
    swell.setAttribute('viewBox', `${x0 - padX} ${y0 - padY} ${w + padX * 2} ${hh + padY * 2}`);
    swell.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const p2 = document.createElementNS(svgNS, 'path');
    p2.setAttribute('d', c.d);
    p2.setAttribute('fill', fill);
    if (m === 0) { p2.setAttribute('stroke', 'var(--sea)'); p2.setAttribute('stroke-opacity', '.28'); p2.setAttribute('stroke-width', '0.9'); p2.setAttribute('vector-effect', 'non-scaling-stroke'); }
    swell.append(p2);
    box.append(swell);

    // Exactly one mark, on the place the next question is about. It is the
    // focal point, and it is real information rather than decoration.
    if (c.id === markId) {
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.innerHTML = '<svg viewBox="0 0 12 12"><path d="M2 2 L10 10 M10 2 L2 10"/></svg>';
      box.append(mark);
    }
    chain.append(box);
  });
  host.append(chain);
}
