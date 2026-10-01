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
import { formatDate } from '../src/i18n/format'
import { fuelKey, radarKey } from '../src/ui/alert-slot'
import { bandFor, radiusReference } from '../src/core/pricing'
import { renderList } from '../src/ui/list'

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

// Alerts only reach the slot while a trip runs.
async function running(stations: Station[] = [], spoken: Spoken[] = []): Promise<TripController> {
  installGeolocation()
  const c = makeController(stations, spoken)
  await c.start()
  return c
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
  const metersTo = (p: LatLon) => radarKey(haversineKm(p, at))
  const radarBanner = (c: TripController) =>
    draw(c).querySelector<HTMLElement>('.trip-view__banner--radar')

  it('renders as a hazard, not as a fuel banner, with distance and road', async () => {
    const c = await running()
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
    const c = await running([], spoken)
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
    const c = await running()
    await fix(c, behind)
    await fix(c, near)
    const el = draw(c)
    expect(el.querySelector('[aria-live]')).toBeNull()
  })

  it('goes away once the radar has been passed', async () => {
    const c = await running()
    await fix(c, behind)
    await fix(c, near)
    await fix(c, passed)
    expect(radarBanner(c)).toBeNull()
  })
})

describe('trip fuel banners', () => {
  const behind: LatLon = { lat: 40.0, lon: 0 }
  const near: LatLon = { lat: 40.02, lon: 0 }
  const keyOf = (el: Element | null) => el?.querySelector('.trip-view__banner-key')?.textContent

  beforeEach(() => setLocale('es'))

  it('cheapest-ahead banner reads brand, price and distance and is announced politely once', async () => {
    const spoken: Spoken[] = []
    const c = await running([CHEAP, PRICEY], spoken)
    await fix(c, behind) // first fix: no heading yet, so nothing alerts
    await fix(c, near) // heading north: CHEAP is the cheapest ahead
    const latest = { lat: 40.025, lon: 0 } // the distance follows the latest fix, not the one that alerted
    await fix(c, latest)
    const el = draw(c)
    const banner = el.querySelector<HTMLElement>('.trip-view__banner--cheapest')
    expect(keyOf(banner)).toBe(fuelKey(CHEAP.brand, 1.0, haversineKm(latest, CHEAP.pos)))
    expect(banner!.querySelector('.trip-view__banner-label')!.textContent).toBe(
      'Más barata · Gasóleo A',
    )
    // CHEAP is also the nearby station: one alert, not the same station twice.
    expect(el.querySelectorAll('.trip-view__banner')).toHaveLength(1)
    expect(el.querySelector('.trip-view__alerts-more')).toBeNull()
    const cheapest = spoken.filter((s) => s.text.includes(t('fuel.gasoleoA')))
    expect(cheapest).toHaveLength(1)
    expect(cheapest[0].politeness).toBe('polite')
  })

  it('collapses the nearby station into one line under the cheapest, announced politely once', async () => {
    const spoken: Spoken[] = []
    const c = await running([CHEAP, PRICEY], spoken)
    c['store'].setSettings({ fuelAlertMode: 'any' })
    await fix(c, behind)
    await fix(c, near)
    draw(c)
    const latest = { lat: 40.021, lon: 0 }
    await fix(c, latest)
    const el = draw(c)
    expect(el.querySelectorAll('.trip-view__banner')).toHaveLength(1)
    expect(el.querySelector('.trip-view__banner--cheapest')).not.toBeNull()
    expect(el.querySelector('.trip-view__alerts-more')!.textContent).toBe(
      `+ ${t('trip.slot.more.fuel')}: ${fuelKey(PRICEY.brand, 2.0, haversineKm(latest, PRICEY.pos))}`,
    )
    const nearby = spoken.filter((s) => s.text.includes(t('fuel.alert.title')))
    expect(nearby).toHaveLength(1)
    expect(nearby[0].politeness).toBe('polite')
  })
})

