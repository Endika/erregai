import { FUELS } from '../core/fuels'
import type { Settings, Theme } from '../app/settings'
import type { SortKey } from '../core/pricing'
import { getLocale, LOCALE_ORDER, t, type Locale } from '../i18n'

const SORT_KEYS: readonly SortKey[] = ['price', 'distance']
const THEMES: readonly Theme[] = ['light', 'system', 'dark']
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

  container.replaceChildren(form)
}
