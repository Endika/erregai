import { utmToWgs84, dedupeRadars, normalizeDgt } from '../scripts/lib/radar-normalize.mjs'

describe('utmToWgs84 (EPSG:25831)', () => {
  it('converts a Barcelona-area UTM 31N point to plausible WGS84', () => {
    // ~ Barcelona: easting 431000, northing 4582000 -> ~41.38 N, ~2.17 E
    const { lat, lon } = utmToWgs84(431000, 4582000)
    expect(lat).toBeGreaterThan(41.2)
    expect(lat).toBeLessThan(41.6)
    expect(lon).toBeGreaterThan(1.9)
    expect(lon).toBeLessThan(2.4)
  })
})

describe('dedupeRadars', () => {
  it('removes points that collapse to the same rounded coordinate', () => {
    const a = { id: '1', lat: 40.00001, lon: -3.00001, via: 'A-1', source: 'dgt' }
    const b = { id: '2', lat: 40.00002, lon: -3.00002, via: 'A-1', source: 'euskadi' }
    const c = { id: '3', lat: 41.0, lon: -3.0, via: 'A-2', source: 'dgt' }
    expect(dedupeRadars([a, b, c], 4)).toHaveLength(2)
  })

  it('drops points with non-finite coordinates', () => {
    const good = { id: '1', lat: 40.0, lon: -3.0, via: 'A-1', source: 'dgt' }
    const bad = { id: '2', lat: NaN, lon: -3.0, via: 'A-2', source: 'dgt' }
    expect(dedupeRadars([good, bad])).toHaveLength(1)
  })
})

describe('normalizeDgt', () => {
  it('maps DGT rows to Radar with decimal coords (dot or comma)', () => {
    const rows = [{ Carretera: 'A-1', Latitud: '40,5', Longitud: '-3,7' }]
    const out = normalizeDgt(rows)
    expect(out[0]).toMatchObject({ via: 'A-1', lat: 40.5, lon: -3.7, source: 'dgt' })
  })
})
