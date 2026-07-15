type AudioContextLike = AudioContext

function defaultCtx(): AudioContextLike {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctor()
}

interface Tone { freq: number; start: number; duration: number }

// Plays a sequence of sine tones on a fresh AudioContext. Shared low-level
// helper so radar and fuel cues stay a single source of truth. Silent no-op
// when audio is unavailable; ctx factory is injectable for testing.
function playTones(tones: readonly Tone[], makeCtx: () => AudioContextLike): void {
  try {
    const ctx = makeCtx()
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
