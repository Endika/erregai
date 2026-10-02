// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
  fits: 0,
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
    fitRadius(): void {
      mocks.fits++
    }
    raiseRadars(): void {}
    focus(): void {}
    panTo(): void {}
  },
}))
vi.mock('../src/ui/trip', () => ({
  TripController: class {
    isActive = false
    currentUpdate = undefined
    render(container: HTMLElement): void {
      container.replaceChildren(Object.assign(document.createElement('div'), { className: 'x' }))
    }
    stationsForMap<T>(s: T): T {
      return s
    }
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

let crossTo: (desktop: boolean) => void = () => {}

function stubMatchMedia(initial: boolean): void {
  const listeners: ((e: { matches: boolean }) => void)[] = []
  const query = {
    matches: initial,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
  }
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia
  crossTo = (matches) => {
    query.matches = matches
    for (const l of listeners) l({ matches })
  }
}

async function boot(desktop: boolean): Promise<HTMLElement> {
  Element.prototype.scrollIntoView = () => {}
  stubMatchMedia(desktop)
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockResolvedValue({
    fecha: '01/10/2026 08:00:00',
    stations: [station('1', 43.27, 1.3), station('2', 43.28, 1.4)],
  })
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('erregai.firstRunDone', '1')
  localStorage.setItem('erregai.settings', JSON.stringify({ locale: 'es', fuel: 'gasoleoA' }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const tab = (root: HTMLElement, name: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-tab="${name}"]`)!
const row = (root: HTMLElement, id: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-view] [data-station="${id}"]`)!

beforeEach(() => {
  mocks.fits = 0
})

afterEach(() => {
  // @ts-expect-error jsdom has no matchMedia of its own; drop the stub.
  delete window.matchMedia
})

describe('desktop shell', () => {
  it('puts the nav in the header, ahead of the view, with the current tab marked', async () => {
    const root = await boot(true)
    const nav = root.querySelector('nav.tab-bar')!
    expect(nav.parentElement?.classList.contains('app-header')).toBe(true)
    expect(tab(root, 'list').getAttribute('aria-current')).toBe('page')
    tab(root, 'settings').click()
    expect(tab(root, 'settings').getAttribute('aria-current')).toBe('page')
    expect(tab(root, 'list').hasAttribute('aria-current')).toBe(false)
  })

  it('shows List beside the map, list pane first, and frames the radius', async () => {
    const root = await boot(true)
    const split = root.querySelector('[data-view] > .map-split')!
    expect([...split.children].map((c) => c.className)).toEqual([
      'map-split__list',
      'map-split__map',
    ])
    expect(split.querySelector('.map-split__list [data-station="1"]')).not.toBeNull()
    expect(mocks.fits).toBe(1)
  })

  it('opens the card in place of the list pane, and keeps the rows out of focus behind it', async () => {
    const root = await boot(true)
    row(root, '2').click()
    const card = root.querySelector<HTMLElement>('[data-card]')!
    expect(card.hidden).toBe(false)
    expect(card.dataset.host).toBe('pane')
    expect(root.querySelector<HTMLElement>('.map-split__list')!.inert).toBe(true)

    card.querySelector<HTMLButtonElement>('.detail-card__close')!.click()
    expect(root.querySelector<HTMLElement>('.map-split__list')!.inert).toBe(false)
    expect(document.activeElement).toBe(row(root, '2'))
  })

  it('keeps the list pane’s scroll when a row opens the card', async () => {
    // jsdom has no layout, so scrollTop is a no-op there; give elements a real one.
    const own = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!
    const tops = new WeakMap<Element, number>()
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get(this: Element) {
        return tops.get(this) ?? 0
      },
      set(this: Element, v: number) {
        tops.set(this, v)
      },
    })
    try {
      const root = await boot(true)
      const before = root.querySelector('.map-split__list')!
      before.scrollTop = 320
      row(root, '2').click()
      const after = root.querySelector('.map-split__list')!
      expect(after).not.toBe(before)
      expect(after.scrollTop).toBe(320)
      tab(root, 'map').click()
      expect(root.querySelector('.map-split__list')!.scrollTop).toBe(0)
    } finally {
      Object.defineProperty(Element.prototype, 'scrollTop', own)
    }
  })

  it('floats the card over the map on Trip, with the readout as the pane before it', async () => {
    const root = await boot(true)
    row(root, '1').click()
    tab(root, 'trip').click()
    const view = root.querySelector('[data-view]')!
    expect([...view.children].map((c) => c.className)).toEqual(['trip-readout', 'trip-map'])
    expect(root.querySelector<HTMLElement>('[data-card]')!.dataset.host).toBe('overlay')
  })

  it('moves back to the phone layout when the window narrows', async () => {
    const root = await boot(true)
    crossTo(false)
    expect(root.lastElementChild?.matches('nav.tab-bar')).toBe(true)
    expect(root.querySelector('[data-view] > .map-split')).toBeNull()
    expect(root.querySelector('[data-view] > .sort-bar')).not.toBeNull()
  })
})

describe('phone shell', () => {
  it('keeps the bottom bar, the plain list and the bottom sheet', async () => {
    const root = await boot(false)
    expect(root.lastElementChild?.matches('nav.tab-bar')).toBe(true)
    expect(root.querySelector('[data-view] > .map-split')).toBeNull()
    expect(mocks.fits).toBe(0)
    row(root, '1').click()
    expect(root.querySelector<HTMLElement>('[data-card]')!.dataset.host).toBe('sheet')
    tab(root, 'trip').click()
    const view = root.querySelector('[data-view]')!
    expect([...view.children].map((c) => c.className)).toEqual(['trip-map', 'trip-readout'])
  })
})
