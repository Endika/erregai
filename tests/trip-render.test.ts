// @vitest-environment jsdom
import { beforeEach, afterEach } from 'vitest'
import { TripController } from '../src/ui/trip'
import type { MapView } from '../src/ui/map'
import { Store } from '../src/app/store'
import type { Kv, CacheEntry } from '../src/adapters/cache'
import { haversineKm, type LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'
import { RADARS } from '../src/core/radars.data'
import { t } from '../src/i18n'
import { bandFor } from '../src/core/pricing'

const memKv = (): Kv => {
  const m = new Map<string, CacheEntry>()
  return {
    get: async (id) => m.get(id),
    put: async (e) => {
      m.set(e.id, e)
    },
  }
}

const st = (id: string, lat: number, price: number): Station => ({
  id,
  brand: id,
  name: id,
  pos: { lat, lon: 0 },
  address: '',
  town: '',
  schedule: '',
  prices: { gasoleoA: price },
})
const CHEAP = st('cheap', 40.035, 1.0)
const MID = st('mid', 40.032, 1.5)
const PRICEY = st('pricey', 40.03, 2.0)

class FakeNotification {
  static permission = 'granted'
  constructor() {}
}

// In-memory geolocation that hands the test the watcher's callbacks, so fixes
// and errors can be pushed exactly as the browser would push them.
interface FakeGeo {
  success?: (p: { coords: { latitude: number; longitude: number } }) => void
  error?: (e: unknown) => void
}
function installGeolocation(): FakeGeo {
  const geo: FakeGeo = {}
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition(s: FakeGeo['success'], e: FakeGeo['error']) {
        geo.success = s
        geo.error = e
        return 1
      },
      clearWatch() {},
    },
  })
  return geo
}

const fakeMap = (): MapView => ({ renderRadars() {}, clearRadars() {} }) as unknown as MapView

function makeController(stations: Station[] = []): TripController {
  const store = new Store({
    fetchProvince: (async () => ({ fecha: 'x', stations })) as never,
    kv: memKv(),
    now: () => 1000,
  })
  store.setSettings({ fuel: 'gasoleoA', fuelSound: false, radarSound: false })
  return new TripController(
    store,
    fakeMap(),
    () => {},
    () => {},
  )
}

const fix = (c: TripController, pos: LatLon): Promise<void> =>
  (c as unknown as { onFix(p: LatLon): Promise<void> }).onFix(pos)

function draw(c: TripController): HTMLElement {
  const el = document.createElement('div')
  c.render(el, c.currentUpdate)
  return el
}

beforeEach(() => {
  ;(globalThis as unknown as { Notification: typeof FakeNotification }).Notification =
    FakeNotification
  localStorage.clear()
})

afterEach(() => {
  delete (globalThis as unknown as { Notification?: unknown }).Notification
})

describe('trip radar banner', () => {
  const RADAR = RADARS.find((r) => r.id === 'dgt-0')!
  const at = { lat: RADAR.lat, lon: RADAR.lon }
  const behind: LatLon = { lat: RADAR.lat - 0.01326, lon: RADAR.lon }
  const near: LatLon = { lat: RADAR.lat - 0.00326, lon: RADAR.lon }
  const nearer: LatLon = { lat: RADAR.lat - 0.00226, lon: RADAR.lon }
  const passed: LatLon = { lat: RADAR.lat + 0.00226, lon: RADAR.lon }
  const metersTo = (p: LatLon) =>
    t('radar.alert.banner').replace('{m}', String(Math.round(haversineKm(p, at) * 1000)))
  const radarBanner = (c: TripController) =>
    draw(c).querySelector<HTMLElement>('.trip-view__banner--radar')

  it('renders as a hazard, not as a fuel banner, with distance and road, announced assertively', async () => {
    const c = makeController()
    await fix(c, behind)
    await fix(c, near)
    const banner = radarBanner(c)!
    expect(banner).not.toBeNull()
    expect(banner.classList.contains('trip-view__banner--fuel')).toBe(false)
    expect(banner.classList.contains('trip-view__banner--cheapest')).toBe(false)
    expect(banner.getAttribute('aria-live')).toBe('assertive')
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toBe(metersTo(near))
    expect(banner.textContent).toContain(RADAR.via)
  })

  it('tracks the distance on every fix but keeps the announced text from the alert', async () => {
    const c = makeController()
    await fix(c, behind)
    await fix(c, near)
    await fix(c, nearer)
    const banner = radarBanner(c)!
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toBe(metersTo(nearer))
    expect(banner.querySelector('.visually-hidden')!.textContent).toContain(metersTo(near))
  })

  it('goes away once the radar has been passed', async () => {
    const c = makeController()
    await fix(c, behind)
    await fix(c, near)
    await fix(c, passed)
    expect(radarBanner(c)).toBeNull()
  })
})

