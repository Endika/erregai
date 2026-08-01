import { beforeEach, describe, expect, it } from 'vitest'
import { playRadarBeep, playFuelChime, unlockAudio, __resetAudio } from '../src/adapters/audio'

beforeEach(() => { __resetAudio() })

// Records every gain automation call so tests can assert levels and envelope
// shape, which is what makes a cue audible or inaudible.
function recordingCtx(state: AudioContextState = 'running') {
  const oscs: { frequency: { value: number }; started: boolean }[] = []
  const ramps: { value: number; at: number }[] = []
  const holds: { value: number; at: number }[] = []
  const resumeCalls = { count: 0 }
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
      connect() {},
    }),
    createOscillator: () => {
      const osc = { frequency: { value: 0 }, type: 'sine', started: false, connect() {}, start() { osc.started = true }, stop() {} }
      oscs.push(osc)
      return osc
    },
  }
  const make = () => { created++; return ctx as unknown as AudioContext }
  return { ctx, make, oscs, ramps, holds, resumeCalls, createdCount: () => created }
}

const peakOf = (ramps: { value: number }[]): number => Math.max(...ramps.map(r => r.value))

it('creates and starts an oscillator at the expected frequency', () => {
  const rec = recordingCtx()
  playRadarBeep(rec.make)
  expect(rec.oscs[0].frequency.value).toBe(880)
  expect(rec.oscs.every(o => o.started)).toBe(true)
})

it('does not throw when no AudioContext is available', () => {
  expect(() => playRadarBeep(() => { throw new Error('no audio') })).not.toThrow()
})

it('fuel chime plays an ascending two-note sequence at the fuel frequencies', () => {
  const rec = recordingCtx()
  playFuelChime(rec.make)
  // Each note is a fundamental plus an octave partial for small-speaker reach.
  expect(rec.oscs.map(o => o.frequency.value)).toEqual([523, 1046, 784, 1568])
})

it('fuel chime does not throw when no AudioContext is available', () => {
  expect(() => playFuelChime(() => { throw new Error('no audio') })).not.toThrow()
})

it('holds each tone at full level instead of decaying from the first instant', () => {
  const rec = recordingCtx()
  playRadarBeep(rec.make)
  const peak = peakOf(rec.ramps)
  expect(peak).toBeGreaterThan(0.5)
  // The peak is re-asserted near the end of the tone, so the decay only runs
  // over the release rather than over the whole duration.
  const hold = rec.holds.find(h => h.value === peak)!
  expect(hold.at).toBeGreaterThan(0.1)
})

describe('shared context', () => {
  it('resumes a suspended context on unlock', () => {
    const rec = recordingCtx('suspended')
    unlockAudio(rec.make)
    expect(rec.resumeCalls.count).toBe(1)
  })

  it('resumes a suspended context defensively before playing a beep', () => {
    const rec = recordingCtx('suspended')
    playRadarBeep(rec.make)
    expect(rec.resumeCalls.count).toBe(1)
  })

  it('does not resume a running context', () => {
    const rec = recordingCtx('running')
    playRadarBeep(rec.make)
    expect(rec.resumeCalls.count).toBe(0)
  })

  it('reuses a single context across beeps instead of creating one per call', () => {
    const rec = recordingCtx('running')
    playRadarBeep(rec.make)
    playFuelChime(rec.make)
    playRadarBeep(rec.make)
    expect(rec.createdCount()).toBe(1)
  })
})
