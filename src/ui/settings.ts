import { FUELS } from '../core/fuels'
import type { FuelAlertMode, Settings, Theme } from '../app/settings'
import type { SortKey } from '../core/pricing'
import { getLocale, LOCALE_ORDER, t, type Locale } from '../i18n'
import { playRadarBeep, playFuelChime, unlockAudio } from '../adapters/audio'

const SORT_KEYS: readonly SortKey[] = ['price', 'distance']
const THEMES: readonly Theme[] = ['light', 'system', 'dark']
const RADAR_DISTANCES_M: readonly number[] = [300, 500, 800, 1000, 1500]
const FUEL_ALERT_MODES: readonly FuelAlertMode[] = ['cheap', 'any', 'off']
const FUEL_DISTANCES_M: readonly number[] = [1000, 2000, 3000, 5000]
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
  input.dataset.field = fieldName
  input.checked = checked
  input.addEventListener('change', () => onToggle(input.checked))
  return field(labelText, input)
}

function buttonField(labelText: string, onClick: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'settings-form__button'
  button.textContent = labelText
  button.addEventListener('click', onClick)
  return button
}

function numberField(
  labelText: string,
  fieldName: string,
  currentValue: number,
  onCommit: (value: number) => void,
): HTMLLabelElement {
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '1'
  input.step = '1'
  input.dataset.field = fieldName
  input.value = String(currentValue)
  input.addEventListener('change', () => {
    const value = Number(input.value)
    if (Number.isFinite(value) && value > 0) onCommit(value)
  })
  return field(labelText, input)
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

function metersOptions(values: readonly number[]): SelectOption[] {
  return values.map(m => ({ value: String(m), label: `${m} m` }))
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
      FUELS.map(f => ({ value: f.id, label: t(f.i18nKey) })),
      value => onChange({ fuel: value as Settings['fuel'] }),
    ),
    selectField(
      t('settings.sort'),
      'sort',
      settings.sort,
      SORT_KEYS.map(key => ({ value: key, label: t(`sort.${key}`) })),
      value => onChange({ sort: value as SortKey }),
    ),
    numberField(t('settings.radius'), 'radiusKm', settings.radiusKm, value =>
      onChange({ radiusKm: value }),
    ),
    selectField(
      t('settings.locale'),
      'locale',
      activeLocale,
      LOCALE_ORDER.map(locale => ({ value: locale, label: LOCALE_LABELS[locale] })),
      value => onChange({ locale: value as Locale }),
    ),
    selectField(
      t('settings.theme'),
      'theme',
      settings.theme,
      THEMES.map(theme => ({ value: theme, label: t(`theme.${theme}`) })),
      value => onChange({ theme: value as Theme }),
    ),
  ])

  const radar = section(t('settings.section.radar'), [
    toggleField(
      t('radar.settings.showOnMap'),
      'radarLayerEnabled',
      settings.radarLayerEnabled,
      checked => onChange({ radarLayerEnabled: checked }),
    ),
    toggleField(
      t('radar.settings.enabled'),
      'radarAlertsEnabled',
      settings.radarAlertsEnabled,
      checked => onChange({ radarAlertsEnabled: checked }),
    ),
    selectField(
      t('radar.settings.distance'),
      'radarAlertDistanceM',
      String(settings.radarAlertDistanceM),
      metersOptions(RADAR_DISTANCES_M),
      value => onChange({ radarAlertDistanceM: Number(value) }),
    ),
    toggleField(t('radar.settings.sound'), 'radarSound', settings.radarSound, checked =>
      onChange({ radarSound: checked }),
    ),
    // Plays the radar beep from a real tap, which also unlocks audio: the only
    // way to verify sound works without driving up to a fixed radar in a trip.
    buttonField(t('radar.settings.testSound'), () => { unlockAudio(); playRadarBeep() }),
  ])

  const fuel = section(t('settings.section.fuel'), [
    selectField(
      t('fuel.settings.mode'),
      'fuelAlertMode',
      settings.fuelAlertMode,
      FUEL_ALERT_MODES.map(mode => ({ value: mode, label: t(`fuel.settings.mode.${mode}`) })),
      value => onChange({ fuelAlertMode: value as FuelAlertMode }),
    ),
    selectField(
      t('fuel.settings.distance'),
      'fuelAlertDistanceM',
      String(settings.fuelAlertDistanceM),
      metersOptions(FUEL_DISTANCES_M),
      value => onChange({ fuelAlertDistanceM: Number(value) }),
    ),
    toggleField(t('fuel.settings.sound'), 'fuelSound', settings.fuelSound, checked =>
      onChange({ fuelSound: checked }),
    ),
    buttonField(t('fuel.settings.testSound'), () => { unlockAudio(); playFuelChime() }),
  ])

  const about = document.createElement('section')
  about.className = 'settings-about'
  const aboutTitle = document.createElement('h2')
  aboutTitle.className = 'settings-about__title'
  aboutTitle.textContent = t('settings.about')
  const legend = document.createElement('div')
  legend.className = 'legend'
  for (const band of ['cheap', 'expensive'] as const) {
    const item = document.createElement('span')
    item.className = 'legend__item'
    item.dataset.band = band
    item.textContent = t(`band.${band}`)
    legend.appendChild(item)
  }
  const dataCredit = document.createElement('p')
  dataCredit.className = 'settings-about__credit'
  dataCredit.textContent = t('about.data')
  const mapCredit = document.createElement('p')
  mapCredit.className = 'settings-about__credit'
  mapCredit.textContent = t('about.map')
  about.append(aboutTitle, legend, dataCredit, mapCredit)

  form.append(general, radar, fuel, about)
  container.replaceChildren(form)
}