describe('trip fuel banners', () => {
  const behind: LatLon = { lat: 40.0, lon: 0 }
  const near: LatLon = { lat: 40.02, lon: 0 }

  it('cheapest-ahead banner shows price and distance and is a polite live region', async () => {
    const c = makeController([CHEAP, PRICEY])
    await fix(c, behind) // first fix: no heading yet, so CHEAP is the cheapest ahead
    await fix(c, near) // the distance follows the latest fix, not the one that alerted
    const banner = draw(c).querySelector<HTMLElement>('.trip-view__banner--cheapest')!
    expect(banner).not.toBeNull()
    expect(banner.getAttribute('aria-live')).toBe('polite')
    expect(banner.textContent).toContain(t('trip.cheapestAhead'))
    expect(banner.textContent).toContain(CHEAP.brand)
    const km = haversineKm(near, CHEAP.pos).toFixed(1)
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toBe(
      `${(1.0).toFixed(3)} · ${km} km`,
    )
  })

  it('proximity fuel banner keeps its distance and is a polite live region', async () => {
    const c = makeController([CHEAP, PRICEY])
    await fix(c, behind)
    await fix(c, near)
    const banner = draw(c).querySelector<HTMLElement>('.trip-view__banner--fuel')!
    expect(banner).not.toBeNull()
    expect(banner.getAttribute('aria-live')).toBe('polite')
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toMatch(/\d+ m/)
  })
})

describe('trip rows', () => {
  it('carry the same price band as the station list', async () => {
    installGeolocation()
    const c = makeController([CHEAP, MID, PRICEY])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const rows = [...draw(c).querySelectorAll<HTMLElement>('.trip-view__row')]
    const all = [CHEAP, MID, PRICEY]
    const prices = all.map((x) => x.prices.gasoleoA!)
    expect(rows).toHaveLength(all.length)
    for (const row of rows) {
      const station = all.find(
        (x) => x.brand === row.querySelector('.trip-view__row-brand')!.textContent,
      )!
      expect(row.dataset.band).toBe(bandFor(station.prices.gasoleoA!, prices))
    }
    expect(new Set(rows.map((r) => r.dataset.band)).has('cheap')).toBe(true)
    c.stop()
  })
})

describe('trip idle and GPS status', () => {
  it('explains what starting a trip does before it starts, without a GPS line', () => {
    const el = draw(makeController())
    const intro = el.querySelector('.trip-view__intro')!
    expect(intro).not.toBeNull()
    expect(intro.textContent).toContain(t('trip.intro.notifications'))
    expect(intro.textContent).toContain(t('trip.intro.screen'))
    expect(el.querySelector('.trip-view__gps')).toBeNull()
  })

  it('reports waiting, active and lost GPS while a trip runs', async () => {
    const geo = installGeolocation()
    const c = makeController()
    await c.start()
    const gps = () => draw(c).querySelector<HTMLElement>('.trip-view__gps')!
    expect(gps().dataset.gps).toBe('waiting')
    expect(gps().textContent).toBe(t('trip.gps.waiting'))
    expect(draw(c).querySelector('.trip-view__intro')).toBeNull()

    geo.success!({ coords: { latitude: 40.0, longitude: 0 } })
    expect(gps().dataset.gps).toBe('active')
    expect(gps().textContent).toBe(t('trip.gps.active'))

    geo.error!({ code: 3 })
    expect(gps().dataset.gps).toBe('lost')
    expect(gps().textContent).toBe(t('trip.gps.lost'))

    c.stop()
  })
})
