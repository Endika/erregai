import { FUELS } from '../core/fuels'
import type { FuelAlertMode, Settings, Theme } from '../app/settings'
import type { SortKey } from '../core/pricing'
import { getLocale, LOCALE_ORDER, t, type Locale } from '../i18n'
import { formatDistance, formatNumber, formatPercent } from '../i18n/format'
import { playRadarBeep, playFuelChime, unlockAudio } from '../adapters/audio'
import { vibrateRadar, vibrateFuel } from '../adapters/vibrate'

const SORT_KEYS: readonly SortKey[] = ['price', 'distance']
const THEMES: readonly Theme[] = ['light', 'system', 'dark']
const RADAR_DISTANCES_M: readonly number[] = [300, 500, 800, 1000, 1500]
const FUEL_ALERT_MODES: readonly FuelAlertMode[] = ['cheap', 'any', 'off']
const FUEL_DISTANCES_M: readonly number[] = [1000, 2000, 3000, 5000]
// Prices come from one province per load, so a radius past ~50 km finds nothing
// more; a free number let 500 through and looked like it meant something.
const RADIUS_KM: readonly number[] = [5, 10, 15, 25, 50]
// Language endonyms are shown in their own language regardless of the
// current UI locale (standard language-picker convention), so these are
// not routed through t().
const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  ca: 'Català',
  eu: 'Euskara',
  va: 'Valencià',
  gl: 'Galego',
}

interface SelectOption {
  value: string
  label: string
}

function field(labelText: string, control: HTMLElement): HTMLLabelElement {
  const field = document.createElement('label')
  field.className = 'settings-form__field'
  const caption = document.createElement('span')
  caption.className = 'settings-form__label'
  caption.textContent = labelText
  field.append(caption, control)
  return field
}

function selectField(
  labelText: string,
  fieldName: string,
  currentValue: string,
  options: readonly SelectOption[],
  onPick: (value: string) => void,
): HTMLLabelElement {
  const select = document.createElement('select')
  select.dataset.field = fieldName
  for (const opt of options) {
    const option = document.createElement('option')
    option.value = opt.value
    option.textContent = opt.label
    option.selected = opt.value === currentValue
    select.appendChild(option)
  }
  select.addEventListener('change', () => onPick(select.value))
  return field(labelText, select)
}

function toggleField(
  labelText: string,
  fieldName: string,
  checked: boolean,
  onToggle: (checked: boolean) => void,
): HTMLLabelElement {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('role', 'switch')
  input.dataset.field = fieldName
  input.checked = checked
  input.addEventListener('change', () => onToggle(input.checked))
  const row = field(labelText, input)
  row.classList.add('settings-form__field--toggle')
  return row
}

function buttonField(labelText: string, onClick: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'settings-form__button'
  button.textContent = labelText
  button.addEventListener('click', onClick)
  return button
}

function rangeField(
  labelText: string,
  fieldName: string,
  currentValue: number,
  onCommit: (value: number) => void,
): HTMLLabelElement {
  const input = document.createElement('input')
  input.type = 'range'
  // Floor at 0.1 rather than 0: silencing a cue is what the sound toggles are
  // for, and a slider dragged to zero looks like a broken alert.
  input.min = '0.1'
  input.max = '1'
  input.step = '0.1'
  input.dataset.field = fieldName
  input.value = String(currentValue)
  // The level in words next to the label; the slider itself voices the same
  // text, so the visible copy stays out of the accessibility tree.
  const shown = document.createElement('span')
  shown.className = 'settings-form__value'
  shown.setAttribute('aria-hidden', 'true')
  const show = (): void => {
    const text = formatPercent(Number(input.value))
    shown.textContent = text
    input.setAttribute('aria-valuetext', text)
  }
  show()
  input.addEventListener('input', show)
  // 'change', not 'input': commit once on release rather than on every pixel of
  // the drag, so the level is not saved (and previewed) dozens of times.
  input.addEventListener('change', () => {
    const value = Number(input.value)
    if (Number.isFinite(value)) onCommit(value)
  })
  const row = field(labelText, input)
  const head = document.createElement('span')
  head.className = 'settings-form__head'
  head.append(row.querySelector('.settings-form__label')!, shown)
  row.prepend(head)
  return row
}

function section(titleText: string, fields: readonly HTMLElement[]): HTMLElement {
  const section = document.createElement('section')
  section.className = 'settings-section'
  const title = document.createElement('h2')
  title.className = 'settings-section__title'
  title.textContent = titleText
  section.append(title, ...fields)
  return section
}

// A radius saved before the fixed choices existed stays listed, so the control
// shows what the app is actually using until the user picks another.
function radiusOptions(current: number): SelectOption[] {
  const values = RADIUS_KM.includes(current)
    ? RADIUS_KM
    : [...RADIUS_KM, current].sort((a, b) => a - b)
  return values.map((km) => ({ value: String(km), label: `${formatNumber(km)} km` }))
}

function metersOptions(values: readonly number[]): SelectOption[] {
  return values.map((m) => ({
    value: String(m),
    label: m % 1000 === 0 ? `${formatNumber(m / 1000)} km` : formatDistance(m / 1000),
  }))
}

