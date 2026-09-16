// Landfall — screens and the round loop.
//
// Five modes, and the list never grows: new content arrives as PACKS inside
// Quick Play, Training and Label the Map, never as a sixth row.
//
// The two rules that shape everything here:
//
//   NO CLOCK. There is no timer element in the question layout. A fixed
//   auto-advance delay is a reading-speed test with the clock hidden, so the
//   dwell scales with how many words are on screen, a miss NEVER auto-advances,
//   and one tap makes that verdict manual for good — it does not pause and
//   resume, because if you reached out to read something the app must not move
//   a second later.
//
//   READ ALOUD IS STRUCTURAL. The speak button is in the same place on every
//   question and on every option. Speech is unlocked on the first pointerdown
//   anywhere, because mobile browsers silently refuse speechSynthesis until it
//   has been called inside a real gesture — without that it looks broken.

import { DB, loadCore, loadMap, loadFlags, item, pack, inPack, kindLabel, withArticle, parentOf } from './data.js';
import { State, cardState, cardScore, isLapsing, FACET_LABEL, FACET_ORDER, KNOWN_AT } from './schedule.js';
import { facetsFor } from './engine.js';
import { Round } from './session.js';
import { MapView } from './map.js';
import { renderHero } from './hero.js';
import { sweepSets, sweepStatus, recordSweep, matchName, listen, listenAvailable } from './sweep.js';
import { initSpeech, unlock, say, stop as stopSpeech, available as speechAvailable } from './speech.js';
import * as sound from './sound.js';

const BUILD = 'dev (unstamped)';

const app = document.getElementById('app');
const sheetHost = document.getElementById('sheet');
let visit = 0;

// ── tiny DOM helpers ─────────────────────────────────────────────────────
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" ${extra}>${d}</svg>`;

// Run something once the node is in the document and laid out.
//
// NOT requestAnimationFrame: rAF does not fire while the page is hidden, so
// anything mounted through it — the hero, every map — silently never appears if
// the app is opened in a background tab and only looked at later. setTimeout
// always runs, and a 0ms timeout is still after layout.
const mount = (fn) => setTimeout(fn, 0);

