// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'
import { t } from '../src/i18n'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
  trip: { active: false },
}))

vi.mock('../src/adapters/geolocation', () => ({
  getOnce: mocks.getOnce,
  watchPosition: vi.fn(() => () => {}),
}))
vi.mock('../src/adapters/api', () => ({ fetchProvince: mocks.fetchProvince }))
vi.mock('../src/adapters/cache', async (importActual) => ({
  ...(await importActual<typeof import('../src/adapters/cache')>()),
  openIdbKv: () => ({ get: async () => undefined, put: async () => {} }),
}))
vi.mock('../src/ui/map', () => ({
  MapView: class {
    render(): void {}
    renderRadars(): void {}
    clearRadars(): void {}
    renderServiceAreas(): void {}
    clearServiceAreas(): void {}
    invalidateSize(): void {}
    fitRadius(): void {}
    focus(): void {}
    panTo(): void {}
  },
}))
vi.mock('../src/ui/trip', () => ({
  TripController: class {
    get isActive(): boolean {
      return mocks.trip.active
    }
    currentUpdate = undefined
    stationsForMap = (s: unknown[]) => s
    render(): void {}
  },
}))

const BILBAO: LatLon = { lat: 43.263, lon: -2.935 }
const station = (id: string, lat: number, price: number): Station => ({
  id,
  brand: `Brand ${id}`,
  name: id,
  pos: { lat, lon: BILBAO.lon },
  address: '',
  town: '',
  schedule: '',
  prices: { gasoleoA: price },
})

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

let visibility: DocumentVisibilityState = 'visible'
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

async function boot(): Promise<HTMLElement> {
  Element.prototype.scrollIntoView = () => {}
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockResolvedValue({
    fecha: '01/10/2026 08:00:00',
    stations: [station('1', 43.27, 1.3)],
  })
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('erregai.settings', JSON.stringify({ locale: 'es', fuel: 'gasoleoA' }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

function openCard(root: HTMLElement): HTMLElement {
  root.querySelector<HTMLButtonElement>('[data-view] [data-station="1"]')!.click()
  return root.querySelector<HTMLElement>('[data-card]')!
}

const voiced = (): string[] =>
  [...document.querySelectorAll('[aria-live] p')].map((p) => p.textContent ?? '')

beforeEach(() => {
  mocks.trip.active = false
  visibility = 'visible'
})

describe('directions during a trip', () => {
  it('says under Cómo llegar that leaving to navigate stops the trip alerts', async () => {
    mocks.trip.active = true
    const card = openCard(await boot())
    const directions = card.querySelector<HTMLAnchorElement>('.station-detail__directions')!
    const note = card.querySelector<HTMLElement>('.station-detail__directions-note')!
    expect(note.textContent).toBe(t('detail.directions.tripNote'))
    expect(t('detail.directions.tripNote')).toBe(
      'Al abrir la navegación, Erregai deja de avisar de radares y gasolineras hasta que vuelvas.',
    )
    expect(directions.nextElementSibling).toBe(note)
    expect(directions.getAttribute('aria-describedby')).toBe(note.id)
  })

  it('adds nothing when no trip is running', async () => {
    const card = openCard(await boot())
    expect(card.querySelector('.station-detail__directions-note')).toBeNull()
    expect(
      card.querySelector('.station-detail__directions')!.hasAttribute('aria-describedby'),
    ).toBe(false)
  })

  it('says the alerts are back when the page returns mid-trip', async () => {
    mocks.trip.active = true
    await boot()
    setVisibility('hidden')
    expect(voiced()).not.toContain(t('trip.resumed'))
    setVisibility('visible')
    expect(voiced()).toContain(t('trip.resumed'))
  })

  it('stays quiet on return when no trip is running', async () => {
    await boot()
    setVisibility('hidden')
    setVisibility('visible')
    expect(voiced()).not.toContain(t('trip.resumed'))
  })
})
