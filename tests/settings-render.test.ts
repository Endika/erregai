// @vitest-environment jsdom
import { renderSettings } from '../src/ui/settings'
import { DEFAULT_SETTINGS } from '../src/app/settings'
import { t } from '../src/i18n'

describe('renderSettings', () => {
  it('renders the general, radar and fuel section headings in order', () => {
    const el = document.createElement('div')
    renderSettings(el, DEFAULT_SETTINGS, () => {})
    const titles = [...el.querySelectorAll('.settings-section__title')].map(h => h.textContent)
    expect(titles).toEqual([
      t('settings.section.general'),
      t('settings.section.radar'),
      t('settings.section.fuel'),
    ])
  })

  it('keeps every control field and fires the matching onChange payload', () => {
    const el = document.createElement('div')
    const partials: Record<string, unknown>[] = []
    renderSettings(el, DEFAULT_SETTINGS, p => partials.push(p))
    const fields = [...el.querySelectorAll('[data-field]')].map(n => (n as HTMLElement).dataset.field)
    expect(fields).toEqual([
      'fuel', 'sort', 'radiusKm', 'locale', 'theme',
      'radarLayerEnabled', 'radarAlertsEnabled', 'radarAlertDistanceM', 'radarSound',
      'fuelAlertMode', 'fuelAlertDistanceM', 'fuelSound',
    ])
    const sound = el.querySelector<HTMLInputElement>('[data-field="radarSound"]')!
    sound.checked = false
    sound.dispatchEvent(new Event('change'))
    expect(partials).toContainEqual({ radarSound: false })
  })
})
