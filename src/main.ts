import './styles.css'
import { Store } from './app/store'
import { fetchProvince } from './adapters/api'
import { openIdbKv } from './adapters/cache'
import { getOnce } from './adapters/geolocation'
import { detectLocale, setLocale, t } from './i18n'
import { renderList } from './ui/list'
import { renderDetail } from './ui/detail'
import { renderSettings } from './ui/settings'
import { TripController } from './ui/trip'
import { MapView } from './ui/map'
import { renderSortBar } from './ui/sortBar'
import { sortStations, type SortKey } from './core/pricing'
import { haversineKm, type LatLon } from './core/geo'
import type { Station } from './core/station'
import type { Settings } from './app/settings'

type Tab = 'list' | 'map' | 'trip' | 'settings'
const TABS: readonly Tab[] = ['list', 'map', 'trip', 'settings']
const TRIP_ZOOM = 15

const store = new Store({ fetchProvince, kv: openIdbKv(), now: () => Date.now() })

setLocale(store.state.settings.locale ?? detectLocale())
applyTheme(store.state.settings.theme)

let activeTab: Tab = 'list'
let selectedStation: Station | undefined
let locationError: string | undefined
let locating = false

const root: HTMLElement = document.getElementById('app') ??
  (() => { throw new Error('missing #app root element') })()

root.innerHTML = `
  <header class="app-header">
    <span class="app-header__title" data-title></span>
    <span class="app-header__freshness" data-freshness></span>
    <button type="button" class="app-header__refresh" data-refresh></button>
  </header>
  <p class="app-error" data-error hidden></p>
  <main class="app-main" data-view></main>
  <aside class="detail-card" data-card hidden></aside>
  <nav class="tab-bar" role="tablist">
    ${TABS.map(tab => `<button type="button" class="tab-bar__tab" role="tab" data-tab="${tab}"></button>`).join('')}
  </nav>
`

function requireEl<T extends Element>(selector: string): T {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`malformed app shell: missing ${selector}`)
  return el
}

const titleEl = requireEl<HTMLElement>('[data-title]')
const freshnessEl = requireEl<HTMLElement>('[data-freshness]')
const errorEl = requireEl<HTMLElement>('[data-error]')
const viewEl = requireEl<HTMLElement>('[data-view]')
const cardEl = requireEl<HTMLElement>('[data-card]')
const refreshButton = requireEl<HTMLButtonElement>('[data-refresh]')
const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-tab]')

const mapContainer = document.createElement('div')
mapContainer.className = 'map-view'
const mapView = new MapView(mapContainer)
const tripController = new TripController(store, mapView, () => { if (activeTab === 'trip') render() }, selectStation)

root.addEventListener('click', e => {
  const target = e.target as HTMLElement
  if (target.closest('[data-refresh]')) { void store.refresh(); return }
  const tabButton = target.closest<HTMLElement>('[data-tab]')
  if (tabButton) {
    activeTab = tabButton.dataset.tab as Tab
    render()
    if (activeTab === 'map' || activeTab === 'trip') mapView.invalidateSize()
    if (activeTab === 'trip') {
      const tp = tripController.currentUpdate?.state.lastPos ?? store.state.pos
      if (tp) mapView.focus(tp, TRIP_ZOOM)
    }
  }
})

function selectStation(station: Station): void {
  selectedStation = station
  render()
}

function closeCard(): void {
  selectedStation = undefined
  render()
}

function renderCard(): void {
  if (!selectedStation) {
    cardEl.hidden = true
    cardEl.replaceChildren()
    return
  }
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'detail-card__close'
  close.setAttribute('aria-label', t('nav.back'))
  close.textContent = '×'
  close.addEventListener('click', closeCard)
  const detailContainer = document.createElement('div')
  renderDetail(detailContainer, selectedStation)
  cardEl.replaceChildren(close, detailContainer)
  cardEl.hidden = false
}

function locate(): void {
  locating = true
  render()
  getOnce()
    .then(pos => { locationError = undefined; return store.loadFor(pos) })
    .catch(() => { locationError = t('error.location') })
    .finally(() => { locating = false; render() })
}

function renderPositionPlaceholder(): void {
  const placeholder = document.createElement('p')
  placeholder.className = 'placeholder'
  placeholder.textContent = locating ? t('app.loading') : (locationError ?? t('app.loading'))
  viewEl.appendChild(placeholder)
  if (locationError && !locating) {
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.className = 'placeholder-retry'
    retry.textContent = t('action.retry')
    retry.addEventListener('click', locate)
    viewEl.appendChild(retry)
  }
}

