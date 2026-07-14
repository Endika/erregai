import './styles.css'
import { Store } from './app/store'
import { fetchProvince } from './adapters/api'
import { openIdbKv } from './adapters/cache'
import { getOnce } from './adapters/geolocation'
import { detectLocale, setLocale, t } from './i18n'
import { renderList } from './ui/list'
import { renderDetail } from './ui/detail'
import { renderSettings } from './ui/settings'
import { MapView } from './ui/map'
import { sortStations } from './core/pricing'
import type { Station } from './core/station'

type Tab = 'list' | 'map' | 'trip' | 'settings'
const TABS: readonly Tab[] = ['list', 'map', 'trip', 'settings']

setLocale(detectLocale())

const store = new Store({ fetchProvince, kv: openIdbKv(), now: () => Date.now() })

let activeTab: Tab = 'list'
let selectedStation: Station | undefined
let locationError: string | undefined

const root: HTMLElement = document.getElementById('app') ??
  (() => { throw new Error('missing #app root element') })()

root.innerHTML = `
  <header class="app-header">
    <span class="app-header__freshness" data-freshness></span>
    <button type="button" class="app-header__refresh" data-refresh>${t('app.refresh')}</button>
  </header>
  <p class="app-error" data-error hidden></p>
  <main class="app-main" data-view></main>
  <nav class="tab-bar" role="tablist">
    ${TABS.map(tab => `<button type="button" class="tab-bar__tab" role="tab" data-tab="${tab}">${t(`nav.${tab}`)}</button>`).join('')}
  </nav>
`

function requireEl<T extends Element>(selector: string): T {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`malformed app shell: missing ${selector}`)
  return el
}

const freshnessEl = requireEl<HTMLElement>('[data-freshness]')
const errorEl = requireEl<HTMLElement>('[data-error]')
const viewEl = requireEl<HTMLElement>('[data-view]')
const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-tab]')

const mapContainer = document.createElement('div')
mapContainer.className = 'map-view'
const mapView = new MapView(mapContainer)

root.addEventListener('click', e => {
  const target = e.target as HTMLElement
  if (target.closest('[data-refresh]')) { void store.refresh(); return }
  const tabButton = target.closest<HTMLElement>('[data-tab]')
  if (tabButton) {
    activeTab = tabButton.dataset.tab as Tab
    selectedStation = undefined
    render()
    if (activeTab === 'map') mapView.invalidateSize()
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

function render(): void {
  const state = store.state

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
      const sorted = sortStations(state.stations, state.settings.fuel, state.pos, state.settings.sort)
      renderList(viewEl, sorted, state.settings.fuel, state.pos, selectStation)
    } else {
      renderPositionPlaceholder()
    }
  } else if (activeTab === 'map') {
    if (selectedStation) {
      renderStationDetail(selectedStation)
    } else if (state.pos) {
      viewEl.appendChild(mapContainer)
      mapView.render(state.pos, state.stations, state.settings.fuel, selectStation)
    } else {
      renderPositionPlaceholder()
    }
  } else if (activeTab === 'settings') {
    renderSettings(viewEl, state.settings, partial => store.setSettings(partial))
  } else {
    const placeholder = document.createElement('p')
    placeholder.className = 'placeholder'
    placeholder.textContent = t(`nav.${activeTab}`)
    viewEl.appendChild(placeholder)
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
