// Landfall — build the corpus and every map from source data.
//
//   node --max-old-space-size=6144 build/build.mjs
//
// Sources (all cached in sources/, all open):
//   world-countries              mledoze/countries, ODbL — capitals, borders,
//                                currencies, languages, demonyms, area, region
//   ne_10m_admin_0_countries     Natural Earth, public domain — country shapes
//   ne_10m_admin_0_map_subunits  ditto, but splits France into its overseas
//                                departments and the UK into four countries
//   ne_10m_admin_1_states_provinces  provinces, states, prefectures, cantons
//   ne_10m_populated_places_simple   cities, with which are capitals of what
//
// The build REPORTS rather than guesses. Anything it cannot resolve — an island
// point that lands on no coastline, a province whose capital it cannot find, a
// group member that matches no item — is printed and dropped. The corpus is
// meant to be defensible: a quiz that teaches a wrong fact is worse than one
// that is smaller.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_PACKS, CARIBBEAN, ADMIN_PACKS, CITY_PACKS, RENAMES, CAPITAL_FIXES, CITY_FIXES, ADMIN1_NAME } from './curated/packs.mjs';
import { ISLANDS } from './curated/islands.mjs';
import { GROUPS } from './curated/groups.mjs';
import { MAPS } from './curated/maps.mjs';
import { chooseProjection, pathFor, fitter, ringsOf, lonLatBounds } from './lib/geo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sources');
const OUT = join(ROOT, 'app', 'data');
mkdirSync(join(OUT, 'maps'), { recursive: true });

// Capitals, flags and alternative names for the curated islands, harvested from
// Wikidata and Commons and geographically verified — see build/harvest-islands.mjs.
// Absent is fine: the build simply asks fewer things about those islands.
const islandData = (() => {
  try { return JSON.parse(readFileSync(join(SRC, 'wikidata', 'islands.json'), 'utf8')); }
  catch { return {}; }
})();
const islandFlags = (() => {
  const out = {};
  try {
    for (const f of readdirSync(join(SRC, 'island-flags'))) {
      if (f.endsWith('.svg')) out[f.replace('.svg', '')] = readFileSync(join(SRC, 'island-flags', f), 'utf8');
    }
  } catch { /* none harvested yet */ }
  return out;
})();

const warn = [];
const note = (...a) => { warn.push(a.join(' ')); };
const load = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));

console.log('reading sources…');
const wc = load('world-countries.json');
const a0 = load('ne_10m_admin_0_countries.geojson').features;
const sub = load('ne_10m_admin_0_map_subunits.geojson').features;
const a1 = load('ne_10m_admin_1_states_provinces.geojson').features;
const pp = load('ne_10m_populated_places_simple.geojson').features;

// ── 1. countries and territories ─────────────────────────────────────────
const byA3 = new Map(wc.filter((c) => c.cca3).map((c) => [c.cca3, c]));
const items = new Map();       // id -> item
const geom = new Map();        // id -> [geometry, …]
const add = (it) => { items.set(it.i, it); return it; };

// Natural Earth geometry, keyed every way it might be found.
const a0ByKey = new Map();
for (const f of a0) {
  const p = f.properties;
  for (const k of [p.ISO_A2_EH, p.ISO_A2, p.ADM0_ISO, p.ADM0_A3]) {
    if (k && k !== '-99' && !a0ByKey.has(k)) a0ByKey.set(k, f);
  }
}
// Subunits carry the pieces admin-0 folds into a parent.
const SUBUNIT_ISO = {
  'FR-971': 'GP', 'FR-972': 'MQ', 'FR-973': 'GF', 'FR-974': 'RE', 'FR-976': 'YT',
};
const subByIso = new Map();
for (const f of sub) {
  const p = f.properties;
  const iso = SUBUNIT_ISO[p.ISO_A2] || (p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : null);
  if (iso && !subByIso.has(iso)) subByIso.set(iso, f);
}

