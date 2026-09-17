// Landfall — projection and geometry, done once at build time.
//
// The app ships no projection library and no topology code: every map it draws
// is a bag of pre-projected SVG path strings. That keeps the phone build small
// and means a map costs nothing to render beyond the paint.
//
// Three projections, chosen by what the map is of:
//   equalEarth  whole world. Equal-area, so mastery of Greenland cannot look
//               like mastery of Africa (Savric, Patterson & Jenny 2018).
//   lcc         mid-latitude regions (Canada, China, Europe). Conformal, so
//               provinces keep the fanned shape people learn them by.
//   laea        anything straddling the equator, or small enough that the
//               difference is invisible (Caribbean, Africa, Indonesia).
// A pack may also be a COMPOSITE of several of these — that is how the United
// States gets Alaska and Hawaii at a size you can actually tap.

const RAD = Math.PI / 180;

// -- Equal Earth ---------------------------------------------------------
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;

export function equalEarth() {
  return (lon, lat) => {
    const lambda = lon * RAD, phi = lat * RAD;
    const l = Math.asin(M * Math.sin(phi));
    const l2 = l * l, l6 = l2 * l2 * l2;
    return [
      (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
      l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)),
    ];
  };
}

// -- Lambert conformal conic ---------------------------------------------
export function lcc(lon0, lat1, lat2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD;
  const n = Math.abs(p1 - p2) < 1e-9
    ? Math.sin(p1)
    : Math.log(Math.cos(p1) / Math.cos(p2)) /
      Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const F = (Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), n)) / n;
  return (lon, lat) => {
    const phi = Math.max(-89.9, Math.min(89.9, lat)) * RAD;
    const rho = F / Math.pow(Math.tan(Math.PI / 4 + phi / 2), n);
    let dl = (lon - lon0) * RAD;
    while (dl > Math.PI) dl -= 2 * Math.PI;
    while (dl < -Math.PI) dl += 2 * Math.PI;
    const th = n * dl;
    return [rho * Math.sin(th), -rho * Math.cos(th)];
  };
}

// -- Lambert azimuthal equal-area ----------------------------------------
export function laea(lon0, lat0) {
  const p0 = lat0 * RAD;
  const sp0 = Math.sin(p0), cp0 = Math.cos(p0);
  return (lon, lat) => {
    const phi = lat * RAD;
    let dl = (lon - lon0) * RAD;
    while (dl > Math.PI) dl -= 2 * Math.PI;
    while (dl < -Math.PI) dl += 2 * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi), cl = Math.cos(dl);
    const denom = 1 + sp0 * sp + cp0 * cp * cl;
    const k = Math.sqrt(2 / Math.max(denom, 1e-9));
    return [k * cp * Math.sin(dl), k * (cp0 * sp - sp0 * cp * cl)];
  };
}

// Pick a projection from what the region actually covers.
export function chooseProjection({ lonMin, lonMax, latMin, latMax }) {
  const lonSpan = lonMax - lonMin, latSpan = latMax - latMin;
  const lon0 = (lonMin + lonMax) / 2, lat0 = (latMin + latMax) / 2;
  if (lonSpan > 190 || latSpan > 120) return { kind: 'equalEarth', fn: equalEarth() };
  const crossesEquator = latMin < 8 && latMax > -8;
  if (!crossesEquator && Math.abs(lat0) > 18) {
    const a = latMin + latSpan / 6, b = latMax - latSpan / 6;
    return { kind: 'lcc', fn: lcc(lon0, a, b), params: [lon0, a, b] };
  }
  return { kind: 'laea', fn: laea(lon0, lat0), params: [lon0, lat0] };
}

// -- geometry helpers ----------------------------------------------------
export function ringsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}

export function lonLatBounds(geoms) {
  let lonMin = 180, lonMax = -180, latMin = 90, latMax = -90;
  for (const g of geoms) {
    for (const ring of ringsOf(g)) {
      for (const [lon, lat] of ring) {
        if (lon < lonMin) lonMin = lon;
        if (lon > lonMax) lonMax = lon;
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
      }
    }
  }
  return { lonMin, lonMax, latMin, latMax };
}

export function ringArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

