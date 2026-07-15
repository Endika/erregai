// @vitest-environment jsdom
import { beforeEach, afterEach } from 'vitest'
import { TripController } from '../src/ui/trip'
import { Store } from '../src/app/store'
import type { Kv, CacheEntry } from '../src/adapters/cache'
import type { LatLon } from '../src/core/geo'
import { RADARS } from '../src/core/radars.data'

const memKv = (): Kv => { const m = new Map<string, CacheEntry>(); return { get: async id => m.get(id), put: async e => { m.set(e.id, e) } } }
const emptyProvince = async () => ({ fecha: 'x', stations: [] })

// Real in-memory fake of the Web Notification API (jsdom does not provide it),
// recording every notification so the test can count radar alerts without mocks.
class FakeNotification {
  static permission = 'granted'
  static instances: { title: string; body?: string }[] = []
  constructor(title: string, opts?: { body?: string }) {
    FakeNotification.instances.push({ title, body: opts?.body })
  }
}

// Pick a real, geographically isolated radar from the bundled dataset and drive
// the controller straight at it heading north.
const RADAR = RADARS.find(r => r.id === 'dgt-0')!
const behind: LatLon = { lat: RADAR.lat - 0.01326, lon: RADAR.lon } // ~1.47 km south (out of range)
const near: LatLon = { lat: RADAR.lat - 0.00326, lon: RADAR.lon }   // ~0.36 km south (in range, ahead)
const nearer: LatLon = { lat: RADAR.lat - 0.00226, lon: RADAR.lon } // ~0.25 km south (still in range)

function makeController(): TripController {
  const store = new Store({ fetchProvince: emptyProvince as never, kv: memKv(), now: () => 1000 })
  return new TripController(store, () => {}, () => {})
}

// onFix is private; the geolocation adapter is the production caller, so drive it directly here.
const fix = (c: TripController, pos: LatLon): Promise<void> =>
  (c as unknown as { onFix(p: LatLon): Promise<void> }).onFix(pos)

beforeEach(() => {
  FakeNotification.instances = []
  ;(globalThis as unknown as { Notification: typeof FakeNotification }).Notification = FakeNotification
})

afterEach(() => {
  delete (globalThis as unknown as { Notification?: unknown }).Notification
})

describe('TripController radar alerting', () => {
  it('alerts exactly once for a radar ahead and does not re-alert while still in range', async () => {
    const c = makeController()

    await fix(c, behind) // seed lastPos, radar out of range -> no alert
    expect(FakeNotification.instances).toHaveLength(0)

    await fix(c, near) // heading now north, radar ahead within range -> one alert
    const radarAlerts = FakeNotification.instances.filter(n => n.body?.includes(RADAR.via))
    expect(radarAlerts).toHaveLength(1)

    await fix(c, nearer) // still in range, already alerted -> no new alert
    expect(FakeNotification.instances.filter(n => n.body?.includes(RADAR.via))).toHaveLength(1)
  })

  it('does not alert when radar alerts are disabled', async () => {
    const c = makeController()
    const store = (c as unknown as { store: Store }).store
    store.setSettings({ radarAlertsEnabled: false })

    await fix(c, behind)
    await fix(c, near)
    await fix(c, nearer)
    expect(FakeNotification.instances).toHaveLength(0)
  })
})
