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

// While a trip is running the cues are routed through a MediaStream feeding a
// looping <audio> element instead of straight to the speakers. Two reasons,
// both about the phone being in a pocket or projecting to Android Auto:
// Chrome suspends the AudioContext of a backgrounded page that is not playing
// media, and an element-backed stream is what Android treats as a media
// session it can route to the car. Null until a trip starts.
let streamDest: MediaStreamAudioDestinationNode | null = null
let keepAlive: HTMLAudioElement | null = null

type AudioElementFactory = () => HTMLAudioElement

export interface BackgroundAudioOptions {
  title?: string
  artist?: string
  makeCtx?: () => AudioContextLike
  makeAudio?: AudioElementFactory
}

function setMediaSession(title: string, artist: string): void {
  const session = typeof navigator === 'undefined' ? undefined : navigator.mediaSession
  if (!session || typeof MediaMetadata === 'undefined') return
  session.metadata = new MediaMetadata({ title, artist })
  session.playbackState = 'playing'
}

// Must be called from a user gesture (trip start), like unlockAudio. If the
// element refuses to play we tear the routing back down rather than leave the
// cues pointing at a stream nobody is listening to — silent alerts on a
// motorway are worse than alerts that only work in the foreground.
export function startBackgroundAudio(opts: BackgroundAudioOptions = {}): void {
  const title = opts.title ?? 'Erregai'
  const artist = opts.artist ?? 'Erregai'
  try {
    const ctx = ensureCtx(opts.makeCtx ?? defaultCtx)
    resumeIfSuspended(ctx)
    if (typeof ctx.createMediaStreamDestination !== 'function') return
    const makeAudio = opts.makeAudio ?? (typeof Audio === 'function' ? () => new Audio() : undefined)
    if (!makeAudio) return

    streamDest = ctx.createMediaStreamDestination()
    keepAlive = makeAudio()
    keepAlive.loop = true
    keepAlive.srcObject = streamDest.stream
    void Promise.resolve(keepAlive.play())
      .then(() => setMediaSession(title, artist))
      .catch(() => { stopBackgroundAudio() })
  } catch {
    stopBackgroundAudio()
  }
}

export function stopBackgroundAudio(): void {
  try {
    keepAlive?.pause()
    if (keepAlive) keepAlive.srcObject = null
    streamDest?.disconnect()
    const session = typeof navigator === 'undefined' ? undefined : navigator.mediaSession
    if (session) { session.metadata = null; session.playbackState = 'none' }
  } catch {
    /* nothing to unwind */
  }
  streamDest = null
  keepAlive = null
}

// Test-only: drops the shared context so injected fake contexts don't leak
// state across tests.
export function __resetAudio(): void {
  shared = null
  streamDest = null
  keepAlive = null
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
  osc.connect(gain); gain.connect(streamDest ?? ctx.destination)
  osc.start(at)
  osc.stop(at + duration)
}

export interface CueOptions {
  // 0..1 multiplier over the cue's own peak level. Out-of-range and
  // non-numeric values fall back to full volume rather than distorting.
  volume?: number
  // Injectable for testing; production callers omit it.
  makeCtx?: () => AudioContextLike
}

function levelFrom(volume: number | undefined): number {
  if (volume === undefined || !Number.isFinite(volume)) return 1
  return Math.min(1, Math.max(0, volume))
}

// Plays a sequence of tones on the shared AudioContext. Shared low-level
// helper so radar and fuel cues stay a single source of truth. Silent no-op
// when audio is unavailable; ctx factory is injectable for testing.
function playTones(tones: readonly Tone[], opts: CueOptions): void {
  const level = levelFrom(opts.volume)
  // Nothing to schedule at zero, and exponential ramps reject a 0 target.
  if (level === 0) return
  try {
    const ctx = ensureCtx(opts.makeCtx ?? defaultCtx)
    resumeIfSuspended(ctx)
    const t0 = ctx.currentTime
    for (const tone of tones) {
      const at = t0 + tone.start
      const peak = tone.peak * level
      scheduleTone(ctx, tone.freq, at, tone.duration, peak)
      scheduleTone(ctx, tone.freq * 2, at, tone.duration, peak * PARTIAL_GAIN)
    }
  } catch {
    /* audio unavailable — silent no-op */
  }
}

// Sharp, attention-grabbing double beep at 880 Hz. Two pulses rather than one:
// a single short cue is lost to a passing truck or a gear change, and the
// repeat costs a quarter of a second.
export function playRadarBeep(opts: CueOptions = {}): void {
  playTones([
    { freq: 880, start: 0, duration: 0.2, peak: 0.9 },
    { freq: 880, start: 0.26, duration: 0.2, peak: 0.9 },
  ], opts)
}

// Pleasant ascending two-note chime (523 Hz -> 784 Hz), clearly distinct in
// pitch, character and duration from the radar beep so the two are trivially
// distinguishable by ear. The notes do not overlap, so their peaks never sum
// into clipping.
export function playFuelChime(opts: CueOptions = {}): void {
  playTones([
    { freq: 523, start: 0, duration: 0.18, peak: 0.85 },
    { freq: 784, start: 0.19, duration: 0.3, peak: 0.85 },
  ], opts)
}
