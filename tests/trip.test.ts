import { newTripState, updateTrip } from '../src/core/trip'
import type { Station } from '../src/core/station'

const st = (id: string, lat: number, price: number): Station => ({
  id, brand: 'X', name: 'X', pos: { lat, lon: 0 }, address: '', town: '', schedule: '',
  prices: { gasoleoA: price },
})
const cfg = { fuel: 'gasoleoA' as const, radiusKm: 50, corridorDeg: 45 }

describe('trip', () => {
  it('first update heading north picks cheapest station ahead as alert', () => {
    let s = newTripState()
    s = updateTrip(s, { lat: 40, lon: 0 }, [], cfg).state          // seed lastPos
    const u = updateTrip(s, { lat: 40.1, lon: 0 },
      [st('ahead-cheap', 40.5, 1.5), st('ahead-cheaper', 40.35, 1.3), st('behind', 39.9, 1.0)], cfg)
    expect(u.ahead.map(x => x.id)).toEqual(['ahead-cheaper', 'ahead-cheap']) // behind excluded, price order
    expect(u.alert?.id).toBe('ahead-cheaper')
  })
  it('does not re-alert unless a strictly cheaper station appears', () => {
    let s = newTripState()
    s = updateTrip(s, { lat: 40, lon: 0 }, [], cfg).state
    s = updateTrip(s, { lat: 40.1, lon: 0 }, [st('a', 40.4, 1.3)], cfg).state // bestSeen=1.3
    const again = updateTrip(s, { lat: 40.2, lon: 0 }, [st('b', 40.4, 1.4)], cfg)
    expect(again.alert).toBeUndefined()
    const cheaper = updateTrip(again.state, { lat: 40.3, lon: 0 }, [st('c', 40.4, 1.1)], cfg)
    expect(cheaper.alert?.id).toBe('c')
  })
})
