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
import { renderRadarList } from './ui/radar-list'
import { statusBanner } from './ui/banner'
import {
  freshnessStamp,
  freshnessText,
  joinNotice,
  locationProblem,
  viewNotice,
  viewNoticeText,
  type LocationProblem,
  type ViewNotice,
} from './ui/status'
import { nearbyRadars } from './core/radars'
import { RADARS } from './core/radars.data'
import { nearbyServiceAreas } from './core/services'
import { SERVICE_AREAS } from './core/services.data'
import { sortStations, type SortKey } from './core/pricing'
import { haversineKm, type LatLon } from './core/geo'
import type { Station } from './core/station'
import type { Settings } from './app/settings'

type Tab = 'list' | 'map' | 'trip' | 'settings'
const TABS: readonly Tab[] = ['list', 'map', 'trip', 'settings']
const TRIP_ZOOM = 15
// Bound radars drawn/listed on the map tab: filter by the active radius, then cap
// icons and list rows so a dense urban area can't flood Leaflet or the DOM.
const RADAR_MARKER_CAP = 60
const RADAR_LIST_CAP = 10
// The header's "updated 25 min ago" only changes by the minute.
const FRESHNESS_TICK_MS = 60_000
// Service areas are far sparser than radars, so a lower cap still covers any
// realistic radius without crowding the map.
const SERVICE_MARKER_CAP = 30

const store = new Store({ fetchProvince, kv: openIdbKv(), now: () => Date.now() })

setLocale(store.state.settings.locale ?? detectLocale())
applyTheme(store.state.settings.theme)

let activeTab: Tab = 'list'
let selectedStation: Station | undefined
let locationError: LocationProblem | undefined
let locating = false
let inlineError = false
let freshnessTimer: number | undefined

const root: HTMLElement =
  document.getElementById('app') ??
  (() => {
    throw new Error('missing #app root element')
  })()

