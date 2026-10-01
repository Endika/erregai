import {
  priceOf,
  bandFor,
  bandThresholds,
  bandForThresholds,
  centsFromAverage,
  priceReference,
  radiusReference,
  sortStations,
  stationBand,
} from '../src/core/pricing'
import type { Station } from '../src/core/station'

const mk = (id: string, lat: number, price?: number): Station => ({
  id,
  brand: 'X',
  name: 'X',
  pos: { lat, lon: 0 },
  address: '',
  town: '',
  schedule: '',
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
  it('bandThresholds + bandForThresholds match bandFor on the same set', () => {
    const all = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]
    const thresholds = bandThresholds(all)
    for (const price of [1.0, 1.25, 1.5]) {
      expect(bandForThresholds(price, thresholds)).toBe(bandFor(price, all))
    }
    expect(bandForThresholds(1.0, thresholds)).toBe('cheap')
    expect(bandForThresholds(1.5, thresholds)).toBe('expensive')
    expect(bandForThresholds(1.25, thresholds)).toBe('mid')
  })
  it('sort by price ascending, missing-fuel last', () => {
    const out = sortStations(
      [mk('a', 0, 1.5), mk('b', 0, 1.2), mk('c', 0)],
      'gasoleoA',
      { lat: 0, lon: 0 },
      'price',
    )
    expect(out.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })
  it('sort by distance ascending from origin', () => {
    const out = sortStations(
      [mk('far', 5, 1), mk('near', 1, 9)],
      'gasoleoA',
      { lat: 0, lon: 0 },
      'distance',
    )
    expect(out.map((s) => s.id)).toEqual(['near', 'far'])
  })
})

describe('price reference', () => {
  const prices = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]
  const set = prices.map((p, i) => mk(String(i), 0, p))

  it('derives the thresholds, mean and count from the priced stations only', () => {
    const ref = priceReference([...set, mk('none', 0)], 'gasoleoA')!
    expect(ref.thresholds).toEqual(bandThresholds(prices))
    expect(ref.mean).toBeCloseTo(1.25)
    expect(ref.count).toBe(6)
  })

  it('has no reference when nothing in the set sells the fuel', () => {
    expect(priceReference([mk('none', 0)], 'gasoleoA')).toBeUndefined()
    expect(priceReference([], 'gasoleoA')).toBeUndefined()
  })

  it('takes only the stations inside the radius', () => {
    // 0.01 degrees of latitude is about 1.1 km; 1 degree, about 111 km.
    const near = [mk('a', 0, 1.4), mk('b', 0.01, 1.5), mk('c', 0.02, 1.6)]
    const far = [mk('x', 1, 0.9), mk('y', 1, 0.9), mk('z', 1, 0.9)]
    const ref = radiusReference([...near, ...far], 'gasoleoA', { lat: 0, lon: 0 }, 15)!
    expect(ref.count).toBe(3)
    expect(ref.mean).toBeCloseTo(1.5)
  })

  it('bands a station against the reference, whatever set it is drawn in', () => {
    const ref = priceReference(set, 'gasoleoA')
    expect(stationBand(mk('cheap', 5, 1.0), 'gasoleoA', ref)).toBe('cheap')
    expect(stationBand(mk('dear', 5, 1.5), 'gasoleoA', ref)).toBe('expensive')
    expect(stationBand(mk('none', 5), 'gasoleoA', ref)).toBeUndefined()
    expect(stationBand(mk('lone', 5, 1.2), 'gasoleoA', undefined)).toBeUndefined()
  })
})

describe('centsFromAverage', () => {
  const ref = (mean: number, count = 3) => ({ thresholds: { low: 0, high: 0 }, mean, count })

  it('is negative below the average and positive above it, in whole céntimos', () => {
    expect(centsFromAverage(1.469, ref(1.5493))).toBe(-8)
    expect(centsFromAverage(1.596, ref(1.55))).toBe(5)
  })

  it('rounds half a céntimo away from zero, symmetrically', () => {
    expect(centsFromAverage(1.505, ref(1.5))).toBe(1)
    expect(centsFromAverage(1.495, ref(1.5))).toBe(-1)
    expect(centsFromAverage(1.504, ref(1.5))).toBe(0)
    expect(Object.is(centsFromAverage(1.496, ref(1.5)), -0)).toBe(false)
  })

  it('stays silent when the reference has fewer than three prices', () => {
    expect(centsFromAverage(1.4, ref(1.5, 2))).toBeUndefined()
    expect(centsFromAverage(1.4, undefined)).toBeUndefined()
  })
})
