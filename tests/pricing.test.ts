import { priceOf, bandFor, sortStations } from '../src/core/pricing'
import type { Station } from '../src/core/station'

const mk = (id: string, lat: number, price?: number): Station => ({
  id, brand: 'X', name: 'X', pos: { lat, lon: 0 }, address: '', town: '', schedule: '',
  prices: price === undefined ? {} : { gasoleoA: price },
})

describe('pricing', () => {
  it('priceOf returns price for fuel', () => {
    const s = mk('x', 0, 1.23)
    expect(priceOf(s, 'gasoleoA')).toBe(1.23)
    expect(priceOf(mk('y', 0), 'gasoleoA')).toBeUndefined()
  })
  it('bandFor uses percentiles of the set', () => {
    const all = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]
    expect(bandFor(1.0, all)).toBe('cheap')
    expect(bandFor(1.5, all)).toBe('expensive')
    expect(bandFor(1.25, all)).toBe('mid')
  })
  it('sort by price ascending, missing-fuel last', () => {
    const out = sortStations([mk('a', 0, 1.5), mk('b', 0, 1.2), mk('c', 0)], 'gasoleoA', { lat: 0, lon: 0 }, 'price')
    expect(out.map(s => s.id)).toEqual(['b', 'a', 'c'])
  })
  it('sort by distance ascending from origin', () => {
    const out = sortStations([mk('far', 5, 1), mk('near', 1, 9)], 'gasoleoA', { lat: 0, lon: 0 }, 'distance')
    expect(out.map(s => s.id)).toEqual(['near', 'far'])
  })
})
