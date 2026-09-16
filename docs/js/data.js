// Landfall — the corpus, and getting hold of it.
//
// core.json holds every item, pack and group (about 450KB). Maps and flags are
// fetched on demand and then live in the service worker cache, because the full
// set of 43 maps is several megabytes and nobody needs the map of Peruvian
// regions before they have asked for it.

export const DB = {
  core: null,
  items: new Map(),
  packs: new Map(),
  groups: new Map(),
  maps: new Map(),          // id -> map payload
  flags: null,
  ready: false,
};

// Resolved lazily: this module is also loaded by the headless test harness,
// where there is no document to ask.
const url = (p) => new URL('.', document.baseURI).href.replace(/js\/$/, '') + p;

// The single-file artifact build has no server to fetch from, so the corpus is
// inlined and handed over here instead.
async function grab(path) {
  const pre = globalThis.window && window.__LANDFALL__;
  if (pre && pre[path]) return pre[path];
  return (await fetch(url(path))).json();
}

export async function loadCore() {
  if (DB.ready) return DB;
  const core = await grab('data/core.json');
  DB.core = core;
  for (const it of core.items) DB.items.set(it.i, it);
  for (const p of core.packs) DB.packs.set(p.id, p);
  for (const g of core.groups) DB.groups.set(g.id, g);

  // Reverse indexes the app leans on constantly.
  DB.byPack = new Map();
  for (const it of core.items) {
    for (const p of it.pk) {
      if (!DB.byPack.has(p)) DB.byPack.set(p, []);
      DB.byPack.get(p).push(it);
    }
  }
  DB.childrenOf = new Map();
  for (const it of core.items) {
    if (!it.pr) continue;
    if (!DB.childrenOf.has(it.pr)) DB.childrenOf.set(it.pr, []);
    DB.childrenOf.get(it.pr).push(it);
  }
  DB.ready = true;
  return DB;
}

export async function loadMap(id) {
  if (!id) return null;
  if (DB.maps.has(id)) return DB.maps.get(id);
  const m = await grab('data/maps/' + id + '.json');
  DB.maps.set(id, m);
  return m;
}

export async function loadFlags() {
  if (DB.flags) return DB.flags;
  DB.flags = await grab('data/flags.json');
  return DB.flags;
}

export const item = (id) => DB.items.get(id);
export const pack = (id) => DB.packs.get(id);
export const group = (id) => DB.groups.get(id);
export const inPack = (id) => DB.byPack.get(id) || [];

// The article-free label used in prompts: "the Bahamas" reads badly as an
// option but badly wrong in a sentence without it.
export function withArticle(it) {
  const n = it.n;
  if (/^(Bahamas|Gambia|Netherlands|Philippines|Maldives|Comoros|Seychelles|United|Democratic|Republic|Czech|Marshall|Solomon|Cayman|Turks|Falkland|Faroe|Cook)\b/.test(n)) return 'the ' + n;
  return n;
}

// How a place should be described when it is the answer to "what is this?"
export function kindLabel(it) {
  if (it.k === 'country') return 'country';
  if (it.k === 'territory') return 'territory';
  if (it.k === 'island') return 'island';
  if (it.k === 'city') return 'city';
  if (it.k === 'admin1') return (it.x?.type || 'region').toLowerCase();
  return 'place';
}

export const parentOf = (it) => (it.pr ? DB.items.get(it.pr) : null);

// Great-circle distance in km, used to rank how near a wrong answer is.
export function distanceKm(a, b) {
  if (!a?.ll || !b?.ll) return null;
  const R = 6371, rad = Math.PI / 180;
  const [la1, lo1] = a.ll, [la2, lo2] = b.ll;
  const dLat = (la2 - la1) * rad, dLon = (lo2 - lo1) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