const SOVEREIGN_EXTRA = new Set(['VA', 'PS', 'XK', 'TW']);   // observers and de-facto states
const FAMOUS = new Set(['JM', 'CU', 'IS', 'IE', 'CH', 'AT', 'GR', 'PT', 'NO', 'DK', 'FI', 'IL',
  'LB', 'JO', 'SG', 'NZ', 'PA', 'CR', 'UY', 'HT', 'DO', 'TT', 'BB', 'BS', 'FJ', 'QA', 'KW',
  'LK', 'NP', 'GE', 'AM', 'EE', 'LV', 'LT', 'SI', 'HR', 'RS', 'AL', 'MD', 'BE', 'NL', 'CZ', 'SK']);

for (const c of wc) {
  const iso = c.cca2;
  const sovereign = (c.independent && c.unMember) || SOVEREIGN_EXTRA.has(iso);
  const f = a0ByKey.get(iso) || subByIso.get(iso) || a0ByKey.get(c.cca3);
  if (!f) { note('no geometry for country', iso, c.name.common); }
  const ne = f ? f.properties : {};
  const pop = c.population ?? ne.POP_EST ?? 0;
  const area = c.area ?? 0;
  const tier = sovereign
    ? (pop > 20e6 || area > 400000 || FAMOUS.has(iso) ? 1 : pop > 5e6 || area > 100000 ? 2 : pop > 400000 ? 3 : 4)
    : (pop > 1e6 || FAMOUS.has(iso) ? 3 : 4);
  const it = add({
    i: 'c:' + iso,
    n: c.name.common,
    k: sovereign ? 'country' : 'territory',
    alt: [c.name.official, ...(ne.NAME_LONG && ne.NAME_LONG !== c.name.common ? [ne.NAME_LONG] : [])]
      .filter((x) => x && x !== c.name.common),
    cap: c.capital?.[0] || null,
    caps: c.capital || [],
    fl: iso.toLowerCase(),
    ll: c.latlng,
    t: tier,
    pk: [],
    x: {
      r: c.region, sr: c.subregion, pop, area,
      bd: (c.borders || []).map((a3) => byA3.get(a3)?.cca2).filter(Boolean),
      cur: Object.keys(c.currencies || {})[0] || null,
      curN: Object.values(c.currencies || {})[0]?.name || null,
      lang: Object.values(c.languages || {}),
      dem: c.demonyms?.eng?.m || null,
      lock: !!c.landlocked,
      i2: iso, i3: c.cca3,
      sov: sovereign ? null : (ne.SOVEREIGNT || null),
    },
  });
  if (f) geom.set(it.i, [f.geometry]);
}

// ── 2. islands: curated names claiming real polygons ─────────────────────
function polysOf(g) {
  if (!g) return [];
  return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
}
function inRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function ringCentroid(ring) {
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return [x / ring.length, y / ring.length];
}

// The smallest islands are not part of their country's own geometry at all —
// Natural Earth files them in a separate minor-islands layer, unnamed. Mayreau
// is there; Petite Martinique and the rest simply are not drawn at 10m. Same
// rule as everything else: the point must land inside a real polygon.
const minorIslands = load('ne_10m_minor_islands.geojson').features;
const minorClaimed = new Set();
function claimMinor(pt) {
  for (let f = 0; f < minorIslands.length; f++) {
    const polys = polysOf(minorIslands[f].geometry);
    for (let p = 0; p < polys.length; p++) {
      const key = f + ':' + p;
      if (minorClaimed.has(key)) continue;
      if (inRing(pt, polys[p][0])) { minorClaimed.add(key); return polys[p]; }
    }
  }
  return null;
}

// An island is never more prominent than the country that holds it. Every
// island used to be a flat tier 2 while Dominica, Grenada and Saint Lucia were
// tier 4 on population — so the Caribbean introduced sixty-five obscure islands
// before it reached the countries, which is exactly backwards. An island now
// sits one rung behind its parent, and an island whose parent is not even in
// the pack (San Andrés, Cozumel, Roatán, Margarita) goes last: there is nothing
// in the pack to hang it on.
const islandTier = (parent) => Math.min(4, Math.max(2, (parent?.t || 3) + 1));

