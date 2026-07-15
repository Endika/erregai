// @vitest-environment jsdom
import { beforeEach, afterEach } from 'vitest'
import { TripController } from '../src/ui/trip'
import type { MapView } from '../src/ui/map'
import { Store } from '../src/app/store'
import type { Kv, CacheEntry } from '../src/adapters/cache'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'
import { t } from '../src/i18n'

const memKv = (): Kv => { const m = new Map<string, CacheEntry>(); return { get: async id => m.get(id), put: async e => { m.set(e.id, e) } } }

// Two dataset-independent in-memory stations on the route ahead: one cheap
// (below the nearby average), one expensive (above it).
const st = (id: string, lat: number, price: number): Station => ({
  id, brand: id, name: id, pos: { lat, lon: 0 }, address: '', town: '', schedule: '',
  prices: { gasoleoA: price },
})
const CHEAP = st('cheap', 40.035, 1.0)  // farther of the two, below the 1.5 average
const PRICEY = st('pricey', 40.03, 2.0) // nearest station ahead, above the 1.5 average
const STATIONS = [CHEAP, PRICEY]
const provinceWithStations = async () => ({ fecha: 'x', stations: STATIONS })

const behind: LatLon = { lat: 40.0, lon: 0 }  // ~3.3 km south of CHEAP: out of alert range
const near: LatLon = { lat: 40.02, lon: 0 }   // ~1.1 km south of CHEAP, heading north: in range, ahead
const nearer: LatLon = { lat: 40.025, lon: 0 } // still in range, already alerted

class FakeNotification {
  static permission = 'granted'
  static instances: { title: string; body?: string }[] = []
  constructor(title: string, opts?: { body?: string }) {
    FakeNotification.instances.push({ title, body: opts?.body })
  }
}

const fakeMap = (): MapView => {
  const view = { renderRadars() {}, clearRadars() {} }
  return view as unknown as MapView
}

function makeController(): TripController {
  const store = new Store({ fetchProvince: provinceWithStations as never, kv: memKv(), now: () => 1000 })
  // fuel is the only alert under test; silence radar to keep dataset out of it.
  store.setSettings({ fuel: 'gasoleoA', radarAlertsEnabled: false, fuelSound: false })
  return new TripController(store, fakeMap(), () => {}, () => {})
}

const fix = (c: TripController, pos: LatLon): Promise<void> =>
  (c as unknown as { onFix(p: LatLon): Promise<void> }).onFix(pos)

const fuelAlerts = () => FakeNotification.instances.filter(n => n.title === t('fuel.alert.title'))

beforeEach(() => {
  FakeNotification.instances = []
  ;(globalThis as unknown as { Notification: typeof FakeNotification }).Notification = FakeNotification
})

afterEach(() => {
  delete (globalThis as unknown as { Notification?: unknown }).Notification
})

describe('TripController fuel alerting', () => {
  it('cheap mode: alerts exactly once for a cheap station ahead, no re-alert in range', async () => {
    const c = makeController()
    await fix(c, behind) // seed lastPos, station out of range
    expect(fuelAlerts()).toHaveLength(0)

    await fix(c, near) // heading north, cheap station ahead within range -> one alert
    expect(fuelAlerts()).toHaveLength(1)
    expect(fuelAlerts()[0].body).toContain(CHEAP.brand)

    await fix(c, nearer) // still in range, already alerted -> no new alert
    expect(fuelAlerts()).toHaveLength(1)
  })

  it('off mode: never alerts', async () => {
    const c = makeController()
    ;(c as unknown as { store: Store }).store.setSettings({ fuelAlertMode: 'off' })
    await fix(c, behind)
    await fix(c, near)
    await fix(c, nearer)
    expect(fuelAlerts()).toHaveLength(0)
  })

  it('any mode: alerts for the expensive station ahead too', async () => {
    const c = makeController()
    ;(c as unknown as { store: Store }).store.setSettings({ fuelAlertMode: 'any' })
    await fix(c, behind)
    await fix(c, near)
    const bodies = fuelAlerts().map(n => n.body ?? '')
    expect(bodies.some(b => b.includes(PRICEY.brand))).toBe(true)
  })
})
