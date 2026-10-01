import { searchPlaces, type Place } from '../core/places'
import { t } from '../i18n'

export interface PlaceSearchOptions {
  load: () => Promise<readonly Place[]>
  onPick: (place: Place) => void
  // The view is redrawn from scratch; the typed text survives it through these.
  query?: string
  onQuery?: (query: string) => void
}

let idCounter = 0

// A text field with a short list of buttons under it: each suggestion is a
// plain button, so it needs no combobox semantics to be reachable.
export function renderPlaceSearch({
  load,
  onPick,
  query = '',
  onQuery,
}: PlaceSearchOptions): HTMLElement {
  const id = `place-search-${++idCounter}`
  const wrap = document.createElement('div')
  wrap.className = 'place-search'

  const label = document.createElement('label')
  label.className = 'place-search__label'
  label.htmlFor = id
  label.textContent = t('place.search.label')

  const input = document.createElement('input')
  input.type = 'search'
  input.id = id
  input.className = 'place-search__input'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.enterKeyHint = 'search'
  input.value = query
  input.setAttribute('aria-describedby', `${id}-hint`)

  const hint = document.createElement('p')
  hint.id = `${id}-hint`
  hint.className = 'place-search__hint'
  hint.textContent = t('place.search.hint')

  const results = document.createElement('ul')
  results.className = 'place-search__results'

  const status = document.createElement('p')
  status.className = 'place-search__status'
  status.setAttribute('role', 'status')

  let places: readonly Place[] = []
  let hits: Place[] = []

  const update = (): void => {
    const q = input.value.trim()
    hits = searchPlaces(q, places)
    results.replaceChildren(
      ...hits.map((place) => {
        const item = document.createElement('li')
        const option = document.createElement('button')
        option.type = 'button'
        option.className = 'place-search__option'
        const name = document.createElement('span')
        name.className = 'place-search__name'
        name.textContent = place.name
        const province = document.createElement('span')
        province.className = 'place-search__province'
        province.textContent = place.province
        option.append(name, ' ', province)
        option.addEventListener('click', () => onPick(place))
        item.appendChild(option)
        return item
      }),
    )
    results.hidden = hits.length === 0
    const none = places.length > 0 && hits.length === 0 && q.length >= 2
    status.textContent = none ? t('place.search.none').replace('{query}', q) : ''
  }

  input.addEventListener('input', () => {
    onQuery?.(input.value)
    update()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && hits[0]) {
      e.preventDefault()
      onPick(hits[0])
    }
  })

  void load().then((loaded) => {
    places = loaded
    update()
  })
  update()

  wrap.append(label, input, hint, results, status)
  return wrap
}

export interface PlaceStripOptions {
  name: string
  onUseGps: () => void
}

// Always on screen while a hand-picked town stands in for the location, with
// the way back next to it.
export function renderPlaceStrip({ name, onUseGps }: PlaceStripOptions): HTMLElement {
  const strip = document.createElement('div')
  strip.className = 'place-strip'
  const text = document.createElement('p')
  text.className = 'place-strip__text'
  const [before, after = ''] = t('place.manual').split('{place}')
  const strong = document.createElement('strong')
  strong.textContent = name
  text.append(before, strong, after)
  const gps = document.createElement('button')
  gps.type = 'button'
  gps.className = 'place-strip__gps'
  gps.textContent = t('place.useGps')
  gps.addEventListener('click', onUseGps)
  strip.append(text, gps)
  return strip
}