const claimed = new Map();   // parent -> Set(polygon index)
let islandsBuilt = 0;
let fromMinor = 0;
for (const isl of ISLANDS) {
  const pid = 'c:' + isl.parent;
  const polys = polysOf(geom.get(pid)?.[0]);
  if (!polys.length) { note('island', isl.id, 'has no parent geometry', isl.parent); continue; }
  const pt = [isl.lon, isl.lat];
  let hit = polys.findIndex((poly) => inRing(pt, poly[0]));
  if (hit < 0) {
    const minor = claimMinor(pt);
    if (minor) {
      const parent = items.get(pid);
      const extra = islandData[isl.id] || {};
      const it = add({
        i: 'i:' + isl.id, n: isl.name, k: 'island',
        alt: [...new Set([...(isl.alt || []), ...(extra.alt || [])])],
        pr: pid, cap: extra.cap || null, caps: extra.cap ? [extra.cap] : [],
        fl: islandFlags[isl.id] ? 'isl-' + isl.id : null,
        ll: [isl.lat, isl.lon], t: islandTier(parent), note: isl.note || null, pk: [],
        x: { r: parent?.x.r, sr: parent?.x.sr, of: parent?.n, area: extra.area || null, pop: extra.pop || null },
      });
      geom.set(it.i, [{ type: 'Polygon', coordinates: minor }]);
      islandsBuilt++; fromMinor++;
      continue;
    }
  }
  if (hit < 0) {
    let best = -1, bestD = Infinity;
    polys.forEach((poly, k) => {
      const [cx, cy] = ringCentroid(poly[0]);
      const d = (cx - isl.lon) ** 2 + (cy - isl.lat) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    });
    if (bestD > 0.36) { note('island', isl.id, 'point matches no polygon of', isl.parent, '- DROPPED'); continue; }
    hit = best;
  }
  const seen = claimed.get(pid) || new Set();
  if (seen.has(hit)) { note('island', isl.id, 'claims a polygon already taken in', isl.parent, '- DROPPED'); continue; }
  seen.add(hit); claimed.set(pid, seen);
  const parent = items.get(pid);
  const extra = islandData[isl.id] || {};
  const it = add({
    i: 'i:' + isl.id,
    n: isl.name,
    k: 'island',
    alt: [...new Set([...(isl.alt || []), ...(extra.alt || [])])],
    pr: pid,
    cap: extra.cap || null,
    caps: extra.cap ? [extra.cap] : [],
    // Nevis, Barbuda, Saba, Sint Eustatius and Bonaire fly their own flag, and
    // those are the halves of the twin-island countries — the one place where
    // "whose flag is this?" is a question about a real distinction inside a
    // single country.
    fl: islandFlags[isl.id] ? 'isl-' + isl.id : null,
    ll: [isl.lat, isl.lon],
    t: islandTier(parent),
    note: isl.note || null,
    pk: [],
    x: { r: parent?.x.r, sr: parent?.x.sr, of: parent?.n, area: extra.area || null, pop: extra.pop || null },
  });
  geom.set(it.i, [{ type: 'Polygon', coordinates: polys[hit] }]);
  islandsBuilt++;
}

// ── 3. sub-national units ────────────────────────────────────────────────
const cityPop = new Map();          // admin1 key -> largest city population
// "admin|adm1name" -> capital city name.
//
// Natural Earth tags more than one city per province as an "Admin-1 capital" —
// Xining is filed under Gansu, Fushun under Liaoning, Tomakomai under Hokkaido.
// Taking the first match put three wrong provincial capitals in the corpus, so
// the rule is: a national capital wins outright, otherwise the largest of the
// tagged cities. That recovers Lanzhou, Shenyang, Kunming and Sapporo, and
// leaves the ordinary cases (Sacramento, Albany) untouched, because only the
// true capital is tagged in the first place.
const a1CapPick = new Map();
for (const f of pp) {
  const p = f.properties;
  if (!/^Admin-1/.test(p.featurecla || '')) continue;
  const k = p.adm0name + '|' + p.adm1name;
  const cur = a1CapPick.get(k);
  const better = !cur
    || (p.adm0cap === 1 && cur.adm0cap !== 1)
    || (p.adm0cap === cur.adm0cap && (p.pop_max || 0) > (cur.pop_max || 0));
  if (better) a1CapPick.set(k, p);
}
const a1Capital = new Map([...a1CapPick].map(([k, p]) => [k, p.name]));

