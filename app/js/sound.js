// Landfall — feedback sounds, synthesised at runtime.
//
// No sample files: nothing to download, nothing to cache, works offline. A
// correct answer walks up a pentatonic ladder as the streak builds, so success
// audibly accumulates and a miss audibly resets it.

let ctx = null;
let on = true;
let step = 0;

const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32];

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSound(v) { on = !!v; }
export function primeSound() { ac(); }

function tone(freq, { at = 0, dur = 0.16, gain = 0.16, type = 'triangle' } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A few milliseconds of band-passed noise at the attack is what makes a
// synthesised note sound struck rather than switched on.
function tick(gain = 0.06) {
  const c = ac();
  if (!c) return;
  const n = c.createBufferSource();
  const len = Math.floor(c.sampleRate * 0.02);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  n.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2200;
  const g = c.createGain();
  g.gain.value = gain;
  n.connect(f).connect(g).connect(c.destination);
  n.start();
}

export function right() {
  if (!on) return;
  tick(0.05);
  tone(LADDER[Math.min(step, LADDER.length - 1)], { gain: 0.14 });
  tone(LADDER[Math.min(step, LADDER.length - 1)] * 1.5, { at: 0.055, dur: 0.12, gain: 0.07 });
  step++;
}

export function wrong() {
  step = 0;
  if (!on) return;
  tick(0.04);
  tone(196, { dur: 0.2, gain: 0.12, type: 'sine' });
  tone(146.83, { at: 0.09, dur: 0.24, gain: 0.1, type: 'sine' });
}

export function resetStreak() { step = 0; }

export function fanfare() {
  if (!on) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.085, dur: 0.3, gain: 0.12 }));
}
