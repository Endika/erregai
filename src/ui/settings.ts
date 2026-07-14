import { FUELS } from '../core/fuels'
import type { Settings } from '../app/settings'
import type { SortKey } from '../core/pricing'
import { t } from '../i18n'

const SORT_KEYS: readonly SortKey[] = ['price', 'distance']

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

  container.replaceChildren(form)
}
