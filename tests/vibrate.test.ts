import { expect, it } from 'vitest'
import { vibrateRadar, vibrateFuel } from '../src/adapters/vibrate'

// Real recording fake of the Vibration API: no mocking framework needed, the
// adapter takes the vibrator as an injectable argument.
function recorder() {
  const patterns: (number | readonly number[])[] = []
  return {
    patterns,
    vibrate: (p: number | readonly number[]) => {
      patterns.push(p)
      return true
    },
  }
}

it('buzzes a double pulse for radar alerts, mirroring the double beep', () => {
  const rec = recorder()
  vibrateRadar(rec.vibrate)
  expect(rec.patterns).toEqual([[200, 100, 200]])
})

it('buzzes a single shorter pulse for fuel alerts', () => {
  const rec = recorder()
  vibrateFuel(rec.vibrate)
  expect(rec.patterns).toEqual([[150]])
})

it('is a no-op when the platform has no Vibration API', () => {
  expect(() => vibrateRadar(undefined)).not.toThrow()
  expect(() => vibrateFuel(undefined)).not.toThrow()
})

it('does not throw when the platform refuses the request', () => {
  const throwing = () => {
    throw new Error('blocked')
  }
  expect(() => vibrateRadar(throwing)).not.toThrow()
  expect(() => vibrateFuel(throwing)).not.toThrow()
})