// Every glyph is something that appears on a real chart: dividers, contour
// rings, a leader line, a folded chart, a depth sounding. Never a generic
// play-triangle-and-brain icon set.
const ICON = {
  quick: svg('<path d="M12 3.5 7 20M12 3.5 17 20M9.2 12.5h5.6"/><circle cx="12" cy="3.5" r="1.4"/>'),
  training: svg('<ellipse cx="12" cy="12" rx="8.5" ry="5.5"/><ellipse cx="12" cy="12" rx="5" ry="3"/><circle cx="12" cy="12" r="1.2"/>'),
  label: svg('<circle cx="7" cy="16" r="1.8"/><path d="M8.4 14.6 14 9h6"/>'),
  atlas: svg('<path d="M3 6.5 9.5 4.2 14.5 6.5 21 4.2v13.3l-6.5 2.3-5-2.3L3 19.8z"/><path d="M9.5 4.2v13.6M14.5 6.4V20"/>'),
  progress: svg('<path d="M12 3.5v17"/><path d="M8.5 7.5h7M9.5 12h5M10.5 16.5h3"/>'),
  settings: svg('<circle cx="12" cy="12" r="3.1"/><path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6M17.9 17.9l-1.6-1.6M7.7 7.7 6.1 6.1"/>'),
  back: svg('<path d="M14.5 5 8 12l6.5 7"/>'),
  chev: svg('<path d="M9 5.5 15.5 12 9 18.5"/>'),
  speak: svg('<path d="M5 9.5v5h3.2L13 19V5L8.2 9.5z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.6 6.6a7.5 7.5 0 0 1 0 10.8"/>'),
  tick: svg('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
  cross: svg('<path d="M6 6 18 18M18 6 6 18"/>'),
  out: svg('<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20 20M8.4 11h5.2"/>'),
  recentre: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3.2M12 17.8V21M21 12h-3.2M6.2 12H3"/>'),
};

const ring = (pct, cls = '') => {
  const tone = pct >= 0.75 ? 'high' : pct >= 0.35 ? 'mid' : '';
  return h('span', { class: `ring ${tone} ${cls}`, style: `--pct:${Math.max(0, Math.min(1, pct))}`, html:
    `<svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="17"/><circle class="fill" cx="22" cy="22" r="17"/></svg>` });
};

const chev = () => h('span', { class: 'chev', html: ICON.chev.replace('<svg', '<svg width="16" height="16"') });

function speakBtn(text, { klass = 'say tap small' } = {}) {
  if (State.settings().speech === 'off' || !speechAvailable()) return null;
  return h('button', {
    class: klass, 'aria-label': 'Read aloud', type: 'button',
    onclick: (e) => { e.stopPropagation(); say(text); },
    html: ICON.speak,
  });
}

// ── router ───────────────────────────────────────────────────────────────
const screens = {};
let current = null;

function go(name, params = {}) {
  stopSpeech();
  current = { name, params };
  document.body.dataset.screen = name;
  clearSheet();
  const node = screens[name](params);
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

// ── shared bits ──────────────────────────────────────────────────────────
const activePacks = () => State.settings().packs.filter((p) => DB.packs.has(p));
const ctxFor = (packIds) => ({
  pool: packIds.flatMap((p) => inPack(p)),
  cruel: false, kinds: null, detail: State.settings().detail,
  preferMap: DB.packs.get(packIds[0])?.map,
});
const facetsOf = (packIds) => {
  const c = ctxFor(packIds);
  return (it) => facetsFor(it, c);
};

function packStats(packIds) {
  const items = [...new Set(packIds.flatMap((p) => inPack(p)))];
  const f = facetsOf(packIds);
  return { items, ledger: State.packLedger(items, f), due: State.dueCount(items, f), facets: f };
}

function backBar(label, onBack) {
  return h('div', { class: 'head' },
    h('button', { class: 'icon-btn tap small', 'aria-label': 'Back', onclick: onBack, html: ICON.back }),
    h('h1', { class: 'title' }, label));
}

// ── home ─────────────────────────────────────────────────────────────────
screens.home = () => {
  const packIds = activePacks();
  const { items, ledger, due, facets } = packStats(packIds);
  const p = DB.packs.get(packIds[0]);
  const rec = State.practiceRecord();
  const drills = State.confusions();

  // What the next question is about, so the hero's mark means something.
  let markId = null;
  try {
    const r = new Round({ packIds, length: 1, detail: State.settings().detail });
    markId = r.sched.next()?.itemId || null;
  } catch { /* nothing learned yet and nothing to mark */ }

  const heroHost = h('div', { class: 'hero' });
  mount(() => {
    renderHero(heroHost, {
      packIds, markId, visit, facetsFor: facets,
      onPick: (id) => go('atlasItem', { id, from: 'home' }),
    });
  });

  const chips = [];
  // Nothing renders as a zero. Day one shows one chip — an empty ring beside a
  // pack name is a statement of scope, not a reproach.
  chips.push(h('span', { class: 'chip' }, ring(ledger.pct, 'small'), p.short,
    h('span', { class: 'n' }, Math.round(ledger.pct * 100) + '%')));
  if (rec.days >= 2) chips.push(h('span', { class: 'chip' },
    h('i', { class: 'dot', style: 'background:var(--verdigris)' }),
    h('span', { class: 'n' }, rec.days), `of last ${rec.of} days`));
  if (due > 0) chips.push(h('span', { class: 'chip' },
    h('i', { class: 'dot', style: 'background:var(--brass-mark)' }),
    h('span', { class: 'n' }, due), 'due'));
  if (drills.length) chips.push(h('span', { class: 'chip' },
    h('i', { class: 'dot', style: 'background:var(--vermilion)' }),
    h('span', { class: 'n' }, drills.length), 'to untangle'));

  const mode = (icon, title, sub, status, onclick, lead = false) =>
    h('button', { class: `mode tap ${lead ? 'lead' : ''}`, onclick },
      h('span', { class: `tile ${lead ? 'lead' : ''}`, html: icon }),
      h('span', { class: 'mode-text' },
        h('span', { class: 'mode-title' }, title),
        h('span', { class: 'mode-sub' }, sub)),
      status, chev());

  const statusDot = (n, colour) => n ? h('span', { class: 'mode-status' },
    h('i', { class: 'dot', style: `width:8px;height:8px;border-radius:50%;background:${colour}` }),
    h('span', { class: 'n' }, n)) : null;

  // Regions held: three clean sweeps at expanding gaps. The only count on this
  // screen that takes five weeks to earn.
  const held = Object.keys(State.data.sweeps).filter((k) => sweepStatus(k).held);

  return h('div', { class: 'screen' },
    h('div', { class: 'home-top' },
      h('div', {},
        h('div', { class: 'wordmark' }, h('span', {}, 'Land'), h('span', {}, 'fall')),
        h('div', { class: 'wordmark-rule' })),
      h('button', { class: 'icon-btn tap small', 'aria-label': 'Settings', onclick: () => go('settings'), html: ICON.settings })),
    heroHost,
    h('div', { class: 'chips' }, chips),
    h('div', { class: 'modes' },
      mode(ICON.quick, 'Quick Play', `${State.settings().length} questions · ${p.short}`,
        statusDot(due, 'var(--brass-mark)'), () => startRound({ mode: 'quick' }), true),
      mode(ICON.training, 'Training', 'spaced, untimed, until you are up to date',
        null, () => startRound({ mode: 'training' })),
      mode(ICON.label, 'Label the Map', 'name a whole region, no options',
        held.length
          ? h('span', { class: 'mode-status' },
            h('i', { class: 'dot', style: 'width:8px;height:8px;border-radius:50%;background:var(--verdigris)' }),
            h('span', { class: 'n' }, held.length), 'held')
          : null,
        () => go('label')),
      mode(ICON.atlas, 'Atlas', `${DB.items.size.toLocaleString()} places · read or listen`,
        null, () => go('atlas')),
      mode(ICON.progress, 'Progress', 'mastery, record, drills',
        statusDot(drills.length, 'var(--vermilion)'), () => go('progress'))),
    h('button', { class: 'row tap', style: 'margin-top:var(--section)', onclick: () => go('setup') },
      h('span', { class: 'tile', html: ICON.atlas }),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-title' }, 'Packs'),
        h('span', { class: 'row-sub' }, packIds.length > 1 ? `${packIds.length} packs · ${ledger.items} places` : `${p.name} · ${ledger.items} places`)),
      chev()));
};

// ── setup ────────────────────────────────────────────────────────────────
screens.setup = () => {
  const chosen = new Set(activePacks());
  const body = h('div', { class: 'stack' });

  const render = () => {
    body.replaceChildren();
    const groups = [
      ['Where you started', ['caribbean']],
      ['Countries', DB.core.packs.filter((p) => p.kind === 'countries').map((p) => p.id)],
      ['Provinces, states and prefectures', DB.core.packs.filter((p) => p.kind === 'admin1').map((p) => p.id)],
      ['Cities', DB.core.packs.filter((p) => p.kind === 'cities').map((p) => p.id)],
    ];
    for (const [title, ids] of groups) {
      if (!ids.length) continue;
      body.append(h('div', { class: 'label', style: 'margin-top:var(--s5)' }, title));
      for (const id of ids) {
        const p = DB.packs.get(id);
        if (!p) continue;
        const items = inPack(id);
        const led = State.packLedger(items, facetsOf([id]));
        const on = chosen.has(id);
        body.append(h('button', {
          class: `row tap ${on ? 'on' : ''}`,
          onclick: () => {
            if (on) chosen.delete(id); else chosen.add(id);
            if (!chosen.size) chosen.add(id);
            State.set({ packs: [...chosen] });
            render();
          },
        },
          ring(led.pct, 'small'),
          h('span', { class: 'row-text' },
            h('span', { class: 'row-title' }, p.name),
            h('span', { class: 'row-sub' }, `${p.n} places · ${p.blurb}`)),
          on ? h('span', { class: 'chev', style: 'color:var(--sea)', html: ICON.tick.replace('<svg', '<svg width="16" height="16"') }) : chev()));
      }
    }
  };
  render();

  const s = State.settings();
  const seg = (label, opts, key) => h('div', { style: 'margin-top:var(--s5)' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'toggle', style: 'margin-top:var(--s2)' },
      opts.map(([v, text]) => h('button', {
        class: 'opt tap small', 'aria-pressed': String(s[key] === v),
        onclick: (e) => { State.set({ [key]: v }); go('setup'); },
      }, text))));

  return h('div', { class: 'screen' },
    backBar('Packs', () => go('home')),
    h('p', { class: 'lede' }, 'Pick what you are working on. Everything else stays in the Atlas, and nothing is lost by turning a pack off.'),
    body,
    seg('Questions per round', [[10, '10'], [14, '14'], [20, '20']], 'length'),
    h('div', { style: 'margin-top:var(--s5)' },
      h('div', { class: 'label' }, 'The detail'),
      h('p', { class: 'lede', style: 'font-size:.95rem;margin:var(--s2) 0' },
        'Currency, language and what you call the people. Off by default: three currency questions in a round of fourteen crowd out three islands.'),
      h('div', { class: 'toggle' },
        h('button', { class: 'opt tap small', 'aria-pressed': String(!s.detail), onclick: () => { State.set({ detail: false }); go('setup'); } }, 'Places only'),
        h('button', { class: 'opt tap small', 'aria-pressed': String(!!s.detail), onclick: () => { State.set({ detail: true }); go('setup'); } }, 'Add the detail'))),
    h('button', { class: 'btn tap', style: 'margin-top:var(--section)', onclick: () => go('home') }, 'Done'));
};

// ── the round ────────────────────────────────────────────────────────────
let round = null;
let mapView = null;
let advanceTimer = null;
let manualFromHere = false;

async function startRound(opts = {}) {
  const packIds = activePacks();
  const s = State.settings();
  round = new Round({
    packIds,
    length: opts.length || s.length,
    mode: opts.mode || 'quick',
    cruel: !!opts.cruel,
    drill: opts.drill || null,
    detail: s.detail,
  });
  app.replaceChildren(h('div', { class: 'screen' }, h('p', { class: 'lede' }, 'Unfolding the map…')));
  await round.warm();
  go('round', {});
}

screens.round = () => {
  const wrap = h('div', { class: 'screen round' });
  renderQuestion(wrap);
  return wrap;
};

function dotRow() {
  const total = Number.isFinite(round.length) ? round.length : Math.max(12, round.results.length + 1);
  const row = h('div', { class: 'dots' });
  const from = Math.max(0, round.results.length - 11);
  for (let i = from; i < Math.min(total, from + 12); i++) {
    const r = round.results[i];
    const cls = r ? (r.right ? 'ok' : 'no') : (i === round.results.length ? 'now' : '');
    row.append(h('i', { class: cls }));
  }
  return row;
}

