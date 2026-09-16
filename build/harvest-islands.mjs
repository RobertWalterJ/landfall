// Landfall — island capitals, flags and alternative names, from Wikidata.
//
//   node build/harvest-islands.mjs              (--refresh re-queries, --offline never does)
//
// The 60 curated Caribbean islands arrived with a name and a coordinate and
// nothing else, so the quiz could only ask where they are and who holds them.
// But Nevis, Saba, Sint Eustatius, Barbuda, Tobago and Carriacou all have their
// own flags and their own chief towns — which is exactly the material the
// twin-island countries are made of — and asserting three dozen capitals from
// memory is not something this project does.
//
// So: ask Wikidata for every island inside the Caribbean box, then JOIN ON
// GEOGRAPHY. A curated island takes a Wikidata record only when that record
// sits within 30 km of the coordinate that already claimed a real coastline
// AND the names agree. Anything failing either test is reported and dropped —
// the same rule the island layer itself is built on.
//
// Output: sources/wikidata/islands.json, read by build.mjs.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISLANDS } from './curated/islands.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'sources', 'wikidata');
mkdirSync(CACHE, { recursive: true });
const OFFLINE = process.argv.includes('--offline');
const REFRESH = process.argv.includes('--refresh');
const UA = 'Landfall/1.0 (personal geography study app; local build)';