const deMacron = (s) => s.replace(/[ōŌ]/g, (c) => (c === 'ō' ? 'o' : 'O'))
  .replace(/[ūŪ]/g, (c) => (c === 'ū' ? 'u' : 'U'))
  .replace(/[āĀ]/g, (c) => (c === 'ā' ? 'a' : 'A'));
// Natural Earth's place names arrive with double spaces ("St.  Paul"), the odd
// misspelling, and macrons English does not use.
const tidy = (s, admin) => {
  if (!s) return s;
  let out = String(s).replace(/\s+/g, ' ').trim();
  out = CITY_FIXES[out] || out;
  if (admin === 'Japan') out = deMacron(out);
  return out;
};
const displayName = (raw, admin) => {
  const hit = RENAMES[raw + '|' + admin] || RENAMES[raw];
  if (hit) return hit;
  return admin === 'Japan' ? deMacron(raw) : raw;
};

// Every place Natural Earth flags as the capital of anything, by country.
const capitalsByCountry = new Map();
for (const f of pp) {
  const p = f.properties;
  if (!/capital/i.test(p.featurecla || '')) continue;
  if (!capitalsByCountry.has(p.adm0name)) capitalsByCountry.set(p.adm0name, []);
  capitalsByCountry.get(p.adm0name).push(p);
}
function capitalInside(geoms, admin) {
  const candidates = capitalsByCountry.get(admin) || [];
  let best = null;
  for (const c of candidates) {
    const pt = [c.longitude, c.latitude];
    let inside = false;
    for (const g of geoms) for (const poly of polysOf(g)) if (inRing(pt, poly[0])) inside = true;
    if (!inside) continue;
    const better = !best
      || (c.adm0cap === 1 && best.adm0cap !== 1)
      || (c.adm0cap === best.adm0cap && (c.pop_max || 0) > (best.pop_max || 0));
    if (better) best = c;
  }
  return best ? best.name : null;
}