root.innerHTML = `
  <header class="app-header">
    <span class="app-header__title" data-title></span>
    <time class="app-header__freshness" data-freshness></time>
    <button type="button" class="app-header__refresh" data-refresh></button>
  </header>
  <div class="app-status" role="status" data-status>
    <p class="app-error" data-error hidden></p>
    <span class="visually-hidden" data-announce></span>
  </div>
  <main class="app-main" data-view></main>
  <aside class="detail-card" data-card hidden></aside>
  <nav class="tab-bar">
    ${TABS.map((tab) => `<button type="button" class="tab-bar__tab" data-tab="${tab}"></button>`).join('')}
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
const announceEl = requireEl<HTMLElement>('[data-announce]')
const viewEl = requireEl<HTMLElement>('[data-view]')
const cardEl = requireEl<HTMLElement>('[data-card]')
const refreshButton = requireEl<HTMLButtonElement>('[data-refresh]')
const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-tab]')

const mapContainer = document.createElement('div')
mapContainer.className = 'map-view'
const mapView = new MapView(mapContainer)
const tripController = new TripController(
  store,
  mapView,
  () => {
    if (activeTab === 'trip') render()
  },
  selectStation,
)

root.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.closest('[data-refresh]')) {
    // Without a position there is nothing to refresh yet: get one, as Retry does.
    if (store.state.pos) void store.refresh()
    else locate()
    return
  }
  const tabButton = target.closest<HTMLElement>('[data-tab]')
  if (tabButton) {
    const previousTab = activeTab
    activeTab = tabButton.dataset.tab as Tab
    render()
    if (activeTab !== previousTab) viewEl.scrollTop = 0
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
  const { settings, pos, stations } = store.state
  renderDetail(detailContainer, selectedStation, undefined, {
    fuel: settings.fuel,
    origin: pos,
    nearby: pos ? withinRadius(stations, pos, settings.radiusKm) : stations,
  })
  cardEl.replaceChildren(close, detailContainer)
  cardEl.hidden = false
}

function locate(): void {
  locating = true
  render()
  getOnce()
    .then(
      (pos) => {
        locationError = undefined
        return store.loadFor(pos)
      },
      (err: unknown) => {
        locationError = locationProblem(err)
      },
    )
    .finally(() => {
      locating = false
      render()
    })
}

function renderNotice(notice: ViewNotice): void {
  const { title, hint } = viewNoticeText(notice, !navigator.onLine)
  const placeholder = document.createElement('p')
  placeholder.className = 'placeholder'
  placeholder.textContent = title
  if (hint) {
    const detail = document.createElement('span')
    detail.className = 'placeholder__hint'
    detail.textContent = hint
    placeholder.appendChild(detail)
  }
  viewEl.appendChild(placeholder)
  if (notice.kind === 'location' || notice.kind === 'loadFailed') {
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.className = 'placeholder-retry'
    retry.textContent = t('action.retry')
    retry.addEventListener(
      'click',
      notice.kind === 'location' ? locate : () => void store.refresh(),
    )
    viewEl.appendChild(retry)
  }
}

function isInlineError(notice: ViewNotice | undefined): boolean {
  return notice?.kind === 'location' || notice?.kind === 'loadFailed'
}

function withinRadius(stations: Station[], origin: LatLon, radiusKm: number): Station[] {
  return stations.filter((s) => haversineKm(origin, s.pos) <= radiusKm)
}

function renderStationList(
  container: HTMLElement,
  sorted: Station[],
  fuel: Settings['fuel'],
  origin: LatLon,
  sort: SortKey,
  selectedId?: string,
): void {
  container.appendChild(
    renderSortBar(sort, (key) => store.setSettings({ sort: key }), {
      current: fuel,
      onChange: (next) => store.setSettings({ fuel: next }),
    }),
  )
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

// The header age and the cached-prices banner are both relative to now, so they
// are redrawn together: on every render and on a timer while the page is visible.
function renderAges(): void {
  const state = store.state
  const now = Date.now()
  const busy = state.loading || locating
  freshnessEl.textContent = freshnessText(state, busy, now)
  const stamp = busy ? undefined : freshnessStamp(state)
  if (stamp) {
    freshnessEl.setAttribute('datetime', stamp.datetime)
    freshnessEl.title = stamp.title
  } else {
    freshnessEl.removeAttribute('datetime')
    freshnessEl.removeAttribute('title')
  }

  const banner = statusBanner(state, {
    online: navigator.onLine,
    now,
    locationError,
    inline: inlineError,
  })
  errorEl.textContent = banner?.text ?? ''
  errorEl.classList.toggle('app-error--notice', banner?.tone === 'notice')
  errorEl.hidden = !banner
}

function syncFreshnessTimer(): void {
  window.clearInterval(freshnessTimer)
  freshnessTimer = undefined
  if (document.visibilityState === 'visible') {
    renderAges()
    freshnessTimer = window.setInterval(renderAges, FRESHNESS_TICK_MS)
  }
}

function render(): void {
  const state = store.state

  refreshStaticCopy()

  for (const button of tabButtons) {
    const isActive = button.dataset.tab === activeTab
    button.classList.toggle('is-active', isActive)
    if (isActive) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }

  const busy = state.loading || locating
  refreshButton.classList.toggle('is-busy', busy)
  refreshButton.disabled = busy

  viewEl.classList.toggle('is-loading', state.loading)
  viewEl.replaceChildren()

  const selectedId = selectedStation?.id
  const noticeFor = (nearby: number): ViewNotice | undefined =>
    viewNotice({
      hasPos: state.pos !== undefined,
      nearby,
      radiusKm: state.settings.radiusKm,
      loading: state.loading,
      locating,
      error: state.error,
      locationError,
    })
  let notice: ViewNotice | undefined

  if (activeTab === 'list') {
    const nearby = state.pos ? withinRadius(state.stations, state.pos, state.settings.radiusKm) : []
    notice = noticeFor(nearby.length)
    if (notice) {
      renderNotice(notice)
    } else if (state.pos) {
      const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
      renderStationList(
        viewEl,
        sorted,
        state.settings.fuel,
        state.pos,
        state.settings.sort,
        selectedId,
      )
    }
  } else if (activeTab === 'map') {
    if (state.pos) {
      const nearby = withinRadius(state.stations, state.pos, state.settings.radiusKm)
      const radarHits = state.settings.radarLayerEnabled
        ? nearbyRadars(state.pos, RADARS, state.settings.radiusKm, RADAR_MARKER_CAP)
        : []
      const serviceHits = state.settings.servicesLayerEnabled
        ? nearbyServiceAreas(state.pos, SERVICE_AREAS, state.settings.radiusKm, SERVICE_MARKER_CAP)
        : []
      notice = noticeFor(nearby.length + radarHits.length + serviceHits.length)
      if (notice) {
        renderNotice(notice)
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
        if (radarHits.length > 0) mapView.renderRadars(radarHits.map((h) => h.radar))
        else mapView.clearRadars()
        if (serviceHits.length > 0) mapView.renderServiceAreas(serviceHits.map((h) => h.area))
        else mapView.clearServiceAreas()
        mapView.invalidateSize()
        if (selectedStation) mapView.panTo(selectedStation.pos)
        if (sorted.length > 0)
          renderStationList(
            listWrap,
            sorted,
            state.settings.fuel,
            state.pos,
            state.settings.sort,
            selectedId,
          )
        if (radarHits.length > 0)
          listWrap.appendChild(renderRadarList(radarHits, 'radar.nearby.title', RADAR_LIST_CAP))
      }
    } else {
      notice = noticeFor(0)
      renderNotice(notice ?? { kind: 'loading' })
    }
  } else if (activeTab === 'trip') {
    const tripPos = tripController.currentUpdate?.state.lastPos ?? state.pos
    if (tripPos) {
      const nearby = withinRadius(state.stations, tripPos, state.settings.radiusKm)
      const mapWrap = document.createElement('div')
      mapWrap.className = 'trip-map'
      mapWrap.appendChild(mapContainer)
      viewEl.appendChild(mapWrap)
      mapView.render(
        tripPos,
        tripController.stationsForMap(nearby),
        state.settings.fuel,
        selectStation,
        { recenter: true, selectedId },
      )
      // While a trip is active, onFix owns the radar layer (per GPS fix); when it
      // is not, keep the preview map's radar layer in sync with the toggle so
      // markers drawn on the map tab don't linger here after it's turned off.
      if (!tripController.isActive) {
        if (state.settings.radarLayerEnabled) {
          mapView.renderRadars(
            nearbyRadars(tripPos, RADARS, state.settings.radiusKm, RADAR_MARKER_CAP).map(
              (h) => h.radar,
            ),
          )
        } else {
          mapView.clearRadars()
        }
      }
      if (state.settings.servicesLayerEnabled) {
        mapView.renderServiceAreas(
          nearbyServiceAreas(
            tripPos,
            SERVICE_AREAS,
            state.settings.radiusKm,
            SERVICE_MARKER_CAP,
          ).map((h) => h.area),
        )
      } else {
        mapView.clearServiceAreas()
      }
      mapView.invalidateSize()
    }
    const readout = document.createElement('div')
    viewEl.appendChild(readout)
    tripController.render(readout, tripController.currentUpdate, selectedId)
  } else if (activeTab === 'settings') {
    renderSettings(viewEl, state.settings, handleSettingsChange)
  }

  const inline = isInlineError(notice)
  inlineError = inline
  renderAges()
  // The inline error sits in the view, outside the live region; voice it once here.
  const announcement = inline && notice ? joinNotice(viewNoticeText(notice, !navigator.onLine)) : ''
  if (announceEl.textContent !== announcement) announceEl.textContent = announcement

  renderCard()
}

store.subscribe(render)
render()
document.addEventListener('visibilitychange', syncFreshnessTimer)
syncFreshnessTimer()
locate()