function renderQuestion(wrap) {
  clearSheet();
  const q = round.next();
  if (!q) { go('summary'); return; }
  manualFromHere = false;

  const top = h('div', { class: 'round-top' },
    h('button', { class: 'icon-btn tap small', 'aria-label': 'Leave the round', onclick: leaveRound, html: ICON.back }),
    dotRow(),
    h('button', { class: 'icon-btn tap small', 'aria-label': 'Sound', onclick: (e) => {
      const on = !State.settings().sound;
      State.set({ sound: on }); sound.setSound(on);
      e.currentTarget.style.opacity = on ? '1' : '.4';
    }, html: svg('<path d="M5 9.5v5h3.2L13 19V5L8.2 9.5z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6"/>') }));
  if (!State.settings().sound) top.lastChild.style.opacity = '.4';

  // The frame is chrome — small, sans, quiet. The subject is the thing under
  // test — serif, huge, dark. One word to read instead of a sentence.
  const frameText = q.frame || q.prompt;
  const frameNode = h('div', { class: 'frame' });
  if (q.negate) {
    const parts = frameText.split(/\bNOT\b/);
    frameNode.append(parts[0], h('b', {}, 'NOT'), parts[1] || '');
  } else frameNode.textContent = frameText;

  // With a subject, the frame is a quiet label above it. Without one — "which
  // country is this", where the figure IS the subject — the frame becomes the
  // question itself and must not also be printed above as a caption.
  const promptBlock = h('div', { class: 'prompt' },
    h('div', { class: 'prompt-text' },
      q.subject ? frameNode : null,
      q.subject
        ? h('div', { class: 'subject' }, q.subject)
        : h('div', { class: 'subject plain' }, q.prompt.replace(/\?$/, '')),
      q.promptSub ? h('div', { class: 'prompt-sub' }, q.promptSub) : null),
    speakBtn(q.speak || q.prompt));

  wrap.replaceChildren(top, promptBlock);

  if (q.figure) wrap.append(figureFor(q.figure));

  if (q.form === 'map') wrap.append(mapSurface(q));
  else if (q.form === 'flags') wrap.append(flagSurface(q));
  else wrap.append(optionSurface(q));

  if (State.settings().speech === 'prompt' || State.settings().speech === 'both') {
    setTimeout(() => say(q.speak || q.prompt), 180);
  }
  startClock(q);
}

// The opt-in clock. Deliberately the most ignorable treatment available: a 2px
// line at the very top edge that shortens, and nothing else on the screen
// changes. No ring, no number, no colour shift, no sound as it runs out. It is
// off by default and the app is designed as though it does not exist.
let clockTimer = null;
function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
  document.querySelector('.clockline')?.remove();
}
function startClock(q) {
  stopClock();
  const secs = Number(State.settings().clock) || 0;
  if (!secs) return;
  const line = h('div', { class: 'clockline', style: 'width:100%' });
  document.body.append(line);
  const t0 = Date.now();
  clockTimer = setInterval(() => {
    const left = 1 - (Date.now() - t0) / (secs * 1000);
    if (left <= 0) {
      stopClock();
      if (!q.answered) answer(null);      // out of time counts as a miss
      return;
    }
    line.style.width = (left * 100).toFixed(1) + '%';
  }, 200);
}

function figureFor(fig) {
  if (fig.type === 'flag') {
    const box = h('div', { class: 'figure flag' });
    box.innerHTML = DB.flags?.[fig.code] || '';
    return box;
  }
  const map = DB.maps.get(fig.mapId);
  const f = map?.f?.[fig.id];
  const box = h('div', { class: 'figure' });
  if (f?.d) {
    // The FULL bounding box, not the main ring's: the shape of the Bahamas is
    // the whole archipelago, and framing it on Andros alone is a different
    // question with a different answer.
    const bb = f.bb;
    const w = bb[2] - bb[0], hh = bb[3] - bb[1];
    const pad = Math.max(w, hh) * 0.06;
    box.innerHTML = `<svg class="shape" viewBox="${bb[0] - pad} ${bb[1] - pad} ${w + pad * 2} ${hh + pad * 2}" preserveAspectRatio="xMidYMid meet"><path d="${f.d}"/></svg>`;
  }
  return box;
}

function optionSurface(q) {
  const box = h('div', { class: 'options' });
  for (const o of q.options) {
    const long = o.label.length >= 26;
    const btn = h('button', {
      class: 'option tap', 'data-opt': o.id,
      onclick: (e) => { if (e.target.closest('.say')) return; answer(o.id); },
    },
      h('span', { class: `option-label ${long ? 'long' : ''}` }, o.label),
      h('span', { class: 'verdict-mark', style: 'display:none' }));
    const sp = speakBtn(o.label, { klass: 'say tap small' });
    if (sp) btn.append(sp);
    box.append(btn);
  }
  return box;
}

function flagSurface(q) {
  const box = h('div', { class: 'flags' });
  for (const o of q.options) {
    const art = h('div', { class: 'art', html: DB.flags?.[o.flag] || '' });
    box.append(h('button', { class: 'flagopt tap', 'data-opt': o.id, 'aria-label': 'Flag option', onclick: () => answer(o.id) }, art));
  }
  return box;
}

function mapSurface(q) {
  const well = h('div', { class: 'mapwell' });
  const controls = h('div', { class: 'mapctl' },
    h('button', { class: 'tap small', 'aria-label': 'Show the whole map', onclick: () => mapView.setView([0, 0, mapView.map.w, mapView.map.h]), html: ICON.out }),
    h('button', { class: 'tap small', 'aria-label': 'Back to the candidates', onclick: () => mapView.setView(mapView.boxOf(q.map.candidates.map((c) => c.id))), html: ICON.recentre }));
  well.append(controls);
  mount(() => {
    const map = DB.maps.get(q.map.id);
    if (!map) return;
    mapView = new MapView(well);
    well.append(controls);
    mapView.reserve = 0;
    mapView.draw(map, { candidates: q.map.candidates, onPick: (id) => answer(id) });
    mapView.setView([0, 0, map.w, map.h], { animate: false });
    mapView.setView(mapView.boxOf(q.map.candidates.map((c) => c.id)));
  });
  return well;
}

// ── answering ────────────────────────────────────────────────────────────
function answer(choiceId) {
  const q = round.current;
  if (!q || q.answered) return;
  q.answered = true;
  stopClock();
  const verdict = round.answer(choiceId);
  if (verdict.right) sound.right(); else sound.wrong();

  // Show what you picked AND what was right, both at once.
  for (const el of document.querySelectorAll('[data-opt]')) {
    const id = el.dataset.opt;
    const mark = el.querySelector('.verdict-mark');
    if (id === verdict.correctId) {
      el.classList.add('right');
      if (mark) { mark.innerHTML = ICON.tick; mark.style.display = ''; }
    } else if (id === choiceId) {
      el.classList.add('wrong');
      if (mark) { mark.innerHTML = ICON.cross; mark.style.display = ''; }
    }
  }
  if (q.form === 'map' && mapView) {
    mapView.mark(verdict.correctId, 'right');
    if (choiceId && choiceId !== verdict.correctId) mapView.mark(choiceId, 'wrong');
    const labels = {};
    labels[verdict.correctId] = item(verdict.correctId)?.n || '';
    mapView.draw(mapView.map, { candidates: q.map.candidates, labels });
    mapView.mark(verdict.correctId, 'right');
    if (choiceId && choiceId !== verdict.correctId) mapView.mark(choiceId, 'wrong');
  }
  showVerdict(verdict, q);
}

