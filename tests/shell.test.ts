// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import { t as translate, type Locale } from '../src/i18n'
import { formatAge } from '../src/ui/status'

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
  // A returning user: the first-run screen would hold the location back.
  localStorage.setItem('erregai.firstRunDone', '1')
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

  it('keeps the header refresh a quiet icon button named for readers', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    const button = root.querySelector<HTMLButtonElement>('[data-refresh]')!
    const locale = document.documentElement.lang as Locale
    expect(button.getAttribute('aria-label')).toBe(translate('app.refresh', locale))
    expect(button.textContent?.trim()).toBe('')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
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

describe('connectivity', () => {
  let online = true
  // Each boot is a fresh app on the same window; earlier ones must not answer.
  const added: [string, EventListenerOrEventListenerObject][] = []
  beforeEach(() => {
    online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    const add = window.addEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (listener) added.push([type, listener])
      add(type, listener, options)
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    for (const [type, listener] of added.splice(0)) window.removeEventListener(type, listener)
  })

  // The booted app picked its own locale from the browser; read it back.
  const t = (key: string): string => translate(key, document.documentElement.lang as Locale)
  const hint = (root: HTMLElement): string | null | undefined =>
    root.querySelector('.notice__hint')?.textContent

  it('says the connection is gone, not the service, as soon as coverage drops', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
    const root = await boot()
    expect(hint(root)).toBe(t('error.load.server'))

    online = false
    window.dispatchEvent(new Event('offline'))
    expect(hint(root)).toBe(t('error.load.offline'))
    expect(mocks.fetchProvince).toHaveBeenCalledTimes(1)
  })

  it('reloads once by itself when the connection comes back after a failed load', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
    online = false
    const root = await boot()
    expect(hint(root)).toBe(t('error.load.offline'))

    vi.useFakeTimers()
    mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations: [] })
    online = true
    window.dispatchEvent(new Event('online'))
    expect(hint(root)).toBe(t('error.load.server'))
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10_000)

    expect(mocks.fetchProvince).toHaveBeenCalledTimes(2)
    expect(root.querySelector('.notice')).toBeNull()
  })

  it('does not fetch on reconnect when the prices loaded fine and are fresh', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    await boot()
    vi.useFakeTimers()
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.fetchProvince).toHaveBeenCalledTimes(1)
  })

  it('says it is offline over fresh prices, and stops saying so on reconnect', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    const root = await boot()
    const banner = root.querySelector<HTMLElement>('[data-error]')!
    expect(banner.hidden).toBe(true)

    online = false
    window.dispatchEvent(new Event('offline'))
    expect(banner.hidden).toBe(false)
    const age = formatAge(60_000, document.documentElement.lang as Locale)
    expect(banner.textContent).toBe(t('status.cached.offline').replace('{age}', age))
    expect(banner.classList.contains('app-error--notice')).toBe(true)
    expect(root.querySelector('.notice')).toBeNull()

    online = true
    window.dispatchEvent(new Event('online'))
    expect(banner.hidden).toBe(true)
    expect(mocks.fetchProvince).toHaveBeenCalledTimes(1)
  })
})
