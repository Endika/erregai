// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import { t } from '../src/i18n'

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
vi.mock('../src/ui/trip', () => ({
  TripController: class {
    isActive = false
    currentUpdate = undefined
    render(): void {}
  },
}))

const BILBAO: LatLon = { lat: 43.263, lon: -2.935 }
const DENIED = Object.assign(new Error('denied'), { code: 1 })
const SETTINGS_KEY = 'erregai.settings'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

async function boot(saved?: object): Promise<HTMLElement> {
  vi.resetModules()
  localStorage.clear()
  // The test reads its copy in Spanish; jsdom would otherwise boot the app in English.
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ locale: 'es', ...saved }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const saved = (): { manualPlace?: { name: string } } =>
  JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')

function byText<T extends HTMLElement>(root: HTMLElement, selector: string, text: string): T {
  const el = [...root.querySelectorAll<T>(selector)].find((e) => e.textContent?.includes(text))
  if (!el) throw new Error(`no ${selector} with "${text}"`)
  return el
}

async function search(root: HTMLElement, query: string): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('.place-search input')!
  input.value = query
  input.dispatchEvent(new Event('input'))
  // The town list is a lazy chunk; wait for it to land and the field to answer.
  await vi.waitFor(() => {
    const answered =
      root.querySelector('.place-search__option') ||
      root.querySelector('.place-search [role="status"]')!.textContent
    if (!answered) throw new Error('town list not loaded yet')
  })
}

const DONOSTIA = {
  name: 'Donostia-San Sebastián',
  province: 'Gipuzkoa',
  pos: { lat: 43.3, lon: -1.98 },
}

beforeEach(() => {
  mocks.getOnce.mockReset()
  mocks.fetchProvince.mockReset()
  mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations: [] })
})

describe('location denied', () => {
  it('offers a town search, labelled, inside a warning rather than a grey sentence', async () => {
    mocks.getOnce.mockRejectedValue(DENIED)
    const root = await boot()
    const notice = root.querySelector<HTMLElement>('[data-view] .notice')!
    expect(notice.dataset.tone).toBe('warn')
    expect(notice.textContent).toContain(t('error.location.denied'))
    const input = notice.querySelector<HTMLInputElement>('.place-search input')!
    expect(root.querySelector(`label[for="${input.id}"]`)!.textContent).toBe(
      t('place.search.label'),
    )
  })

  it('sets the position from a town picked by hand and says it was picked by hand', async () => {
    mocks.getOnce.mockRejectedValue(DENIED)
    const root = await boot()
    await search(root, 'Donosti')
    byText<HTMLButtonElement>(root, '.place-search__option', 'Donostia-San Sebastián').click()
    await flush()

    expect(mocks.fetchProvince).toHaveBeenCalledWith('20')
    expect(root.querySelector('.notice')).toBeNull()
    expect(root.querySelector('.place-strip')!.textContent).toContain(
      t('place.manual').replace('{place}', 'Donostia-San Sebastián'),
    )
    expect(saved().manualPlace?.name).toBe('Donostia-San Sebastián')
  })

  it('says so when no town with a station matches', async () => {
    mocks.getOnce.mockRejectedValue(DENIED)
    const root = await boot()
    await search(root, 'Zzzz')
    expect(root.querySelectorAll('.place-search__option')).toHaveLength(0)
    expect(root.querySelector('.place-search [role="status"]')!.textContent).toBe(
      t('place.search.none').replace('{query}', 'Zzzz'),
    )
  })
})

describe('a town picked by hand', () => {
  it('survives a reload without asking for the location again', async () => {
    const root = await boot({ manualPlace: DONOSTIA })
    expect(mocks.getOnce).not.toHaveBeenCalled()
    expect(mocks.fetchProvince).toHaveBeenCalledWith('20')
    expect(root.querySelector('.place-strip')!.textContent).toContain('Donostia-San Sebastián')
  })

  it('goes back to GPS from the strip, and forgets the town once GPS answers', async () => {
    const root = await boot({ manualPlace: DONOSTIA })
    mocks.getOnce.mockResolvedValue(BILBAO)
    byText<HTMLButtonElement>(root, '.place-strip button', t('place.useGps')).click()
    await flush()

    expect(mocks.fetchProvince).toHaveBeenLastCalledWith('48')
    expect(root.querySelector('.place-strip')).toBeNull()
    expect(saved().manualPlace).toBeUndefined()
  })

  it('keeps the town when GPS still fails, and says why', async () => {
    const root = await boot({ manualPlace: DONOSTIA })
    mocks.getOnce.mockRejectedValue(DENIED)
    byText<HTMLButtonElement>(root, '.place-strip button', t('place.useGps')).click()
    await flush()

    expect(root.querySelector('.place-strip')).not.toBeNull()
    expect(saved().manualPlace?.name).toBe('Donostia-San Sebastián')
    expect(root.querySelector('[data-error]')!.textContent).toContain(t('error.location.denied'))
  })
})

describe('prices that cannot load', () => {
  it('offers the bundled radars and takes the user to them on the map', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
    const root = await boot()
    const notice = root.querySelector<HTMLElement>('[data-view] .notice')!
    expect(notice.dataset.tone).toBe('error')

    byText<HTMLButtonElement>(notice, 'button', t('radar.offline.offer')).click()
    await flush()

    expect(root.querySelector('[data-tab="map"]')!.getAttribute('aria-current')).toBe('page')
    expect(root.querySelector('[data-view] .radar-list')).not.toBeNull()
  })

  it('turns the radar layer on when the offer is taken with it off', async () => {
    mocks.getOnce.mockResolvedValue(BILBAO)
    mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
    const root = await boot({ radarLayerEnabled: false, servicesLayerEnabled: false })
    byText<HTMLButtonElement>(root, '[data-view] .notice button', t('radar.offline.offer')).click()
    await flush()
    expect(root.querySelector('[data-view] .radar-list')).not.toBeNull()
  })
})
