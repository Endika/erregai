import { beforeEach, describe, expect, it } from 'vitest'
import { playRadarBeep, playFuelChime, unlockAudio, startBackgroundAudio, stopBackgroundAudio, __resetAudio } from '../src/adapters/audio'

beforeEach(() => { __resetAudio() })

// Records every gain automation call so tests can assert levels and envelope
// shape, which is what makes a cue audible or inaudible.
function recordingCtx(state: AudioContextState = 'running') {
  const oscs: { frequency: { value: number }; started: boolean }[] = []
  const ramps: { value: number; at: number }[] = []
  const holds: { value: number; at: number }[] = []
  const resumeCalls = { count: 0 }
  const connectedTo: unknown[] = []
  const streamDest = { stream: { id: 'fake-stream' }, disconnect() {} }
  let created = 0
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    resume() { resumeCalls.count++; return Promise.resolve() },
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime(value: number, at: number) { holds.push({ value, at }) },
        exponentialRampToValueAtTime(value: number, at: number) { ramps.push({ value, at }) },
      },
      connect(target: unknown) { connectedTo.push(target) },
    }),
    createMediaStreamDestination: () => streamDest,
    createOscillator: () => {
      const osc = { frequency: { value: 0 }, type: 'sine', started: false, connect() {}, start() { osc.started = true }, stop() {} }
      oscs.push(osc)
      return osc
    },
  }
  const make = () => { created++; return ctx as unknown as AudioContext }
  return { ctx, make, oscs, ramps, holds, resumeCalls, connectedTo, streamDest, createdCount: () => created }
}

const peakOf = (ramps: { value: number }[]): number => Math.max(...ramps.map(r => r.value))

it('creates and starts an oscillator at the expected frequency', () => {
  const rec = recordingCtx()
  playRadarBeep({ makeCtx: rec.make })
  expect(rec.oscs[0].frequency.value).toBe(880)
  expect(rec.oscs.every(o => o.started)).toBe(true)
})

it('does not throw when no AudioContext is available', () => {
  expect(() => playRadarBeep({ makeCtx: () => { throw new Error('no audio') } })).not.toThrow()
})

it('fuel chime plays an ascending two-note sequence at the fuel frequencies', () => {
  const rec = recordingCtx()
  playFuelChime({ makeCtx: rec.make })
  // Each note is a fundamental plus an octave partial for small-speaker reach.
  expect(rec.oscs.map(o => o.frequency.value)).toEqual([523, 1046, 784, 1568])
})

it('fuel chime does not throw when no AudioContext is available', () => {
  expect(() => playFuelChime({ makeCtx: () => { throw new Error('no audio') } })).not.toThrow()
})

it('holds each tone at full level instead of decaying from the first instant', () => {
  const rec = recordingCtx()
  playRadarBeep({ makeCtx: rec.make })
  const peak = peakOf(rec.ramps)
  expect(peak).toBeGreaterThan(0.5)
  // The peak is re-asserted near the end of the tone, so the decay only runs
  // over the release rather than over the whole duration.
  const hold = rec.holds.find(h => h.value === peak)!
  expect(hold.at).toBeGreaterThan(0.1)
})

describe('volume', () => {
  it('scales the peak level by the requested volume', () => {
    const loud = recordingCtx()
    playRadarBeep({ volume: 1, makeCtx: loud.make })
    __resetAudio()
    const quiet = recordingCtx()
    playRadarBeep({ volume: 0.5, makeCtx: quiet.make })
    expect(peakOf(quiet.ramps)).toBeCloseTo(peakOf(loud.ramps) * 0.5, 5)
  })

  it('plays at full level when no volume is given', () => {
    const explicit = recordingCtx()
    playFuelChime({ volume: 1, makeCtx: explicit.make })
    __resetAudio()
    const implicit = recordingCtx()
    playFuelChime({ makeCtx: implicit.make })
    expect(peakOf(implicit.ramps)).toBe(peakOf(explicit.ramps))
  })

  it('never exceeds full level, so an out-of-range setting cannot clip', () => {
    const full = recordingCtx()
    playRadarBeep({ volume: 1, makeCtx: full.make })
    __resetAudio()
    const over = recordingCtx()
    playRadarBeep({ volume: 4, makeCtx: over.make })
    expect(peakOf(over.ramps)).toBe(peakOf(full.ramps))
  })

  it('falls back to full level on a non-numeric volume', () => {
    const full = recordingCtx()
    playRadarBeep({ volume: 1, makeCtx: full.make })
    __resetAudio()
    const nan = recordingCtx()
    playRadarBeep({ volume: Number.NaN, makeCtx: nan.make })
    expect(peakOf(nan.ramps)).toBe(peakOf(full.ramps))
  })

  it('schedules nothing at zero volume rather than ramping to an illegal 0 target', () => {
    const rec = recordingCtx()
    playRadarBeep({ volume: 0, makeCtx: rec.make })
    expect(rec.oscs).toEqual([])
    expect(rec.ramps).toEqual([])
  })
})

