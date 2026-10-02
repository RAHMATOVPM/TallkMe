// Sound + vibration feedback. Reads user prefs from localStorage so it works
// even from non-React call sites (realtime channel handlers).

export type FeedbackKind = "match" | "message" | "leave" | "tap";

function prefOn(key: string, fallback = true): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v) === true;
  } catch {
    return fallback;
  }
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, duration: number, when = 0, type: OscillatorType = "sine", gain = 0.12) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playSound(kind: FeedbackKind) {
  if (!prefOn("talkme_sound", true)) return;
  switch (kind) {
    case "match":
      beep(660, 0.12, 0, "sine");
      beep(880, 0.18, 0.12, "sine");
      break;
    case "message":
      beep(720, 0.1, 0, "triangle", 0.1);
      break;
    case "leave":
      beep(420, 0.18, 0, "sine", 0.1);
      break;
    case "tap":
      beep(1100, 0.03, 0, "sine", 0.05);
      break;
  }
}

export function vibrate(pattern: number | number[]) {
  if (!prefOn("talkme_vibration", true)) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function feedback(kind: FeedbackKind) {
  playSound(kind);
  switch (kind) {
    case "match":
      vibrate([40, 60, 80]);
      break;
    case "message":
      vibrate(25);
      break;
    case "leave":
      vibrate([60, 40, 60]);
      break;
    case "tap":
      vibrate(8);
      break;
  }
}
