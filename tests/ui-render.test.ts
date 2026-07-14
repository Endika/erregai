// @vitest-environment jsdom
import { renderList } from '../src/ui/list'
import type { Station } from '../src/core/station'

const s = (id: string, price: number): Station => ({ id, brand: 'REPSOL', name: 'REPSOL', pos: { lat: 40, lon: -3 }, address: '', town: 'Madrid', schedule: '', prices: { gasoleoA: price } })

describe('renderList', () => {
  it('renders a row per station with band attribute and price', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.2), s('2', 1.6)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const rows = el.querySelectorAll('[data-station]')
    expect(rows.length).toBe(2)
    expect(el.textContent).toContain('1.2')
    expect(rows[0].getAttribute('data-band')).toBe('cheap')
  })
})
