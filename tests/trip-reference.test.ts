// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'
import { radiusReference, type PriceReference } from '../src/core/pricing'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
  mapRender: vi.fn(),
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
    render = mocks.mapRender
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
const station = (id: string, lat: number, price: number): Station => ({
  id,
  brand: id,
  name: id,
  pos: { lat, lon: BILBAO.lon },
  address: '',
  town: '',
  schedule: '',
  prices: { gasoleoA: price },
})
const STATIONS = [
  station('a', 43.27, 1.3),
  station('b', 43.28, 1.4),
  station('c', 43.25, 1.5),
  station('d', 43.24, 1.6),
]

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

it('bands the trip map against the same radius reference as the list and map tabs', async () => {
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations: STATIONS })
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('erregai.settings', JSON.stringify({ fuel: 'gasoleoA', radiusKm: 15 }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()

  document.querySelector<HTMLButtonElement>('[data-tab="trip"]')!.click()
  const opts = mocks.mapRender.mock.lastCall![4] as { reference?: PriceReference }
  expect(opts.reference).toEqual(radiusReference(STATIONS, 'gasoleoA', BILBAO, 15))
})
