// Landfall — read aloud.
//
// This is an accessibility feature, not a flourish. It also has one hard
// gotcha: mobile browsers refuse speechSynthesis until it has been called once
// inside a real user gesture. Without unlock() on the first pointerdown, speech
// silently does nothing and looks broken.

let voice = null;
let unlocked = false;
// Who to tell when speaking starts and stops. A callback rather than an import
// of sound.js: the single-file bundler refuses two modules that both declare
// the same top-level binding, and `import * as sound` in two places is exactly
// that. It has frozen the boot screen three times; not a fourth.
let onState = null;
export function onSpeaking(fn) { onState = fn; }

function choose() {
  const all = speechSynthesis.getVoices?.() || [];
  if (!all.length) return null;
  const score = (v) => {
    let s = 0;
    if (/^en[-_]CA/i.test(v.lang)) s += 6;
    if (/^en[-_]GB/i.test(v.lang)) s += 5;
    if (/^en/i.test(v.lang)) s += 3;
    if (v.localService) s += 2;
    if (/natural|neural/i.test(v.name)) s += 2;
    return s;
  };
  return all.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

export function initSpeech() {
  if (!('speechSynthesis' in window)) return;
  voice = choose();
  speechSynthesis.addEventListener?.('voiceschanged', () => { voice = choose(); });
}

export function unlock() {
  if (unlocked || !('speechSynthesis' in window)) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch { /* nothing to do */ }
}

export function available() { return 'speechSynthesis' in window; }

// The reading speed is a setting, not a constant. Being able to slow a voice
// down is a standard accommodation, and 0.97 is only right for whoever picked
// it. Set by app.js from the stored preference.
let rate = 0.97;
export function setRate(r) { rate = Math.max(0.6, Math.min(1.3, Number(r) || 0.97)); }

export function say(text, opts = {}) {
  const spoken = opts.rate || rate;
  if (!text || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    onState?.(false);
    const u = new SpeechSynthesisUtterance(String(text));
    if (!voice) voice = choose();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = spoken;
    u.onstart = () => { onState?.(true); armGuard(4 + String(text).split(/\s+/).length * 0.9); };
    u.onend = () => { clearTimeout(guard); onState?.(false); };
    u.onerror = () => { clearTimeout(guard); onState?.(false); };
    speechSynthesis.speak(u);
  } catch { /* nothing to do */ }
}

export function stop() {
  try { speechSynthesis.cancel(); } catch { /* nothing to do */ }
  onState?.(false);
}

// A watchdog, because `onend` is not reliable. Android's speech service drops
// it under interruption and Safari has historically not fired it after
// cancel() — and a single missed `onend` leaves the effects ducked to 22% for
// the rest of the session, which presents as "the sound went quiet" with no
// way back but a reload.
let guard = null;
function armGuard(seconds) {
  clearTimeout(guard);
  guard = setTimeout(() => onState?.(false), seconds * 1000);
}
