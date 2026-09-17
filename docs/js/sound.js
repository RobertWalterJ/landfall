// Landfall — the sound of a chart table.
//
// Everything is synthesised at runtime: no sample files, nothing to download,
// nothing to cache, works offline, adds nothing to the bundle.
//
// THE MATERIALS. This is a chart being surveyed, so the sounds are the things
// on the table — a pencil tick on wood, paper moving, a struck brass bar, a
// small bell, and the room they are all in. Nothing here beeps. An arcade
// blip would be the audio equivalent of a hard-edged bordered box, which the
// stylesheet spends its whole header refusing.
//
// TWO RULES THAT DECIDE MOST OF IT:
//
// 1. STAY WHERE A PHONE CAN SPEAK. A phone speaker is a few millimetres
//    across and falls off a cliff below about 400 Hz. The previous version
//    played "wrong" as a SINE at 196 Hz and 147 Hz — a sine has no harmonics,
//    so there was nothing above the rolloff to hear and the cue was close to
//    silent on the actual device. Nothing here puts meaning in a fundamental
//    below ~330 Hz; where a sound needs to feel low it gets a darker timbre
//    and a falling contour instead. build/sound-lab.html measures this.
//
// 2. SUBTLE MEANS SHORT AND QUIET, NOT THIN. The glue is a shared room: one
//    small reverb that everything is sent to in different amounts. A dry
//    oscillator straight to the speaker is what makes synthesised audio sound
//    cheap; the same note with 200 ms of room around it sounds placed.
//
// Sound is OFF by default and stays that way. This is what it sounds like when
// he turns it on.

let ctx = null;
let bus = null;
let on = false;
let ducked = false;
let step = 0;                       // how far up the ladder the streak has gone

// C major pentatonic. It climbs with the streak and then FOLDS BACK an octave
// rather than continuing up: the old ladder ran to 2349 Hz, which on a small
// speaker is not triumphant, it is piercing. Folding keeps every success in
// the register a phone actually flatters while still feeling like it rose.
const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const FOLD = 4;                     // fold back to this index once past the top

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!bus) bus = buildBus(ctx);
  return ctx;
}

// -- the room ------------------------------------------------------------
//
// A short, dark impulse response, generated rather than downloaded. Noise with
// an exponential decay, run through a one-pole lowpass so the tail loses its
// top end the way a real small room does, and decorrelated between the two
// channels so it has width instead of sitting in the middle of your head.
function impulse(c, seconds = 1.1, decay = 3.2) {
  const n = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;                 // one-pole lowpass
      d[i] = last * (1 - i / n) ** decay;
    }
  }
  return buf;
}

function buildBus(c) {
  const master = c.createGain();
  // Built while speech is already running? Start ducked, or the first cue
  // talks straight over the voice.
  master.gain.value = ducked ? 0.22 : 0.9;

  // Cues can land on top of each other — an answer, a sheet arriving and a
  // milestone bell inside 200 ms — so there is a limiter. But it has to be set
  // where the audio actually IS.
  //
  // At threshold -16 with a knee of 14 the knee spanned -23 to -9 dBFS, and
  // the loudest cue here is -23 short-term. Nothing ever crossed it, so the
  // node did no limiting at all — while still applying Chrome's unconditional
  // makeup gain, which measured as a flat +4 dB. Every level in this file was
  // therefore tuned through a boost that does not exist in Firefox or Safari.
  // Now it sits low enough to catch a real stack, and the makeup is explicit
  // and mine.
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -30;
  comp.knee.value = 6;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  const makeup = c.createGain();
  makeup.gain.value = 1.6;

  const verb = c.createConvolver();
  verb.buffer = impulse(c);
  const verbGain = c.createGain();
  verbGain.gain.value = 0.9;
  // Keep the tail out of the way of speech, and out of the low end the
  // speaker cannot render anyway.
  const verbTone = c.createBiquadFilter();
  verbTone.type = 'highpass';
  verbTone.frequency.value = 400;

  const send = c.createGain();
  send.gain.value = 1;
  send.connect(verb).connect(verbTone).connect(verbGain).connect(master);
  master.connect(comp).connect(makeup).connect(c.destination);
  return { master, comp, makeup, send, verbGain };
}

// -- helpers -------------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);
// Nothing is ever played twice identically. A few cents of detune and a few
// per cent of level is the difference between a cue you stop noticing and one
// that starts to grate on the four hundredth question.
const vary = (f) => f * (2 ** (rnd(-7, 7) / 1200));

function out(node, gain, verbAmount) {
  const c = ctx;
  const dry = c.createGain();
  dry.gain.value = gain;
  node.connect(dry).connect(bus.master);
  if (verbAmount > 0) {
    const wet = c.createGain();
    wet.gain.value = gain * verbAmount;
    node.connect(wet).connect(bus.send);
  }
}

