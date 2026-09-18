// Landfall — population, area, coordinates and flags for the sub-national
// units, from Wikidata.
//
//   node build/harvest-admin1.mjs              (--refresh re-queries, --offline never does)
//
// 969 provinces, states and regions reached the corpus with an outline and a
// name and nothing else: area 0, no position, no population. So "which of these
// has the most people" and "which is furthest north" could never be asked about
// any of them, and the fact card had nothing to say.
//
// Natural Earth already carries the answer to the hard part. Every admin-1 row
// names its own Wikidata item (`wikidataid`), so this is a JOIN BY IDENTIFIER,
// not by name — no fuzzy matching, nothing guessed. What can still go wrong is
// that the identifier is stale or points at the wrong thing, and build.mjs
// checks every value against geometry it already trusts before using it.
//
// Output: sources/wikidata/admin1.json — one small record per item, read by
// build.mjs. Raw entities are enormous (a Chinese province is ~400 KB of
// claims) so only the four properties used are kept.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_PACKS } from './curated/packs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sources');
const OUT = join(SRC, 'wikidata', 'admin1.json');
mkdirSync(dirname(OUT), { recursive: true });
const OFFLINE = process.argv.includes('--offline');
const REFRESH = process.argv.includes('--refresh');
const UA = 'Landfall/1.0 (https://robertwalterj.github.io/landfall/; personal geography study app)';

const load = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));

// ── 1. which items are needed ────────────────────────────────────────────
const admins = new Set(ADMIN_PACKS.filter((p) => p.source !== 'subunit').map((p) => p.admin));
const ids = new Set();
for (const f of load('ne_10m_admin_1_states_provinces.geojson').features) {
  if (admins.has(f.properties.admin) && f.properties.wikidataid) ids.add(f.properties.wikidataid);
}
for (const f of load('ne_10m_admin_0_map_subunits.geojson').features) {
  const p = f.properties;
  if (p.ADM0_A3 === 'GBR' && p.TYPE === 'Geo unit' && p.WIKIDATAID) ids.add(p.WIKIDATAID);
}

// Italy, Spain and France are taught by REGION, and a region is a set of
// Natural Earth rows (its provinces or departments). Summing their populations
// failed in eleven of Italy's twenty regions, because Italian provinces have
// been merged and abolished and their items no longer carry a current figure.
// The region has an item of its own; it is found without naming it, as the one
// thing every row in the region says it is located in (P131). build.mjs then
// checks that item like any other.
const regionRows = new Map();   // "admin|region" -> [row ids]
for (const pack of ADMIN_PACKS.filter((p) => p.source === 'region')) {
  for (const f of load('ne_10m_admin_1_states_provinces.geojson').features) {
    const pr = f.properties;
    if (pr.admin !== pack.admin || !pr.region || !pr.wikidataid) continue;
    const k = pack.admin + '|' + pr.region;
    if (!regionRows.has(k)) regionRows.set(k, []);
    regionRows.get(k).push(pr.wikidataid);
  }
}
const regionIds = new Set([...regionRows.values()].flat());

const have = existsSync(OUT) && !REFRESH ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
// Region rows need their P131, which the first harvest did not keep.
const need = [...ids].filter((q) => !(q in have) || (regionIds.has(q) && !have[q].in));
console.log(`${ids.size} items wanted, ${ids.size - need.length} cached, ${need.length} to fetch`);
if (need.length && OFFLINE) throw new Error('items missing from the cache and --offline was given');

// ── 2. choosing one value from many ──────────────────────────────────────
// A province has a population statement for every census. Deprecated ones are
// errors someone flagged; a preferred one is the community's pick; otherwise
// the most recent by its point-in-time qualifier. The date travels with the
// number so the build can say how old it is.
const timeOf = (st) => st.qualifiers?.P585?.[0]?.datavalue?.value?.time || '';
function pick(statements) {
  const live = (statements || []).filter((s) => s.rank !== 'deprecated' && s.mainsnak?.snaktype === 'value');
  if (!live.length) return null;
  const pool = live.some((s) => s.rank === 'preferred') ? live.filter((s) => s.rank === 'preferred') : live;
  return pool.slice().sort((a, b) => timeOf(b).localeCompare(timeOf(a)))[0];
}

