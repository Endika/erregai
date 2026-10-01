// @vitest-environment jsdom
import { renderBandLegend, renderList } from '../src/ui/list'
import { renderRadarList } from '../src/ui/radar-list'
import { setLocale } from '../src/i18n'
import type { RadarHit } from '../src/core/radars'
import type { Station } from '../src/core/station'

const s = (id: string, price: number): Station => ({
  id,
  brand: 'REPSOL',
  name: 'REPSOL',
  pos: { lat: 40, lon: -3 },
  address: '',
  town: 'Madrid',
  schedule: '',
  prices: { gasoleoA: price },
})

describe('renderList', () => {
  it('renders a row per station with band attribute and price', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.2), s('2', 1.6)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const rows = el.querySelectorAll('[data-station]')
    expect(rows.length).toBe(2)
    expect(el.textContent).toContain('1,200')
    expect(rows[0].getAttribute('data-band')).toBe('cheap')
  })

  it('formats prices and distances for the active locale', () => {
    const el = document.createElement('div')
    const far = { ...s('1', 1.739), pos: { lat: 40.0112, lon: -3 } }
    setLocale('en')
    renderList(el, [far], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    expect(el.querySelector('.station-row__price')?.textContent).toBe('1.739')
    expect(el.querySelector('.station-row__distance')?.textContent).toBe('1.2 km')
    setLocale('eu')
    renderList(el, [far], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    expect(el.querySelector('.station-row__price')?.textContent).toBe('1,739')
    expect(el.querySelector('.station-row__distance')?.textContent).toBe('1,2 km')
    setLocale('es')
  })

  it('voices the price followed by its band, not the band alone', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.739), s('2', 1.9)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const price = el.querySelector('.station-row__price')!
    expect(price.getAttribute('aria-label')).toBe('1,739 €/l, barata')
    expect(price.getAttribute('title')).toBe('Barata')
  })
})

describe('renderBandLegend', () => {
  it('names the reference the colours compare against, then the three bands', () => {
    setLocale('es')
    const el = renderBandLegend(15)
    expect(el.querySelector('.band-legend__scope')?.textContent).toBe('En tu radio de 15 km:')
    const items = [...el.querySelectorAll<HTMLElement>('.legend__item')]
    expect(items.map((i) => i.dataset.band)).toEqual(['cheap', 'mid', 'expensive'])
    expect(el.textContent).toBe('En tu radio de 15 km: Barata Media Cara')
  })

  it('follows the locale and the radius', () => {
    setLocale('en')
    expect(renderBandLegend(50).textContent).toBe('Within your 50 km radius: Cheap Mid Expensive')
    setLocale('es')
  })
})

describe('renderRadarList', () => {
  const hit = (id: string, distanceKm: number): RadarHit =>
    ({ radar: { id, via: `N-${id}`, lat: 0, lon: 0 }, distanceKm }) as RadarHit

  it('shows metres under a kilometre and kilometres from there on', () => {
    setLocale('es')
    const el = renderRadarList([hit('1', 0.42), hit('2', 1.26)], 'radar.list.title', 5)
    const distances = [...el.querySelectorAll('.radar-list__distance')].map((d) => d.textContent)
    expect(distances).toEqual(['420 m', '1,3 km'])
  })
  it('marks each row with the camera glyph the map uses for radars, hidden from readers', () => {
    const el = renderRadarList([hit('1', 0.42), hit('2', 1.26)], 'radar.list.title', 5)
    const rows = [...el.querySelectorAll('.radar-list__row')]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const icon = row.firstElementChild!
      expect(icon.classList.contains('radar-list__icon')).toBe(true)
      expect(icon.getAttribute('aria-hidden')).toBe('true')
      expect(icon.querySelector('svg.map-glyph')).not.toBeNull()
    }
  })
})
