import { radarsAhead, nearbyRadars, nextRadarAlerts, type Radar } from '../src/core/radars'

const r = (id: string, lat: number, lon: number): Radar =>
  ({ id, lat, lon, via: 'A-1', source: 'dgt' })

describe('radarsAhead', () => {
  const pos = { lat: 40.0, lon: -3.0 }

  it('keeps only radars within radius, sorted by distance', () => {
    const near = r('n', 40.02, -3.0)   // ~2.2 km north
    const far = r('f', 41.0, -3.0)     // ~111 km north
    const hits = radarsAhead(pos, undefined, [far, near], { radiusKm: 10, corridorDeg: 45 })
    expect(hits.map(h => h.radar.id)).toEqual(['n'])
    expect(hits[0].distanceKm).toBeGreaterThan(0)
  })

  it('with a heading, drops radars behind and keeps those ahead in the cone', () => {
    const ahead = r('ahead', 40.05, -3.0)   // due north
    const behind = r('behind', 39.95, -3.0) // due south
    const headingNorth = 0
    const hits = radarsAhead(pos, headingNorth, [ahead, behind], { radiusKm: 20, corridorDeg: 45 })
    expect(hits.map(h => h.radar.id)).toEqual(['ahead'])
  })

  it('with undefined heading, keeps all radars in radius (no cone filter)', () => {
    const hits = radarsAhead(pos, undefined, [r('a', 40.05, -3.0), r('b', 39.95, -3.0)],
      { radiusKm: 20, corridorDeg: 45 })
    expect(hits).toHaveLength(2)
  })
})

describe('nearbyRadars', () => {
  const pos = { lat: 40.0, lon: -3.0 }

  it('keeps only radars within radius, nearest first, ignoring heading', () => {
    const near = r('n', 40.02, -3.0)   // ~2.2 km north
    const mid = r('m', 40.05, -3.0)    // ~5.6 km north
    const far = r('f', 41.0, -3.0)     // ~111 km north
    const behind = r('b', 39.97, -3.0) // ~3.3 km south (still kept: no cone)
    const hits = nearbyRadars(pos, [far, mid, near, behind], 10, 10)
    expect(hits.map(h => h.radar.id)).toEqual(['n', 'b', 'm'])
  })

  it('caps the result to the given limit', () => {
    const radars = Array.from({ length: 5 }, (_, i) => r(`r${i}`, 40.0 + (i + 1) * 0.01, -3.0))
    const hits = nearbyRadars(pos, radars, 50, 2)
    expect(hits).toHaveLength(2)
    expect(hits.map(h => h.radar.id)).toEqual(['r0', 'r1'])
  })
})

describe('nextRadarAlerts', () => {
  const hit = (id: string, km: number): { radar: Radar; distanceKm: number } =>
    ({ radar: r(id, 0, 0), distanceKm: km })

  it('alerts once when a radar enters the alert distance', () => {
    const res = nextRadarAlerts(new Set(), [hit('x', 0.5)], 0.8)
    expect(res.newlyAlerted.map(h => h.radar.id)).toEqual(['x'])
    expect(res.alertedIds.has('x')).toBe(true)
  })

  it('does not re-alert while still within range', () => {
    const res = nextRadarAlerts(new Set(['x']), [hit('x', 0.4)], 0.8)
    expect(res.newlyAlerted).toHaveLength(0)
    expect(res.alertedIds.has('x')).toBe(true)
  })

  it('forgets the id after leaving range + hysteresis, enabling re-alert', () => {
    const res = nextRadarAlerts(new Set(['x']), [hit('x', 1.1)], 0.8, 0.2)
    expect(res.alertedIds.has('x')).toBe(false)
  })

  it('does not alert for radars beyond the alert distance', () => {
    const res = nextRadarAlerts(new Set(), [hit('x', 2.0)], 0.8)
    expect(res.newlyAlerted).toHaveLength(0)
  })
})
