// @vitest-environment jsdom
import { renderSettings } from '../src/ui/settings'
import { DEFAULT_SETTINGS } from '../src/app/settings'
import { LOCALE_ORDER, setLocale, t } from '../src/i18n'
import { formatPercent } from '../src/i18n/format'

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

  it('labels whole-kilometre distance options without a trailing decimal', () => {
    setLocale('es')
    const el = document.createElement('div')
    renderSettings(el, DEFAULT_SETTINGS, () => {})
    const labels = [...el.querySelectorAll('[data-field="radarAlertDistanceM"] option')].map(
      (o) => o.textContent,
    )
    expect(labels).toEqual(['300 m', '500 m', '800 m', '1 km', '1,5 km'])
  })

  it('offers the radius as fixed choices within what one province load can fill', () => {
    setLocale('es')
    const el = document.createElement('div')
    const partials: Record<string, unknown>[] = []
    renderSettings(el, DEFAULT_SETTINGS, (p) => partials.push(p))
    const radius = el.querySelector<HTMLSelectElement>('[data-field="radiusKm"]')!
    expect(radius.tagName).toBe('SELECT')
    expect([...radius.options].map((o) => o.textContent)).toEqual([
      '5 km',
      '10 km',
      '15 km',
      '25 km',
      '50 km',
    ])
    expect(radius.value).toBe(String(DEFAULT_SETTINGS.radiusKm))
    radius.value = '25'
    radius.dispatchEvent(new Event('change'))
    expect(partials).toEqual([{ radiusKm: 25 }])
  })

  it('shows a radius saved before the choices existed instead of silently picking another', () => {
    setLocale('es')
    const el = document.createElement('div')
    renderSettings(el, { ...DEFAULT_SETTINGS, radiusKm: 500 }, () => {})
    const radius = el.querySelector<HTMLSelectElement>('[data-field="radiusKm"]')!
    expect(radius.value).toBe('500')
    expect([...radius.options].map((o) => o.value)).toEqual(['5', '10', '15', '25', '50', '500'])
  })

  it('explains all three price colours in the legend', () => {
    const el = document.createElement('div')
    renderSettings(el, DEFAULT_SETTINGS, () => {})
    const items = [...el.querySelectorAll<HTMLElement>('.legend__item')]
    expect(items.map((i) => i.dataset.band)).toEqual(['cheap', 'mid', 'expensive'])
    expect(items.map((i) => i.textContent)).toEqual([
      t('band.cheap'),
      t('band.mid'),
      t('band.expensive'),
    ])
    expect(el.querySelector('.legend__note')?.textContent).toBe(t('band.legend.about'))
  })

  it('lays out every on/off setting as a labelled switch row', () => {
    const el = document.createElement('div')
    renderSettings(el, DEFAULT_SETTINGS, () => {})
    const toggles = [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    expect(toggles).toHaveLength(6)
    for (const toggle of toggles) {
      expect(toggle.getAttribute('role')).toBe('switch')
      const label = toggle.closest('label')!
      expect(label.classList.contains('settings-form__field--toggle')).toBe(true)
      expect(label.querySelector('.settings-form__label')!.textContent).not.toBe('')
    }
  })
})

describe('settings labels', () => {
  const squash = (s: string | null) => (s ?? '').toLowerCase().replace(/[^\p{L}]/gu, '')

  it.each(LOCALE_ORDER)('never repeat their section title as a field label (%s)', (locale) => {
    setLocale(locale)
    const el = document.createElement('div')
    renderSettings(el, DEFAULT_SETTINGS, () => {})
    for (const section of el.querySelectorAll('.settings-section')) {
      const title = squash(section.querySelector('.settings-section__title')!.textContent)
      const labels = [...section.querySelectorAll('.settings-form__label')].map((l) =>
        squash(l.textContent),
      )
      expect(labels).not.toContain(title)
    }
    setLocale('es')
  })
})

describe('volume slider', () => {
  const draw = (volume: number) => {
    const el = document.createElement('div')
    renderSettings(el, { ...DEFAULT_SETTINGS, alertVolume: volume }, () => {})
    const input = el.querySelector<HTMLInputElement>('[data-field="alertVolume"]')!
    const shown = input.closest('label')!.querySelector('.settings-form__value')!
    return { input, shown }
  }

  it('shows its level as a percentage in the reader locale', () => {
    const { input, shown } = draw(0.7)
    expect(shown.textContent).toBe(formatPercent(0.7))
    expect(shown.textContent).toBe('70 %')
    expect(input.getAttribute('aria-valuetext')).toBe(formatPercent(0.7))
  })

  it('follows the thumb while it is dragged', () => {
    const { input, shown } = draw(0.7)
    input.value = '0.4'
    input.dispatchEvent(new Event('input'))
    expect(shown.textContent).toBe(formatPercent(0.4))
    expect(input.getAttribute('aria-valuetext')).toBe(formatPercent(0.4))
  })
})
