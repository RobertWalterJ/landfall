// Landfall — read aloud.
//
// This is an accessibility feature, not a flourish. It also has one hard
// gotcha: mobile browsers refuse speechSynthesis until it has been called once
// inside a real user gesture. Without unlock() on the first pointerdown, speech
// silently does nothing and looks broken.

let voice = null;
let unlocked = false;

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

export function say(text, { rate = 0.97 } = {}) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    if (!voice) voice = choose();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = rate;
    speechSynthesis.speak(u);
  } catch { /* nothing to do */ }
}

export function stop() {
  try { speechSynthesis.cancel(); } catch { /* nothing to do */ }
}
