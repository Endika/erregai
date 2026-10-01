// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'

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
    focus(): void {}
    panTo(): void {}
  },
}))
vi.mock('../src/ui/trip', () => ({
  TripController: class {
    isActive = false
    currentUpdate = undefined
    render(): void {}
  },
}))

const BILBAO: LatLon = { lat: 43.263, lon: -2.935 }

const flush = (): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, 0))

async function boot(): Promise<HTMLElement> {
  vi.resetModules()
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

function tab(root: HTMLElement, name: string): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>(`[data-tab="${name}"]`)!
}

// jsdom has no layout, so scrollTop is a no-op there; give the view a real one.
function trackScroll(el: HTMLElement): void {
  let top = 0
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v
    },
  })
}

beforeEach(() => {
  mocks.getOnce.mockReset()
  mocks.fetchProvince.mockReset()
  mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations: [] })
})

describe('app shell', () => {
  it('starts each tab at the top but keeps the scroll on a re-render of the same tab', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    const view = root.querySelector<HTMLElement>('[data-view]')!
    trackScroll(view)

    view.scrollTop = 400
    tab(root, 'settings').click()
    expect(view.scrollTop).toBe(0)

    view.scrollTop = 250
    tab(root, 'settings').click()
    expect(view.scrollTop).toBe(250)

    view.querySelector<HTMLInputElement>('[data-field="radarSound"]')!.click()
    expect(view.scrollTop).toBe(250)
  })

  it('retries the location from the header when there is no position yet', async () => {
    mocks.getOnce.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 1 }))
    const root = await boot()
    expect(mocks.getOnce).toHaveBeenCalledTimes(1)

    mocks.getOnce.mockResolvedValueOnce(BILBAO)
    root.querySelector<HTMLButtonElement>('[data-refresh]')!.click()
    await flush()

    expect(mocks.getOnce).toHaveBeenCalledTimes(2)
    expect(mocks.fetchProvince).toHaveBeenCalledTimes(1)
  })

  it('only refreshes the data from the header once the position is known', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    expect(mocks.fetchProvince).toHaveBeenCalledTimes(1)

    root.querySelector<HTMLButtonElement>('[data-refresh]')!.click()
    await flush()

    expect(mocks.getOnce).toHaveBeenCalledTimes(1)
    expect(mocks.fetchProvince).toHaveBeenCalledTimes(2)
  })

  it('marks the bottom bar as navigation with the current view, not as half a tabs widget', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    const nav = root.querySelector('nav.tab-bar')!
    expect(nav.getAttribute('role')).toBeNull()
    expect(root.querySelector('[role="tab"], [role="tablist"], [aria-selected]')).toBeNull()

    const current = (): string[] =>
      [...root.querySelectorAll<HTMLElement>('[aria-current]')].map((b) => b.dataset.tab!)
    expect(current()).toEqual(['list'])
    expect(tab(root, 'list').getAttribute('aria-current')).toBe('page')

    tab(root, 'map').click()
    expect(current()).toEqual(['map'])
  })
})