for (const pack of ADMIN_PACKS) {
  let units = [];
  if (pack.source === 'subunit') {
    units = sub.filter((f) => f.properties.ADM0_A3 === 'GBR' && f.properties.TYPE === 'Geo unit')
      .map((f) => ({ name: f.properties.SUBUNIT, code: 'GB-' + f.properties.SU_A3, geoms: [f.geometry], type: 'country' }));
  } else {
    const rows = a1.filter((f) => f.properties.admin === pack.admin && !/water|lake/i.test(f.properties.type_en || ''));
    if (pack.source === 'region') {
      const byRegion = new Map();
      for (const f of rows) {
        const key = f.properties.region;
        if (!key) continue;
        if (!byRegion.has(key)) byRegion.set(key, []);
        byRegion.get(key).push(f);
      }
      units = [...byRegion].map(([name, fs]) => ({
        name, code: pack.id.toUpperCase().slice(0, 2) + '-' + name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
        geoms: fs.map((f) => f.geometry), type: pack.unit,
        area: fs.reduce((s, f) => s + (f.properties.area_sqkm || 0), 0),
        src: fs,
      }));
    } else {
      // ONE CODE, ONE UNIT — and say so when rows have to be merged.
      //
      // Natural Earth gives several rows the same iso_3166_2 wherever a city is
      // carved out of the province around it: PH-DAV is Davao del Norte AND
      // Davao, CO-CUN is Cundinamarca AND Bogotá, PE-LIM is Lima the department
      // AND Lima the province. PH-MNL is all SEVENTEEN cities of Metro Manila.
      // Keying items by that code and letting the last write win silently lost
      // 35 Philippine provinces — Pampanga, Pangasinan, Palawan, Benguet,
      // Isabela, Leyte, Quezon and more — and left the survivor wearing a
      // city's name. It was the one place in this build that guessed instead of
      // reporting.
      //
      // Now the rows are merged so no land is lost, the name comes from the row
      // that actually matches the pack's unit (the province, not the city
      // inside it), and every merge is reported.
      const byCode = new Map();
      for (const f of rows) {
        const code = f.properties.iso_3166_2 || (pack.id + '-' + f.properties.adm1_code);
        if (!byCode.has(code)) byCode.set(code, []);
        byCode.get(code).push(f);
      }
      units = [...byCode].map(([code, fs]) => {
        const unitish = (f) => new RegExp(pack.unit.replace(/s$/, ''), 'i').test(f.properties.type_en || '');
        const ranked = fs.slice().sort((a, b) =>
          (unitish(b) - unitish(a)) || ((b.properties.area_sqkm || 0) - (a.properties.area_sqkm || 0)));
        const lead = ranked[0];
        const name = ADMIN1_NAME[code] || lead.properties.name;
        if (fs.length > 1) {
          note('admin1', pack.id, `${code} covers ${fs.length} Natural Earth rows `
            + `(${fs.map((f) => f.properties.name).join(', ')}) — merged as "${name}"`);
        }
        return {
          name, code,
          geoms: fs.map((f) => f.geometry),
          type: lead.properties.type_en || pack.unit,
          area: fs.reduce((t, f) => t + (f.properties.area_sqkm || 0), 0),
          src: fs,
          abbr: lead.properties.postal || lead.properties.abbrev || null,
        };
      });
    }
  }
  units = units.filter((u) => u.name && !(pack.drop || []).includes(u.name));
  if (!units.length) { note('pack', pack.id, 'produced no units'); continue; }

  // Familiarity proxy: the population of the largest city in the unit. Area
  // would put Nunavut ahead of Ontario, which is not how anyone learns Canada.
  for (const u of units) {
    let best = 0;
    for (const f of pp) {
      const p = f.properties;
      if (p.adm0name !== pack.admin) continue;
      const rn = displayName(p.adm1name, pack.admin);
      if (rn === u.name || p.adm1name === u.name || (u.src || []).some((s) => s.properties.name === p.adm1name)) {
        best = Math.max(best, p.pop_max || 0);
      }
    }
    u.cityPop = best;
  }
  const ranked = [...units].sort((a, b) => b.cityPop - a.cityPop);

  for (const u of units) {
    const name = tidy(displayName(u.name, pack.admin), null);
    const rank = ranked.indexOf(u);
    // Name matching finds most capitals; where Natural Earth files the city
    // under a different adm1name than its own admin-1 name (Tokyo, Berlin,
    // Bern, Mexico City — usually because the city is also the national
    // capital), fall back to asking which unit the city actually sits inside.
    const cap = CAPITAL_FIXES[u.code]
      || a1Capital.get(pack.admin + '|' + u.name)
      || (u.src || []).map((s) => a1Capital.get(pack.admin + '|' + s.properties.name)).find(Boolean)
      || capitalInside(u.geoms, pack.admin)
      || null;
    const capTidy = tidy(cap, pack.admin);
    if (!cap && pack.source !== 'subunit') note('no capital found for', pack.id, name);
    const parentIso = [...items.values()].find((x) => x.k !== 'island' && (x.n === pack.admin || x.alt?.includes(pack.admin)))?.i
      || 'c:' + (a0.find((f) => f.properties.NAME === pack.admin || f.properties.ADMIN === pack.admin)?.properties.ISO_A2_EH || '');
    const it = add({
      i: 'a:' + u.code,
      n: name,
      k: 'admin1',
      alt: u.name !== name ? [u.name] : [],
      pr: parentIso,
      cap: capTidy, caps: capTidy ? [capTidy] : [],
      t: rank < units.length / 3 ? 1 : rank < (units.length * 2) / 3 ? 2 : 3,
      pk: [pack.id],
      x: { type: u.type, abbr: u.abbr || null, area: Math.round(u.area || 0), admin: pack.admin, code: u.code },
    });
    geom.set(it.i, u.geoms);
  }
  for (const iso of pack.extraCountries || []) {
    const it = items.get('c:' + iso);
    if (it) it.pk.push(pack.id); else note('extra country', iso, 'not found for', pack.id);
  }
}

// ── 4. cities ────────────────────────────────────────────────────────────
const isoOfAdmin = new Map();
for (const it of items.values()) if (it.k === 'country' || it.k === 'territory') isoOfAdmin.set(it.x.i2, it.i);
const a1ByName = new Map();
for (const it of items.values()) if (it.k === 'admin1') a1ByName.set(it.x.admin + '|' + (it.alt?.[0] || it.n), it.i);

