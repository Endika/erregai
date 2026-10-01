import { radiusBounds } from '../src/ui/map-frame'
import { haversineKm } from '../src/core/geo'

const BILBAO = { lat: 43.263, lon: -2.935 }

describe('radiusBounds', () => {
  it('reaches the radius exactly on each side of the position', () => {
    const { south, west, north, east } = radiusBounds(BILBAO, 15)
    expect(haversineKm(BILBAO, { lat: north, lon: BILBAO.lon })).toBeCloseTo(15, 6)
    expect(haversineKm(BILBAO, { lat: south, lon: BILBAO.lon })).toBeCloseTo(15, 6)
    // East and west are measured along the parallel, which the great circle
    // undercuts by a hair; the box has to be at least as wide as the circle.
    expect(haversineKm(BILBAO, { lat: BILBAO.lat, lon: east })).toBeGreaterThanOrEqual(14.99)
    expect(haversineKm(BILBAO, { lat: BILBAO.lat, lon: west })).toBeGreaterThanOrEqual(14.99)
  })

  it('is centred on the position', () => {
    const { south, west, north, east } = radiusBounds(BILBAO, 15)
    expect((south + north) / 2).toBeCloseTo(BILBAO.lat, 9)
    expect((west + east) / 2).toBeCloseTo(BILBAO.lon, 9)
  })

  it('widens in longitude away from the equator, as the meridians close in', () => {
    const equator = radiusBounds({ lat: 0, lon: 0 }, 10)
    const north = radiusBounds({ lat: 43, lon: 0 }, 10)
    expect(north.north - north.south).toBeCloseTo(equator.north - equator.south, 9)
    expect(north.east - north.west).toBeGreaterThan(equator.east - equator.west)
  })

  it('scales with the radius', () => {
    const small = radiusBounds(BILBAO, 5)
    const large = radiusBounds(BILBAO, 25)
    expect((large.north - large.south) / (small.north - small.south)).toBeCloseTo(5, 6)
  })
})