function renderEmptyState(radiusKm: number): void {
  const placeholder = document.createElement('p')
  placeholder.className = 'placeholder'
  placeholder.textContent = t('list.empty').replace('{radius}', String(radiusKm))
  viewEl.appendChild(placeholder)
}

function withinRadius(stations: Station[], origin: LatLon, radiusKm: number): Station[] {
  return stations.filter(s => haversineKm(origin, s.pos) <= radiusKm)
}

function renderStationList(container: HTMLElement, sorted: Station[], fuel: Settings['fuel'], origin: LatLon, sort: SortKey, selectedId?: string): void {
  container.appendChild(renderSortBar(sort, key => store.setSettings({ sort: key })))
  const listContainer = document.createElement('div')
  container.appendChild(listContainer)
  renderList(listContainer, sorted, fuel, origin, selectStation, selectedId)
}

function applyTheme(theme: Settings['theme']): void {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

function handleSettingsChange(partial: Partial<Settings>): void {
  if (partial.locale) setLocale(partial.locale)
  if (partial.theme) applyTheme(partial.theme)
  store.setSettings(partial)
}

function refreshStaticCopy(): void {
  document.title = t('app.title')
  titleEl.textContent = t('app.title')
  refreshButton.textContent = t('app.refresh')
  for (const button of tabButtons) {
    const tab = button.dataset.tab as Tab
    button.textContent = t(`nav.${tab}`)
  }
}

function render(): void {
  const state = store.state

  refreshStaticCopy()

  for (const button of tabButtons) {
    const isActive = button.dataset.tab === activeTab
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-selected', String(isActive))
  }

  const busy = state.loading || locating
  freshnessEl.textContent = busy
    ? t('app.refreshing')
    : (state.dataDate ? `${t('app.updated')} ${state.dataDate}` : t('app.loading'))
  refreshButton.classList.toggle('is-busy', busy)
  refreshButton.disabled = busy

  const errorMessage = locationError ?? (state.error ? `${t('error.network')}: ${state.error}` : undefined)
  errorEl.textContent = errorMessage ?? ''
  errorEl.hidden = !errorMessage

  viewEl.classList.toggle('is-loading', state.loading)
  viewEl.replaceChildren()

  const selectedId = selectedStation?.id

  if (activeTab === 'list') {
    if (state.pos) {
      const nearby = withinRadius(state.stations, state.pos, state.settings.radiusKm)
      if (nearby.length === 0) {
        renderEmptyState(state.settings.radiusKm)
      } else {
        const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
        renderStationList(viewEl, sorted, state.settings.fuel, state.pos, state.settings.sort, selectedId)
      }
    } else {
      renderPositionPlaceholder()
    }
  } else if (activeTab === 'map') {
    if (state.pos) {
      const nearby = withinRadius(state.stations, state.pos, state.settings.radiusKm)
      if (nearby.length === 0) {
        renderEmptyState(state.settings.radiusKm)
      } else {
        const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
        const split = document.createElement('div')
        split.className = 'map-split'
        const mapWrap = document.createElement('div')
        mapWrap.className = 'map-split__map'
        mapWrap.appendChild(mapContainer)
        const listWrap = document.createElement('div')
        listWrap.className = 'map-split__list'
        split.append(mapWrap, listWrap)
        viewEl.appendChild(split)
        mapView.render(state.pos, sorted, state.settings.fuel, selectStation, { selectedId })
        mapView.invalidateSize()
        if (selectedStation) mapView.panTo(selectedStation.pos)
        renderStationList(listWrap, sorted, state.settings.fuel, state.pos, state.settings.sort, selectedId)
      }
    } else {
      renderPositionPlaceholder()
    }
  } else if (activeTab === 'trip') {
    const tripPos = tripController.currentUpdate?.state.lastPos ?? state.pos
    if (tripPos) {
      const nearby = withinRadius(state.stations, tripPos, state.settings.radiusKm)
      const mapWrap = document.createElement('div')
      mapWrap.className = 'trip-map'
      mapWrap.appendChild(mapContainer)
      viewEl.appendChild(mapWrap)
      mapView.render(tripPos, nearby, state.settings.fuel, selectStation, { recenter: true, selectedId })
      mapView.invalidateSize()
    }
    const readout = document.createElement('div')
    viewEl.appendChild(readout)
    tripController.render(readout, tripController.currentUpdate, selectedId)
  } else if (activeTab === 'settings') {
    renderSettings(viewEl, state.settings, handleSettingsChange)
  }

  renderCard()
}

store.subscribe(render)
render()
locate()