const cityItems = new Map();
for (const pack of CITY_PACKS) {
  const rows = pp.filter((f) => {
    const p = f.properties;
    if (!p.name || p.featurecla === 'Scientific station' || p.featurecla === 'Historic place') return false;
    if (pack.country && p.adm0name !== pack.country) return false;
    if ((p.pop_max || 0) < pack.min) return false;
    if (pack.region || pack.subregion) {
      const c = items.get(isoOfAdmin.get(p.iso_a2));
      if (!c) return false;
      if (pack.region && c.x.r !== pack.region) return false;
      if (pack.subregion && c.x.sr !== pack.subregion) return false;
    }
    return true;
  });
  for (const f of rows) {
    const p = f.properties;
    const id = 'y:' + p.ne_id;
    let it = cityItems.get(id);
    if (!it) {
      const country = isoOfAdmin.get(p.iso_a2) || null;
      const admin = a1ByName.get(p.adm0name + '|' + p.adm1name) || null;
      it = add({
        i: id, n: tidy(p.name, p.adm0name), k: 'city',
        pr: country, a1: admin,
        ll: [p.latitude, p.longitude],
        t: p.pop_max > 5e6 ? 1 : p.pop_max > 1.5e6 ? 2 : p.pop_max > 400e3 ? 3 : 4,
        pk: [],
        x: { pop: p.pop_max, cap: p.adm0cap === 1, of: p.adm0name, in: p.adm1name, world: !!p.worldcity },
      });
      cityItems.set(id, it);
    }
    it.pk.push(pack.id);
  }
}

// ── 5. packs ─────────────────────────────────────────────────────────────
const packs = [];
const isCaribbean = (it) =>
  it.x?.sr === 'Caribbean' || (it.k === 'island' && ['BS', 'TC', 'KY', 'CU', 'HT', 'DO', 'PR', 'VI', 'VG',
    'KN', 'BQ', 'GP', 'VC', 'GD', 'AG', 'TT', 'VE', 'MX', 'HN', 'CO'].includes(it.pr?.slice(2)));

for (const p of COUNTRY_PACKS) {
  const members = [...items.values()].filter((it) => (it.k === 'country' || it.k === 'territory')
    && p.filter({ ...it.x, sovereign: it.k === 'country', cca2: it.x.i2, region: it.x.r, subregion: it.x.sr }));
  for (const m of members) m.pk.push(p.id);
  packs.push({ id: p.id, name: p.name, short: p.short, blurb: p.blurb, map: p.map, tier: p.tier, kind: 'countries', n: members.length });
}

const caribMembers = [...items.values()].filter((it) =>
  (it.k === 'island' && isCaribbean(it)) ||
  ((it.k === 'country' || it.k === 'territory') && it.x.sr === 'Caribbean'));
for (const m of caribMembers) m.pk.push(CARIBBEAN.id);
packs.push({ ...CARIBBEAN, kind: 'islands', n: caribMembers.length });

for (const p of ADMIN_PACKS) {
  const n = [...items.values()].filter((it) => it.pk.includes(p.id)).length;
  if (!n) continue;
  packs.push({ id: p.id, name: p.name, short: p.short, blurb: p.blurb, map: p.map, tier: p.tier, kind: 'admin1', unit: p.unit, n });
}
for (const p of CITY_PACKS) {
  const n = [...items.values()].filter((it) => it.pk.includes(p.id)).length;
  packs.push({ id: p.id, name: p.name, short: p.short, blurb: p.blurb, map: p.map, tier: p.tier, kind: 'cities', n });
}

// ── 6. groups ────────────────────────────────────────────────────────────
const groups = [];
for (const g of GROUPS) {
  const resolve = (list) => (list || []).map((m) => {
    const id = m.startsWith('c:') || m.startsWith('i:') || m.startsWith('a:') ? m : null;
    if (id && items.has(id)) return id;
    note('group', g.id, 'member not found:', m);
    return null;
  }).filter(Boolean);
  const members = resolve(g.members);
  if (members.length < 2) { note('group', g.id, 'has too few resolved members'); continue; }
  groups.push({ id: g.id, name: g.name, blurb: g.blurb, scope: g.scope, note: g.note || null, members, contested: resolve(g.contested) });
}
// Reverse index, so an item knows the groups it is in.
for (const g of groups) {
  for (const m of g.members) { const it = items.get(m); (it.g ||= []).push(g.id); }
  for (const m of g.contested) { const it = items.get(m); (it.gc ||= []).push(g.id); }
}

