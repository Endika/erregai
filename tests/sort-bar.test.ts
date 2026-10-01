// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderSortBar } from '../src/ui/sortBar'
import { COMMON_FUELS, FUELS, type FuelId } from '../src/core/fuels'
import { setLocale, t } from '../src/i18n'

function bar(fuel: FuelId, onFuel: (f: FuelId) => void = () => {}): HTMLElement {
  return renderSortBar('price', () => {}, { current: fuel, onChange: onFuel })
}

describe('sort bar fuel control', () => {
  beforeEach(() => setLocale('es'))

  it('shows the current fuel by name, labelled as the fuel for screen readers', () => {
    const select = bar('gasoleoA').querySelector('select')!
    expect(select.value).toBe('gasoleoA')
    expect(select.selectedOptions[0].textContent).toBe(t('fuel.gasoleoA'))
    expect(select.labels?.[0]?.textContent).toBe(t('settings.fuel'))
  })

  it('reports the picked fuel', () => {
    const picked: FuelId[] = []
    const select = bar('gasoleoA', (f) => picked.push(f)).querySelector('select')!
    select.value = 'gasolina95'
    select.dispatchEvent(new Event('change'))
    expect(picked).toEqual(['gasolina95'])
  })

  it('offers the common fuels first and keeps every other fuel reachable', () => {
    const groups = [...bar('glp').querySelectorAll('optgroup')]
    expect(groups.map((g) => g.label)).toEqual([t('fuel.group.common'), t('fuel.group.other')])
    const values = (g: HTMLOptGroupElement) => [...g.querySelectorAll('option')].map((o) => o.value)
    expect(values(groups[0])).toEqual([...COMMON_FUELS])
    expect([...values(groups[0]), ...values(groups[1])].sort()).toEqual(
      FUELS.map((f) => f.id).sort(),
    )
  })

  it('keeps the sort buttons working beside it', () => {
    const sorted: string[] = []
    const el = renderSortBar('price', (k) => sorted.push(k), {
      current: 'gasoleoA',
      onChange: () => {},
    })
    el.querySelectorAll<HTMLButtonElement>('.sort-bar__btn')[1].click()
    expect(sorted).toEqual(['distance'])
  })
})

// jsdom has no layout; read the declared floor rather than trust the fuel select
// beside them to stretch the buttons to a full touch target.
describe('sort bar buttons', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../src/styles.css'), 'utf8')

  it('are rendered with the class that carries the touch target', () => {
    const buttons = bar('gasoleoA').querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button.classList.contains('sort-bar__btn')).toBe(true)
  })

  it('declare at least a 44px touch target of their own', () => {
    const rule = /\.sort-bar__btn\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    const rem = Number(/min-height:\s*([\d.]+)rem/.exec(rule)?.[1])
    expect(rem * 16).toBeGreaterThanOrEqual(44)
  })
})