// Deliberately minimal. The first version asked for capitals, flags and
// aliases in one query and walked the subclass tree (P31/P279*); Wikidata
// answered 504. The geographic join is the expensive part, so it gets a query
// to itself and everything else is fetched by id through the REST API, which
// is cheap and cannot time out.
const QUERY = `
SELECT ?item ?itemLabel ?lat ?lon WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerWest "Point(-88 8.5)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerEast "Point(-57 28)"^^geo:wktLiteral .
  }
  ?item wdt:P31 wd:Q23442 .
  ?item p:P625/psv:P625 [ wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ] .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const norm = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\bs(ain)?t\.?\b/g, 'st').replace(/\bsint\b/g, 'st')
  .replace(/\b(island|islands|isla|ile|the|of)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

function km(aLat, aLon, bLat, bLon) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ── 1. the islands in the box ────────────────────────────────────────────
const rawFile = join(CACHE, 'caribbean-islands.json');
let rows;
if (existsSync(rawFile) && !REFRESH) {
  rows = JSON.parse(readFileSync(rawFile, 'utf8'));
  console.log('using cached Wikidata results:', rows.length, 'islands');
} else if (OFFLINE) {
  throw new Error('no cache and --offline was given');
} else {
  console.log('querying Wikidata…');
  const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(QUERY), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error('Wikidata returned ' + res.status);
  const json = await res.json();
  rows = json.results.bindings.map((b) => ({
    q: b.item.value.split('/').pop(),
    name: b.itemLabel?.value || '',
    lat: Number(b.lat.value), lon: Number(b.lon.value),
  }));
  writeFileSync(rawFile, JSON.stringify(rows, null, 1));
  console.log('cached', rows.length, 'islands to sources/wikidata/');
}

// ── 2. detail for a known set of ids ─────────────────────────────────────
const entFile = join(CACHE, 'entities.json');
const store = existsSync(entFile) ? JSON.parse(readFileSync(entFile, 'utf8')) : {};

async function entities(ids) {
  const missing = [...new Set(ids)].filter((id) => id && !store[id]);
  if (missing.length && !OFFLINE) {
    for (let i = 0; i < missing.length; i += 50) {
      const chunk = missing.slice(i, i + 50);
      const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json'
        + '&languages=en&props=claims%7Caliases%7Clabels&ids=' + chunk.join('%7C');
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('Wikidata API returned ' + r.status);
      const j = await r.json();
      Object.assign(store, j.entities || {});
    }
    writeFileSync(entFile, JSON.stringify(store));
  }
  return store;
}

const claim = (e, p) => e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;

// ── 3. the join ──────────────────────────────────────────────────────────
const matched = {};
const report = [];

for (const isl of ISLANDS) {
  const near = rows
    .map((r) => ({ r, d: km(isl.lat, isl.lon, r.lat, r.lon) }))
    .filter((x) => x.d <= 30)
    .sort((a, b) => a.d - b.d);
  if (!near.length) { report.push(`${isl.id}: nothing within 30 km on Wikidata`); continue; }

  const want = [isl.name, ...(isl.alt || [])].map(norm);
  // The names must agree as well as the coordinates. A Wikidata island 8 km
  // away with a different name is a different island, and the Caribbean is
  // full of them.
  const hit = near.find((x) => {
    const g = norm(x.r.name);
    return want.some((w) => g === w
      || (g.length > 4 && w.length > 4 && (g.includes(w) || w.includes(g))));
  });
  if (!hit) {
    report.push(`${isl.id}: nearest is "${near[0].r.name}" at ${near[0].d.toFixed(1)} km — names disagree, dropped`);
    continue;
  }
  matched[isl.id] = { q: hit.r.q, km: Math.round(hit.d * 10) / 10 };
}

await entities(Object.values(matched).map((m) => m.q));
const capIds = [];
for (const m of Object.values(matched)) {
  const cap = claim(store[m.q], 'P36');
  if (cap?.id) { m.capQ = cap.id; capIds.push(cap.id); }
}
await entities(capIds);

// ── 4. emit ──────────────────────────────────────────────────────────────
const out = {};
let withCap = 0, withFlag = 0, withAlias = 0;
for (const [id, m] of Object.entries(matched)) {
  const e = store[m.q];
  const isl = ISLANDS.find((x) => x.id === id);
  const rec = { q: m.q, km: m.km };

  // THE CAPITAL HAS TO BE ON THE ISLAND. Wikidata gives Bequia's capital as
  // Port Elizabeth and the label resolves to Gqeberha — the South African city
  // — because the wrong Port Elizabeth is linked. A quiz that teaches that is
  // worse than one that stays quiet, so the town's own coordinates must sit
  // within 60 km of the island or the claim is dropped.
  const capLabel = m.capQ && store[m.capQ]?.labels?.en?.value;
  if (capLabel) {
    const cc = claim(store[m.capQ], 'P625');
    const far = !cc || km(isl.lat, isl.lon, cc.latitude, cc.longitude) > 60;
    if (far) {
      report.push(`${id}: capital "${capLabel}" is ${cc ? Math.round(km(isl.lat, isl.lon, cc.latitude, cc.longitude)) + ' km away' : 'unlocated'} — dropped`);
    } else {
      // Wikidata files some of these under their administrative form.
      rec.cap = capLabel.replace(/\s+barrio-pueblo$/i, '').replace(/^Municipality of\s+/i, '');
      withCap++;
    }
  }

  // THE FLAG HAS TO BE THE ISLAND'S OWN. P41 on Saint Thomas points at the
  // flag of the United States Virgin Islands, which would make "whose flag is
  // this?" unanswerable — the island's name must appear in the file name.
  const flag = claim(e, 'P41');
  if (typeof flag === 'string') {
    const f = norm(flag);
    const own = [isl.name, ...(isl.alt || [])].some((n) => norm(n).length > 3 && f.includes(norm(n)));
    if (own) { rec.flag = flag; withFlag++; }
    else report.push(`${id}: "${flag}" is not this island's own flag — dropped`);
  }

  const alts = (e?.aliases?.en || []).map((a) => a.value)
    .filter((a) => a.length > 2 && norm(a) !== norm(isl.name))
    .slice(0, 4);
  if (alts.length) { rec.alt = alts; withAlias++; }

  out[id] = rec;
}

writeFileSync(join(CACHE, 'islands.json'), JSON.stringify(out, null, 1));
console.log(`\nmatched ${Object.keys(out).length} of ${ISLANDS.length} curated islands`);
console.log(`  ${withCap} with a capital · ${withFlag} with their own flag · ${withAlias} with alternative names`);
if (report.length) {
  console.log('\n' + report.length + ' unmatched:');
  for (const r of report) console.log('  ! ' + r);
}
