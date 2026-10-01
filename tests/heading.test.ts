import {
  newHeadingState,
  nextHeading,
  GPS_HEADING_MIN_SPEED_MPS,
  HEADING_MIN_MOVE_M,
} from '../src/core/heading'
import type { LatLon } from '../src/core/geo'

// ~1 m of latitude, so offsets read in metres.
const M = 1 / 111_195
const north = (from: LatLon, m: number): LatLon => ({ lat: from.lat + m * M, lon: from.lon })
const START: LatLon = { lat: 40, lon: -3 }

describe('nextHeading', () => {
  it('has no heading before any movement', () => {
    const s = nextHeading(newHeadingState(), START)
    expect(s.headingDeg).toBeUndefined()
  })

  it('uses the GPS heading when moving faster than the threshold', () => {
    const s = nextHeading(newHeadingState(), START, {
      heading: 90,
      speed: GPS_HEADING_MIN_SPEED_MPS + 1,
    })
    expect(s.headingDeg).toBe(90)
  })

  it('ignores the GPS heading when slow', () => {
    const s = nextHeading(newHeadingState(), START, {
      heading: 90,
      speed: GPS_HEADING_MIN_SPEED_MPS / 2,
    })
    expect(s.headingDeg).toBeUndefined()
  })

  it('ignores a GPS heading without a speed, and a non-finite one', () => {
    expect(nextHeading(newHeadingState(), START, { heading: 90 }).headingDeg).toBeUndefined()
    expect(
      nextHeading(newHeadingState(), START, { heading: NaN, speed: 20 }).headingDeg,
    ).toBeUndefined()
  })

  it('computes a bearing once the position has moved the minimum distance', () => {
    let s = nextHeading(newHeadingState(), START)
    s = nextHeading(s, north(START, HEADING_MIN_MOVE_M + 1))
    expect(s.headingDeg).toBeCloseTo(0, 0)
  })

  it('measures movement from the anchor, not from the previous fix', () => {
    let s = nextHeading(newHeadingState(), START)
    // Three 10 m steps: each under the threshold, together over it.
    s = nextHeading(s, north(START, 10))
    s = nextHeading(s, north(START, 20))
    expect(s.headingDeg).toBeUndefined()
    s = nextHeading(s, north(START, 30))
    expect(s.headingDeg).toBeCloseTo(0, 0)
  })

  it('keeps the heading through jitter while stopped', () => {
    let s = nextHeading(newHeadingState(), START)
    const stop = north(START, 200)
    s = nextHeading(s, stop)
    expect(s.headingDeg).toBeCloseTo(0, 0)
    // A few metres either way, including straight back, at a traffic light.
    for (const [dLat, dLon] of [
      [-8, 3],
      [5, -6],
      [-12, 0],
      [2, 9],
    ]) {
      s = nextHeading(s, { lat: stop.lat + dLat * M, lon: stop.lon + dLon * M }, { speed: 0 })
      expect(s.headingDeg).toBeCloseTo(0, 0)
    }
  })

  it('keeps the last GPS heading once the car slows down', () => {
    let s = nextHeading(newHeadingState(), START, { heading: 90, speed: 20 })
    s = nextHeading(s, { lat: START.lat + 5 * M, lon: START.lon }, { heading: 300, speed: 0.3 })
    expect(s.headingDeg).toBe(90)
  })

  it('requires more movement when the fix is less accurate than the threshold', () => {
    let s = nextHeading(newHeadingState(), START)
    s = nextHeading(s, north(START, HEADING_MIN_MOVE_M + 5), { accuracy: 60 })
    expect(s.headingDeg).toBeUndefined()
    s = nextHeading(s, north(START, 70), { accuracy: 60 })
    expect(s.headingDeg).toBeCloseTo(0, 0)
  })
})
