// Landfall — drawing the maps.
//
// Everything arrives pre-projected, so this file only ever sets a viewBox and
// paints path strings. Two details matter on a phone:
//
// TAP TARGETS. Saba is about one pixel across at Caribbean scale and Barbados
// is a marker rather than a shape. Every candidate therefore gets an invisible
// circle of at least 22 units over it, so the thing you are asked to tap is
// always tappable even when the thing you are tapping is not visible.
//
// ZOOM TO THE CANDIDATES. At whole-map scale a thumb covers half the Lesser
// Antilles. The view eases to the bounding box of whatever is in play, which is
// what makes "where is Bequia" a real question rather than a stab.

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
};

const ease = (t) => 1 - Math.pow(1 - t, 3);

export class MapView {
  constructor(host) {
    this.host = host;
    this.svg = el('svg', { class: 'map', preserveAspectRatio: 'xMidYMid meet' });
    this.gCtx = el('g', { class: 'map-ctx' });
    this.gBase = el('g', { class: 'map-base' });
    this.gHit = el('g', { class: 'map-hit' });
    this.gPin = el('g', { class: 'map-pin' });
    this.svg.append(this.gCtx, this.gBase, this.gHit, this.gPin);
    host.replaceChildren(this.svg);
    this.view = null;
    this.raf = 0;
    this.reserve = 0;        // screen space something else is covering, in px
    this.onSettle = null;
  }

  // How many SVG units one CSS pixel is worth at the current zoom. Everything
  // to do with touch targets has to be computed through this.
  unitsPerPx() {
    const w = this.host.getBoundingClientRect().width || 360;
    return (this.view ? this.view[2] : (this.map?.w || 1000)) / w;
  }

