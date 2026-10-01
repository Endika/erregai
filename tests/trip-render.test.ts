// @vitest-environment jsdom
import { beforeEach, afterEach } from 'vitest'
import { TripController } from '../src/ui/trip'
import type { MapView } from '../src/ui/map'
import { Store } from '../src/app/store'
import type { Kv, CacheEntry } from '../src/adapters/cache'
import { haversineKm, type LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'
import { RADARS, RADARS_DATASET_DATE } from '../src/core/radars.data'
import { setLocale, t } from '../src/i18n'
import { formatDate, formatDistance, formatKm } from '../src/i18n/format'
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

type Spoken = { text: string; politeness: 'polite' | 'assertive' }

function makeController(stations: Station[] = [], spoken: Spoken[] = []): TripController {
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
    (text, politeness) => spoken.push({ text, politeness }),
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
    t('radar.alert.banner').replace('{distance}', formatDistance(haversineKm(p, at)))
  const radarBanner = (c: TripController) =>
    draw(c).querySelector<HTMLElement>('.trip-view__banner--radar')

  it('renders as a hazard, not as a fuel banner, with distance and road', async () => {
    const c = makeController()
    await fix(c, behind)
    await fix(c, near)
    const banner = radarBanner(c)!
    expect(banner).not.toBeNull()
    expect(banner.classList.contains('trip-view__banner--fuel')).toBe(false)
    expect(banner.classList.contains('trip-view__banner--cheapest')).toBe(false)
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toBe(metersTo(near))
    expect(banner.textContent).toContain(RADAR.via)
  })

  it('tracks the distance on every fix but announces the alert once, assertively', async () => {
    const spoken: Spoken[] = []
    const c = makeController([], spoken)
    await fix(c, behind)
    await fix(c, near)
    draw(c)
    await fix(c, nearer)
    draw(c)
    draw(c)
    const banner = radarBanner(c)!
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toBe(metersTo(nearer))
    expect(spoken).toHaveLength(1)
    expect(spoken[0].politeness).toBe('assertive')
    expect(spoken[0].text).toContain(metersTo(near))
    expect(spoken[0].text).toContain(RADAR.via)
  })

  it('leaves announcing to the persistent regions, not to the re-rendered banner', async () => {
    const c = makeController()
    await fix(c, behind)
    await fix(c, near)
    const el = draw(c)
    expect(el.querySelector('[aria-live]')).toBeNull()
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

  it('cheapest-ahead banner shows price and distance and is announced politely once', async () => {
    const spoken: Spoken[] = []
    const c = makeController([CHEAP, PRICEY], spoken)
    await fix(c, behind) // first fix: no heading yet, so nothing alerts
    await fix(c, near) // heading north: CHEAP is the cheapest ahead
    await fix(c, { lat: 40.025, lon: 0 }) // the distance follows the latest fix, not the one that alerted
    const banner = draw(c).querySelector<HTMLElement>('.trip-view__banner--cheapest')!
    expect(banner).not.toBeNull()
    expect(banner.textContent).toContain(CHEAP.brand)
    const cheapest = spoken.filter((s) => s.text.includes(t('fuel.gasoleoA')))
    expect(cheapest).toHaveLength(1)
    expect(cheapest[0].politeness).toBe('polite')
    const km = formatKm(haversineKm({ lat: 40.025, lon: 0 }, CHEAP.pos))
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toBe(`1,000 · ${km}`)
  })

  it('proximity fuel banner keeps its distance and is announced politely once', async () => {
    const spoken: Spoken[] = []
    const c = makeController([CHEAP, PRICEY], spoken)
    await fix(c, behind)
    await fix(c, near)
    draw(c)
    await fix(c, { lat: 40.021, lon: 0 })
    const banner = draw(c).querySelector<HTMLElement>('.trip-view__banner--fuel')!
    expect(banner).not.toBeNull()
    const nearby = spoken.filter((s) => s.text.includes(t('fuel.alert.title')))
    expect(nearby).toHaveLength(1)
    expect(nearby[0].politeness).toBe('polite')
    expect(banner.querySelector('.trip-view__banner-key')!.textContent).toMatch(
      /^.+ a (\d+ m|\d+,\d km)$/,
    )
  })
})

describe('trip fuel name', () => {
  it('names the fuel in the cheapest-ahead banner', async () => {
    setLocale('es')
    const c = makeController([CHEAP, PRICEY])
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const label = draw(c).querySelector('.trip-view__banner--cheapest .trip-view__banner-label')!
    expect(label.textContent).toBe(`Más barata en Gasóleo A por delante: ${CHEAP.brand}`)
  })

  it('switches fuel from the trip sort bar', async () => {
    installGeolocation()
    const c = makeController([CHEAP, PRICEY])
    await c.start()
    const select = draw(c).querySelector<HTMLSelectElement>('.sort-bar select')!
    expect(select.value).toBe('gasoleoA')
    select.value = 'gasolina95'
    select.dispatchEvent(new Event('change'))
    expect(c['store'].state.settings.fuel).toBe('gasolina95')
    c.stop()
  })

  it('prices the cheapest-ahead banner afresh after a switch, even when the new fuel costs more', async () => {
    setLocale('es')
    installGeolocation()
    const both: Station = { ...CHEAP, prices: { gasoleoA: 1.0, gasolina95: 1.6 } }
    const c = makeController([both])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.01, lon: 0 })
    const label = () =>
      draw(c).querySelector('.trip-view__banner--cheapest .trip-view__banner-label')?.textContent
    expect(label()).toBe(`Más barata en Gasóleo A por delante: ${both.brand}`)
    const select = draw(c).querySelector<HTMLSelectElement>('.sort-bar select')!
    select.value = 'gasolina95'
    select.dispatchEvent(new Event('change'))
    expect(label()).toBeUndefined()
    await fix(c, { lat: 40.015, lon: 0 })
    expect(label()).toBe(`Más barata en Gasolina 95 por delante: ${both.brand}`)
    c.stop()
  })
})

