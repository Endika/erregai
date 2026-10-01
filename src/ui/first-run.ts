import { t } from '../i18n'
import { COMMON_FUELS, FUELS, type FuelId } from '../core/fuels'
import { renderPlaceSearch, type PlaceSearchOptions } from './place-search'
import { selectChevron } from './sortBar'

export interface FirstRunOptions {
  onLocate: () => void
  onPickTown: () => void
  fuel: FuelId
  onFuel: (fuel: FuelId) => void
  // Set once "Elegir municipio" is chosen: the town search replaces that button.
  search?: PlaceSearchOptions
}

export function renderFirstRun({
  onLocate,
  onPickTown,
  fuel,
  onFuel,
  search,
}: FirstRunOptions): HTMLElement {
  const box = document.createElement('section')
  box.className = 'first-run'
  box.setAttribute('aria-labelledby', 'first-run-title')

  const title = document.createElement('h2')
  title.id = 'first-run-title'
  title.className = 'first-run__title'
  title.textContent = t('firstRun.title')

  const body = document.createElement('p')
  body.className = 'first-run__body'
  body.textContent = t('firstRun.body')

  const actions = document.createElement('div')
  actions.className = 'first-run__actions'
  const locate = document.createElement('button')
  locate.type = 'button'
  locate.className = 'notice__action'
  locate.textContent = t('place.useGps')
  locate.addEventListener('click', onLocate)
  actions.appendChild(locate)
  if (!search) {
    const pick = document.createElement('button')
    pick.type = 'button'
    pick.className = 'notice__action notice__action--secondary'
    pick.textContent = t('firstRun.pickTown')
    pick.addEventListener('click', onPickTown)
    actions.appendChild(pick)
  }

  box.append(title, body, renderFuelChoice(fuel, onFuel), actions)
  if (search) box.appendChild(renderPlaceSearch(search))
  return box
}

// Every price on the first screen is for this fuel, so it is asked here rather
// than discovered later in the sort bar; the default stays one tap away.
function renderFuelChoice(current: FuelId, onFuel: (fuel: FuelId) => void): HTMLElement {
  const set = document.createElement('fieldset')
  set.className = 'first-run__fuel'
  const legend = document.createElement('legend')
  legend.className = 'first-run__fuel-legend'
  legend.textContent = t('firstRun.fuel')

  const options = document.createElement('div')
  options.className = 'first-run__fuel-options'
  const radios = COMMON_FUELS.map((id) => {
    const option = document.createElement('label')
    option.className = 'first-run__fuel-option'
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'first-run-fuel'
    radio.value = id
    radio.checked = id === current
    const name = document.createElement('span')
    name.textContent = t(`fuel.${id}`)
    option.append(radio, name)
    options.appendChild(option)
    return radio
  })

  const other = document.createElement('div')
  other.className = 'first-run__fuel-other'
  const otherLabel = document.createElement('label')
  otherLabel.className = 'visually-hidden'
  otherLabel.htmlFor = 'first-run-fuel-other'
  otherLabel.textContent = t('firstRun.fuelOther')
  const select = document.createElement('select')
  select.id = 'first-run-fuel-other'
  select.className = 'first-run__fuel-select'
  const placeholder = document.createElement('option')
  placeholder.value = ''
  // Not a fuel: picking it back would leave nothing chosen on screen.
  placeholder.disabled = true
  placeholder.textContent = t('firstRun.fuelOther')
  select.appendChild(placeholder)
  for (const { id } of FUELS) {
    if (COMMON_FUELS.includes(id)) continue
    const option = document.createElement('option')
    option.value = id
    option.textContent = t(`fuel.${id}`)
    select.appendChild(option)
  }
  select.value = COMMON_FUELS.includes(current) ? '' : current
  other.append(otherLabel, select, selectChevron())

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      select.value = ''
      onFuel(radio.value as FuelId)
    })
  }
  select.addEventListener('change', () => {
    if (!select.value) return
    for (const radio of radios) radio.checked = false
    onFuel(select.value as FuelId)
  })

  set.append(legend, options, other)
  return set
}