describe('trip fuel alerts expire', () => {
  const FAR = st('far', 40.06, 1.2)
  const bestRow = (el: HTMLElement) =>
    el.querySelector('.trip-view__row--best .trip-view__row-brand')?.textContent
  const cheapestKey = (el: HTMLElement) =>
    el.querySelector('.trip-view__banner--cheapest .trip-view__banner-key')?.textContent
  const cheapestSpoken = (spoken: Spoken[]) =>
    spoken.filter((s) => s.text.includes(t('fuel.gasoleoA')))

  beforeEach(() => setLocale('es'))

  it('drops the cheapest and nearby banners once the station is behind', async () => {
    const c = await running([CHEAP, PRICEY])
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    expect(draw(c).querySelector('.trip-view__banner--cheapest')).not.toBeNull()
    await fix(c, { lat: 40.04, lon: 0 }) // both stations are behind now
    expect(draw(c).querySelector('.trip-view__banner')).toBeNull()
  })

  it('never names a station other than the best row of the list below', async () => {
    const spoken: Spoken[] = []
    installGeolocation()
    const c = makeController([CHEAP, MID, PRICEY, FAR], spoken)
    await c.start()
    for (const lat of [40.0, 40.02, 40.03, 40.036, 40.045]) {
      await fix(c, { lat, lon: 0 })
      const el = draw(c)
      const key = cheapestKey(el)
      if (key !== undefined) expect(key.startsWith(`${bestRow(el)} `)).toBe(true)
    }
    // Past CHEAP, FAR leads the list at 1,200: dearer than the 1,000 already
    // announced, so no banner for it and nothing new said.
    const el = draw(c)
    expect(bestRow(el)).toBe(FAR.brand)
    expect(cheapestKey(el)).toBeUndefined()
    expect(cheapestSpoken(spoken)).toHaveLength(1)
    c.stop()
  })

  it('alerts again when a cheaper station than the one passed comes into range', async () => {
    const spoken: Spoken[] = []
    const BETTER = st('better', 40.2, 0.9) // beyond the 15 km radius at the start
    const c = await running([CHEAP, BETTER], spoken)
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    await fix(c, { lat: 40.07, lon: 0 })
    expect(cheapestKey(draw(c))!.startsWith(`${BETTER.brand} `)).toBe(true)
    expect(cheapestSpoken(spoken)).toHaveLength(2)
  })

  it('shows a station that comes back ahead without announcing it again', async () => {
    const spoken: Spoken[] = []
    const c = await running([CHEAP], spoken)
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    await fix(c, { lat: 40.036, lon: 0 }) // just past it
    expect(cheapestKey(draw(c))).toBeUndefined()
    await fix(c, { lat: 40.0355, lon: 0 }) // turned back: it is ahead again
    expect(cheapestKey(draw(c))!.startsWith(`${CHEAP.brand} `)).toBe(true)
    expect(cheapestSpoken(spoken)).toHaveLength(1)
    expect(spoken.filter((s) => s.text.includes(t('fuel.alert.title')))).toHaveLength(1)
  })

  it('drops the nearby line once that station is behind', async () => {
    const c = await running([CHEAP, PRICEY])
    c['store'].setSettings({ fuelAlertMode: 'any' })
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    expect(draw(c).querySelector('.trip-view__alerts-more')).not.toBeNull()
    await fix(c, { lat: 40.031, lon: 0 }) // past PRICEY, CHEAP still ahead
    const el = draw(c)
    expect(el.querySelector('.trip-view__banner--cheapest')).not.toBeNull()
    expect(el.querySelector('.trip-view__alerts-more')).toBeNull()
  })
})

describe('trip fuel name', () => {
  it('names the fuel in the cheapest-ahead banner', async () => {
    setLocale('es')
    const c = await running([CHEAP, PRICEY])
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const label = draw(c).querySelector('.trip-view__banner--cheapest .trip-view__banner-label')!
    expect(label.textContent).toBe('Más barata · Gasóleo A')
  })

  it('switches fuel from the trip view before the trip starts', () => {
    const c = makeController([CHEAP, PRICEY])
    const select = draw(c).querySelector<HTMLSelectElement>('.trip-view select')!
    expect(select.value).toBe('gasoleoA')
    select.value = 'gasolina95'
    select.dispatchEvent(new Event('change'))
    expect(c['store'].state.settings.fuel).toBe('gasolina95')
  })

  it('prices the cheapest-ahead banner afresh after a switch, even when the new fuel costs more', async () => {
    setLocale('es')
    installGeolocation()
    const both: Station = { ...CHEAP, prices: { gasoleoA: 1.0, gasolina95: 1.6 } }
    const c = makeController([both])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.01, lon: 0 })
    const banner = () => draw(c).querySelector('.trip-view__banner--cheapest')
    expect(banner()!.textContent).toContain('Gasóleo A')
    // Mid-trip the fuel can still change from the List tab.
    c['store'].setSettings({ fuel: 'gasolina95' })
    expect(banner()).toBeNull()
    await fix(c, { lat: 40.015, lon: 0 })
    expect(banner()!.textContent).toContain('Gasolina 95')
    expect(banner()!.textContent).toContain('1,600')
    c.stop()
  })
})

