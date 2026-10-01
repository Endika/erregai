import { t } from '../i18n'
import { renderPlaceSearch, type PlaceSearchOptions } from './place-search'

export interface FirstRunOptions {
  onLocate: () => void
  onPickTown: () => void
  // Set once "Elegir municipio" is chosen: the town search replaces that button.
  search?: PlaceSearchOptions
}

export function renderFirstRun({ onLocate, onPickTown, search }: FirstRunOptions): HTMLElement {
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

  box.append(title, body, actions)
  if (search) box.appendChild(renderPlaceSearch(search))
  return box
}
