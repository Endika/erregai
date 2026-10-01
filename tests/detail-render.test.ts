// @vitest-environment jsdom
import { renderDetail } from '../src/ui/detail'
import { setLocale } from '../src/i18n'
import type { Station } from '../src/core/station'

const station = (id: string, prices: Station['prices'], lat = 43.263): Station => ({
  id,
  brand: 'REPSOL',
  name: 'REPSOL',
  pos: { lat, lon: -2.935 },
  address: 'Calle X',
  town: 'Bilbao',
  schedule: 'L-D: 24H',
  prices,
})

const origin = { lat: 43.263, lon: -2.935 }
const wednesday = new Date(2026, 0, 7, 12, 0)

const render = (s: Station, context?: Parameters<typeof renderDetail>[3]): HTMLElement => {
  const el = document.createElement('div')
  renderDetail(el, s, wednesday, context)
  return el
}

beforeEach(() => setLocale('es'))

describe('station detail card', () => {
  const target = station('a', { gasoleoA: 1.4, gasolina95: 1.6, glp: 0.9 }, 43.272)
  const nearby = [
    target,
    station('b', { gasoleoA: 1.5 }),
    station('c', { gasoleoA: 1.6 }),
    station('d', { gasoleoA: 1.7 }),
  ]

  it('leads with the selected fuel price, its band and the distance', () => {
    const el = render(target, { fuel: 'gasoleoA', origin, nearby })
    const lead = el.querySelector('.station-detail__lead')
    expect(lead?.getAttribute('data-band')).toBe('cheap')
    expect(lead?.querySelector('.station-detail__lead-fuel')?.textContent).toBe('Gasóleo A')
    expect(lead?.querySelector('.station-detail__lead-price')?.textContent).toContain('1,400')
    expect(lead?.querySelector('.station-detail__band')?.textContent).toBe('Barata')
    expect(lead?.querySelector('.station-detail__distance')?.textContent).toBe('1,0 km')
  })

  it('puts the directions action right after the lead price, keeping the maps link', () => {
    const el = render(target, { fuel: 'gasoleoA', origin, nearby })
    const lead = el.querySelector('.station-detail__lead')
    const action = el.querySelector<HTMLAnchorElement>('a.station-detail__directions')
    expect(action?.textContent).toBe('Cómo llegar')
    expect(action?.getAttribute('href')).toMatch(/^(geo:|https:\/\/maps\.apple\.com)/)
    expect(lead?.nextElementSibling).toBe(action)
  })

  it('folds only the other priced fuels behind a closed disclosure', () => {
    const el = render(target, { fuel: 'gasoleoA', origin, nearby })
    const others = el.querySelector('details.station-detail__others')
    expect(others?.hasAttribute('open')).toBe(false)
    expect(others?.querySelector('summary')?.textContent).toBe('Otros combustibles (2)')
    const labels = [...el.querySelectorAll('.station-detail__price-label')].map(
      (n) => n.textContent,
    )
    expect(labels).toEqual(['Gasolina 95', 'GLP'])
    expect(el.textContent).not.toContain('—')
  })

  it('omits the disclosure when the selected fuel is the only one priced', () => {
    const el = render(station('b', { gasoleoA: 1.5 }), { fuel: 'gasoleoA', origin, nearby })
    expect(el.querySelector('.station-detail__others')).toBeNull()
  })

  it('says so when the station does not sell the selected fuel', () => {
    const el = render(station('e', { gasolina95: 1.6 }), { fuel: 'gasoleoA', origin, nearby })
    const lead = el.querySelector('.station-detail__lead')
    expect(lead?.hasAttribute('data-band')).toBe(false)
    expect(lead?.textContent).toContain('Sin precio')
    expect(el.querySelector('.station-detail__band')).toBeNull()
  })

  it('lists every priced fuel openly when no fuel is selected', () => {
    const el = render(target)
    expect(el.querySelector('.station-detail__lead')).toBeNull()
    expect(el.querySelector('details')).toBeNull()
    expect(el.querySelectorAll('.station-detail__price-row').length).toBe(3)
    expect(el.querySelector('a.station-detail__directions')).not.toBeNull()
  })
})
