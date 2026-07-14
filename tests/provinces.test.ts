import { provinceFor, adjacentProvinces } from '../src/core/provinces'
import { PROVINCE_BBOX } from '../src/core/provinces.data'

describe('provinces', () => {
  it('maps a Madrid coord to Madrid province', () => {
    const p = provinceFor({ lat: 40.4168, lon: -3.7038 })
    expect(p.name.toUpperCase()).toContain('MADRID')
  })
  it('maps a Barcelona coord to Barcelona province', () => {
    const p = provinceFor({ lat: 41.3874, lon: 2.1686 })
    expect(p.name.toUpperCase()).toContain('BARCELONA')
  })
  it('a point far outside Spain falls back to the nearest centroid (no throw)', () => {
    expect(() => provinceFor({ lat: 0, lon: 0 })).not.toThrow()
  })
  it('adjacentProvinces returns n distinct neighbours', () => {
    const madrid = provinceFor({ lat: 40.4168, lon: -3.7038 })
    const adj = adjacentProvinces(madrid.id, 3)
    expect(adj.length).toBe(3)
    expect(adj.every(p => p.id !== madrid.id)).toBe(true)
  })
  it('every province bbox has a centroid within Spain and a consistent envelope', () => {
    for (const b of PROVINCE_BBOX) {
      expect(b.cLat).toBeGreaterThanOrEqual(27)
      expect(b.cLat).toBeLessThanOrEqual(44)
      expect(b.cLon).toBeGreaterThanOrEqual(-19)
      expect(b.cLon).toBeLessThanOrEqual(5)
      expect(b.minLat).toBeLessThanOrEqual(b.maxLat)
      expect(b.minLon).toBeLessThanOrEqual(b.maxLon)
    }
  })
  it('PONTEVEDRA centroid sits in Galicia, not a corrupted out-of-range envelope', () => {
    const pontevedra = PROVINCE_BBOX.find(b => b.name.includes('PONTEVEDRA'))
    expect(pontevedra).toBeDefined()
    expect(pontevedra!.cLat).toBeGreaterThan(41)
    expect(pontevedra!.cLat).toBeLessThan(43)
    expect(pontevedra!.cLon).toBeGreaterThan(-9.5)
    expect(pontevedra!.cLon).toBeLessThan(-7.5)
  })
})
