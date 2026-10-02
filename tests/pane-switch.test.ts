// @vitest-environment jsdom
import { renderPaneSwitch } from '../src/ui/pane-switch'
import { setLocale } from '../src/i18n'

describe('pane switch', () => {
  beforeEach(() => setLocale('es'))

  it('is a named group of two radios, the radars one carrying how many are listed', () => {
    const el = renderPaneSwitch('stations', 4, () => {})
    expect(el.tagName).toBe('FIELDSET')
    expect(el.querySelector('legend')!.textContent).toBe('Mostrar')
    const inputs = [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(inputs.map((i) => i.labels![0].textContent)).toEqual(['Gasolineras', 'Radares (4)'])
    expect(inputs.map((i) => i.checked)).toEqual([true, false])
    expect(new Set(inputs.map((i) => i.name)).size).toBe(1)
  })

  it('reports the picked view', () => {
    const seen: string[] = []
    const el = renderPaneSwitch('stations', 0, (v) => seen.push(v))
    const radars = el.querySelector<HTMLInputElement>('input[value="radars"]')!
    radars.checked = true
    radars.dispatchEvent(new Event('change'))
    expect(seen).toEqual(['radars'])
  })

  it('keeps Radares (0) selectable, so the empty state can say why', () => {
    const el = renderPaneSwitch('radars', 0, () => {})
    const radars = el.querySelector<HTMLInputElement>('input[value="radars"]')!
    expect(radars.disabled).toBe(false)
    expect(radars.checked).toBe(true)
    expect(radars.labels![0].textContent).toBe('Radares (0)')
  })
})