function clearSheet() {
  stopClock();
  clearTimeout(advanceTimer);
  advanceTimer = null;
  // Clear the CONTENT, not just the visibility. A hidden-but-populated sheet
  // makes every later measurement of what is on screen lie.
  sheetHost.replaceChildren();
  sheetHost.hidden = true;
  document.querySelector('.veil')?.remove();
}

function showVerdict(v, q) {
  const veil = h('div', { class: `veil ${v.right ? 'right' : 'wrong'}` });
  document.body.append(veil);
  mount(() => veil.classList.add('on'));

  const target = item(v.correctId);
  const context = target
    ? (DB.groups.get((target.g || [])[0])?.name
      || parentOf(target)?.n
      || target.x?.sr || target.x?.admin || '')
    : '';

  const body = h('div', { class: 'sheet-body' });
  const lines = [];
  if (v.explain) lines.push(v.explain);
  if (v.note) lines.push(v.note);
  for (const line of lines) body.append(h('p', {}, line));

  const conf = !v.right && v.chosen ? State.confusionWeight(q.itemId, v.chosen) : 0;
  if (conf >= 2) {
    body.append(h('span', { class: 'chip' },
      h('i', { class: 'dot', style: 'background:var(--vermilion)' }), 'untangle these later'));
  }

  const spoken = [v.label, context, ...lines].filter(Boolean).join('. ');
  const sp = speakBtn(spoken, { klass: 'say tap small' });
  if (sp) {
    body.append(h('div', { style: 'display:flex;align-items:center;gap:var(--s2);margin-top:var(--s2)' },
      sp, h('span', { style: 'font:500 .9375rem/1 var(--font-use);color:var(--sea)' }, 'hear it again')));
  }

  const last = Number.isFinite(round.length) && round.results.length >= round.length;
  const cont = h('button', { class: 'btn tap', onclick: next },
    last ? 'See the round' : 'Continue',
    h('span', { html: ICON.chev.replace('<svg', '<svg width="18" height="18"') }));

  sheetHost.replaceChildren(
    h('div', { class: 'sheet-grab' }),
    h('div', { class: `sheet-head ${v.right ? 'right' : 'wrong'}` },
      h('span', { class: 'sheet-glyph', html: (v.right ? ICON.tick : ICON.cross).replace('<svg', '<svg class="x"') }),
      h('div', {},
        h('div', { class: 'sheet-answer' }, v.label || target?.n || ''),
        context ? h('div', { class: 'sheet-context' }, context) : null)),
    body,
    h('div', { class: 'sheet-foot' }, cont));
  sheetHost.hidden = false;

  // The sheet covers the bottom of the screen; on a map question the map IS
  // the answer, so re-frame the correct feature into what is still showing.
  if (q.form === 'map' && mapView) {
    mount(() => {
      mapView.reserve = sheetHost.getBoundingClientRect().height;
      mapView.setView(mapView.boxOf([v.correctId], 1.4));
    });
  }

  // Pacing. A miss never auto-advances — a wrong answer is the moment the
  // learning happens, and it stays until it is dismissed. A hit waits 400ms a
  // word (about 150wpm, a fair figure for unfamiliar proper nouns), capped.
  const words = (v.label + ' ' + context + ' ' + lines.join(' ')).trim().split(/\s+/).filter(Boolean).length;
  const auto = State.settings().advance === 'auto';
  if (v.right && auto) {
    const dwell = Math.min(6000, 900 + words * 400);
    advanceTimer = setTimeout(next, dwell);
  }

  // Any tap other than Continue cancels the advance for good. It does not
  // pause and resume: if you reached out to read something, the app must not
  // move a second later.
  const cancel = (e) => {
    if (e.target.closest('.btn')) return;
    manualFromHere = true;
    clearTimeout(advanceTimer);
    advanceTimer = null;
  };
  sheetHost.addEventListener('pointerdown', cancel);
  veil.style.pointerEvents = 'none';
  document.addEventListener('pointerdown', cancel, { once: false });

  if (State.settings().speech === 'both') setTimeout(() => say(spoken), 420);
}

function next() {
  clearSheet();
  if (round.done) { go('summary'); return; }
  const wrap = document.querySelector('.round');
  if (wrap) renderQuestion(wrap); else go('summary');
}

function leaveRound() {
  if (!round || !round.results.length) { go('home'); return; }
  go('summary');
}

// ── summary ──────────────────────────────────────────────────────────────
screens.summary = () => {
  const s = round ? round.summary() : { asked: 0, right: 0, missed: [], bestStreak: 0, newItems: 0 };
  const packIds = activePacks();
  const { ledger } = packStats(packIds);
  const p = DB.packs.get(packIds[0]);
  if (s.asked && s.right === s.asked) sound.fanfare();

  const missed = h('div', { class: 'list' });
  const seen = new Set();
  for (const q of s.missed) {
    const it = item(q.correctId) || item(q.itemId);
    if (!it || seen.has(it.i)) continue;
    seen.add(it.i);
    missed.append(h('button', { class: 'listrow tap', onclick: () => go('atlasItem', { id: it.i, from: 'summary' }) },
      h('i', { class: `pip ${State.itemState(it.i, facetsOf(packIds)(it))}` }),
      h('span', { class: 'name' }, it.n),
      h('span', { class: 'meta' }, FACET_LABEL[q.facet] || ''),
      chev()));
  }

  return h('div', { class: 'screen' },
    h('h1', { class: 'title', style: 'margin-top:var(--s6)' }, s.asked ? 'Round done' : 'Nothing asked'),
    h('div', { class: 'grid2', style: 'margin-top:var(--s4)' },
      h('div', { class: 'bubble' },
        h('div', { class: 'stat' }, h('span', { class: 'n' }, `${s.right}/${s.asked}`)),
        h('div', { class: 'label', style: 'margin-top:4px' }, 'this round')),
      h('div', { class: 'bubble' },
        h('div', { class: 'stat' }, h('span', { class: 'n' }, s.newItems)),
        h('div', { class: 'label', style: 'margin-top:4px' }, 'new places'))),
    h('p', { class: 'sentence', style: 'margin-top:var(--s5)' },
      `You can name ${ledger.itemsKnown} of ${ledger.items} in ${p.short}.`),
    h('p', { class: 'lede', style: 'font-size:.95rem' },
      `${ledger.cards} cards: ${ledger.met} met, ${ledger.known} known, ${ledger.secure} secure.`),
    seen.size ? h('div', { style: 'margin-top:var(--s6)' },
      h('div', { class: 'label' }, 'What slipped'), missed) : null,
    h('button', { class: 'btn tap', style: 'margin-top:var(--section)', onclick: () => startRound({ mode: 'quick' }) }, 'Another round'),
    // Nothing due is not a dead end. A sweep is a better use of the same
    // minutes than churning cards ahead of schedule, and it is the mode he
    // actually wants.
    h('button', { class: 'btn quiet tap', style: 'margin-top:var(--stack)', onclick: () => go('label') }, 'Label the map instead'),
    h('button', { class: 'btn quiet tap', style: 'margin-top:var(--stack)', onclick: () => go('home') }, 'Home'));
};

