import { haversineKm, bearingDeg, angularDelta, isAhead } from '../src/core/geo'

describe('geo', () => {
  it('haversine ~ known distance Madrid->Barcelona ≈ 505km', () => {
    const d = haversineKm({ lat: 40.4168, lon: -3.7038 }, { lat: 41.3874, lon: 2.1686 })
    expect(d).toBeGreaterThan(495); expect(d).toBeLessThan(515)
  })
  it('bearing due north is ~0 and due east ~90', () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 0)
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 0)
  })
  it('angularDelta wraps around 360', () => {
    expect(angularDelta(350, 10)).toBeCloseTo(20, 5)
    expect(angularDelta(10, 350)).toBeCloseTo(20, 5)
  })
  it('isAhead true within corridor, false behind', () => {
    const pos = { lat: 40, lon: -3 }
    expect(isAhead(pos, 0, { lat: 41, lon: -3 }, 45)).toBe(true)   // north, heading north
    expect(isAhead(pos, 0, { lat: 39, lon: -3 }, 45)).toBe(false)  // south, heading north
  })
})