  // ── viewBox handling ───────────────────────────────────────────────────
  setView(box, { animate = true } = {}) {
    const target = this.fit(box);
    if (!this.view || !animate) {
      this.view = target;
      this.apply(target);
      return;
    }
    const from = this.view.slice();
    const t0 = performance.now();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.settleTimer);
    // Safety net: rAF does not run while the page is hidden, so without this a
    // map opened in a background tab stays at whatever view it started on and
    // the question is unanswerable. The tween is the nice path, not the only one.
    this.settleTimer = setTimeout(() => {
      if (this.view !== target) { this.view = target; this.apply(target); this.onSettle?.(); }
    }, 600);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = ease(k);
      const cur = from.map((v, i) => v + (target[i] - v) * e);
      this.apply(cur);
      this.view = cur;
      if (k < 1) this.raf = requestAnimationFrame(step);
      else { this.view = target; clearTimeout(this.settleTimer); this.onSettle?.(); }
    };
    this.raf = requestAnimationFrame(step);
  }

  apply(v) { this.svg.setAttribute('viewBox', v.map((n) => Math.round(n * 10) / 10).join(' ')); }

  // Grow a box to the aspect ratio of the element so nothing is squashed, and
  // never zoom in past a floor — a single small island filling the screen is
  // disorienting, you want to see it in its neighbourhood.
  // `reserve` is the height, in CSS pixels, that something else is covering —
  // the verdict sheet takes 58% of the screen, and framing the answer inside
  // the full rect puts it underneath. The map must keep the thing it is being
  // asked about visible.
  fit(box) {
    const r = this.host.getBoundingClientRect();
    const usable = Math.max(80, (r.height || 300) - this.reserve);
    const aspect = (r.width || 360) / usable;
    let [x0, y0, x1, y1] = box;
    let w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const floor = Math.max(this.map ? this.map.w * 0.035 : 30, 26);
    if (w < floor) w = floor;
    if (h < floor / aspect) h = floor / aspect;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    // Shift the centre up by half the covered height so the framed feature
    // sits in the part of the map that is still showing.
    const shift = this.reserve ? (this.reserve / 2) * (h / Math.max(usable, 1)) : 0;
    h *= 1 + (this.reserve ? this.reserve / Math.max(usable, 1) : 0);
    let x = cx - w / 2, y = cy - h / 2 - shift;
    // Keep the frame on the chart. Without this, fitting a wide spread of
    // candidates into a tall well pans hundreds of units off the top of the
    // map and most of the screen is empty sea.
    if (this.map) {
      if (w <= this.map.w) x = Math.max(0, Math.min(x, this.map.w - w));
      else x = (this.map.w - w) / 2;
      if (h <= this.map.h) y = Math.max(0, Math.min(y, this.map.h - h));
      else y = (this.map.h - h) / 2;
    }
    return [x, y, w, h];
  }

  boxOf(ids, pad = 0.5) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const f = this.map.f[id];
      if (!f) continue;
      const bb = f.bb || [f.cx - 3, f.cy - 3, f.cx + 3, f.cy + 3];
      x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]);
      x1 = Math.max(x1, bb[2]); y1 = Math.max(y1, bb[3]);
    }
    if (!Number.isFinite(x0)) return [0, 0, this.map.w, this.map.h];
    const w = x1 - x0, h = y1 - y0;
    return [x0 - w * pad - 6, y0 - h * pad - 6, x1 + w * pad + 6, y1 + h * pad + 6];
  }

  // ── drawing ────────────────────────────────────────────────────────────
  draw(map, { candidates = [], highlight = null, shade = null, onPick = null, labels = null, rings = true } = {}) {
    this.map = map;
    this.svg.setAttribute('data-map', map.id);
    this.gCtx.replaceChildren();
    this.gBase.replaceChildren();
    this.gHit.replaceChildren();
    this.gPin.replaceChildren();

    if (map.ctx) this.gCtx.append(el('path', { d: map.ctx, class: 'ctx' }));

    const candSet = new Map(candidates.map((c) => [c.id, c]));
    for (const [id, f] of Object.entries(map.f)) {
      const isCand = candSet.has(id);
      const cls = ['feat'];
      if (isCand) cls.push('cand');
      if (highlight === id) cls.push('hi');
      let tone = null;
      if (shade) {
        const v = shade(id);
        if (v != null) tone = v;
      }
      if (f.d) {
        const p = el('path', { d: f.d, class: cls.join(' '), 'data-id': id });
        if (tone != null) p.style.fill = tone;
        this.gBase.append(p);
      } else {
        const c = el('circle', { cx: f.cx, cy: f.cy, r: 3.2, class: cls.concat('dot').join(' '), 'data-id': id });
        if (tone != null) c.style.fill = tone;
        this.gBase.append(c);
      }
    }

    // A ring around anything in play that is too small to see on its own.
    // Suppressed when everything on the map is in play (Label the Map), where
    // ringing eighty islands is noise rather than a signal.
    for (const c of (rings ? candidates : [])) {
      const f = map.f[c.id];
      if (!f) continue;
      const size = f.bb ? Math.max(f.bb[2] - f.bb[0], f.bb[3] - f.bb[1]) : 0;
      if (size < 16) {
        // A position circle from chart practice: "this small thing is in play".
        this.gPin.append(el('circle', { cx: f.cx, cy: f.cy, r: 11, class: 'pos', 'data-id': c.id }));
      }
    }

    if (labels) {
      for (const [id, text] of Object.entries(labels)) {
        const f = map.f[id];
        if (!f) continue;
        const t = el('text', { x: f.cx, y: f.cy - 13, class: 'mlabel' });
        t.textContent = text;
        this.gPin.append(t);
      }
    }

    if (onPick) {
      this.candidates = candidates;
      this.onPick = onPick;
      this.layHits();
      // Hit radii are in SVG units, which mean nothing until the zoom has
      // settled: 22 units is over 100px zoomed into the Lesser Antilles and
      // about 7px on the unzoomed world map. Lay them again when the ease ends.
      this.onSettle = () => this.layHits();
    }
  }

  // A 60px effective target at every zoom level (Fitts), except where two
  // candidates are close enough that equal-sized targets would overlap — an
  // overlapping target is worse than a small one, because it makes the RIGHT
  // answer register as wrong.
  layHits() {
    if (!this.candidates || !this.onPick) return;
    const upp = this.unitsPerPx();
    let r = 30 * upp;
    const pts = this.candidates.map((c) => this.map.f[c.id]).filter(Boolean);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].cx - pts[j].cx, pts[i].cy - pts[j].cy);
        if (d < r * 1.4) r = Math.max(22 * upp, d / 1.4);
      }
    }
    this.gHit.replaceChildren();
    for (const c of this.candidates) {
      const f = this.map.f[c.id];
      if (!f) continue;
      const size = f.bb ? Math.max(f.bb[2] - f.bb[0], f.bb[3] - f.bb[1]) : 0;
      const hit = el('circle', { cx: f.cx, cy: f.cy, r: Math.max(r, size * 0.62), class: 'hit', 'data-id': c.id });
      hit.addEventListener('click', () => this.onPick(c.id));
      this.gHit.append(hit);
    }
  }

  mark(id, kind) {
    for (const n of this.svg.querySelectorAll(`[data-id="${CSS.escape(id)}"]`)) {
      if (n.classList.contains('hit')) continue;
      n.classList.add(kind);
    }
  }

  clearMarks() {
    for (const n of this.svg.querySelectorAll('.right, .wrong')) n.classList.remove('right', 'wrong');
  }
}