// ── Label the Map ────────────────────────────────────────────────────────
//
// The mode he is here for: work through a region naming every feature until the
// map is filled in. Removing the four options converts the whole engine from
// recognition to production, which is the thing he could actually do as a child.
//
// Three rules from the design that are easy to lose and worth stating:
//   The map does NOT zoom to the answer. Seeing the archipelago whole is the
//   entire point, so the region stays framed for the length of the sweep.
//   There is no progress bar, because the map IS the progress bar.
//   A missed feature inks in ANYWAY and goes to the back of the queue. The goal
//   state is a completed chart; leaving a hole as punishment is not the game.

let sweep = null;

// The entry screen: which set, and which direction.
screens.label = () => {
  const packIds = activePacks();
  const facets = facetsOf(packIds);
  const sets = sweepSets(packIds, facets);
  const ready = sets.filter((s) => s.ready);
  const notYet = sets.filter((s) => !s.ready);

  const dir = State.settings().sweepDir || 'fill';
  const dirRow = h('div', { class: 'toggle', style: 'margin-top:var(--s2)' },
    h('button', {
      class: 'opt tap small', 'aria-pressed': String(dir === 'fill'),
      onclick: () => { State.set({ sweepDir: 'fill' }); go('label'); },
    }, 'Place it on the map'),
    h('button', {
      class: 'opt tap small', 'aria-pressed': String(dir === 'name'),
      onclick: () => { State.set({ sweepDir: 'name' }); go('label'); },
    }, 'Name it'));

  const setRow = (s) => {
    const st = s.status;
    const badge = st.held
      ? h('span', { class: 'chip' }, h('i', { class: 'dot', style: 'background:var(--verdigris)' }), 'held')
      : st.clean
        ? h('span', { class: 'mode-status' }, h('span', { class: 'n' }, st.clean),
          st.clean === 1 ? 'clean sweep' : 'clean')
        : null;
    return h('button', {
      class: 'row tap', onclick: () => go('sweep', { key: s.key, dir }),
    },
      ring(s.met / s.members.length, 'small'),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-title' }, s.name),
        h('span', { class: 'row-sub' },
          `${s.members.length} features · you have met ${s.met}`)),
      badge, chev());
  };

  const blocked = (s) => h('div', { class: 'row', style: 'opacity:.55' },
    ring(s.met / s.members.length, 'small'),
    h('span', { class: 'row-text' },
      h('span', { class: 'row-title' }, s.name),
      h('span', { class: 'row-sub' }, `${s.met} of ${s.members.length} met. Not yet.`)));

  return h('div', { class: 'screen' },
    backBar('Label the Map', () => go('home')),
    h('p', { class: 'lede' },
      'No options and no clock. Work through a region until the chart is finished.'),
    h('div', { style: 'margin-top:var(--s5)' },
      h('div', { class: 'label' }, 'Which way round'),
      dirRow,
      h('p', { class: 'lede muted', style: 'font-size:.9rem;margin-top:var(--s2)' },
        dir === 'fill'
          ? 'It names a place, you find it. The whole map is live.'
          : 'It lights up a place, you name it. Typed or spoken, and spelling is never marked.')),
    ready.length
      ? h('div', { style: 'margin-top:var(--s6)' },
        h('div', { class: 'label' }, 'Ready to sweep'),
        h('div', { class: 'stack' }, ready.map(setRow)))
      : h('p', { class: 'lede', style: 'margin-top:var(--s6)' },
        'Nothing is ready yet. A set opens here once you have met most of it — play a round or two first, because a sweep of places you have never seen is not practice.'),
    notYet.length
      ? h('div', { style: 'margin-top:var(--s6)' },
        h('div', { class: 'label' }, 'Not yet'),
        h('div', { class: 'stack' }, notYet.slice(0, 8).map(blocked)))
      : null);
};

