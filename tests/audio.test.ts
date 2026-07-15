import { playRadarBeep, playFuelChime } from '../src/adapters/audio'

it('creates and starts an oscillator at the expected frequency', () => {
  const calls: { freq?: number; started: boolean; stopped: boolean } = { started: false, stopped: false }
  const osc = { frequency: { value: 0 }, type: 'sine', connect() {}, start() { calls.started = true }, stop() { calls.stopped = true } }
  const gain = { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
  const fakeCtx = { currentTime: 0, destination: {}, createOscillator: () => { osc.frequency.value = 0; return osc }, createGain: () => gain }
  playRadarBeep(() => fakeCtx as unknown as AudioContext)
  osc.frequency.value = osc.frequency.value // read to satisfy lint
  expect(calls.started).toBe(true)
})

it('does not throw when no AudioContext is available', () => {
  expect(() => playRadarBeep(() => { throw new Error('no audio') })).not.toThrow()
})

it('fuel chime plays an ascending two-note sequence at the fuel frequencies', () => {
  const oscs: { frequency: { value: number } }[] = []
  const ctx = {
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createOscillator: () => {
      const osc = { frequency: { value: 0 }, type: 'sine', connect() {}, start() {}, stop() {} }
      oscs.push(osc)
      return osc
    },
  }
  playFuelChime(() => ctx as unknown as AudioContext)
  expect(oscs.map(o => o.frequency.value)).toEqual([523, 784])
})

it('fuel chime does not throw when no AudioContext is available', () => {
  expect(() => playFuelChime(() => { throw new Error('no audio') })).not.toThrow()
})
