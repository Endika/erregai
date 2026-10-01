// @vitest-environment jsdom
import { vi } from 'vitest'
import type { LatLon } from '../src/core/geo'
import type { Station } from '../src/core/station'
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
    focus(): void {}
    panTo(): void {}
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

async function boot(): Promise<HTMLElement> {
  // jsdom has no layout; the list scrolls the selected row into view.
  Element.prototype.scrollIntoView = () => {}
  mocks.getOnce.mockResolvedValue(BILBAO)
  mocks.fetchProvince.mockResolvedValue({
    fecha: '01/10/2026 08:00:00',
    stations: [station('1', 43.27, 1.3), station('2', 43.28, 1.4)],
  })
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('erregai.settings', JSON.stringify({ locale: 'es', fuel: 'gasoleoA' }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main')
  await flush()
  return document.getElementById('app')!
}

const row = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLButtonElement>(`[data-view] [data-station="${id}"]`)!

describe('station card focus', () => {
  it('moves to the card heading when the card opens', async () => {
    const root = await boot()
    row(root, '2').focus()
    row(root, '2').click()
    const heading = root.querySelector<HTMLElement>('[data-card] .station-detail__brand')!
    expect(document.activeElement).toBe(heading)
    expect(heading.textContent).toBe('Brand 2')
  })

  it('stays put when the open card is merely redrawn', async () => {
    const root = await boot()
    row(root, '1').click()
    const close = root.querySelector<HTMLButtonElement>('[data-card] .detail-card__close')!
    close.focus()
    root.querySelector<HTMLButtonElement>('[data-tab="list"]')!.click()
    expect(document.activeElement?.classList.contains('detail-card__close')).toBe(true)
  })

  it('returns to the row it came from on close', async () => {
    const root = await boot()
    row(root, '2').click()
    root.querySelector<HTMLButtonElement>('[data-card] .detail-card__close')!.click()
    expect(root.querySelector<HTMLElement>('[data-card]')!.hidden).toBe(true)
    expect(document.activeElement).toBe(row(root, '2'))
  })

  it('names the close control for what it does', async () => {
    const root = await boot()
    row(root, '1').click()
    const close = root.querySelector('[data-card] .detail-card__close')!
    expect(close.getAttribute('aria-label')).toBe(t('nav.close'))
    expect(t('nav.close')).toBe('Cerrar')
  })
})
