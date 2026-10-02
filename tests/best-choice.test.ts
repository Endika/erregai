import { bestChoice, detourCost } from '../src/core/best-choice'
import type { Station } from '../src/core/station'

const KM_PER_DEG = 6371 * (Math.PI / 180)
const origin = { lat: 0, lon: 0 }
// A Wednesday at noon, and one at 21:40 for the stations that close at 22:00.
const noon = new Date(2026, 0, 7, 12, 0)
const late = new Date(2026, 0, 7, 21, 40)

const at = (id: string, km: number, price: number | undefined, schedule = 'L-D: 24H'): Station => ({
  id,
  brand: id.toUpperCase(),
  name: id.toUpperCase(),
  pos: { lat: km / KM_PER_DEG, lon: 0 },
  address: '',
  town: '',
  schedule,
  prices: price === undefined ? {} : { gasoleoA: price },
})

const pick = (stations: Station[], tank = 50, now = noon) =>
  bestChoice(stations, 'gasoleoA', origin, tank, now)

describe('detourCost', () => {
  it('prices the extra kilometres there and back at 6.5 l/100 km', () => {
    expect(detourCost(2, 1.5)).toBeCloseTo(2 * 2 * 0.065 * 1.5, 10)
  })

  it('charges nothing for a station no further than the nearest', () => {
    expect(detourCost(0, 1.5)).toBe(0)
    expect(detourCost(-1, 1.5)).toBe(0)
  })
})

describe('bestChoice', () => {
  it('measures the saving against the nearest open station, net of the detour', () => {
    const choice = pick([at('near', 1, 1.5), at('far', 3, 1.4)])!
    expect(choice.station.id).toBe('far')
    expect(choice.kind).toBe('saving')
    // (1.50 − 1.40) × 50 − (3 − 1) × 2 × 0.065 × 1.40
    expect(choice.saving).toBeCloseTo(5 - 0.364, 6)
    expect(choice.distanceKm).toBeCloseTo(3, 6)
    expect(choice.price).toBe(1.4)
  })

  it('scales the saving with the tank', () => {
    const choice = pick([at('near', 1, 1.5), at('far', 3, 1.4)], 30)!
    expect(choice.saving).toBeCloseTo(3 - 0.364, 6)
  })

  it('lets a long detour cancel a small difference', () => {
    // 1 cent × 50 l = 0.50 €, against 10 km × 2 × 0.065 × 1.49 ≈ 1.94 €.
    const choice = pick([at('near', 1, 1.5), at('far', 11, 1.49)])!
    expect(choice.station.id).toBe('near')
    expect(choice.kind).toBe('nearest')
    expect(choice.saving).toBeUndefined()
  })

  it('answers with the nearest when nothing beats it', () => {
    const choice = pick([at('near', 1, 1.4), at('mid', 2, 1.45), at('far', 3, 1.5)])!
    expect(choice.station.id).toBe('near')
    expect(choice.kind).toBe('nearest')
  })

  it('treats a saving under one cent as no saving', () => {
    // 0.0001 €/l × 50 l = 0.005 €, with no detour at the same distance.
    const choice = pick([at('near', 1, 1.5), at('twin', 1, 1.4999)])!
    expect(choice.kind).toBe('nearest')
  })

  it('breaks a tie to the cent in favour of the nearer station', () => {
    // 4.636 € at 2 km and 4.6357 € at 4 km both round to 4.64 €.
    const choice = pick([at('here', 0, 1.5), at('b', 2, 1.4), at('c', 4, 1.3928)])!
    expect(choice.station.id).toBe('b')
  })

  it('takes the cheaper of two stations equally near as the reference', () => {
    const choice = pick([at('dear', 1, 1.6), at('cheap', 1, 1.5), at('far', 50, 1.55)])!
    expect(choice.station.id).toBe('cheap')
    expect(choice.kind).toBe('nearest')
  })

  it('leaves closed stations out, as the reference and as the answer', () => {
    const shut = 'L-D: 07:00-11:00'
    const choice = pick([at('closed-near', 0.5, 1.2, shut), at('near', 1, 1.5), at('far', 3, 1.4)])!
    expect(choice.station.id).toBe('far')
    expect(choice.saving).toBeCloseTo(5 - 0.364, 6)
  })

  it('leaves out a station whose hours cannot be read, since the card says it is open', () => {
    const choice = pick([at('near', 1, 1.5), at('noise', 2, 1.0, 'L: 24H')])!
    expect(choice.station.id).toBe('near')
  })

  it('gives the only open station without a saving', () => {
    const choice = pick([at('only', 2, 1.5), at('closed', 1, 1.2, 'L-D: 07:00-11:00')])!
    expect(choice.station.id).toBe('only')
    expect(choice.kind).toBe('only')
    expect(choice.saving).toBeUndefined()
  })

  it('ignores stations that do not sell the fuel', () => {
    const choice = pick([at('nofuel', 0.5, undefined), at('near', 1, 1.5), at('far', 3, 1.4)])!
    expect(choice.station.id).toBe('far')
    expect(choice.saving).toBeCloseTo(5 - 0.364, 6)
  })

  it('has no answer when no open station sells the fuel', () => {
    expect(pick([at('a', 1, undefined), at('b', 2, 1.2, 'L-D: 07:00-11:00')])).toBeUndefined()
    expect(pick([])).toBeUndefined()
  })

  it('flags a winner that closes within the hour, as the list does', () => {
    const closes = 'L-D: 07:00-22:00'
    const choice = pick([at('near', 1, 1.5), at('far', 3, 1.4, closes)], 50, late)!
    expect(choice.station.id).toBe('far')
    expect(choice.closingSoon).toBe(true)
    expect(pick([at('near', 1, 1.5), at('far', 3, 1.4, closes)])!.closingSoon).toBe(false)
  })
})