// ── 7. maps ──────────────────────────────────────────────────────────────
function clipGeoms(geoms, box) {
  if (!box) return geoms;
  const [x0, y0, x1, y1] = box;
  const out = [];
  for (const g of geoms) {
    for (const poly of polysOf(g)) {
      const ring = poly[0];
      let a = 180, b = 90, c = -180, d = -90;
      for (const [lon, lat] of ring) {
        if (lon < a) a = lon; if (lon > c) c = lon;
        if (lat < b) b = lat; if (lat > d) d = lat;
      }
      if (c < x0 || a > x1 || d < y0 || b > y1) continue;
      out.push({ type: 'Polygon', coordinates: poly });
    }
  }
  return out;
}
// Straddling the antimeridian: push the western half round so the geometry is
// continuous. Done BEFORE clipping, so a map's box is written in shifted
// degrees (the Pacific runs 110 -> 230, not 110 -> -130).
const shifted = (geoms, on) => {
  if (!on) return geoms;
  const walk = (c) => (typeof c[0] === 'number' ? [c[0] < 0 ? c[0] + 360 : c[0], c[1]] : c.map(walk));
  return geoms.map((g) => ({ type: g.type, coordinates: walk(g.coordinates) }));
};

const mapMeta = {};
let mapBytes = 0;
for (const [id, spec] of Object.entries(MAPS)) {
  const memberIds = spec.members(items, packs);
  if (!memberIds.length) { note('map', id, 'has no members'); continue; }
  // Cities have no geometry, but "where is Halifax" is a question worth asking,
  // so every city pack drawn on this map contributes a point feature.
  const cityPacks = packs.filter((p) => p.kind === 'cities' && p.map === id).map((p) => p.id);
  const cityMembers = cityPacks.length
    ? [...items.values()].filter((it) => it.k === 'city' && it.pk.some((p) => cityPacks.includes(p)))
    : [];
  const box = spec.box || null;
  const geoms = new Map();
  for (const mid of memberIds) {
    const g = geom.get(mid);
    if (!g) { note('map', id, 'member has no geometry:', mid); continue; }
    const clipped = clipGeoms(shifted(g, spec.shift), box);
    if (clipped.length) geoms.set(mid, clipped);
  }
  if (!geoms.size) { note('map', id, 'nothing to draw'); continue; }

  const all = [...geoms.values()].flat();
  const bounds = lonLatBounds(all);
  const proj = spec.projection ? spec.projection() : chooseProjection(bounds);
  const width = spec.width || 1000;
  const fit = fitter(all, proj.fn, width, spec.pad ?? 8);

  const features = {};
  for (const [mid, g] of geoms) {
    const p = pathFor(g, fit.toXY, { tol: spec.tol ?? 0.55, minArea: spec.minArea ?? 0.2, round: spec.round ?? 0 });
    if (!p) {
      // Too small to draw at this scale — Barbados and Singapore are real
      // places and must still be findable, so they get a point instead of a
      // shape and the app draws them as a marker.
      const it = items.get(mid);
      if (it?.ll) {
        let [lat, lon] = it.ll;
        if (spec.shift && lon < 0) lon += 360;
        const [x, y] = fit.toXY(lon, lat);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          features[mid] = { pt: 1, cx: Math.round(x), cy: Math.round(y), bb: null, a: 0 };
          continue;
        }
      }
      note('map', id, 'feature vanished at this scale:', mid, it?.n);
      continue;
    }
    features[mid] = { d: p.d, cx: p.cx, cy: p.cy, bb: p.bbox, mb: p.main, a: p.area };
  }

  // Context: everything else within the frame, drawn flat and grey so a region
  // map is not a set of shapes floating in a void.
  let ctx = '';
  if (spec.context !== false) {
    const cbox = box || [bounds.lonMin - 12, bounds.latMin - 8, bounds.lonMax + 12, bounds.latMax + 8];
    const ctxGeoms = [];
    for (const f of a0) {
      const g = clipGeoms(shifted([f.geometry], spec.shift), cbox);
      if (g.length) ctxGeoms.push(...g);
    }
    const cp = pathFor(ctxGeoms, fit.toXY, { tol: (spec.tol ?? 0.55) * 4, minArea: (spec.minArea ?? 0.2) * 12, round: 0 });
    ctx = cp?.d || '';
  }

  for (const c of cityMembers) {
    if (!c.ll) continue;
    let [lat, lon] = c.ll;
    if (spec.shift && lon < 0) lon += 360;
    if (box && (lon < box[0] || lon > box[2] || lat < box[1] || lat > box[3])) continue;
    const [x, y] = fit.toXY(lon, lat);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    features[c.i] = { pt: 1, cx: Math.round(x), cy: Math.round(y), bb: null, a: 0 };
    (c.m ||= []).push(id);
  }

  const payload = { id, w: fit.width, h: fit.height, proj: proj.kind, f: features, ctx };
  const json = JSON.stringify(payload);
  writeFileSync(join(OUT, 'maps', id + '.json'), json);
  mapBytes += json.length;
  mapMeta[id] = { w: fit.width, h: fit.height, n: Object.keys(features).length, kb: Math.round(json.length / 1024), ctxKb: Math.round(ctx.length / 1024) };
  for (const mid of Object.keys(features)) {
    const it = items.get(mid);
    if (it && !(it.m || []).includes(id)) (it.m ||= []).push(id);
  }
}

