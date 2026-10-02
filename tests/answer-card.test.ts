// @vitest-environment jsdom
import { renderAnswerCard } from '../src/ui/answer-card'
import { bestChoice, type BestChoice } from '../src/core/best-choice'
import { priceReference } from '../src/core/pricing'
import { setLocale } from '../src/i18n'
import type { Station } from '../src/core/station'

const KM_PER_DEG = 6371 * (Math.PI / 180)
const origin = { lat: 43, lon: -3 }
const noon = new Date(2026, 0, 7, 12, 0)

const at = (id: string, brand: string, km: number, price: number, schedule = 'L-D: 24H') =>
  ({
    id,
    brand,
    name: brand,
    pos: { lat: 43 + km / KM_PER_DEG, lon: -3 },
    address: '',
    town: 'Bilbao',
    schedule,
    prices: { gasoleoA: price },
  }) satisfies Station

const nearby = [
  at('n', 'GALP', 1, 1.379),
  at('r', 'REPSOL', 1.5, 1.289),
  at('c', 'CEPSA', 2, 1.459),
  at('b', 'BP', 3, 1.499),
]
const reference = priceReference(nearby, 'gasoleoA')

const render = (choice: BestChoice, onSelect: (s: Station) => void = () => {}) =>
  renderAnswerCard(choice, { fuel: 'gasoleoA', reference, tankLitres: 50, onSelect })

const winner = () => bestChoice(nearby, 'gasoleoA', origin, 50, noon)!

beforeEach(() => setLocale('es'))

describe('answer card', () => {
  it('names itself with the station, its price and the saving', () => {
    // Intl puts a no-break space before the euro sign.
    // (1,379 − 1,289) × 50 − 0,5 × 2 × 0,065 × 1,289 = 4,50 − 0,08 = 4,42 €
    const card = render(winner())
    expect(card.tagName).toBe('SECTION')
    expect(card.getAttribute('aria-label')).toBe(
      'Mejor opción: REPSOL, 1,289 €/l, te ahorras 4,42\u00a0€',
    )
  })

  it('shows the brand, the banded price, the saving, the distance and that it is open', () => {
    const card = render(winner())
    expect(card.querySelector('.answer-card__brand')?.textContent).toBe('REPSOL')
    const lead = card.querySelector('.answer-card__figures')!
    expect(lead.getAttribute('data-band')).toBe('cheap')
    expect(card.querySelector('.answer-card__price')?.textContent).toBe('1,289 €/l')
    expect(card.querySelector('.answer-card__band')?.textContent).toBe('Barata')
    expect(card.querySelector('.answer-card__saving')?.textContent).toBe(
      'Te ahorras 4,42\u00a0€ en 50 l',
    )
    expect(card.querySelector('.answer-card__distance')?.textContent).toBe('1,5 km en línea recta')
    const status = card.querySelector('.answer-card__status')!
    expect(status.textContent).toBe('Abierta ahora')
    expect(status.getAttribute('data-schedule')).toBe('open')
  })

  it('prices the saving on the tank from the settings', () => {
    const choice = bestChoice(nearby, 'gasoleoA', origin, 30, noon)!
    const card = renderAnswerCard(choice, {
      fuel: 'gasoleoA',
      reference,
      tankLitres: 30,
      onSelect: () => {},
    })
    expect(card.querySelector('.answer-card__saving')?.textContent).toBe(
      'Te ahorras 2,62\u00a0€ en 30 l',
    )
  })

  it('says the nearest is already a good choice when nothing beats it', () => {
    const choice = bestChoice(nearby.slice(1), 'gasoleoA', origin, 50, noon)!
    expect(choice.kind).toBe('nearest')
    const card = render(choice)
    expect(card.querySelector('.answer-card__saving')?.textContent).toBe(
      'La más cercana ya es buena opción',
    )
    expect(card.getAttribute('aria-label')).toBe('Mejor opción: REPSOL, 1,289 €/l')
  })

  it('gives no saving figure for the only open station', () => {
    const choice = bestChoice([nearby[2]], 'gasoleoA', origin, 50, noon)!
    const card = render(choice)
    expect(card.textContent).not.toContain('Te ahorras')
    expect(card.querySelector('.answer-card__saving')?.textContent).toBe(
      'La única abierta en tu radio',
    )
  })

  it('warns when the answer closes soon instead of calling it open', () => {
    const late = new Date(2026, 0, 7, 21, 40)
    const closing = [nearby[0], { ...nearby[1], schedule: 'L-D: 07:00-22:00' }]
    const card = render(bestChoice(closing, 'gasoleoA', origin, 50, late)!)
    const status = card.querySelector('.answer-card__status')!
    expect(status.textContent).toBe('Cierra pronto')
    expect(status.getAttribute('data-schedule')).toBe('closing-soon')
  })

  it('opens the station card when the body is tapped', () => {
    const picked: Station[] = []
    const card = render(winner(), (s) => picked.push(s))
    const body = card.querySelector<HTMLButtonElement>('button.answer-card__body')!
    body.click()
    expect(picked.map((s) => s.id)).toEqual(['r'])
  })

  it('links to the maps app like the station card, outside the tappable body', () => {
    const picked: Station[] = []
    const card = render(winner(), (s) => picked.push(s))
    const link = card.querySelector<HTMLAnchorElement>('a.answer-card__directions')!
    expect(link.textContent).toBe('Cómo llegar')
    expect(link.getAttribute('href')).toMatch(/^(geo:|https:\/\/maps\.apple\.com)/)
    expect(link.getAttribute('href')).toContain(String(nearby[1].pos.lat))
    expect(link.target).toBe('_blank')
    expect(link.closest('button')).toBeNull()
    link.addEventListener('click', (e) => e.preventDefault())
    link.click()
    expect(picked).toEqual([])
  })

  it('formats the saving for the active locale', () => {
    setLocale('en')
    const card = render(winner())
    expect(card.querySelector('.answer-card__saving')?.textContent).toBe('You save €4.42 on 50 l')
  })
})
