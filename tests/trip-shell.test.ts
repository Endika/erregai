// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
  tripRender: vi.fn(),
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
    focus(): void {}
    panTo(): void {}
  },
}))
vi.mock('../src/ui/trip', () => ({
  TripController: class {
    isActive = false
    currentUpdate = undefined
    stationsForMap = (s: unknown[]) => s
    render = mocks.tripRender
  },
}))

const flush = (): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, 0))

describe('trip without prices', () => {
  it('leaves the one message to the trip view instead of repeating it on top', async () => {
    mocks.getOnce.mockResolvedValue({ lat: 43.263, lon: -2.935 })
    mocks.fetchProvince.mockRejectedValue(new Error('down'))
    localStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    await flush()
    const root = document.getElementById('app')!
    root.querySelector<HTMLButtonElement>('[data-tab="trip"]')!.click()

    const [, , , options] = mocks.tripRender.mock.lastCall!
    expect(options.pricesUnavailable).toBe(true)
    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(true)
  })
})