// ── 8. flags ─────────────────────────────────────────────────────────────
const flagDir = join(SRC, 'flags-4x3');
const flags = {};
const available = new Set(readdirSync(flagDir).map((f) => f.replace('.svg', '')));
for (const it of items.values()) {
  if (!it.fl) continue;
  if (it.fl.startsWith('isl-')) {
    if (!flags[it.fl]) flags[it.fl] = islandFlags[it.fl.slice(4)];
    continue;
  }
  if (!available.has(it.fl)) { note('no flag for', it.i, it.n); it.fl = null; continue; }
  if (!flags[it.fl]) flags[it.fl] = readFileSync(join(flagDir, it.fl + '.svg'), 'utf8').replace(/\s+/g, ' ').trim();
}
writeFileSync(join(OUT, 'flags.json'), JSON.stringify(flags));

// ── 9. emit ──────────────────────────────────────────────────────────────
const itemList = [...items.values()].filter((it) => it.pk.length || it.k === 'island');
for (const it of itemList) it.pk = [...new Set(it.pk)];
const core = {
  v: 1,
  generated: new Date().toISOString(),
  packs,
  groups,
  maps: mapMeta,
  items: itemList,
};
const coreJson = JSON.stringify(core);
writeFileSync(join(OUT, 'core.json'), coreJson);

// ── report ───────────────────────────────────────────────────────────────
const kinds = {};
for (const it of itemList) kinds[it.k] = (kinds[it.k] || 0) + 1;
console.log('\nitems:', itemList.length, JSON.stringify(kinds));
console.log('islands claimed:', islandsBuilt, 'of', ISLANDS.length, fromMinor ? `(${fromMinor} from the minor-islands layer)` : '');
console.log('packs:', packs.length, ' groups:', groups.length, ' maps:', Object.keys(mapMeta).length);
console.log('core.json', Math.round(coreJson.length / 1024) + 'KB   maps', Math.round(mapBytes / 1024) + 'KB   flags', Math.round(JSON.stringify(flags).length / 1024) + 'KB');
console.log('\nmaps:');
for (const [id, m] of Object.entries(mapMeta)) {
  console.log(`  ${id.padEnd(18)} ${String(m.n).padStart(4)} features  ${m.w}x${m.h}  ${String(m.kb).padStart(5)}KB (ctx ${String(m.ctxKb).padStart(4)})  ratio ${(m.w / m.h).toFixed(2)}`);
}
writeFileSync(join(ROOT, 'build', 'report.txt'), warn.join(String.fromCharCode(10)));
if (warn.length) {
  console.log('\n' + warn.length + ' warnings:');
  for (const w of warn.slice(0, 25)) console.log('  ! ' + w);
  if (warn.length > 25) console.log('  … and ' + (warn.length - 25) + ' more — see build/report.txt');
}
