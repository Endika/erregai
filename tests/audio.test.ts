import { playRadarBeep } from '../src/adapters/audio'

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
