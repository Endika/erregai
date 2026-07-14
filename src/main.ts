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
import { sortStations } from './core/pricing'
import { haversineKm, type LatLon } from './core/geo'
import type { Station } from './core/station'
import type { Settings } from './app/settings'

type Tab = 'list' | 'map' | 'trip' | 'settings'
const TABS: readonly Tab[] = ['list', 'map', 'trip', 'settings']
const TRIP_ZOOM = 15

const store = new Store({ fetchProvince, kv: openIdbKv(), now: () => Date.now() })

setLocale(store.state.settings.locale ?? detectLocale())

let activeTab: Tab = 'list'
let selectedStation: Station | undefined
let locationError: string | undefined

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
const refreshButton = requireEl<HTMLButtonElement>('[data-refresh]')
const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-tab]')

const mapContainer = document.createElement('div')
mapContainer.className = 'map-view'
const mapView = new MapView(mapContainer)
const tripController = new TripController(store, () => { if (activeTab === 'trip') render() })

root.addEventListener('click', e => {
  const target = e.target as HTMLElement
  if (target.closest('[data-refresh]')) { void store.refresh(); return }
  const tabButton = target.closest<HTMLElement>('[data-tab]')
  if (tabButton) {
    activeTab = tabButton.dataset.tab as Tab
    selectedStation = undefined
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

function backToList(): void {
  selectedStation = undefined
  render()
}

function renderStationDetail(station: Station): void {
  const backButton = document.createElement('button')
  backButton.type = 'button'
  backButton.className = 'detail-back'
  backButton.textContent = `< ${t('nav.back')}`
  backButton.addEventListener('click', backToList)
  const detailContainer = document.createElement('div')
  viewEl.append(backButton, detailContainer)
  renderDetail(detailContainer, station)
}

function renderPositionPlaceholder(): void {
  const placeholder = document.createElement('p')
  placeholder.className = 'placeholder'
  placeholder.textContent = locationError ?? t('app.loading')
  viewEl.appendChild(placeholder)
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

function handleSettingsChange(partial: Partial<Settings>): void {
  if (partial.locale) setLocale(partial.locale)
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

  freshnessEl.textContent = state.dataDate ? `${t('app.updated')} ${state.dataDate}` : t('app.loading')

  const errorMessage = locationError ?? (state.error ? `${t('error.network')}: ${state.error}` : undefined)
  errorEl.textContent = errorMessage ?? ''
  errorEl.hidden = !errorMessage

  viewEl.classList.toggle('is-loading', state.loading)
  viewEl.replaceChildren()

  if (activeTab === 'list') {
    if (selectedStation) {
      renderStationDetail(selectedStation)
    } else if (state.pos) {
      const nearby = withinRadius(state.stations, state.pos, state.settings.radiusKm)
      if (nearby.length === 0) {
        renderEmptyState(state.settings.radiusKm)
      } else {
        const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
        renderList(viewEl, sorted, state.settings.fuel, state.pos, selectStation)
      }
    } else {
      renderPositionPlaceholder()
    }
  } else if (activeTab === 'map') {
    if (selectedStation) {
      renderStationDetail(selectedStation)
    } else if (state.pos) {
      const nearby = withinRadius(state.stations, state.pos, state.settings.radiusKm)
      if (nearby.length === 0) {
        renderEmptyState(state.settings.radiusKm)
      } else {
        viewEl.appendChild(mapContainer)
        mapView.render(state.pos, nearby, state.settings.fuel, selectStation)
        mapView.invalidateSize()
      }
    } else {
      renderPositionPlaceholder()
    }
  } else if (activeTab === 'trip') {
    if (selectedStation) {
      renderStationDetail(selectedStation)
    } else {
      const tripPos = tripController.currentUpdate?.state.lastPos ?? state.pos
      if (tripPos) {
        const nearby = withinRadius(state.stations, tripPos, state.settings.radiusKm)
        const mapWrap = document.createElement('div')
        mapWrap.className = 'trip-map'
        mapWrap.appendChild(mapContainer)
        viewEl.appendChild(mapWrap)
        mapView.render(tripPos, nearby, state.settings.fuel, selectStation, { recenter: true })
        mapView.invalidateSize()
      }
      const readout = document.createElement('div')
      viewEl.appendChild(readout)
      tripController.render(readout, tripController.currentUpdate)
    }
  } else if (activeTab === 'settings') {
    renderSettings(viewEl, state.settings, handleSettingsChange)
  }
}

store.subscribe(render)
render()

getOnce()
  .then(pos => {
    locationError = undefined
    return store.loadFor(pos)
  })
  .catch(() => {
    locationError = t('error.location')
    render()
  })
