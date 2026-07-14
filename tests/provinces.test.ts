import { provinceFor, adjacentProvinces } from '../src/core/provinces'

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
})
