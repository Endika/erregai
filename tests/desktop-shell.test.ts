// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'

const mocks = vi.hoisted(() => ({
  getOnce: vi.fn<() => Promise<LatLon>>(),
  fetchProvince: vi.fn(),
  fits: 0,
  radars: 0,
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
    renderRadars(radars: readonly unknown[]): void {
      mocks.radars = radars.length
    }
    clearRadars(): void {
      mocks.radars = 0
    }
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
  schedule: 'L-D: 24H',
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

async function boot(desktop: boolean, saved: object = {}): Promise<HTMLElement> {
  Element.prototype.scrollIntoView = () => {}
  stubMatchMedia(desktop)
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockResolvedValue({
    fecha: '01/10/2026 08:00:00',
    stations: [station('1', 43.27, 1.3), station('2', 43.28, 1.4)],
  })
  vi.resetModules()
  localStorage.clear()
  window.sessionStorage.clear()
  localStorage.setItem('erregai.firstRunDone', '1')
  localStorage.setItem(
    'erregai.settings',
    JSON.stringify({ locale: 'es', fuel: 'gasoleoA', ...saved }),
  )
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const tab = (root: HTMLElement, name: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-tab="${name}"]`)!
const row = (root: HTMLElement, id: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-view] [data-station="${id}"]`)!

const visibleTabs = (root: HTMLElement): string[] =>
  [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')]
    .filter((b) => !b.hidden)
    .map((b) => b.textContent!)
const current = (root: HTMLElement): string | undefined =>
  root.querySelector<HTMLElement>('[data-tab][aria-current="page"]')?.dataset.tab
const pane = (root: HTMLElement): HTMLElement => root.querySelector('.map-split__list')!
const option = (root: HTMLElement, view: 'stations' | 'radars'): HTMLInputElement =>
  root.querySelector<HTMLInputElement>(`.pane-switch input[value="${view}"]`)!
const pick = (input: HTMLInputElement): void => {
  input.checked = true
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  mocks.fits = 0
  mocks.radars = 0
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
      tab(root, 'trip').click()
      tab(root, 'list').click()
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

describe('desktop stations view', () => {
  it('has three tabs, Gasolineras in place of List and Map, with the current one marked', async () => {
    const root = await boot(true)
    expect(visibleTabs(root)).toEqual(['Gasolineras', 'Viaje', 'Ajustes'])
    expect(tab(root, 'map').hidden).toBe(true)
    expect(current(root)).toBe('list')
    tab(root, 'trip').click()
    expect(current(root)).toBe('trip')
    expect(root.querySelectorAll('[aria-current]')).toHaveLength(1)
  })

  it('leads the pane with the switch, then the sort bar, the answer, the legend and the list', async () => {
    const root = await boot(true)
    const order = [...pane(root).children].map((c) => c.className.split(' ')[0])
    expect(order).toEqual(['pane-switch', 'sort-bar', 'answer-card', 'band-legend', ''])
    expect(pane(root).lastElementChild!.querySelector('[data-station="1"]')).not.toBeNull()
    expect(option(root, 'stations').checked).toBe(true)
    expect(pane(root).querySelector('.radar-list')).toBeNull()
  })

  it('shows only the radars when Radares is picked, keeping both map layers', async () => {
    const root = await boot(true)
    const radars = option(root, 'radars')
    const listed = Number(/\((\d+)\)/.exec(radars.labels![0].textContent!)![1])
    expect(listed).toBeGreaterThan(0)
    pick(radars)
    const children = [...pane(root).children].map((c) => c.className)
    expect(children).toEqual(['pane-switch', 'radar-list'])
    expect(pane(root).querySelectorAll('.radar-list__row')).toHaveLength(listed)
    expect(mocks.radars).toBeGreaterThan(0)
    expect(document.activeElement).toBe(option(root, 'radars'))
    pick(option(root, 'stations'))
    expect(pane(root).querySelector('[data-station="1"]')).not.toBeNull()
  })

  it('lands on Gasolineras when the window widens from Map, and back on Map when it narrows', async () => {
    const root = await boot(false)
    tab(root, 'map').click()
    crossTo(true)
    expect(current(root)).toBe('list')
    expect(visibleTabs(root)).toEqual(['Gasolineras', 'Viaje', 'Ajustes'])
    expect(pane(root).previousElementSibling).toBeNull()
    crossTo(false)
    expect(current(root)).toBe('map')
    expect(visibleTabs(root)).toEqual(['Lista', 'Mapa', 'Viaje', 'Ajustes'])
    expect(root.querySelector('.map-split')!.firstElementChild!.className).toBe('map-split__map')
  })

  it('narrows back to List when List was the last stations tab on the phone', async () => {
    const root = await boot(false)
    tab(root, 'map').click()
    tab(root, 'list').click()
    crossTo(true)
    crossTo(false)
    expect(current(root)).toBe('list')
    expect(root.querySelector('[data-view] > .sort-bar')).not.toBeNull()
  })

  it('keeps Trip and Settings across the breakpoint both ways', async () => {
    const root = await boot(false)
    tab(root, 'trip').click()
    crossTo(true)
    expect(current(root)).toBe('trip')
    tab(root, 'settings').click()
    crossTo(false)
    expect(current(root)).toBe('settings')
  })

  it('takes the offline radar offer to the radars in the stations view, layer on', async () => {
    vi.resetModules()
    const fresh = await bootFailing()
    const offer = [...fresh.querySelectorAll<HTMLButtonElement>('[data-view] .notice button')].find(
      (b) => b.textContent === 'Ver radares (funcionan sin conexión)',
    )!
    offer.click()
    await flush()
    expect(current(fresh)).toBe('list')
    expect(option(fresh, 'radars').checked).toBe(true)
    expect(pane(fresh).querySelector('.radar-list__row')).not.toBeNull()
    expect(mocks.radars).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem('erregai.settings')!).radarLayerEnabled).toBe(true)
  })
})

async function bootFailing(): Promise<HTMLElement> {
  stubMatchMedia(true)
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
  localStorage.clear()
  window.sessionStorage.clear()
  localStorage.setItem('erregai.firstRunDone', '1')
  localStorage.setItem(
    'erregai.settings',
    JSON.stringify({ locale: 'es', radarLayerEnabled: false, servicesLayerEnabled: false }),
  )
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

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

  it('keeps the four tabs and a List with no switch', async () => {
    const root = await boot(false)
    expect(visibleTabs(root)).toEqual(['Lista', 'Mapa', 'Viaje', 'Ajustes'])
    expect(current(root)).toBe('list')
    expect(root.querySelector('.pane-switch')).toBeNull()
    const view = root.querySelector('[data-view]')!
    expect([...view.children].map((c) => c.className.split(' ')[0])).toEqual([
      'sort-bar',
      'answer-card',
      'band-legend',
      '',
    ])
  })

  it('puts the switch right under the map, stations first, radars on demand', async () => {
    const root = await boot(false)
    tab(root, 'map').click()
    const split = root.querySelector('.map-split')!
    expect([...split.children].map((c) => c.className)).toEqual([
      'map-split__map',
      'map-split__list',
    ])
    expect([...pane(root).children].map((c) => c.className.split(' ')[0])).toEqual([
      'pane-switch',
      'sort-bar',
      'band-legend',
      '',
    ])
    pick(option(root, 'radars'))
    expect([...pane(root).children].map((c) => c.className)).toEqual(['pane-switch', 'radar-list'])
  })

  it('remembers the picked view for the session, across tabs and reloads', async () => {
    const root = await boot(false)
    tab(root, 'map').click()
    pick(option(root, 'radars'))
    tab(root, 'list').click()
    tab(root, 'map').click()
    expect(option(root, 'radars').checked).toBe(true)
    vi.resetModules()
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    await flush()
    const again = document.getElementById('app')!
    tab(again, 'map').click()
    expect(option(again, 'radars').checked).toBe(true)
  })

  it('takes the offline radar offer to Map with Radares picked', async () => {
    const root = await bootFailingPhone()
    const offer = [...root.querySelectorAll<HTMLButtonElement>('[data-view] .notice button')].find(
      (b) => b.textContent === 'Ver radares (funcionan sin conexión)',
    )!
    offer.click()
    await flush()
    expect(current(root)).toBe('map')
    expect(option(root, 'radars').checked).toBe(true)
    expect(pane(root).querySelector('.radar-list__row')).not.toBeNull()
  })
})

async function bootFailingPhone(): Promise<HTMLElement> {
  stubMatchMedia(false)
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockRejectedValue(new Error('Failed to fetch'))
  vi.resetModules()
  localStorage.clear()
  window.sessionStorage.clear()
  localStorage.setItem('erregai.firstRunDone', '1')
  localStorage.setItem('erregai.settings', JSON.stringify({ locale: 'es' }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}