describe('trip layout', () => {
  // Where Stop sits among the view's children, and what sits around it.
  const stopPlace = (view: Element) => {
    const dock = view.querySelector('.trip-view__dock')!
    return {
      last: view.lastElementChild === dock,
      stop: dock.querySelector('.trip-view__toggle')!.textContent,
      gps: dock.querySelector('.trip-view__gps') !== null,
    }
  }

  it('docks Stop with the GPS line as the last row, wherever the alerts come and go', async () => {
    installGeolocation()
    const c = makeController([CHEAP, PRICEY])
    await c.start()
    const waiting = draw(c).querySelector('.trip-view')!
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const alerting = draw(c).querySelector('.trip-view')!
    expect(alerting.querySelector('.trip-view__banner')).not.toBeNull()
    await fix(c, { lat: 40.04, lon: 0 }) // both stations behind: the alert is gone
    const cleared = draw(c).querySelector('.trip-view')!
    expect(cleared.querySelector('.trip-view__banner')).toBeNull()

    for (const view of [waiting, alerting, cleared]) {
      expect(view.querySelectorAll('.trip-view__dock .trip-view__toggle')).toHaveLength(1)
      expect(stopPlace(view)).toEqual({ last: true, stop: t('trip.stop'), gps: true })
      // The slot is the first row in every state, so nothing above Stop changes kind.
      expect(view.firstElementChild!.classList.contains('trip-view__slot')).toBe(true)
    }
    c.stop()
  })

  it('reserves the alert slot while a trip runs, with a calm line when nothing alerts', async () => {
    installGeolocation()
    const c = makeController()
    expect(draw(c).querySelector('.trip-view__slot')).toBeNull()
    await c.start()
    const slot = draw(c).querySelector('.trip-view__slot')!
    expect(slot).not.toBeNull()
    expect(slot.querySelector('.trip-view__banner')).toBeNull()
    expect(slot.querySelector('.trip-view__slot-empty')!.textContent).toBe(t('trip.slot.empty'))
    c.stop()
  })

  it('offers the fuel but no order before the trip starts', () => {
    const el = draw(makeController([CHEAP, PRICEY]))
    expect(el.querySelector('.trip-view select')).not.toBeNull()
    expect(el.querySelector('.sort-bar')).toBeNull()
    expect(el.querySelector('[aria-pressed]')).toBeNull()
    for (const key of ['sort.price', 'sort.distance']) expect(el.textContent).not.toContain(t(key))
  })

  it('leaves sorting and the fuel picker out of an active trip', async () => {
    installGeolocation()
    const c = makeController([CHEAP, PRICEY])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const el = draw(c)
    expect(el.querySelector('.sort-bar')).toBeNull()
    expect(el.querySelector('select')).toBeNull()
    expect(el.querySelector('.trip-view__gps')).not.toBeNull()
    expect(el.querySelectorAll('.trip-view__row').length).toBeGreaterThan(0)
    c.stop()
  })
})

describe('trip rows ahead', () => {
  const FAR_CHEAP = st('far-cheap', 40.1, 0.9)
  const NEAR_DEAR = st('near-dear', 40.021, 2.5)
  const FIVE = [CHEAP, MID, PRICEY, FAR_CHEAP, NEAR_DEAR]
  const ids = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLElement>('.trip-view__row')].map((r) => r.dataset.station)
  const toggleOf = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('.trip-view__ahead-toggle')

  async function aheadOf(stations: Station[]): Promise<TripController> {
    const c = await running(stations)
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    return c
  }

  it('lists the cheapest three first, whatever order was kept in settings', async () => {
    const c = await aheadOf(FIVE)
    c['store'].setSettings({ tripSort: 'distance' })
    expect(ids(draw(c))).toEqual(['far-cheap', 'cheap', 'mid'])
    c.stop()
  })

  it('shows every station behind a toggle that says how many there are', async () => {
    const c = await aheadOf(FIVE)
    const collapsed = draw(c)
    const toggle = toggleOf(collapsed)!
    expect(toggle.textContent).toBe(t('trip.ahead.showAll').replace('{n}', '5'))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    toggle.click()
    const expanded = draw(c)
    expect(ids(expanded)).toEqual(['far-cheap', 'cheap', 'mid', 'pricey', 'near-dear'])
    expect(toggleOf(expanded)!.getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf(expanded)!.textContent).toBe(t('trip.ahead.showFewer'))
    toggleOf(expanded)!.click()
    expect(ids(draw(c))).toHaveLength(3)
    c.stop()
  })

  it('needs no toggle when three or fewer stations are ahead', async () => {
    const c = await aheadOf([CHEAP, MID, PRICEY])
    const el = draw(c)
    expect(ids(el)).toHaveLength(3)
    expect(toggleOf(el)).toBeNull()
    c.stop()
  })

  it('starts the next trip collapsed again', async () => {
    const c = await aheadOf(FIVE)
    toggleOf(draw(c))!.click()
    c.stop()
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    expect(ids(draw(c))).toHaveLength(3)
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
    expect(price.querySelector('.trip-view__row-price-value')!.textContent).toBe('1,000')
    expect(price.getAttribute('aria-label')).toBe('1,000 €/l, barata')
    c.stop()
  })
})

