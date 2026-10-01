// @vitest-environment jsdom
import { renderDetail } from '../src/ui/detail'
import { setLocale } from '../src/i18n'
import { priceReference } from '../src/core/pricing'
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
  const reference = priceReference(nearby, 'gasoleoA')

  // The visible line drops the "Dirección:" prefix the pin already says; a
  // screen reader still hears it, and the Ministerio's capitals become readable.
  it('shows the address in readable case under a pin, labelled for readers', () => {
    const el = render({ ...target, address: 'POLIGONO GRANADA, S/N', town: 'Ortuella' })
    const line = el.querySelector('.station-detail__address')!
    expect(line.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(line.querySelector('.visually-hidden')?.textContent).toBe('Dirección: ')
    expect(line.textContent).toBe('Dirección: Poligono Granada, S/N, Ortuella')
  })

  it('shows the published schedule readably, labelled for readers', () => {
    const el = render(target)
    const line = el.querySelector('.station-detail__schedule')!
    expect(line.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(line.querySelector('.visually-hidden')?.textContent).toBe('Horario: ')
    expect(line.textContent).toBe('Horario: L-D: 24 h Abierto ahora')
  })

  it('leads with the selected fuel price, its band and the distance', () => {
    const el = render(target, { fuel: 'gasoleoA', origin, reference })
    const lead = el.querySelector('.station-detail__lead')
    expect(lead?.getAttribute('data-band')).toBe('cheap')
    expect(lead?.querySelector('.station-detail__lead-fuel')?.textContent).toBe('Gasóleo A')
    expect(lead?.querySelector('.station-detail__lead-price')?.textContent).toContain('1,400')
    expect(lead?.querySelector('.station-detail__band')?.textContent).toBe('Barata')
    expect(lead?.querySelector('.station-detail__distance')?.textContent).toBe('1,0 km')
  })

  it('says how far the price sits from the reference average, in céntimos', () => {
    // Mean of 1,40 1,50 1,60 1,70 is 1,55: 15 céntimos below.
    const el = render(target, { fuel: 'gasoleoA', origin, reference })
    expect(el.querySelector('.station-detail__delta')?.textContent).toBe(
      '\u221215 cént. frente a la media',
    )
    const dear = render(station('d', { gasoleoA: 1.7 }), { fuel: 'gasoleoA', origin, reference })
    expect(dear.querySelector('.station-detail__delta')?.textContent).toBe(
      '+15 cént. frente a la media',
    )
  })

  it('hides the comparison when fewer than three prices make the average', () => {
    const thin = priceReference(nearby.slice(0, 2), 'gasoleoA')
    const el = render(target, { fuel: 'gasoleoA', origin, reference: thin })
    expect(el.querySelector('.station-detail__band')?.textContent).toBe('Barata')
    expect(el.querySelector('.station-detail__delta')).toBeNull()
  })

  it('claims no band when there is nothing to compare against', () => {
    const el = render(target, { fuel: 'gasoleoA', origin })
    expect(el.querySelector('.station-detail__lead')?.hasAttribute('data-band')).toBe(false)
    expect(el.querySelector('.station-detail__band')).toBeNull()
    expect(el.querySelector('.station-detail__delta')).toBeNull()
  })

  it('puts the directions action right after the lead price, keeping the maps link', () => {
    const el = render(target, { fuel: 'gasoleoA', origin, reference })
    const lead = el.querySelector('.station-detail__lead')
    const action = el.querySelector<HTMLAnchorElement>('a.station-detail__directions')
    expect(action?.textContent).toBe('Cómo llegar')
    expect(action?.getAttribute('href')).toMatch(/^(geo:|https:\/\/maps\.apple\.com)/)
    expect(lead?.nextElementSibling).toBe(action)
  })

  it('folds only the other priced fuels behind a closed disclosure', () => {
    const el = render(target, { fuel: 'gasoleoA', origin, reference })
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
    const el = render(station('b', { gasoleoA: 1.5 }), { fuel: 'gasoleoA', origin, reference })
    expect(el.querySelector('.station-detail__others')).toBeNull()
  })

  it('says so when the station does not sell the selected fuel', () => {
    const el = render(station('e', { gasolina95: 1.6 }), { fuel: 'gasoleoA', origin, reference })
    const lead = el.querySelector('.station-detail__lead')
    expect(lead?.hasAttribute('data-band')).toBe(false)
    expect(lead?.textContent).toContain('Sin precio')
    expect(el.querySelector('.station-detail__band')).toBeNull()
    expect(el.querySelector('.station-detail__delta')).toBeNull()
  })

  it('lists every priced fuel openly when no fuel is selected', () => {
    const el = render(target)
    expect(el.querySelector('.station-detail__lead')).toBeNull()
    expect(el.querySelector('details')).toBeNull()
    expect(el.querySelectorAll('.station-detail__price-row').length).toBe(3)
    expect(el.querySelector('a.station-detail__directions')).not.toBeNull()
  })
})
