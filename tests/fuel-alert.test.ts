import { cheapAhead } from '../src/core/fuel-alert'
import type { Station } from '../src/core/station'

const st = (id: string, lat: number, price: number): Station => ({
  id, brand: 'X', name: 'X', pos: { lat, lon: 0 }, address: '', town: '', schedule: '',
  prices: { gasoleoA: price },
})

const pos = { lat: 40, lon: 0 }
const headingNorth = 0
const base = { fuel: 'gasoleoA' as const, radiusKm: 50, corridorDeg: 45, alertDistanceKm: 20 }

describe('cheapAhead', () => {
  // All four non-far stations are within radiusKm, so the nearby average is
  // (1.0 + 1.2 + 2.0 + 1.0) / 4 = 1.3; 'expensive' (2.0) sits above it.
  const cheap = st('cheap', 40.05, 1.0)       // ~5.6 km ahead, below average
  const mid = st('mid', 40.1, 1.2)            // ~11 km ahead, below average
  const expensive = st('expensive', 40.03, 2.0) // ~3.3 km ahead, above average
  const behind = st('behind', 39.95, 1.0)     // south, cheap but behind
  const farAway = st('far', 40.5, 1.0)        // ~56 km ahead, beyond alertDistance
  const all = [cheap, mid, expensive, behind, farAway]

  it("cheap mode: keeps within-distance ahead stations at or below nearby average, sorted by distance", () => {
    const hits = cheapAhead(pos, headingNorth, all, { ...base, mode: 'cheap' })
    expect(hits.map(h => h.station.id)).toEqual(['cheap', 'mid'])
  })

  it('cheap mode: excludes an above-average (expensive) station', () => {
    const hits = cheapAhead(pos, headingNorth, all, { ...base, mode: 'cheap' })
    expect(hits.map(h => h.station.id)).not.toContain('expensive')
  })

  it('cheap mode: excludes a station behind the heading', () => {
    const hits = cheapAhead(pos, headingNorth, all, { ...base, mode: 'cheap' })
    expect(hits.map(h => h.station.id)).not.toContain('behind')
  })

  it('cheap mode: excludes a station beyond the alert distance', () => {
    const hits = cheapAhead(pos, headingNorth, all, { ...base, mode: 'cheap' })
    expect(hits.map(h => h.station.id)).not.toContain('far')
  })

  it('any mode: includes the above-average station too, still sorted by distance', () => {
    const hits = cheapAhead(pos, headingNorth, all, { ...base, mode: 'any' })
    expect(hits.map(h => h.station.id)).toEqual(['expensive', 'cheap', 'mid'])
  })
})