export function renderSettings(
  container: HTMLElement,
  settings: Settings,
  onChange: (partial: Partial<Settings>) => void,
): void {
  const form = document.createElement('div')
  form.className = 'settings-form'

  const activeLocale = settings.locale ?? getLocale()

  const general = section(t('settings.section.general'), [
    selectField(
      t('settings.fuel'),
      'fuel',
      settings.fuel,
      FUELS.map((f) => ({ value: f.id, label: t(f.i18nKey) })),
      (value) => onChange({ fuel: value as Settings['fuel'] }),
    ),
    selectField(
      t('settings.sort'),
      'sort',
      settings.sort,
      SORT_KEYS.map((key) => ({ value: key, label: t(`sort.${key}`) })),
      (value) => onChange({ sort: value as SortKey }),
    ),
    selectField(
      t('settings.radius'),
      'radiusKm',
      String(settings.radiusKm),
      radiusOptions(settings.radiusKm),
      (value) => onChange({ radiusKm: Number(value) }),
    ),
    selectField(
      t('settings.locale'),
      'locale',
      activeLocale,
      LOCALE_ORDER.map((locale) => ({ value: locale, label: LOCALE_LABELS[locale] })),
      (value) => onChange({ locale: value as Locale }),
    ),
    selectField(
      t('settings.theme'),
      'theme',
      settings.theme,
      THEMES.map((theme) => ({ value: theme, label: t(`theme.${theme}`) })),
      (value) => onChange({ theme: value as Theme }),
    ),
    // Previews the new level on release: a volume slider you cannot hear while
    // setting it is guesswork, and the release is still a user gesture, so the
    // audio context unlocks here too.
    rangeField(t('settings.alertVolume'), 'alertVolume', settings.alertVolume, (value) => {
      onChange({ alertVolume: value })
      unlockAudio()
      playRadarBeep({ volume: value })
    }),
    toggleField(t('settings.alertVibrate'), 'alertVibrate', settings.alertVibrate, (checked) => {
      onChange({ alertVibrate: checked })
      if (checked) vibrateRadar()
    }),
  ])

  const services = section(t('settings.section.services'), [
    toggleField(
      t('services.settings.showOnMap'),
      'servicesLayerEnabled',
      settings.servicesLayerEnabled,
      (checked) => onChange({ servicesLayerEnabled: checked }),
    ),
  ])

  const radar = section(t('settings.section.radar'), [
    toggleField(
      t('radar.settings.showOnMap'),
      'radarLayerEnabled',
      settings.radarLayerEnabled,
      (checked) => onChange({ radarLayerEnabled: checked }),
    ),
    toggleField(
      t('radar.settings.enabled'),
      'radarAlertsEnabled',
      settings.radarAlertsEnabled,
      (checked) => onChange({ radarAlertsEnabled: checked }),
    ),
    selectField(
      t('radar.settings.distance'),
      'radarAlertDistanceM',
      String(settings.radarAlertDistanceM),
      metersOptions(RADAR_DISTANCES_M),
      (value) => onChange({ radarAlertDistanceM: Number(value) }),
    ),
    toggleField(t('radar.settings.sound'), 'radarSound', settings.radarSound, (checked) =>
      onChange({ radarSound: checked }),
    ),
    // Plays the radar beep from a real tap, which also unlocks audio: the only
    // way to verify sound works without driving up to a fixed radar in a trip.
    // Mirrors the real alert — configured volume and haptics included.
    buttonField(t('radar.settings.testSound'), () => {
      unlockAudio()
      playRadarBeep({ volume: settings.alertVolume })
      if (settings.alertVibrate) vibrateRadar()
    }),
  ])

  const fuel = section(t('settings.section.fuel'), [
    selectField(
      t('fuel.settings.mode'),
      'fuelAlertMode',
      settings.fuelAlertMode,
      FUEL_ALERT_MODES.map((mode) => ({ value: mode, label: t(`fuel.settings.mode.${mode}`) })),
      (value) => onChange({ fuelAlertMode: value as FuelAlertMode }),
    ),
    selectField(
      t('fuel.settings.distance'),
      'fuelAlertDistanceM',
      String(settings.fuelAlertDistanceM),
      metersOptions(FUEL_DISTANCES_M),
      (value) => onChange({ fuelAlertDistanceM: Number(value) }),
    ),
    toggleField(t('fuel.settings.sound'), 'fuelSound', settings.fuelSound, (checked) =>
      onChange({ fuelSound: checked }),
    ),
    buttonField(t('fuel.settings.testSound'), () => {
      unlockAudio()
      playFuelChime({ volume: settings.alertVolume })
      if (settings.alertVibrate) vibrateFuel()
    }),
  ])

  const about = document.createElement('section')
  about.className = 'settings-about'
  const aboutTitle = document.createElement('h2')
  aboutTitle.className = 'settings-about__title'
  aboutTitle.textContent = t('settings.about')
  const legend = document.createElement('div')
  legend.className = 'legend'
  for (const band of ['cheap', 'mid', 'expensive'] as const) {
    const item = document.createElement('span')
    item.className = 'legend__item'
    item.dataset.band = band
    item.textContent = t(`band.${band}`)
    legend.appendChild(item)
  }
  const legendNote = document.createElement('p')
  legendNote.className = 'legend__note'
  legendNote.textContent = t('band.legend.about')
  const dataCredit = document.createElement('p')
  dataCredit.className = 'settings-about__credit'
  dataCredit.textContent = t('about.data')
  const mapCredit = document.createElement('p')
  mapCredit.className = 'settings-about__credit'
  mapCredit.textContent = t('about.map')
  const version = document.createElement('p')
  version.className = 'settings-about__version'
  version.textContent = `v${__APP_VERSION__}`
  about.append(aboutTitle, legend, legendNote, dataCredit, mapCredit, version)

  form.append(general, services, radar, fuel, about)
  container.replaceChildren(form)
}
