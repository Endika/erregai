// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
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
    raiseRadars(): void {}
    focus(): void {}
    panTo(): void {}
  },
}))

const BILBAO: LatLon = { lat: 43.263, lon: -2.935 }
const station = (id: string, lat: number, price: number | undefined): Station => ({
  id,
  brand: `Brand ${id}`,
  name: id,
  pos: { lat, lon: BILBAO.lon },
  address: '',
  town: '',
  schedule: 'L-D: 24H',
  prices: price === undefined ? {} : { gasoleoA: price },
})

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

function stubDesktop(matches: boolean): void {
  window.matchMedia = (() => ({
    matches,
    addEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

async function boot(
  stations: Station[],
  saved: object = {},
  desktop = false,
): Promise<HTMLElement> {
  Element.prototype.scrollIntoView = () => {}
  stubDesktop(desktop)
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations })
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem(
    'erregai.settings',
    JSON.stringify({ locale: 'es', fuel: 'gasoleoA', ...saved }),
  )
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const STATIONS = [station('near', 43.27, 1.5), station('far', 43.28, 1.3)]

describe('answer card in the shell', () => {
  it('sits right under the sort bar, above the unchanged list', async () => {
    const root = await boot(STATIONS)
    const card = root.querySelector<HTMLElement>('[data-view] .answer-card')!
    expect(card.previousElementSibling?.className).toBe('sort-bar')
    expect(card.querySelector('.answer-card__brand')?.textContent).toBe('Brand far')
    expect(root.querySelectorAll('[data-view] [data-station]')).toHaveLength(2)
  })

  it('prices the saving on the stored tank', async () => {
    const root = await boot(STATIONS, { tankLitres: 30 })
    expect(root.querySelector('.answer-card__saving')?.textContent).toMatch(/ en 30 l$/)
  })

  it('opens the station card from the card body', async () => {
    const root = await boot(STATIONS)
    root.querySelector<HTMLButtonElement>('.answer-card__body')!.click()
    const detail = root.querySelector<HTMLElement>('[data-card]')!
    expect(detail.hidden).toBe(false)
    expect(detail.querySelector('.station-detail__brand')?.textContent).toBe('Brand far')
  })

  it('leads the list pane beside the map on a desktop', async () => {
    const root = await boot(STATIONS, {}, true)
    const card = root.querySelector<HTMLElement>('.map-split__list .answer-card')!
    expect(card.previousElementSibling?.className).toBe('sort-bar')
    root.querySelector<HTMLButtonElement>('[data-tab="map"]')!.click()
    expect(root.querySelector('.answer-card')).toBeNull()
  })

  it('stays off the map tab', async () => {
    const root = await boot(STATIONS)
    root.querySelector<HTMLButtonElement>('[data-tab="map"]')!.click()
    expect(root.querySelector('.answer-card')).toBeNull()
  })

  it('shows no card when no open station sells the fuel', async () => {
    const root = await boot([station('a', 43.27, undefined)])
    expect(root.querySelector('.answer-card')).toBeNull()
    expect(root.querySelectorAll('[data-view] [data-station]')).toHaveLength(1)
  })
})