// The sweep itself.
screens.sweep = ({ key, dir }) => {
  const packIds = activePacks();
  const set = sweepSets(packIds, facetsOf(packIds)).find((s) => s.key === key);
  if (!set) return screens.label();
  const map = DB.maps.get(set.mapId);
  if (!map) {
    loadMap(set.mapId).then(() => go('sweep', { key, dir }));
    return h('div', { class: 'screen' }, h('p', { class: 'lede' }, 'Unfolding the map…'));
  }

  // The first sweep of a set runs in geographic order — north to south along
  // the arc — because that is the structure of the place and it gives him a
  // route to walk. Every sweep after that is shuffled: if a set is only ever
  // learned in order, the list becomes the retrieval cue and "where is Nevis"
  // fails on its own.
  const first = set.status.last === 0;
  const order = first
    ? set.members.slice().sort((a, b) => (b.ll?.[0] ?? 0) - (a.ll?.[0] ?? 0))
    : set.members.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

  sweep = {
    set, dir, map, order, i: 0,
    firstTime: 0, afterMiss: 0, given: [], missed: new Set(), failed: [],
    named: new Map(),            // id -> 'clean' | 'miss' | 'given'
  };

  const head = h('div', { class: 'head', style: 'gap:var(--s3)' },
    h('button', { class: 'icon-btn tap small', 'aria-label': 'Leave the sweep', onclick: () => go('label'), html: ICON.back }),
    h('span', { class: 'row-text' },
      h('span', { class: 'row-title', style: 'font-family:var(--font-read);font-weight:600' }, set.name),
      h('span', { class: 'row-sub', id: 'sweep-tally' }, `0 of ${order.length}`)),
    ring(0, 'small'));
  // Fixed height, not flex:1 — in a min-height:100dvh column a growing well
  // pushes the prompt and the input below the fold.
  const well = h('div', { class: 'mapwell', style: 'flex:none;height:46dvh;margin-top:var(--s3)' });
  const bar = h('div', { class: 'bubble', style: 'margin-top:var(--s3)' });
  const wrap = h('div', { class: 'screen round' }, head, well, bar);

  mount(() => {
    const mv = new MapView(well);
    sweep.mv = mv;
    paint();
    // THE SET's region, held, for the length of the sweep. Not the whole map:
    // sweeping the Leewards while framed on the entire Caribbean puts every
    // target inside about eight pixels. The view never moves again after this,
    // because seeing the chain whole is the point of the mode.
    mv.setView(mv.boxOf(set.members.map((m) => m.i), 0.28), { animate: false });
    ask();
  });

  function paint(pulse) {
    const labels = {};
    for (const id of sweep.named.keys()) labels[id] = item(id)?.n || '';
    sweep.mv.draw(map, {
      candidates: sweep.order.slice(sweep.i).map((x) => ({ id: x.i })),
      rings: false,
      labels,
      collide: true,
      onPick: dir === 'fill' ? (id) => tapped(id) : null,
    });
    for (const el of sweep.mv.svg.querySelectorAll('.feat')) {
      const how = sweep.named.get(el.dataset.id);
      el.classList.toggle('named', how === 'clean' || how === 'miss');
      el.classList.toggle('given', how === 'given');
    }
    if (dir === 'name' && sweep.i < sweep.order.length) {
      const id = sweep.order[sweep.i].i;
      sweep.mv.svg.querySelector(`.feat[data-id="${CSS.escape(id)}"]`)?.classList.add('hi');
      sweep.mv.point(id);
    }
    if (pulse) {
      const el = sweep.mv.svg.querySelector(`.feat[data-id="${CSS.escape(pulse)}"]`);
      el?.classList.add('just');
      setTimeout(() => el?.classList.remove('just'), 700);
    }
    const done = sweep.named.size;
    head.querySelector('#sweep-tally').textContent = `${done} of ${sweep.order.length}`;
    const r = head.querySelector('.ring');
    r.style.setProperty('--pct', done / sweep.order.length);
    r.className = 'ring small' + (done / sweep.order.length >= 0.75 ? ' high' : done / sweep.order.length >= 0.35 ? ' mid' : '');
  }

  function ask() {
    if (sweep.i >= sweep.order.length) return finish();
    const it = sweep.order[sweep.i];
    paint();
    bar.replaceChildren(
      dir === 'fill' ? fillPrompt(it) : namePrompt(it),
      h('button', {
        class: 'btn quiet tap', style: 'margin-top:var(--s3)',
        onclick: () => give(it),
      }, 'Show me'));
    if (dir === 'name') setTimeout(() => bar.querySelector('input')?.focus({ preventScroll: true }), 60);
  }

  function fillPrompt(it) {
    return h('div', { style: 'display:flex;align-items:flex-start;gap:var(--s3)' },
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { class: 'frame' }, 'Place this'),
        h('div', { class: 'subject', style: 'font-size:clamp(1.7rem,7.5vw,2.2rem)' }, it.n)),
      speakBtn(it.n));
  }

  function namePrompt(it) {
    const input = h('input', {
      class: 'search', type: 'text', autocomplete: 'off', autocapitalize: 'words',
      spellcheck: 'false', placeholder: 'What is it called?',
      onkeydown: (e) => { if (e.key === 'Enter') submit(); },
    });
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      named(it, v);
    };
    const row = h('div', { style: 'display:flex;gap:var(--s2);margin-top:var(--s3)' }, input);
    if (listenAvailable()) {
      const mic = h('button', {
        class: 'say tap small', 'aria-label': 'Say the name',
        onclick: (e) => {
          const btn = e.currentTarget;
          btn.classList.add('on');
          listen((alts) => {
            for (const a of alts) {
              if (matchName(a, it, sweep.order)) { named(it, a); return; }
            }
            input.value = alts[0] || '';
          }, () => btn.classList.remove('on'));
        },
        html: svg('<path d="M12 4.5a2.6 2.6 0 0 1 2.6 2.6v4.4a2.6 2.6 0 0 1-5.2 0V7.1A2.6 2.6 0 0 1 12 4.5z"/><path d="M6.5 11.3a5.5 5.5 0 0 0 11 0M12 16.8V20"/>'),
      });
      row.append(mic);
    }
    row.append(h('button', { class: 'btn tap', style: 'width:auto;padding:0 var(--s5);min-height:48px', onclick: submit }, 'Say'));
    return h('div', {},
      h('div', { class: 'frame' }, 'Name this'),
      h('div', { class: 'prompt-sub', style: 'margin-top:4px' }, 'Spelling is never marked.'),
      row);
  }

  // ── answering ───────────────────────────────────────────────────────
  function tapped(id) {
    const want = sweep.order[sweep.i];
    if (id === want.i) return right(want);
    // A wrong TAP is the richest confusion signal in the app: an unprompted
    // error with no distractor set shaping it.
    State.answer(want.i, 'place', false, id);
    wrong(want, id);
  }

  function named(it, text) {
    const m = matchName(text, it, sweep.order);
    if (m) return right(it, m.exact ? null : m.spelling);
    State.answer(it.i, 'place', false, null);
    wrong(it, null);
  }

  function right(it, spelling) {
    sound.right();
    const missedBefore = sweep.missed.has(it.i);
    if (!missedBefore) { sweep.firstTime++; State.answer(it.i, 'place', true, null, { bonus: dir === 'name' ? 0.25 : 0.15 }); }
    else { sweep.afterMiss++; State.answer(it.i, 'place', true, null, { bonus: dir === 'name' ? 0.25 : 0.15 }); }
    sweep.named.set(it.i, missedBefore ? 'miss' : 'clean');
    sweep.i++;
    if (spelling) return showSpelling(it, spelling);
    ask();
    paint(it.i);
  }

  function wrong(want, tappedId) {
    sound.wrong();
    sweep.failed.push(want.n);
    if (sweep.missed.has(want.i)) return give(want, true);   // twice is enough
    sweep.missed.add(want.i);
    // It inks in anyway — you get told — and goes to the back of the queue.
    sweep.named.set(want.i, 'miss');
    const it = sweep.order.splice(sweep.i, 1)[0];
    sweep.order.push(it);
    sweep.named.delete(want.i);
    paint(want.i);
    tell(want, tappedId ? item(tappedId) : null, 'miss');
  }

  function give(want, afterTwo = false) {
    if (!afterTwo) {
      // No confusion pair: there was no wrong answer, only a blank.
      State.answer(want.i, 'place', false, null);
      sweep.failed.push(want.n);
    }
    sweep.given.push(want.i);
    sweep.named.set(want.i, 'given');
    sweep.i++;
    paint(want.i);
    tell(want, null, 'given');
  }

  // A short, dismissible line rather than the round's verdict sheet: this mode
  // is the contemplative one and the chart should stay in view.
  function tell(want, wrongItem, how) {
    bar.replaceChildren(
      h('div', { style: 'display:flex;align-items:flex-start;gap:var(--s3)' },
        h('span', {
          class: 'sheet-glyph', style: `stroke:var(--${how === 'given' ? 'brass' : 'vermilion'})`,
          html: ICON.cross,
        }),
        h('div', { style: 'flex:1;min-width:0' },
          h('div', { class: 'sheet-answer', style: 'font-size:1.5rem' }, want.n),
          wrongItem
            ? h('div', { class: 'sheet-context' }, 'You tapped ' + wrongItem.n + '.')
            : h('div', { class: 'sheet-context' }, how === 'given' ? 'Given.' : 'It comes back before the end.')),
        speakBtn(want.n)),
      h('button', { class: 'btn tap', style: 'margin-top:var(--s3)', onclick: ask }, 'Carry on'));
  }

  function showSpelling(it, spelling) {
    bar.replaceChildren(
      h('div', { style: 'display:flex;align-items:flex-start;gap:var(--s3)' },
        h('span', { class: 'sheet-glyph', style: 'stroke:var(--verdigris)', html: ICON.tick }),
        h('div', { style: 'flex:1;min-width:0' },
          h('div', { class: 'sheet-answer', style: 'font-size:1.5rem' }, spelling),
          h('div', { class: 'sheet-context' }, 'Counted. That is how it is spelled.')),
        speakBtn(spelling)),
      h('button', { class: 'btn tap', style: 'margin-top:var(--s3)', onclick: ask }, 'Carry on'));
    paint(it.i);
  }

  // ── the end ─────────────────────────────────────────────────────────
  function finish() {
    const clean = sweep.firstTime === sweep.order.length;
    const res = recordSweep(set.key, {
      cleanSweep: clean, named: sweep.firstTime, total: sweep.order.length,
      failed: [...new Set(sweep.failed)],
    });
    if (clean) sound.fanfare();
    paint();
    bar.replaceChildren();

    const lines = [];
    if (res.now.held && !res.was.held) {
      lines.push(h('p', { class: 'sentence' },
        `${set.name} is held — three clean sweeps, five weeks apart.`));
    } else if (res.was.held && !res.now.held) {
      lines.push(h('p', { class: 'sentence' },
        `Dropped. ${set.name} was held since ${new Date(res.was.heldSince).toLocaleDateString('en-CA', { day: 'numeric', month: 'long' })}.`));
      if (res.now.droppedNames.length) {
        lines.push(h('p', { class: 'lede' }, res.now.droppedNames.join(', ') + '.'));
      }
    } else if (clean && res.now.waitFor) {
      lines.push(h('p', { class: 'lede' },
        `Clean sweep ${res.now.clean}. The next one counts towards holding this region in ${res.now.waitFor} day${res.now.waitFor === 1 ? '' : 's'}.`));
    } else if (clean) {
      lines.push(h('p', { class: 'lede' }, `Clean sweep ${res.now.clean}.`));
    }

    const panel = h('div', { class: 'bubble', style: 'margin-top:var(--s3)' },
      h('p', { class: 'sentence' }, `${set.name} — ${sweep.order.length} of ${sweep.order.length}.`),
      h('p', { class: 'lede', style: 'font-size:.95rem' },
        [`${sweep.firstTime} named first time`,
          sweep.afterMiss ? `${sweep.afterMiss} after a miss` : null,
          sweep.given.length ? `${sweep.given.length} given` : null]
          .filter(Boolean).join(' · ')),
      lines,
      h('div', { style: 'display:flex;gap:var(--s2);margin-top:var(--s4)' },
        h('button', { class: 'btn tap', onclick: () => go('sweep', { key, dir }) }, 'Again'),
        h('button', { class: 'btn quiet tap', onclick: () => saveChart(set) }, 'Save the chart')),
      h('button', { class: 'btn quiet tap', style: 'margin-top:var(--stack)', onclick: () => go('home') }, 'Home'));
    wrap.replaceChildren(head, well, panel);
  }

  return wrap;
};