describe('trip rows against the radius', () => {
  // Cheaper stations just behind the car: banding only what lies ahead would
  // call 1,000 cheap here, while the list, which sees the whole radius, does not.
  const BEHIND = [st('b1', 39.99, 0.5), st('b2', 39.985, 0.6), st('b3', 39.98, 0.7)]
  const ALL = [CHEAP, MID, PRICEY, ...BEHIND]

  it('give each station the band the list gives it', async () => {
    installGeolocation()
    const c = makeController(ALL)
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    const here = { lat: 40.02, lon: 0 }
    await fix(c, here)

    const reference = radiusReference(ALL, 'gasoleoA', here, 15)
    const list = document.createElement('div')
    renderList(list, ALL, 'gasoleoA', here, () => {}, { reference })
    const listBand = (id: string) =>
      list.querySelector<HTMLElement>(`[data-station="${id}"]`)!.dataset.band

    const rows = [...draw(c).querySelectorAll<HTMLElement>('.trip-view__row')]
    expect(rows.map((r) => r.dataset.station)).toEqual(
      expect.arrayContaining(['cheap', 'mid', 'pricey']),
    )
    for (const row of rows) expect(row.dataset.band).toBe(listBand(row.dataset.station!))
    expect(rows.find((r) => r.dataset.station === 'cheap')!.dataset.band).toBe('expensive')
    c.stop()
  })

  it('wear the list pill, unit included', async () => {
    installGeolocation()
    const c = makeController([CHEAP, MID, PRICEY])
    await c.start()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const unit = draw(c).querySelector('.trip-view__row-price .trip-view__row-price-unit')!
    expect(unit.textContent).toBe('€/l')
    expect(unit.getAttribute('aria-hidden')).toBe('true')
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
    expect(intro.querySelectorAll('li').length).toBeLessThanOrEqual(3)
    expect(intro.textContent).toContain(t('trip.foregroundOnly'))
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

describe('trip start without a usable location or prices', () => {
  const drawWith = (c: TripController, opts: Parameters<TripController['render']>[3]) => {
    const el = document.createElement('div')
    c.render(el, c.currentUpdate, undefined, opts)
    return el
  }

  it('disables Start while the location is refused, with the reason tied to it', () => {
    const el = drawWith(makeController(), { locationDenied: true })
    const start = el.querySelector<HTMLButtonElement>('.trip-view__toggle')!
    expect(start.disabled).toBe(true)
    const reason = el.querySelector(`#${start.getAttribute('aria-describedby')}`)!
    expect(reason.textContent).toBe(t('trip.needsLocation'))
  })

  it('offers Start as usual when the location is not refused', () => {
    const start = drawWith(makeController(), {}).querySelector<HTMLButtonElement>(
      '.trip-view__toggle',
    )!
    expect(start.disabled).toBe(false)
    expect(start.hasAttribute('aria-describedby')).toBe(false)
  })

  it('puts Start first and drops the intro and pickers when no prices could load', () => {
    const el = drawWith(makeController(), { pricesUnavailable: true })
    const view = el.querySelector('.trip-view')!
    expect(view.firstElementChild!.classList.contains('trip-view__toggle')).toBe(true)
    expect(el.querySelector('.trip-view__intro')).toBeNull()
    expect(el.querySelector('select')).toBeNull()
    expect(el.querySelectorAll('.trip-view__note')).toHaveLength(1)
    expect(el.querySelector('.trip-view__note')!.textContent).toBe(t('trip.radarsOnly'))
  })

  it('says once, mid-trip too, that without prices only radars are left', async () => {
    const c = await running()
    await fix(c, { lat: 40.0, lon: 0 })
    await fix(c, { lat: 40.02, lon: 0 })
    const el = drawWith(c, { pricesUnavailable: true })
    expect(el.querySelectorAll('.trip-view__note')).toHaveLength(1)
    expect(el.querySelector('.trip-view__note')!.textContent).toBe(t('trip.radarsOnly'))
    expect(el.querySelector('.trip-view__empty')).toBeNull()
    c.stop()
  })
})
