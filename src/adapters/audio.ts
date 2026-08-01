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

interface Tone { freq: number; start: number; duration: number; peak: number }

// Envelope shape, in seconds. Short attack and release keep the edges
// click-free; everything between them is held at full level, because a cue
// that decays from its first millisecond is heard as a faint tick rather than
// a beep.
const ATTACK = 0.012
const RELEASE = 0.05
const SILENT = 0.0001

// Level of the octave partial relative to the fundamental. Phone and car
// speakers reproduce almost nothing below ~1 kHz efficiently, so a pure sine
// at 880 Hz arrives thin and is easily masked by road noise; a partial an
// octave up lands in the band those speakers are loudest in without changing
// the perceived pitch of the cue.
const PARTIAL_GAIN = 0.35

function scheduleTone(ctx: AudioContextLike, freq: number, at: number, duration: number, peak: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  // Triangle rather than sine: a little harmonic content carries far better on
  // small speakers, while staying clean enough not to sound like distortion.
  osc.type = 'triangle'
  osc.frequency.value = freq
  const hold = Math.max(at + ATTACK, at + duration - RELEASE)
  gain.gain.value = SILENT
  gain.gain.setValueAtTime(SILENT, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + ATTACK)
  gain.gain.setValueAtTime(peak, hold)
  gain.gain.exponentialRampToValueAtTime(SILENT, at + duration)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + duration)
}

// Plays a sequence of tones on the shared AudioContext. Shared low-level
// helper so radar and fuel cues stay a single source of truth. Silent no-op
// when audio is unavailable; ctx factory is injectable for testing.
function playTones(tones: readonly Tone[], makeCtx: () => AudioContextLike): void {
  try {
    const ctx = ensureCtx(makeCtx)
    resumeIfSuspended(ctx)
    const t0 = ctx.currentTime
    for (const tone of tones) {
      const at = t0 + tone.start
      scheduleTone(ctx, tone.freq, at, tone.duration, tone.peak)
      scheduleTone(ctx, tone.freq * 2, at, tone.duration, tone.peak * PARTIAL_GAIN)
    }
  } catch {
    /* audio unavailable — silent no-op */
  }
}

// Sharp, attention-grabbing double beep at 880 Hz. Two pulses rather than one:
// a single short cue is lost to a passing truck or a gear change, and the
// repeat costs a quarter of a second.
export function playRadarBeep(makeCtx: () => AudioContextLike = defaultCtx): void {
  playTones([
    { freq: 880, start: 0, duration: 0.2, peak: 0.9 },
    { freq: 880, start: 0.26, duration: 0.2, peak: 0.9 },
  ], makeCtx)
}

// Pleasant ascending two-note chime (523 Hz -> 784 Hz), clearly distinct in
// pitch, character and duration from the radar beep so the two are trivially
// distinguishable by ear. The notes do not overlap, so their peaks never sum
// into clipping.
export function playFuelChime(makeCtx: () => AudioContextLike = defaultCtx): void {
  playTones([
    { freq: 523, start: 0, duration: 0.18, peak: 0.85 },
    { freq: 784, start: 0.19, duration: 0.3, peak: 0.85 },
  ], makeCtx)
}