// The finished chart is the reward, so it is worth being able to keep one.
function saveChart(set) {
  try {
    const src = sweep.mv.svg.cloneNode(true);
    src.setAttribute('viewBox', `0 0 ${sweep.map.w} ${sweep.map.h}`);
    src.setAttribute('width', sweep.map.w);
    src.setAttribute('height', sweep.map.h);
    const cs = getComputedStyle(document.documentElement);
    const vars = ['--land-context', '--land-unseen', '--land-known', '--land-shaky',
      '--surface', '--surface-sunk', '--ink', '--sea', '--vermilion', '--verdigris', '--brass-mark'];
    // An SVG rasterised through an <img> has no access to the document's CSS,
    // so the custom properties have to be baked in.
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `svg{background:${cs.getPropertyValue('--surface-sunk')}}`
      + vars.map((v) => `${v}:${cs.getPropertyValue(v)};`).join('')
      + `.ctx{fill:${cs.getPropertyValue('--land-context')};opacity:.55}`
      + `.feat{fill:${cs.getPropertyValue('--land-unseen')}}`
      + `.feat.named{fill:${cs.getPropertyValue('--land-known')}}`
      + `.feat.given{fill:${cs.getPropertyValue('--brass-mark')}}`
      + `text.mlabel{font:600 12px sans-serif;fill:${cs.getPropertyValue('--ink')};text-anchor:middle;`
      + `paint-order:stroke;stroke:${cs.getPropertyValue('--surface-sunk')};stroke-width:3.5px;stroke-linejoin:round}`;
    src.prepend(style);
    const svgText = new XMLSerializer().serializeToString(src);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = sweep.map.w * 1.5;
      c.height = sweep.map.h * 1.5;
      const ctx = c.getContext('2d');
      ctx.fillStyle = cs.getPropertyValue('--surface-sunk');
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = set.name.replace(/[^\w]+/g, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  } catch { /* a chart that will not save is not worth an error message */ }
}

// ── Atlas ────────────────────────────────────────────────────────────────
screens.atlas = () => {
  const list = h('div', { class: 'list' });
  const input = h('input', { class: 'search', type: 'search', placeholder: 'Search 1,742 places', oninput: (e) => render(e.target.value) });

  function render(term = '') {
    list.replaceChildren();
    const t = term.trim().toLowerCase();
    let rows;
    if (t.length >= 2) {
      rows = [...DB.items.values()].filter((it) =>
        it.n.toLowerCase().includes(t) || (it.alt || []).some((a) => a.toLowerCase().includes(t))).slice(0, 60);
    } else {
      rows = [...new Set(activePacks().flatMap((p) => inPack(p)))].slice(0, 80);
    }
    for (const it of rows) {
      const st = State.itemState(it.i, facetsOf(activePacks())(it));
      list.append(h('button', { class: 'listrow tap', onclick: () => go('atlasItem', { id: it.i, from: 'atlas' }) },
        h('i', { class: `pip ${st}` }),
        it.fl && DB.flags?.[it.fl] ? h('span', { class: 'thumb', html: DB.flags[it.fl] }) : null,
        h('span', { class: 'name' }, it.n),
        h('span', { class: 'meta' }, kindLabel(it)),
        chev()));
    }
    if (!rows.length) list.append(h('p', { class: 'lede muted' }, 'Nothing by that name.'));
  }
  loadFlags().then(() => render(input.value));
  render();

  return h('div', { class: 'screen' },
    backBar('Atlas', () => go('home')),
    input,
    list);
};

screens.atlasItem = ({ id, from }) => {
  const it = item(id);
  if (!it) return h('div', { class: 'screen' }, h('p', { class: 'lede' }, 'Not in the corpus.'));
  const facets = facetsOf(activePacks())(it);
  const mapId = (it.m || [])[0];
  const map = DB.maps.get(mapId);

  const facts = [];
  const add = (k, v) => { if (v) facts.push([k, v]); };
  add('Capital', it.caps?.join(', '));
  add(it.k === 'territory' ? 'Administered by' : 'Part of', parentOf(it)?.n || it.x?.sov || it.x?.admin);
  add('Region', it.x?.sr);
  add('Groups', (it.g || []).map((g) => DB.groups.get(g)?.name).filter(Boolean).join(' · '));
  add('Borders', (it.x?.bd || []).map((c) => item('c:' + c)?.n).filter(Boolean).join(', '));
  add('Currency', it.x?.curN);
  add('Language', (it.x?.lang || []).join(', '));
  add('People', it.x?.dem);
  add('Population', it.x?.pop ? it.x.pop.toLocaleString() : null);
  add('Area', it.x?.area ? Math.round(it.x.area).toLocaleString() + ' km²' : null);

  const contested = (it.gc || []).map((g) => DB.groups.get(g)).filter(Boolean);

  const body = h('div', { class: 'stack' });
  if (map?.f?.[it.i]?.d) {
    const f = map.f[it.i];
    // Full extent, not the main ring: framing the Bahamas on Andros alone and
    // then clipping draws an unrecognisable fragment.
    const bb = f.bb;
    const w = bb[2] - bb[0], hh = bb[3] - bb[1];
    const pad = Math.max(w, hh) * 0.5;
    body.append(h('div', { class: 'figure', html:
      `<svg class="shape" viewBox="${bb[0] - pad} ${bb[1] - pad} ${w + pad * 2} ${hh + pad * 2}"><path d="${map.ctx}" fill="var(--land-context)" opacity=".5"/><path d="${f.d}" fill="var(--ink)" opacity=".88"/></svg>` }));
  }
  if (it.fl && DB.flags?.[it.fl]) body.append(h('div', { class: 'figure flag', html: DB.flags[it.fl] }));

  for (const [k, v] of facts) {
    body.append(h('div', { class: 'row' },
      h('span', { class: 'row-text' },
        h('span', { class: 'row-sub' }, k),
        h('span', { class: 'row-title', style: 'font-family:var(--font-read);font-weight:400' }, v)),
      speakBtn(`${k}. ${v}`)));
  }

  const state = State.itemState(it.i, facets);
  const perFacet = facets.map((f) => `${FACET_LABEL[f]}: ${cardState(State.card(it.i, f))}`).join(' · ');

  return h('div', { class: 'screen' },
    backBar(it.n, () => go(from === 'home' ? 'home' : from === 'summary' ? 'summary' : 'atlas')),
    h('p', { class: 'lede' }, `${kindLabel(it)}${it.alt?.length ? ' · also ' + it.alt[0] : ''}`),
    it.note ? h('p', { class: 'lede', style: 'margin-top:var(--s3)' }, it.note) : null,
    contested.length ? h('div', { class: 'bubble', style: 'margin-top:var(--s4)' },
      h('div', { class: 'label' }, 'Contested'),
      contested.map((g) => h('p', { class: 'lede', style: 'font-size:.95rem;margin-top:var(--s2)' },
        `Whether ${it.n} belongs to ${g.name} is argued both ways. ${g.note || ''}`))) : null,
    body,
    h('div', { class: 'sep' }),
    h('div', { class: 'label' }, 'Where you are with it'),
    h('p', { class: 'sentence' }, state === 'unseen' ? 'Not met yet.' : perFacet));
};

// ── Progress ─────────────────────────────────────────────────────────────
screens.progress = () => {
  const packIds = activePacks();
  const { items, ledger, facets } = packStats(packIds);
  const p = DB.packs.get(packIds[0]);
  const rec = State.practiceRecord();
  const drills = State.confusions();
  const lapsing = items.filter((it) => facets(it).some((f) => isLapsing(State.card(it.i, f))));

  const mapId = p.map;
  const map = DB.maps.get(mapId);
  const mapBox = h('div', { class: 'mapwell', style: 'height:34dvh;margin-top:var(--s4)' });
  if (map) {
    mount(() => {
      const mv = new MapView(mapBox);
      mv.draw(map, {
        shade: (id) => {
          const it = item(id);
          if (!it) return null;
          const m = State.itemMastery(id, facets(it));
          if (m === 0) return 'var(--land-unseen)';
          return m > 0.55 ? 'var(--land-known)' : 'var(--land-shaky)';
        },
      });
      mv.setView([0, 0, map.w, map.h], { animate: false });
    });
  }

  const drillRows = h('div', { class: 'list' });
  for (const d of drills.slice(0, 8)) {
    const a = item(d.a), b = item(d.b);
    if (!a || !b) continue;
    drillRows.append(h('button', { class: 'listrow tap', onclick: () => startRound({ mode: 'quick', length: 8, drill: { a: d.a, b: d.b }, cruel: true }) },
      h('i', { class: 'pip', style: 'background:var(--vermilion)' }),
      h('span', { class: 'name' }, `${a.n} and ${b.n}`),
      h('span', { class: 'meta' }, `${Math.round(d.n)}×`),
      chev()));
  }

  return h('div', { class: 'screen' },
    backBar('Progress', () => go('home')),
    h('p', { class: 'sentence' }, `You can name ${ledger.itemsKnown} of ${ledger.items} in ${p.short}.`),
    h('p', { class: 'lede', style: 'font-size:.95rem' },
      `${ledger.cards} cards: ${ledger.met} met, ${ledger.known} known, ${ledger.secure} secure.`),
    mapBox,
    h('div', { class: 'grid2', style: 'margin-top:var(--s5)' },
      h('div', { class: 'bubble' },
        h('div', { class: 'stat' }, h('span', { class: 'n' }, rec.days), h('span', { class: 'u' }, `of ${rec.of} days`)),
        h('div', { class: 'label', style: 'margin-top:6px' }, 'practised')),
      h('div', { class: 'bubble' },
        h('div', { class: 'stat' }, h('span', { class: 'n' }, ledger.itemsMet)),
        h('div', { class: 'label', style: 'margin-top:6px' }, 'places met'))),
    lapsing.length ? h('div', { style: 'margin-top:var(--s6)' },
      h('div', { class: 'label' }, 'Going grey'),
      h('p', { class: 'lede', style: 'font-size:.95rem' },
        `${lapsing.length} ${lapsing.length === 1 ? 'place is' : 'places are'} overdue by more than half their own interval. They are shown faded because that is what has happened to the memory.`)) : null,
    drills.length ? h('div', { style: 'margin-top:var(--s6)' },
      h('div', { class: 'label' }, 'Worth untangling'),
      h('p', { class: 'lede', style: 'font-size:.95rem' }, 'Pairs you have mixed up more than once. A drill puts them head to head.'),
      drillRows) : null);
};

// ── Settings ─────────────────────────────────────────────────────────────
screens.settings = () => {
  const s = State.settings();
  const seg = (label, note, opts, key, after = null) => h('div', { style: 'margin-top:var(--s6)' },
    h('div', { class: 'label' }, label),
    note ? h('p', { class: 'lede', style: 'font-size:.95rem;margin:var(--s2) 0' }, note) : null,
    h('div', { class: 'toggle' }, opts.map(([v, text]) => h('button', {
      class: 'opt tap small', 'aria-pressed': String(s[key] === v),
      onclick: () => { State.set({ [key]: v }); if (after) after(v); go('settings'); },
    }, text))));

  return h('div', { class: 'screen' },
    backBar('Settings', () => go('home')),
    seg('Read aloud', 'Speech is primed on your first tap; without that, phones refuse it silently.',
      [['off', 'Off'], ['prompt', 'The question'], ['both', 'Question and answer']], 'speech'),
    seg('Move on', 'A miss never moves on by itself, whatever this says.',
      [['auto', 'After a pause'], ['tap', 'Only when I tap']], 'advance'),
    seg('Clock', 'Off by default. A clock measures how fast you read, not what you know.',
      [[0, 'No clock'], [20, '20 seconds'], [40, '40 seconds']], 'clock'),
    seg('Sound', null, [[true, 'On'], [false, 'Off']], 'sound', (v) => sound.setSound(v)),
    seg('Theme', null, [['system', 'Match the phone'], ['light', 'Chart'], ['dark', 'Night chart']], 'theme', applyTheme),
    h('div', { class: 'sep' }),
    h('div', { class: 'label' }, 'About'),
    h('p', { class: 'lede', style: 'font-size:.95rem' },
      `Landfall · build ${BUILD}. Shapes and places from Natural Earth (public domain) and world-countries (ODbL); flags from flag-icons (MIT). Island names, regional groupings and corrections are hand-checked — see build/report.txt for everything the build could not resolve.`),
    h('button', {
      class: 'btn quiet tap', style: 'margin-top:var(--s6)',
      onclick: () => {
        if (confirm('Erase all progress on this device? This cannot be undone.')) { State.reset(); go('home'); }
      },
    }, 'Erase progress'));
};

function applyTheme(v) {
  const t = v || State.settings().theme;
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

// ── boot ─────────────────────────────────────────────────────────────────
async function boot() {
  State.load();
  applyTheme();
  initSpeech();
  sound.setSound(State.settings().sound);
  visit = Number(localStorage.getItem('landfall.visits') || 0) + 1;
  try { localStorage.setItem('landfall.visits', String(visit)); } catch { /* fine */ }

  // Speech and audio both need one real gesture before they will work at all.
  const prime = () => { unlock(); sound.primeSound(); document.removeEventListener('pointerdown', prime); };
  document.addEventListener('pointerdown', prime);

  await loadCore();
  State.seedConfusions(DB.core.groups);
  const packs = activePacks();
  await Promise.all([
    loadFlags().catch(() => null),
    ...packs.map((p) => loadMap(DB.packs.get(p)?.map).catch(() => null)),
  ]);

  go('home');
  const boot = document.getElementById('boot');
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 300);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
