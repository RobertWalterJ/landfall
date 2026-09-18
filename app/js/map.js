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

// Who to tell when the feature under a moving thumb changes. A hook rather
// than an import of sound.js, for the reason given in speech.js: two modules
// declaring the same top-level binding is what the single-file bundler refuses.
let onAim = null;
export function onAiming(fn) { onAim = fn; }
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
      this.refresh();
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
      if (this.view !== target) { this.view = target; this.apply(target); this.refresh(); this.onSettle?.(); }
    }, 600);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = ease(k);
      const cur = from.map((v, i) => v + (target[i] - v) * e);
      this.apply(cur);
      this.view = cur;
      if (k < 1) this.raf = requestAnimationFrame(step);
      else { this.view = target; clearTimeout(this.settleTimer); this.refresh(); this.onSettle?.(); }
    };
    this.raf = requestAnimationFrame(step);
  }

  apply(v) { this.svg.setAttribute('viewBox', v.map((n) => Math.round(n * 10) / 10).join(' ')); }

  // Anything sized in screen pixels has to be laid out again when the zoom
  // changes — labels and hit targets are both computed back through
  // unitsPerPx(), and laying them out before the first setView sized a 12px
  // label at 34 map units, which rendered as a word bigger than the island.
  refresh() {
    if (this.labels) this.layLabels(this.labels, this.collide);
    if (this.candidates && this.onPick) this.layHits();
  }

  // Grow a box to the aspect ratio of the element so nothing is squashed, and
  // never zoom in past a floor — a single small island filling the screen is
  // disorienting, you want to see it in its neighbourhood.
  // `reserve` is the height, in CSS pixels, that something else is covering —
  // the verdict sheet takes 58% of the screen, and framing the answer inside
  // the full rect puts it underneath. The map must keep the thing it is being
  // asked about visible.
  // How much of the MAP is actually hidden, in CSS pixels.
  //
  // Not the covering element's height: the verdict sheet is fixed to the
  // bottom of the VIEWPORT, and the map well generally ends above it, so its
  // full height over-states the damage — and when the well sits entirely clear
  // of the sheet the honest answer is that nothing is covered at all.
  coverBy(el) {
    const host = this.host.getBoundingClientRect();
    const over = el?.getBoundingClientRect?.();
    this.reserve = (!over || !over.height) ? 0
      : Math.max(0, Math.min(host.bottom, over.bottom) - Math.max(host.top, over.top));
    return this.reserve;
  }

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
    // Zoom out so the box fills the VISIBLE strip rather than the whole
    // element, then slide the frame so the feature lands in the middle of that
    // strip instead of the middle of the map.
    //
    // THE SIGN HERE IS THE WHOLE BUG. A point at user-y `cy` is drawn at the
    // fraction (cy - y) / h down the element, so making y SMALLER moves the
    // feature DOWN the screen. The old line subtracted the shift, which pushed
    // the answer further underneath the very sheet it was meant to dodge —
    // measured on a 375x812 phone, the correct island ended up 100% covered.
    //
    // Wanted: the feature at the centre of the strip, i.e. at fraction
    // (H - reserve) / 2H. Solving for y gives a shift of h * reserve / 2H,
    // ADDED.
    const H = Math.max(r.height || 300, 1);
    h *= H / Math.max(usable, 1);
    const shift = (h * this.reserve) / (2 * H);
    let x = cx - w / 2, y = cy - h / 2 + shift;
    // Keep the frame on the chart. Without this, fitting a wide spread of
    // candidates into a tall well pans hundreds of units off the top of the
    // map and most of the screen is empty sea.
    if (this.map) {
      if (w <= this.map.w) x = Math.max(0, Math.min(x, this.map.w - w));
      else x = (this.map.w - w) / 2;
      // Vertically, only clamp when there is something to clamp against. When
      // the frame is TALLER than the chart the old code recentred it, which
      // silently threw the shift away and put the answer straight back under
      // the sheet — and a frame taller than the chart is exactly what you get
      // for a big island like Cuba, so the bug hit the easiest questions
      // hardest. Off the top of the chart is empty sea; that is fine.
      // The frame may hang BELOW the chart by however much of itself is
      // hidden: that strip is behind the sheet, so the empty sea there costs
      // nothing. Without the slack, a feature low on the chart gets clamped
      // straight back down under the sheet — which is what still happened to
      // Jamaica after the sign was fixed.
      const hidden = h * (this.reserve / H);
      if (h <= this.map.h) y = Math.max(0, Math.min(y, this.map.h - h + hidden));
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
  draw(map, { candidates = [], highlight = null, shade = null, onPick = null, labels = null, rings = true, collide = false } = {}) {
    this.labels = labels;
    this.collide = collide;
    this.map = map;
    this.svg.setAttribute('data-map', map.id);
    // A handful of candidates means the rest of the map can step back; a whole
    // region in play (Label the Map) means there is no field to dim.
    this.svg.classList.toggle('few', candidates.length > 0 && candidates.length <= 8);
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

    if (labels) this.layLabels(labels, collide);

    if (onPick) {
      this.candidates = candidates;
      this.onPick = onPick;
      this.outline = null;
      this.layHits();
      // Hit radii are in SVG units, which mean nothing until the zoom has
      // settled: 22 units is over 100px zoomed into the Lesser Antilles and
      // about 7px on the unzoomed world map. Lay them again when the ease ends.
      this.onSettle = () => { this.layHits(); if (this.labels) this.layLabels(this.labels, this.collide); };
    }
  }

  // Labels are drawn in SVG user units, and a font-size in user units shrinks
  // with the viewBox — 12 units on an 860-wide map rendered at 340px is under
  // five pixels of type. The size is therefore computed back through the zoom
  // so a label is always about twelve screen pixels.
  //
  // `collide` drops any label that would land on one already placed, biggest
  // feature first. On a finished Caribbean sweep there are eighty-eight names
  // and without this the Bahamas is an illegible smear.
  layLabels(labels, collide) {
    for (const n of this.gPin.querySelectorAll('text.mlabel')) n.remove();
    const upp = this.unitsPerPx();
    const size = 12 * upp;
    const placed = [];
    const entries = Object.entries(labels)
      .filter(([id]) => this.map.f[id])
      .sort((a, b) => (this.map.f[b[0]].a || 0) - (this.map.f[a[0]].a || 0));
    for (const [id, text] of entries) {
      const f = this.map.f[id];
      const w = String(text).length * size * 0.55, hh = size * 1.1;
      // Clear of the feature, not touching it. The baseline sits at `y` and
      // the text rises about 0.8 of its size above that, so half a size of
      // clearance left the halo merging with the coastline; a full size is a
      // gap you can see.
      const x = f.cx, y = f.cy - (f.bb ? (f.bb[3] - f.bb[1]) / 2 : 0) - size;
      const box = [x - w / 2, y - hh, x + w / 2, y];
      if (collide && placed.some((p) => !(box[2] < p[0] || box[0] > p[2] || box[3] < p[1] || box[1] > p[3]))) continue;
      placed.push(box);
      const t = el('text', { x, y, class: 'mlabel', 'font-size': size.toFixed(2), 'stroke-width': (3.5 * upp).toFixed(2) });
      t.textContent = text;
      this.gPin.append(t);
    }
  }

  // ── choosing what a tap means ──────────────────────────────────────────
  //
  // One capture layer over the whole map, and the candidate is worked out from
  // the point. The old approach gave every candidate its own hit circle, and
  // SVG hit-testing hands the tap to whichever element is on top — so a small
  // island's circle sitting over Jamaica's landmass stole taps meant for
  // Jamaica. You cannot fix that by shrinking circles; overlapping targets are
  // the wrong model.
  //
  // The rule now, in order:
  //   1. inside a candidate's actual coastline  → that candidate, always;
  //   2. otherwise the nearest candidate, if it is within reach of the thumb;
  //   3. otherwise nothing at all — a tap in open sea must not cost a wrong
  //      answer.
  //
  // And it resolves on pointerUP, not down: press, see which island lights up,
  // slide to correct it, release to commit. That is what makes a 1mm island
  // selectable with a finger.
  // Points along each candidate's coastline, sampled once per question. A
  // path's own geometry is the only honest way to ask "how far is this tap
  // from that island".
  sampleOutlines() {
    this.outline = new Map();
    for (const c of this.candidates || []) {
      const f = this.map.f[c.id];
      if (!f) continue;
      const node = this.gBase.querySelector(`path.feat[data-id="${CSS.escape(c.id)}"]`);
      const pts = [[f.cx, f.cy]];
      try {
        const len = node?.getTotalLength?.() || 0;
        if (len > 0) {
          const n = Math.min(64, Math.max(12, Math.round(len / 6)));
          for (let i = 0; i < n; i++) {
            const pt = node.getPointAtLength((len * i) / n);
            pts.push([pt.x, pt.y]);
          }
        }
      } catch { /* a marker-only feature keeps just its point */ }
      this.outline.set(c.id, pts);
    }
  }

  layHits() {
    if (!this.candidates || !this.onPick) return;
    if (!this.outline) this.sampleOutlines();
    this.gHit.replaceChildren();
    const rect = el('rect', { x: -1e5, y: -1e5, width: 2e5, height: 2e5, class: 'hit' });
    this.gHit.append(rect);

    const pt = this.svg.createSVGPoint();
    const toUser = (ev) => {
      pt.x = ev.clientX; pt.y = ev.clientY;
      const m = this.svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : null;
    };

    const best = (p) => {
      if (!p) return null;
      // Inside a coastline wins outright, whatever else is nearby.
      for (const c of this.candidates) {
        const node = this.gBase.querySelector(`path.feat[data-id="${CSS.escape(c.id)}"]`);
        try { if (node?.isPointInFill?.(p)) return c.id; } catch { /* older engines */ }
      }
      // Otherwise the nearest COASTLINE, within a thumb's reach.
      //
      // Not the nearest bounding box: Cuba's box is 320 units wide and sprawls
      // across the whole northern Caribbean, so a tap just south of Jamaica sat
      // INSIDE Cuba's box at distance zero and answered Cuba. Not the nearest
      // centroid either — that makes the eastern tip of Cuba far from Cuba.
      // Distance to points sampled along the actual outline is the only measure
      // that behaves for both a 320-unit island and a 1-unit one.
      const reach = 34 * this.unitsPerPx();
      let hit = null, bestD = Infinity;
      for (const c of this.candidates) {
        const pts = this.outline.get(c.id);
        if (!pts) continue;
        for (const [x, y] of pts) {
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < bestD) { bestD = d; hit = c.id; }
        }
      }
      return bestD <= reach ? hit : null;
    };

    const show = (id) => {
      if (id === this.pending) return;
      this.pending = id;
      if (id) onAim?.();          // a tick as the aim lands on something new
      for (const n of this.gPin.querySelectorAll('circle.aim')) n.remove();
      for (const n of this.gBase.querySelectorAll('.aiming')) n.classList.remove('aiming');
      if (!id) return;
      const f = this.map.f[id];
      if (!f) return;
      this.gBase.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('aiming');
      const bb = f.mb || f.bb;
      const size = bb ? Math.max(bb[2] - bb[0], bb[3] - bb[1]) : 0;
      const upp = this.unitsPerPx();
      this.gPin.append(el('circle', {
        cx: f.cx, cy: f.cy, r: Math.max(17 * upp, size * 0.8), class: 'aim',
        'stroke-width': 2.5 * upp,
      }));
    };

    // ── pinch and pan ────────────────────────────────────────────────────
    //
    // TWO fingers move the map, one finger chooses. They cannot share a
    // gesture: a one-finger drag is already how you slide from one island to
    // the next before committing, and a map that pans under that would make
    // selection impossible.
    //
    // Zooming is the real answer to "Jamaica and Cuba are hard to tell apart
    // with a thumb" — at twice the scale they are not close at all.
    const touches = new Map();
    let gesture = null;
    const spread = () => {
      const [a, b] = [...touches.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };

    rect.addEventListener('pointerdown', (ev) => {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size === 2) {
        show(null);                       // a second finger means this is a gesture
        gesture = { ...spread(), view: this.view.slice() };
        return;
      }
      // Capture first so a finger that slides off the rect keeps sending
      // events — but never let it take the handler down with it. It throws
      // for a pointer id the element does not own, and an exception here
      // means no aiming ring and no idea why.
      try { rect.setPointerCapture(ev.pointerId); } catch { /* not capturable */ }
      show(best(toUser(ev)));
    });
    rect.addEventListener('pointermove', (ev) => {
      if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (gesture && touches.size >= 2) {
        const now = spread();
        const scale = gesture.d > 8 ? gesture.d / now.d : 1;      // apart = zoom in
        const rectBox = this.host.getBoundingClientRect();
        const w = Math.min(this.map.w * 1.6, Math.max(this.map.w * 0.04, gesture.view[2] * scale));
        const h = w * (gesture.view[3] / gesture.view[2]);
        // Keep the point between the fingers under the fingers.
        const fx = (gesture.cx - rectBox.left) / rectBox.width;
        const fy = (gesture.cy - rectBox.top) / rectBox.height;
        const anchorX = gesture.view[0] + gesture.view[2] * fx;
        const anchorY = gesture.view[1] + gesture.view[3] * fy;
        const dx = (now.cx - gesture.cx) / rectBox.width * w;
        const dy = (now.cy - gesture.cy) / rectBox.height * h;
        this.view = [anchorX - w * fx - dx, anchorY - h * fy - dy, w, h];
        this.apply(this.view);
        return;
      }
      if (ev.buttons === 0 && ev.pointerType === 'mouse') return;
      show(best(toUser(ev)));
    });
    const commit = (ev) => {
      touches.delete(ev.pointerId);
      if (gesture) {
        // A gesture never answers a question. Re-lay anything sized in screen
        // pixels now that the zoom has changed.
        if (touches.size === 0) { gesture = null; this.refresh(); }
        show(null);
        return;
      }
      const id = this.pending ?? best(toUser(ev));
      show(null);
      if (id) this.onPick(id);
    };
    rect.addEventListener('pointerup', commit);
    rect.addEventListener('pointercancel', (ev) => {
      touches.delete(ev.pointerId);
      if (touches.size === 0) { gesture = null; this.refresh(); }
      show(null);
    });

    // A mouse wheel or trackpad pinch does the same thing, for the desktop.
    this.host.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const rectBox = this.host.getBoundingClientRect();
      const k = Math.exp(ev.deltaY * 0.0016);
      const w = Math.min(this.map.w * 1.6, Math.max(this.map.w * 0.04, this.view[2] * k));
      const h = w * (this.view[3] / this.view[2]);
      const fx = (ev.clientX - rectBox.left) / rectBox.width;
      const fy = (ev.clientY - rectBox.top) / rectBox.height;
      const ax = this.view[0] + this.view[2] * fx;
      const ay = this.view[1] + this.view[3] * fy;
      this.view = [ax - w * fx, ay - h * fy, w, h];
      this.apply(this.view);
      clearTimeout(this.wheelTimer);
      this.wheelTimer = setTimeout(() => this.refresh(), 160);
    }, { passive: false });
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