// Drop points that would land on top of each other once drawn. Cheap and
// stable: a proper Douglas-Peucker buys little at these tolerances and can
// collapse a small island to a sliver.
function thin(pts, tol) {
  if (pts.length < 8) return pts;
  const out = [pts[0]];
  const t2 = tol * tol;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = out[out.length - 1];
    if ((x - px) ** 2 + (y - py) ** 2 >= t2) out.push(pts[i]);
  }
  return out.length >= 4 ? out : pts;
}

// Project one feature's geometry into an SVG path plus the numbers the app
// needs to point at it: the centroid of its LARGEST ring (so a marker lands on
// the main island, not halfway to an outlying cay) and its bounding box.
export function pathFor(geoms, toXY, { tol = 0.3, minArea = 0.12, round = 1 } = {}) {
  const f = 10 ** round;
  const r = (n) => Math.round(n * f) / f;
  let d = '';
  let best = { area: -1, cx: 0, cy: 0, bbox: null };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let drawn = 0, totalArea = 0;

  for (const geom of geoms) {
    for (const ring of ringsOf(geom)) {
      let pts = ring.map(([lon, lat]) => toXY(lon, lat));
      pts = thin(pts, tol);
      if (pts.length < 3) continue;
      // Round to the precision the path will actually be written at, THEN drop
      // the points that collapsed onto each other. Rounding after measuring
      // leaves runs of identical coordinates in the file — on a world map that
      // was most of the bytes.
      pts = pts.map(([x, y]) => [r(x), r(y)]);
      const kept = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], q = kept[kept.length - 1];
        if (p[0] !== q[0] || p[1] !== q[1]) kept.push(p);
      }
      if (kept.length > 3) {
        const first = kept[0], last = kept[kept.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) kept.pop();
      }
      pts = kept;
      if (pts.length < 3) continue;
      const a = ringArea(pts);
      const abs = Math.abs(a);
      if (abs < minArea) continue;
      d += 'M' + pts.map(([x, y]) => `${x} ${y}`).join('L') + 'Z';
      drawn++;
      totalArea += abs;
      let cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        const w = ax * by - bx * ay;
        cx += (ax + bx) * w; cy += (ay + by) * w;
      }
      if (abs > best.area) {
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const [x, y] of pts) {
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
          if (y < by0) by0 = y; if (y > by1) by1 = y;
        }
        best = { area: abs, cx: cx / (6 * a), cy: cy / (6 * a), bbox: [bx0, by0, bx1, by1] };
      }
      for (const [x, y] of pts) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (!drawn) return null;
  return {
    d,
    cx: r(best.cx), cy: r(best.cy),
    bbox: [r(x0), r(y0), r(x1), r(y1)],
    main: best.bbox.map(r),
    area: Math.round(totalArea * 10) / 10,
  };
}

// Fit a projected extent into a viewBox of a given width.
export function fitter(geoms, project, width, pad = 0) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of geoms) {
    for (const ring of ringsOf(g)) {
      for (const [lon, lat] of ring) {
        const [x, y] = project(lon, lat);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const scale = (width - pad * 2) / (maxX - minX);
  const height = Math.round((maxY - minY) * scale + pad * 2);
  const toXY = (lon, lat) => {
    const [x, y] = project(lon, lat);
    return [(x - minX) * scale + pad, (maxY - y) * scale + pad];
  };
  return { toXY, width, height, scale, extent: { minX, maxX, minY, maxY } };
}

// Real area on the globe, in km², from a lon/lat ring.
//
// The curated islands arrive with a name and a coordinate and no size, and
// "Saba is 13 km²" is one of the most useful things you can be told about Saba
// — it is what makes the shortest-runway story land. This is the standard
// spherical excess formula, so the number comes from the coastline the island
// actually claimed rather than from anyone's memory.
export function areaKm2(geoms) {
  const R = 6371.0088;
  const RAD = Math.PI / 180;
  let total = 0;
  for (const g of geoms) {
    for (const poly of (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])) {
      // Outer ring adds, holes subtract.
      poly.forEach((ring, i) => {
        let sum = 0;
        for (let k = 0; k < ring.length; k++) {
          const [lon1, lat1] = ring[k];
          const [lon2, lat2] = ring[(k + 1) % ring.length];
          sum += (lon2 - lon1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD));
        }
        const a = Math.abs(sum * R * R / 2);
        total += i === 0 ? a : -a;
      });
    }
  }
  return total;
}