describe('trip layout', () => {
  it('puts the alerts above the stop control while a trip runs', async () => {
    installGeolocation()
    const c = makeController([CHEAP, PRICEY])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const view = draw(c).querySelector('.trip-view')!
    expect(view.firstElementChild!.classList.contains('trip-view__alerts')).toBe(true)
    expect(view.querySelector('.trip-view__alerts + .trip-view__controls')).not.toBeNull()
    expect(view.querySelector('.trip-view__controls .trip-view__toggle')!.textContent).toBe(
      t('trip.stop'),
    )
    c.stop()
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

  it('voice the price before its band, not the band instead of the price', async () => {
    installGeolocation()
    const c = makeController([CHEAP, MID, PRICEY])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const cheap = [...draw(c).querySelectorAll<HTMLElement>('.trip-view__row')].find(
      (r) => r.dataset.band === 'cheap',
    )!
    const price = cheap.querySelector('.trip-view__row-price')!
    expect(price.textContent).toBe('1,000')
    expect(price.getAttribute('aria-label')).toBe('1,000 €/l, barata')
    c.stop()
  })
})

describe('trip before the direction is known', () => {
  it('lists no stations and shows the nothing-ahead state', async () => {
    installGeolocation()
    const c = makeController([CHEAP, MID, PRICEY, st('south', 39.97, 0.9)])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    const el = draw(c)
    expect(el.querySelectorAll('.trip-view__row')).toHaveLength(0)
    expect(el.querySelector('.trip-view__empty')!.textContent).toBe(t('trip.noneAhead'))
    expect(el.querySelector('.trip-view__banner')).toBeNull()
    c.stop()
  })
})

describe('trip map stations', () => {
  const SOUTH = st('south', 39.97, 0.9)
  const ALL = [CHEAP, MID, PRICEY, SOUTH]

  it('shows every nearby station when no trip is running', () => {
    expect(makeController(ALL).stationsForMap(ALL)).toEqual(ALL)
  })

  it('shows only the stations ahead while a trip runs', async () => {
    installGeolocation()
    const c = makeController(ALL)
    await c.start()
    expect(c.stationsForMap(ALL)).toEqual([])
    await fix(c, { lat: 40.0, lon: 0 })
    expect(c.stationsForMap(ALL)).toEqual([])
    await fix(c, { lat: 40.01, lon: 0 })
    expect(c.stationsForMap(ALL).map((s) => s.id)).toEqual(['cheap', 'mid', 'pricey'])
    c.stop()
    expect(c.stationsForMap(ALL)).toEqual(ALL)
  })
})

describe('trip radar dataset notice', () => {
  it("dates the radar dataset in the reader's locale, not ISO", async () => {
    installGeolocation()
    const c = makeController()
    c['store'].setSettings({ radarAlertsEnabled: true })
    await c.start()
    const notice = draw(c).querySelector('.trip-view__radar-notice')!
    expect(notice.textContent).toContain(formatDate(RADARS_DATASET_DATE))
    expect(notice.textContent).not.toContain(RADARS_DATASET_DATE)
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

  it('reports waiting, direction pending, active and lost GPS while a trip runs', async () => {
    const geo = installGeolocation()
    const c = makeController()
    await c.start()
    const gps = () => draw(c).querySelector<HTMLElement>('.trip-view__gps')!
    expect(gps().dataset.gps).toBe('waiting')
    expect(gps().textContent).toBe(t('trip.gps.waiting'))
    expect(draw(c).querySelector('.trip-view__intro')).toBeNull()

    geo.success!({ coords: { latitude: 40.0, longitude: 0 } })
    expect(gps().dataset.gps).toBe('heading')
    expect(gps().textContent).toBe(t('trip.gps.heading'))

    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.01, lon: 0 })
    expect(gps().dataset.gps).toBe('active')
    expect(gps().textContent).toBe(t('trip.gps.active'))

    geo.error!({ code: 3 })
    expect(gps().dataset.gps).toBe('lost')
    expect(gps().textContent).toBe(t('trip.gps.lost'))

    c.stop()
  })
})
