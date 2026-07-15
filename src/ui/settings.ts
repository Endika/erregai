import { FUELS } from '../core/fuels'
import type { FuelAlertMode, Settings, Theme } from '../app/settings'
import type { SortKey } from '../core/pricing'
import { getLocale, LOCALE_ORDER, t, type Locale } from '../i18n'

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

export function renderSettings(
  container: HTMLElement,
  settings: Settings,
  onChange: (partial: Partial<Settings>) => void,
): void {
  const form = document.createElement('div')
  form.className = 'settings-form'

  const fuelField = document.createElement('label')
  fuelField.className = 'settings-form__field'
  const fuelCaption = document.createElement('span')
  fuelCaption.className = 'settings-form__label'
  fuelCaption.textContent = t('settings.fuel')
  const fuelSelect = document.createElement('select')
  fuelSelect.dataset.field = 'fuel'
  for (const fuel of FUELS) {
    const option = document.createElement('option')
    option.value = fuel.id
    option.textContent = t(fuel.i18nKey)
    option.selected = fuel.id === settings.fuel
    fuelSelect.appendChild(option)
  }
  fuelSelect.addEventListener('change', () => onChange({ fuel: fuelSelect.value as Settings['fuel'] }))
  fuelField.append(fuelCaption, fuelSelect)
  form.appendChild(fuelField)

  const sortField = document.createElement('label')
  sortField.className = 'settings-form__field'
  const sortCaption = document.createElement('span')
  sortCaption.className = 'settings-form__label'
  sortCaption.textContent = t('settings.sort')
  const sortSelect = document.createElement('select')
  sortSelect.dataset.field = 'sort'
  for (const key of SORT_KEYS) {
    const option = document.createElement('option')
    option.value = key
    option.textContent = t(`sort.${key}`)
    option.selected = key === settings.sort
    sortSelect.appendChild(option)
  }
  sortSelect.addEventListener('change', () => onChange({ sort: sortSelect.value as SortKey }))
  sortField.append(sortCaption, sortSelect)
  form.appendChild(sortField)

  const radiusField = document.createElement('label')
  radiusField.className = 'settings-form__field'
  const radiusCaption = document.createElement('span')
  radiusCaption.className = 'settings-form__label'
  radiusCaption.textContent = t('settings.radius')
  const radiusInput = document.createElement('input')
  radiusInput.type = 'number'
  radiusInput.min = '1'
  radiusInput.step = '1'
  radiusInput.dataset.field = 'radiusKm'
  radiusInput.value = String(settings.radiusKm)
  radiusInput.addEventListener('change', () => {
    const value = Number(radiusInput.value)
    if (Number.isFinite(value) && value > 0) onChange({ radiusKm: value })
  })
  radiusField.append(radiusCaption, radiusInput)
  form.appendChild(radiusField)

  const localeField = document.createElement('label')
  localeField.className = 'settings-form__field'
  const localeCaption = document.createElement('span')
  localeCaption.className = 'settings-form__label'
  localeCaption.textContent = t('settings.locale')
  const localeSelect = document.createElement('select')
  localeSelect.dataset.field = 'locale'
  const activeLocale = settings.locale ?? getLocale()
  for (const locale of LOCALE_ORDER) {
    const option = document.createElement('option')
    option.value = locale
    option.textContent = LOCALE_LABELS[locale]
    option.selected = locale === activeLocale
    localeSelect.appendChild(option)
  }
  localeSelect.addEventListener('change', () => onChange({ locale: localeSelect.value as Locale }))
  localeField.append(localeCaption, localeSelect)
  form.appendChild(localeField)

  const themeField = document.createElement('label')
  themeField.className = 'settings-form__field'
  const themeCaption = document.createElement('span')
  themeCaption.className = 'settings-form__label'
  themeCaption.textContent = t('settings.theme')
  const themeSelect = document.createElement('select')
  themeSelect.dataset.field = 'theme'
  for (const theme of THEMES) {
    const option = document.createElement('option')
    option.value = theme
    option.textContent = t(`theme.${theme}`)
    option.selected = theme === settings.theme
    themeSelect.appendChild(option)
  }
  themeSelect.addEventListener('change', () => onChange({ theme: themeSelect.value as Theme }))
  themeField.append(themeCaption, themeSelect)
  form.appendChild(themeField)

  const radarEnabledField = document.createElement('label')
  radarEnabledField.className = 'settings-form__field'
  const radarEnabledCaption = document.createElement('span')
  radarEnabledCaption.className = 'settings-form__label'
  radarEnabledCaption.textContent = t('radar.settings.enabled')
  const radarEnabledInput = document.createElement('input')
  radarEnabledInput.type = 'checkbox'
  radarEnabledInput.dataset.field = 'radarAlertsEnabled'
  radarEnabledInput.checked = settings.radarAlertsEnabled
  radarEnabledInput.addEventListener('change', () => onChange({ radarAlertsEnabled: radarEnabledInput.checked }))
  radarEnabledField.append(radarEnabledCaption, radarEnabledInput)
  form.appendChild(radarEnabledField)

  const radarDistanceField = document.createElement('label')
  radarDistanceField.className = 'settings-form__field'
  const radarDistanceCaption = document.createElement('span')
  radarDistanceCaption.className = 'settings-form__label'
  radarDistanceCaption.textContent = t('radar.settings.distance')
  const radarDistanceSelect = document.createElement('select')
  radarDistanceSelect.dataset.field = 'radarAlertDistanceM'
  for (const meters of RADAR_DISTANCES_M) {
    const option = document.createElement('option')
    option.value = String(meters)
    option.textContent = `${meters} m`
    option.selected = meters === settings.radarAlertDistanceM
    radarDistanceSelect.appendChild(option)
  }
  radarDistanceSelect.addEventListener('change', () => onChange({ radarAlertDistanceM: Number(radarDistanceSelect.value) }))
  radarDistanceField.append(radarDistanceCaption, radarDistanceSelect)
  form.appendChild(radarDistanceField)

  const radarSoundField = document.createElement('label')
  radarSoundField.className = 'settings-form__field'
  const radarSoundCaption = document.createElement('span')
  radarSoundCaption.className = 'settings-form__label'
  radarSoundCaption.textContent = t('radar.settings.sound')
  const radarSoundInput = document.createElement('input')
  radarSoundInput.type = 'checkbox'
  radarSoundInput.dataset.field = 'radarSound'
  radarSoundInput.checked = settings.radarSound
  radarSoundInput.addEventListener('change', () => onChange({ radarSound: radarSoundInput.checked }))
  radarSoundField.append(radarSoundCaption, radarSoundInput)
  form.appendChild(radarSoundField)

  const fuelModeField = document.createElement('label')
  fuelModeField.className = 'settings-form__field'
  const fuelModeCaption = document.createElement('span')
  fuelModeCaption.className = 'settings-form__label'
  fuelModeCaption.textContent = t('fuel.settings.mode')
  const fuelModeSelect = document.createElement('select')
  fuelModeSelect.dataset.field = 'fuelAlertMode'
  for (const mode of FUEL_ALERT_MODES) {
    const option = document.createElement('option')
    option.value = mode
    option.textContent = t(`fuel.settings.mode.${mode}`)
    option.selected = mode === settings.fuelAlertMode
    fuelModeSelect.appendChild(option)
  }
  fuelModeSelect.addEventListener('change', () => onChange({ fuelAlertMode: fuelModeSelect.value as FuelAlertMode }))
  fuelModeField.append(fuelModeCaption, fuelModeSelect)
  form.appendChild(fuelModeField)

  const fuelDistanceField = document.createElement('label')
  fuelDistanceField.className = 'settings-form__field'
  const fuelDistanceCaption = document.createElement('span')
  fuelDistanceCaption.className = 'settings-form__label'
  fuelDistanceCaption.textContent = t('fuel.settings.distance')
  const fuelDistanceSelect = document.createElement('select')
  fuelDistanceSelect.dataset.field = 'fuelAlertDistanceM'
  for (const meters of FUEL_DISTANCES_M) {
    const option = document.createElement('option')
    option.value = String(meters)
    option.textContent = `${meters} m`
    option.selected = meters === settings.fuelAlertDistanceM
    fuelDistanceSelect.appendChild(option)
  }
  fuelDistanceSelect.addEventListener('change', () => onChange({ fuelAlertDistanceM: Number(fuelDistanceSelect.value) }))
  fuelDistanceField.append(fuelDistanceCaption, fuelDistanceSelect)
  form.appendChild(fuelDistanceField)

  const fuelSoundField = document.createElement('label')
  fuelSoundField.className = 'settings-form__field'
  const fuelSoundCaption = document.createElement('span')
  fuelSoundCaption.className = 'settings-form__label'
  fuelSoundCaption.textContent = t('fuel.settings.sound')
  const fuelSoundInput = document.createElement('input')
  fuelSoundInput.type = 'checkbox'
  fuelSoundInput.dataset.field = 'fuelSound'
  fuelSoundInput.checked = settings.fuelSound
  fuelSoundInput.addEventListener('change', () => onChange({ fuelSound: fuelSoundInput.checked }))
  fuelSoundField.append(fuelSoundCaption, fuelSoundInput)
  form.appendChild(fuelSoundField)

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
  form.appendChild(about)

  container.replaceChildren(form)
}
