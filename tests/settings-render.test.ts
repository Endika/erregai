// @vitest-environment jsdom
import { renderSettings } from '../src/ui/settings'
import { DEFAULT_SETTINGS } from '../src/app/settings'
import { t } from '../src/i18n'

describe('renderSettings', () => {
  it('renders the general, services, radar and fuel section headings in order', () => {
    const el = document.createElement('div')
    renderSettings(el, DEFAULT_SETTINGS, () => {})
    const titles = [...el.querySelectorAll('.settings-section__title')].map((h) => h.textContent)
    expect(titles).toEqual([
      t('settings.section.general'),
      t('settings.section.services'),
      t('settings.section.radar'),
      t('settings.section.fuel'),
    ])
  })

  it('keeps every control field and fires the matching onChange payload', () => {
    const el = document.createElement('div')
    const partials: Record<string, unknown>[] = []
    renderSettings(el, DEFAULT_SETTINGS, (p) => partials.push(p))
    const fields = [...el.querySelectorAll('[data-field]')].map(
      (n) => (n as HTMLElement).dataset.field,
    )
    expect(fields).toEqual([
      'fuel',
      'sort',
      'radiusKm',
      'locale',
      'theme',
      'alertVolume',
      'alertVibrate',
      'servicesLayerEnabled',
      'radarLayerEnabled',
      'radarAlertsEnabled',
      'radarAlertDistanceM',
      'radarSound',
      'fuelAlertMode',
      'fuelAlertDistanceM',
      'fuelSound',
    ])
    const sound = el.querySelector<HTMLInputElement>('[data-field="radarSound"]')!
    sound.checked = false
    sound.dispatchEvent(new Event('change'))
    expect(partials).toContainEqual({ radarSound: false })
  })

  it('commits the alert volume on release and never offers a silent slider', () => {
    const el = document.createElement('div')
    const partials: Record<string, unknown>[] = []
    renderSettings(el, DEFAULT_SETTINGS, (p) => partials.push(p))
    const volume = el.querySelector<HTMLInputElement>('[data-field="alertVolume"]')!
    expect(volume.type).toBe('range')
    // Silencing a cue is the sound toggles' job, so the slider floor is audible.
    expect(Number(volume.min)).toBeGreaterThan(0)
    expect(Number(volume.max)).toBe(1)
    volume.value = '0.5'
    volume.dispatchEvent(new Event('change'))
    expect(partials).toContainEqual({ alertVolume: 0.5 })
  })

  it('toggles the service area layer independently of the radar one', () => {
    const el = document.createElement('div')
    const partials: Record<string, unknown>[] = []
    renderSettings(el, DEFAULT_SETTINGS, (p) => partials.push(p))
    const layer = el.querySelector<HTMLInputElement>('[data-field="servicesLayerEnabled"]')!
    expect(layer.checked).toBe(true)
    layer.checked = false
    layer.dispatchEvent(new Event('change'))
    expect(partials).toEqual([{ servicesLayerEnabled: false }])
  })

  it('toggles the haptic fallback', () => {
    const el = document.createElement('div')
    const partials: Record<string, unknown>[] = []
    renderSettings(el, DEFAULT_SETTINGS, (p) => partials.push(p))
    const vibrate = el.querySelector<HTMLInputElement>('[data-field="alertVibrate"]')!
    vibrate.checked = false
    vibrate.dispatchEvent(new Event('change'))
    expect(partials).toContainEqual({ alertVibrate: false })
  })
})
