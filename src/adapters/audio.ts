type AudioContextLike = AudioContext

function defaultCtx(): AudioContextLike {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctor()
}

// Single AudioContext shared across every cue. Created lazily and reused so
// unlocking it once from a user gesture keeps later beeps audible on mobile.
let shared: AudioContextLike | null = null

function ensureCtx(makeCtx: () => AudioContextLike): AudioContextLike {
  if (!shared) shared = makeCtx()
  return shared
}

function resumeIfSuspended(ctx: AudioContextLike): void {
  if (ctx.state === 'suspended') void ctx.resume()
}

// Creates (if needed) and resumes the shared context. Must be called
// synchronously from a user gesture: mobile browsers only leave the
// 'suspended' state when resume() originates from a gesture, and cues fire
// later from the geolocation callback, which is not a gesture.
export function unlockAudio(makeCtx: () => AudioContextLike = defaultCtx): void {
  try {
    resumeIfSuspended(ensureCtx(makeCtx))
  } catch {
    /* audio unavailable — silent no-op */
  }
}

// Test-only: drops the shared context so injected fake contexts don't leak
// state across tests.
export function __resetAudio(): void {
  shared = null
}

interface Tone { freq: number; start: number; duration: number }

// Plays a sequence of sine tones on the shared AudioContext. Shared low-level
// helper so radar and fuel cues stay a single source of truth. Silent no-op
// when audio is unavailable; ctx factory is injectable for testing.
function playTones(tones: readonly Tone[], makeCtx: () => AudioContextLike): void {
  try {
    const ctx = ensureCtx(makeCtx)
    resumeIfSuspended(ctx)
    const t0 = ctx.currentTime
    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = tone.freq
      const at = t0 + tone.start
      gain.gain.value = 0.0001
      gain.gain.setValueAtTime(0.3, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(at)
      osc.stop(at + tone.duration)
    }
  } catch {
    /* audio unavailable — silent no-op */
  }
}

// Sharp, attention-grabbing single beep at 880 Hz.
export function playRadarBeep(makeCtx: () => AudioContextLike = defaultCtx): void {
  playTones([{ freq: 880, start: 0, duration: 0.25 }], makeCtx)
}

// Pleasant ascending two-note chime (523 Hz -> 784 Hz), clearly distinct in
// pitch, character and duration from the radar beep so the two are trivially
// distinguishable by ear.
export function playFuelChime(makeCtx: () => AudioContextLike = defaultCtx): void {
  playTones([
    { freq: 523, start: 0, duration: 0.18 },
    { freq: 784, start: 0.16, duration: 0.28 },
  ], makeCtx)
}
