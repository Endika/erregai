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
const SETTINGS_KEY = 'erregai.settings'
const FIRST_RUN_KEY = 'erregai.firstRunDone'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

function permission(state: PermissionState | undefined): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: state === undefined ? undefined : { query: async () => ({ state }) },
  })
}

async function boot(storage: Record<string, string> = {}): Promise<HTMLElement> {
  vi.resetModules()
  localStorage.clear()
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v)
  Object.defineProperty(navigator, 'language', { configurable: true, value: 'es-ES' })
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const intro = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-view] .first-run')

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const el = [...root.querySelectorAll<HTMLButtonElement>('.first-run button')].find(
    (b) => b.textContent === label,
  )
  if (!el) throw new Error(`no first-run button "${label}"`)
  return el
}

beforeEach(() => {
  mocks.getOnce.mockReset()
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockReset()
  mocks.fetchProvince.mockResolvedValue({ fecha: '01/10/2026 08:00:00', stations: [] })
  permission(undefined)
})

describe('first run', () => {
  it('explains the location use before the browser asks for it', async () => {
    const root = await boot()
    const screen = intro(root)!
    expect(screen).not.toBeNull()
    expect(mocks.getOnce).not.toHaveBeenCalled()
    expect(screen.textContent).toContain(t('firstRun.body'))
    expect(t('firstRun.body')).toBe(
      'Tu ubicación se usa solo en este dispositivo, para encontrar las gasolineras cercanas.',
    )
    expect(button(root, 'Usar mi ubicación')).toBeTruthy()
    expect(button(root, 'Elegir municipio')).toBeTruthy()
  })

  it('asks for the location from the primary button and never shows the screen again', async () => {
    const root = await boot()
    button(root, 'Usar mi ubicación').click()
    await flush()
    expect(mocks.getOnce).toHaveBeenCalledTimes(1)
    expect(intro(root)).toBeNull()
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('1')

    const again = await boot({ [FIRST_RUN_KEY]: '1' })
    expect(intro(again)).toBeNull()
    expect(mocks.getOnce).toHaveBeenCalledTimes(2)
  })

  it('opens the town search from the secondary button and uses the town picked', async () => {
    const root = await boot()
    button(root, 'Elegir municipio').click()
    const input = root.querySelector<HTMLInputElement>('.first-run .place-search input')!
    expect(document.activeElement).toBe(input)
    input.value = 'Donostia'
    input.dispatchEvent(new Event('input'))
    await vi.waitFor(() => {
      if (!root.querySelector('.place-search__option')) throw new Error('town list not loaded')
    })
    root.querySelector<HTMLButtonElement>('.place-search__option')!.click()
    await flush()
    expect(mocks.getOnce).not.toHaveBeenCalled()
    expect(intro(root)).toBeNull()
    expect(root.querySelector('.place-strip')!.textContent).toContain('Donostia')
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('1')
  })

  it('locates straight away when the permission is already granted', async () => {
    permission('granted')
    const root = await boot()
    expect(intro(root)).toBeNull()
    expect(mocks.getOnce).toHaveBeenCalledTimes(1)
  })

  it('goes straight to the refusal and its town search when the permission is denied', async () => {
    permission('denied')
    mocks.getOnce.mockRejectedValue(Object.assign(new Error('denied'), { code: 1 }))
    const root = await boot()
    expect(intro(root)).toBeNull()
    expect(root.querySelector('.notice .place-search')).not.toBeNull()
  })

  it('still explains first when the browser would prompt', async () => {
    permission('prompt')
    const root = await boot()
    expect(intro(root)).not.toBeNull()
    expect(mocks.getOnce).not.toHaveBeenCalled()
  })

  it('skips the screen for someone who used the app before this release', async () => {
    const root = await boot({ [SETTINGS_KEY]: JSON.stringify({ fuel: 'gasoleoA' }) })
    expect(intro(root)).toBeNull()
    expect(mocks.getOnce).toHaveBeenCalledTimes(1)
  })
})