describe('shared context', () => {
  it('resumes a suspended context on unlock', () => {
    const rec = recordingCtx('suspended')
    unlockAudio(rec.make)
    expect(rec.resumeCalls.count).toBe(1)
  })

  it('resumes a suspended context defensively before playing a beep', () => {
    const rec = recordingCtx('suspended')
    playRadarBeep({ makeCtx: rec.make })
    expect(rec.resumeCalls.count).toBe(1)
  })

  it('does not resume a running context', () => {
    const rec = recordingCtx('running')
    playRadarBeep({ makeCtx: rec.make })
    expect(rec.resumeCalls.count).toBe(0)
  })

  it('reuses a single context across beeps instead of creating one per call', () => {
    const rec = recordingCtx('running')
    playRadarBeep({ makeCtx: rec.make })
    playFuelChime({ makeCtx: rec.make })
    playRadarBeep({ makeCtx: rec.make })
    expect(rec.createdCount()).toBe(1)
  })
})

// Trip mode routes the cues through a media element so a backgrounded page
// keeps its AudioContext alive and Android has a session it can hand to the
// car. These cover the wiring; the real Android Auto behaviour can only be
// confirmed on a phone in a car.
function fakeAudioElement(playResult: Promise<void> = Promise.resolve()) {
  const el = {
    loop: false,
    srcObject: null as unknown,
    paused: true,
    play() { this.paused = false; return playResult },
    pause() { this.paused = true },
  }
  return el as unknown as HTMLAudioElement & { paused: boolean; srcObject: unknown }
}

it('routes cues through the media stream once background audio starts', () => {
  const rec = recordingCtx()
  const el = fakeAudioElement()
  startBackgroundAudio({ makeCtx: rec.make, makeAudio: () => el })
  expect(el.srcObject).toBe(rec.streamDest.stream)
  expect(el.loop).toBe(true)
  expect(el.paused).toBe(false)

  playRadarBeep({ makeCtx: rec.make })
  expect(rec.connectedTo).toContain(rec.streamDest)
  expect(rec.connectedTo).not.toContain(rec.ctx.destination)
})

it('goes back to the speakers when background audio stops', () => {
  const rec = recordingCtx()
  const el = fakeAudioElement()
  startBackgroundAudio({ makeCtx: rec.make, makeAudio: () => el })
  stopBackgroundAudio()
  expect(el.paused).toBe(true)
  expect(el.srcObject).toBeNull()

  playRadarBeep({ makeCtx: rec.make })
  expect(rec.connectedTo).toContain(rec.ctx.destination)
  expect(rec.connectedTo).not.toContain(rec.streamDest)
})

it('falls back to the speakers when the element refuses to play', async () => {
  const rec = recordingCtx()
  const el = fakeAudioElement(Promise.reject(new Error('autoplay blocked')))
  startBackgroundAudio({ makeCtx: rec.make, makeAudio: () => el })
  await Promise.resolve()
  await Promise.resolve()

  // A blocked element must never leave the cues pointing at a stream nobody
  // is playing: silent radar alerts would be worse than foreground-only ones.
  playRadarBeep({ makeCtx: rec.make })
  expect(rec.connectedTo).toContain(rec.ctx.destination)
})

it('keeps cues on the speakers when the context has no stream destination', () => {
  const rec = recordingCtx()
  const ctx = rec.ctx as unknown as Record<string, unknown>
  delete ctx.createMediaStreamDestination
  expect(() => startBackgroundAudio({ makeCtx: rec.make, makeAudio: fakeAudioElement })).not.toThrow()

  playRadarBeep({ makeCtx: rec.make })
  expect(rec.connectedTo).toContain(rec.ctx.destination)
})

it('stopping background audio that never started is a no-op', () => {
  expect(() => stopBackgroundAudio()).not.toThrow()
})