// A struck bar: a triangle through a lowpass that CLOSES as it decays. The
// closing filter is the whole trick — it is why this reads as something hit
// rather than something switched on.
function struck(freq, { at = 0, dur = 0.5, gain = 0.1, verb = 0.3, bright = 2600, type = 'triangle', partial = 3.0, partialGain = 0.18 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const f = vary(freq);

  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.max(f * 2, bright), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.05, 240), t + dur);
  lp.Q.value = 0.7;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  o.connect(lp).connect(g);
  out(g, gain * rnd(0.94, 1.06), verb);
  o.start(t);
  o.stop(t + dur + 0.03);

  // A quiet upper partial gives the bar its metal. Skipped when it would land
  // somewhere shrill.
  if (partial && f * partial < 5200) {
    const p = c.createOscillator();
    p.type = 'sine';
    p.frequency.setValueAtTime(vary(f * partial), t);
    const pg = c.createGain();
    pg.gain.setValueAtTime(0.0001, t);
    pg.gain.exponentialRampToValueAtTime(1, t + 0.004);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.45);
    p.connect(pg);
    out(pg, gain * partialGain, verb);
    p.start(t);
    p.stop(t + dur + 0.03);
  }
}

// Filtered noise. Wood at a couple of kHz, paper higher and softer.
function noise(freq, { at = 0, dur = 0.03, gain = 0.05, q = 1.1, verb = 0.12, type = 'bandpass', sweep = 1 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const len = Math.max(64, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.6;
  const n = c.createBufferSource();
  n.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep !== 1) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = 1;
  n.connect(f).connect(g);
  out(g, gain * rnd(0.9, 1.1), verb);
  n.start(t);
  n.stop(t + dur + 0.02);
}

// A small bell. Real bell partials are inharmonic — that ratio set is what
// stops it sounding like an organ. Reserved for the moments that have earned
// an event: a streak milestone, a region held, a clean sweep.
function bell(freq, { at = 0, gain = 0.055, dur = 1.5, verb = 0.7 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const f = vary(freq);
  // hum, prime, tierce, quint, nominal — ratio, level, relative length
  const partials = [[1, 0.5, 1], [2, 1, 0.8], [2.4, 0.55, 0.62], [3, 0.36, 0.5], [4, 0.28, 0.4]];
  for (const [ratio, level, len] of partials) {
    const hz = f * ratio * 0.5;
    if (hz > 6000) continue;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * (1 + rnd(-0.0015, 0.0015)), t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * len);
    o.connect(g);
    out(g, gain * level, verb);
    o.start(t);
    o.stop(t + dur * len + 0.05);
  }
}

// -- the cues ------------------------------------------------------------
//
// Levels are deliberately spread over a wide range. `press` is nearly
// subliminal and `held` is an event; if every cue sat at the same loudness the
// set would be noise rather than information.

export function setSound(v) { on = !!v; }
export function primeSound() { ac(); }
export function resetStreak() { step = 0; }

// Speech and sound effects must never talk over each other — read-aloud is an
// accessibility feature here, not a garnish, so the effects get out of its way.
export function setSpeaking(v) {
  ducked = !!v;
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.master.gain.cancelScheduledValues(t);
  bus.master.gain.setTargetAtTime(ducked ? 0.22 : 0.9, t, 0.05);
}

// Any tap. Wood, 14 ms, barely there — you feel it more than hear it.
export function press() {
  if (!on) return;
  noise(1800, { dur: 0.014, gain: 0.075, q: 0.9, verb: 0.05 });
  struck(560, { dur: 0.05, gain: 0.032, verb: 0.05, bright: 1200, partial: 0 });
}

// The map's aimed feature changed under a moving thumb. Quieter still, and
// high — it has to read while a finger is sliding without becoming a rattle.
export function aim() {
  if (!on) return;
  // A very short burst splatters across the spectrum whatever you centre it on
  // — time and bandwidth trade against each other — so this one is given a few
  // more milliseconds and a tighter filter rather than being made shorter and
  // brighter, which is the instinct and is wrong.
  noise(2150, { dur: 0.015, gain: 0.085, q: 1.9, verb: 0 });
}

// Right. Up the pentatonic, folding back an octave at the top so a long streak
// never turns shrill.
// `n` is the round's own streak. The module used to keep its own counter that
// nothing ever reset, so finishing a round on nine and starting another put
// your first correct answer at rung ten — and Label the Map shares this
// function, so a long sweep drove the quiz's ladder past twenty and rang the
// milestone bell at a displayed streak of three. One source of truth.
export function right(n = null) {
  step = n == null ? step + 1 : n;
  if (!on) return;
  const i = Math.max(0, step - 1);
  const note = LADDER[i < LADDER.length ? i : FOLD + ((i - LADDER.length) % (LADDER.length - FOLD))];
  noise(2400, { dur: 0.012, gain: 0.022, verb: 0.05 });
  struck(note, { dur: 0.5, gain: 0.1, verb: 0.32 });
  struck(note * 2, { at: 0.045, dur: 0.3, gain: 0.03, verb: 0.4, partial: 0 });
  // Five, ten, twenty, and every twenty after: a bell over the top. Rare
  // enough that it still means something when it happens.
  if (step === 5 || step === 10 || step === 20 || (step > 20 && step % 20 === 0)) {
    bell(step >= 20 ? 1046.5 : 783.99, { at: 0.08, gain: step >= 20 ? 0.06 : 0.045 });
  }
}

// Wrong. NOT a buzzer — a minor third down, darker and shorter: the sound of
// setting the pencil down rather than of an alarm. It says "no" by contour and
// timbre, which works on a phone speaker; the old low sine did not.
export function wrong() {
  step = 0;
  if (!on) return;
  noise(1200, { dur: 0.018, gain: 0.026, q: 0.8, verb: 0.08 });
  struck(587.33, { dur: 0.3, gain: 0.085, verb: 0.22, bright: 1500, partial: 2.0, partialGain: 0.1 });
  struck(493.88, { at: 0.085, dur: 0.46, gain: 0.08, verb: 0.3, bright: 1250, partial: 2.0, partialGain: 0.1 });
}

// The verdict sheet arriving. Paper, not a note.
export function reveal(good = true) {
  if (!on) return;
  noise(good ? 2300 : 1900, { dur: 0.11, gain: 0.055, q: 0.85, verb: 0.2, sweep: good ? 0.55 : 0.45 });
}

// On to the next question. A page turning under your thumb.
export function advance() {
  if (!on) return;
  noise(2100, { dur: 0.07, gain: 0.058, q: 0.85, verb: 0.15, sweep: 1.2 });
}

// A place you have never been asked about before. Two notes a fifth apart,
// rising: the one motif in here allowed to be slightly romantic, because
// sighting new land is the whole idea of the game.
export function discover() {
  if (!on) return;
  struck(659.25, { dur: 0.42, gain: 0.055, verb: 0.45 });
  struck(987.77, { at: 0.1, dur: 0.6, gain: 0.05, verb: 0.55 });
}

// Label the Map: a feature you named, inked in. DRY on purpose — it is a mark
// made on paper in front of you, not something heard across a room.
export function ink() {
  if (!on) return;
  noise(1500, { dur: 0.05, gain: 0.045, q: 0.7, verb: 0.05, sweep: 0.6 });
  struck(523.25, { dur: 0.22, gain: 0.055, verb: 0.1, bright: 1800, partial: 2 });
}

// A feature you were given because you missed it twice. The same gesture,
// falling instead of level, and duller. It should land slightly flat.
export function given() {
  if (!on) return;
  noise(1150, { dur: 0.05, gain: 0.04, q: 0.7, verb: 0.05, sweep: 0.55 });
  struck(440, { dur: 0.26, gain: 0.05, verb: 0.12, bright: 1500, partial: 2, partialGain: 0.14 });
}

// A region held: three clean sweeps at widening gaps, five weeks minimum. The
// biggest thing the app can tell you, so it gets the biggest sound in here —
// which is still under a tenth of full scale.
export function held() {
  if (!on) return;
  [523.25, 659.25, 783.99].forEach((f, i) => struck(f, { at: i * 0.075, dur: 0.7, gain: 0.075, verb: 0.5 }));
  bell(1046.5, { at: 0.24, gain: 0.06, dur: 2.2, verb: 0.85 });
}

// A round finished clean.
export function fanfare() {
  if (!on) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => struck(f, { at: i * 0.08, dur: 0.55, gain: 0.07, verb: 0.45 }));
  bell(1318.51, { at: 0.32, gain: 0.05, dur: 1.8, verb: 0.8 });
}

// -- measurement ---------------------------------------------------------
//
// build/sound-lab.html renders every cue through an OfflineAudioContext and
// reports peak level, length, and how much of each one lives below 400 Hz —
// the band a phone speaker throws away. It drives the module through here, so
// it measures the code that actually ships rather than a copy of it.
export const CUES = ['press', 'aim', 'right', 'wrong', 'reveal', 'advance', 'discover', 'ink', 'given', 'held', 'fanfare'];

export async function __render(name, OfflineCtx, seconds = 3.5) {
  const prevCtx = ctx, prevBus = bus, prevOn = on, prevStep = step;
  const c = new OfflineCtx(2, Math.ceil(44100 * seconds), 44100);
  ctx = c;
  bus = buildBus(c);
  on = true;
  if (name === 'right') step = 0;
  const fns = { press, aim, right, wrong, reveal, advance, discover, ink, given, held, fanfare };
  fns[name]();
  const rendered = await c.startRendering();
  ctx = prevCtx; bus = prevBus; on = prevOn; step = prevStep;
  return rendered;
}
