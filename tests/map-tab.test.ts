// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import { t } from '../src/i18n'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
  calls: [] as string[],
  fits: [] as { pos: LatLon; radiusKm: number }[],
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
    render(): void {
      mocks.calls.push('render')
    }
    renderRadars(radars: readonly unknown[]): void {
      mocks.calls.push(`radars:${radars.length}`)
    }
    clearRadars(): void {}
    renderServiceAreas(): void {}
    clearServiceAreas(): void {}
    invalidateSize(): void {}
    raiseRadars(): void {}
    fitRadius(pos: LatLon, radiusKm: number): void {
      mocks.calls.push('fit')
      mocks.fits.push({ pos, radiusKm })
    }
    focus(): void {
      mocks.calls.push('focus')
    }
    panTo(): void {}
  },
}))
vi.mock('../src/ui/trip', () => ({
  TripController: class {
    isActive = false
    currentUpdate = undefined
    render(): void {}
    stationsForMap<T>(s: T): T {
      return s
    }
  },
}))

const BILBAO: LatLon = { lat: 43.263, lon: -2.935 }
const SETTINGS_KEY = 'erregai.settings'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

async function boot(saved?: object): Promise<HTMLElement> {
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ locale: 'es', ...saved }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const tab = (root: HTMLElement, name: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-tab="${name}"]`)!

beforeEach(() => {
  mocks.getOnce.mockReset()
  mocks.fetchProvince.mockReset()
  mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations: [] })
  mocks.calls.length = 0
  mocks.fits.length = 0
})

describe('map tab framing', () => {
  it('frames the radius around the position on entering the tab', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot({ radiusKm: 15 })
    tab(root, 'map').click()
    expect(mocks.fits).toEqual([{ pos: BILBAO, radiusKm: 15 }])
  })

  it('leaves the user’s own pan and zoom alone when the data merely refreshes', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    tab(root, 'map').click()
    root.querySelector<HTMLButtonElement>('[data-refresh]')!.click()
    await flush()
    tab(root, 'map').click()
    expect(mocks.calls.filter((c) => c === 'render').length).toBeGreaterThan(1)
    expect(mocks.fits).toHaveLength(1)
  })

  it('reframes after a visit to Trip, so it never keeps the trip zoom', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    tab(root, 'map').click()
    tab(root, 'trip').click()
    mocks.calls.length = 0
    tab(root, 'map').click()
    expect(mocks.calls).toContain('fit')
    expect(mocks.calls).not.toContain('focus')
  })

  it('frames once the map first appears when the tab was entered before a position', async () => {
    let resolve: (pos: LatLon) => void = () => {}
    mocks.getOnce.mockReturnValue(new Promise((r) => (resolve = r)))
    const root = await boot()
    tab(root, 'map').click()
    expect(mocks.fits).toHaveLength(0)
    resolve(BILBAO)
    await flush()
    expect(mocks.fits).toEqual([{ pos: BILBAO, radiusKm: 15 }])
  })

  it('reframes when the position itself moves while on the map', async () => {
    const getxo = { name: 'Getxo', province: 'Bizkaia', pos: { lat: 43.35, lon: -3.01 } }
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot({ manualPlace: getxo })
    tab(root, 'map').click()
    expect(mocks.fits.map((f) => f.pos)).toEqual([getxo.pos])
    const useGps = [...root.querySelectorAll<HTMLButtonElement>('[data-view] button')].find(
      (b) => b.textContent === t('place.useGps', 'es'),
    )!
    useGps.click()
    await flush()
    expect(mocks.fits.map((f) => f.pos)).toEqual([getxo.pos, BILBAO])
  })

  it('lands the offline radar offer on a framed map with the radars already drawn', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
    const root = await boot({ radarLayerEnabled: false, servicesLayerEnabled: false })
    const offer = [...root.querySelectorAll<HTMLButtonElement>('[data-view] .notice button')].find(
      (b) => b.textContent === t('radar.offline.offer', 'es'),
    )!
    offer.click()
    const radars = mocks.calls.findIndex((c) => /^radars:[1-9]/.test(c))
    expect(radars).toBeGreaterThan(-1)
    expect(mocks.calls.indexOf('fit')).toBeGreaterThan(-1)
    expect(mocks.fits).toEqual([{ pos: BILBAO, radiusKm: 15 }])
  })
})