// Area arrives in whatever unit the editor typed.
const KM2 = {
  'http://www.wikidata.org/entity/Q712226': 1,          // square kilometre
  'http://www.wikidata.org/entity/Q25343': 1e-6,        // square metre
  'http://www.wikidata.org/entity/Q35852': 0.01,        // hectare
  'http://www.wikidata.org/entity/Q232291': 2.589988,   // square mile
  'http://www.wikidata.org/entity/Q81292': 0.00404686,  // acre
};

function trim(e) {
  const c = e.claims || {};
  const out = { label: e.labels?.en?.value || null };
  const pop = pick(c.P1082);
  if (pop) {
    out.pop = Math.round(Number(pop.mainsnak.datavalue.value.amount));
    out.popYear = timeOf(pop).slice(1, 5) || null;
  }
  const area = pick(c.P2046);
  if (area) {
    const v = area.mainsnak.datavalue.value;
    const f = KM2[v.unit];
    if (f) out.area = Number(v.amount) * f;
    else out.areaUnit = v.unit;          // reported, never silently converted
  }
  const at = pick(c.P625);
  if (at) out.ll = [at.mainsnak.datavalue.value.latitude, at.mainsnak.datavalue.value.longitude];
  out.in = (c.P131 || []).filter((st) => st.rank !== 'deprecated' && st.mainsnak?.snaktype === 'value')
    .map((st) => st.mainsnak.datavalue.value.id);
  const flag = pick(c.P41);
  if (flag) out.flag = flag.mainsnak.datavalue.value;   // a Commons file name; not downloaded here
  return out;
}

// ── 3. fetch, fifty at a time ────────────────────────────────────────────
async function fetchAll(need) {
for (let i = 0; i < need.length; i += 50) {
  const batch = need.slice(i, i + 50);
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json'
    + '&props=labels|claims&languages=en&ids=' + batch.join('|');
  let json = null;
  // Wikimedia answers 429 to anything brisk. Pace every batch, and when told to
  // wait, wait as long as it says — the cache is written after each batch, so
  // an interrupted run resumes where it stopped.
  for (let attempt = 0; attempt < 8 && !json; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) { json = await res.json(); break; }
    const wait = (Number(res.headers.get('retry-after')) || 10 * (attempt + 1)) * 1000;
    process.stdout.write(`
  ${res.status}; waiting ${wait / 1000}s            `);
    await new Promise((r) => setTimeout(r, wait));
  }
  await new Promise((r) => setTimeout(r, 2500));
  if (!json) throw new Error('Wikidata kept refusing batch starting ' + batch[0]);
  for (const q of batch) {
    const e = json.entities?.[q];
    // A redirect comes back under the target's id; record where it went.
    if (!e || e.missing !== undefined) { have[q] = { missing: true }; continue; }
    have[q] = trim(e);
    if (e.id !== q) have[q].redirect = e.id;
  }
  for (const e of Object.values(json.entities || {})) {
    if (!batch.includes(e.id)) {
      const from = batch.find((q) => !have[q] || have[q].missing);
      if (from) { have[from] = { ...trim(e), redirect: e.id }; }
    }
  }
  process.stdout.write(`\r  ${Math.min(i + 50, need.length)} / ${need.length}`);
  writeFileSync(OUT, JSON.stringify(have));   // resumable if interrupted
}
if (need.length) console.log('');
}
await fetchAll(need);

// ── 4. the regions' own items ────────────────────────────────────────────
const regions = {};
for (const [k, qs] of regionRows) {
  if (qs.length < 2) continue;      // a one-province region is its province's own item
  const sets = qs.map((q) => new Set(have[q]?.in || []));
  const common = [...sets[0]].filter((q) => sets.every((st) => st.has(q)));
  // More than one candidate is kept, not guessed between: build.mjs takes the
  // one that passes the position and area checks.
  if (common.length) regions[k] = common;
  else console.log(`  region ${k}: no common parent — left to the provinces`);
}
const parents = [...new Set(Object.values(regions).flat())].filter((q) => !(q in have) || REFRESH);
if (parents.length) { console.log(`fetching ${parents.length} region items`); await fetchAll(parents); }
have._regions = regions;
console.log(`${Object.keys(regions).length} regions resolved to their own item`);

const vals = [...ids].map((q) => have[q]);
const n = (k) => vals.filter((v) => v && v[k] != null).length;
console.log(`population ${n('pop')} · area ${n('area')} · coordinate ${n('ll')} · flag ${n('flag')} `
  + `· missing ${vals.filter((v) => v?.missing).length} · odd area unit ${n('areaUnit')}`);
writeFileSync(OUT, JSON.stringify(have));
console.log('wrote', OUT);
