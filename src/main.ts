import './styles.css'
import { Store } from './app/store'
import { fetchProvince } from './adapters/api'
import { openIdbKv } from './adapters/cache'
import { getOnce } from './adapters/geolocation'
import { detectLocale, setLocale, t } from './i18n'
import { renderBandLegend, renderList } from './ui/list'
import { renderDetail } from './ui/detail'
import { renderSettings } from './ui/settings'
import { TripController } from './ui/trip'
import { MapView } from './ui/map'
import { renderSortBar } from './ui/sortBar'
import { renderAnswerCard } from './ui/answer-card'
import { bestChoice } from './core/best-choice'
import { renderRadarList } from './ui/radar-list'
import { renderPaneSwitch } from './ui/pane-switch'
import { statusBanner } from './ui/banner'
import { createAnnouncer } from './ui/announcer'
import { watchConnectivity } from './app/connectivity'
import { renderPlaceSearch, renderPlaceStrip } from './ui/place-search'
import { renderFirstRun } from './ui/first-run'
import {
  cardHost,
  navTabs,
  placeNav,
  tabAcrossBreakpoint,
  tabLabelKey,
  watchDesktop,
  type PhoneStationsTab,
} from './ui/layout'
import { loadPaneView, savePaneView, type PaneView } from './app/pane-view'
import { formatNumber } from './i18n/format'
import { geolocationPermission, isFirstRun, markFirstRunDone } from './app/first-run'
import { placesFromRows, type Place } from './core/places'
import {
  freshnessStamp,
  freshnessText,
  joinNotice,
  locationProblem,
  needsRefreshOnReconnect,
  viewNotice,
  viewNoticeText,
  type LocationProblem,
  type ViewNotice,
} from './ui/status'
import { nearbyRadars, type RadarHit } from './core/radars'
import { RADARS } from './core/radars.data'
import { nearbyServiceAreas, type ServiceAreaHit } from './core/services'
import { SERVICE_AREAS } from './core/services.data'
import {
  radiusReference,
  sortStations,
  withinRadius,
  type PriceReference,
  type SortKey,
} from './core/pricing'
import type { LatLon } from './core/geo'
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
const RECONNECT_SETTLE_MS = 2_000

const store = new Store({ fetchProvince, kv: openIdbKv(), now: () => Date.now() })

setLocale(store.state.settings.locale ?? detectLocale())
applyTheme(store.state.settings.theme)

let activeTab: Tab = 'list'
let selectedStation: Station | undefined
let locationError: LocationProblem | undefined
let locating = false
let inlineError = false
// Only a refusal blocks a trip: an unavailable fix may come back once moving.
let gpsDenied = false
let placeQuery = ''
// Before the browser's own prompt, a first visit says what the location is for.
let firstRun: 'checking' | 'intro' | 'search' | undefined
// Asked on the intro screen and saved only once the user moves on from it, so a
// reload before that still shows the intro instead of skipping it.
let firstRunFuel = store.state.settings.fuel
let places: Promise<readonly Place[]> | undefined
let freshnessTimer: number | undefined
// What the Map tab last framed: entering the tab or a new position reframes the
// radius, while a mere data refresh keeps the user's own pan and zoom.
let mapFramedFor: string | undefined
// The tab the view last drew, so a re-render of it keeps a pane's own scroll.
let renderedTab: Tab | undefined
// Which of List and Map the phone last showed, to go back to on narrowing.
let phoneStationsTab: PhoneStationsTab = 'list'
// Stations or radars beside the map; a new pick starts the pane at the top.
let paneView: PaneView = loadPaneView()
let renderedPaneView: PaneView | undefined
let focusSwitch = false

const root: HTMLElement =
  document.getElementById('app') ??
  (() => {
    throw new Error('missing #app root element')
  })()

root.innerHTML = `
  <header class="app-header">
    <span class="app-header__title" data-title></span>
    <time class="app-header__freshness" data-freshness></time>
    <button type="button" class="app-header__refresh" data-refresh>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 3.5v5h-5"/></svg>
    </button>
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
const headerEl = requireEl<HTMLElement>('.app-header')
const navEl = requireEl<HTMLElement>('.tab-bar')

const isDesktop = watchDesktop(window, (desktop) => {
  placeNav(navEl, desktop, headerEl)
  const tab = tabAcrossBreakpoint(activeTab, desktop, phoneStationsTab)
  if (tab === activeTab) render()
  else showTab(tab)
})
placeNav(navEl, isDesktop(), headerEl)

const mapContainer = document.createElement('div')
mapContainer.className = 'map-view'
const mapView = new MapView(mapContainer)
const announce = createAnnouncer(document.body)
const tripController = new TripController(
  store,
  mapView,
  () => {
    if (activeTab === 'trip') render()
  },
  selectStation,
  announce,
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
  if (tabButton) showTab(tabButton.dataset.tab as Tab)
})

function showTab(tab: Tab): void {
  const previousTab = activeTab
  activeTab = tab
  if (!isDesktop() && (tab === 'list' || tab === 'map')) phoneStationsTab = tab
  // On a desktop List shares the map too, and frames the radius like Map does.
  const framesRadius = tab === 'map' || (tab === 'list' && isDesktop())
  if (framesRadius && previousTab !== tab) mapFramedFor = undefined
  render()
  if (activeTab !== previousTab) viewEl.scrollTop = 0
  if (activeTab === 'map' || activeTab === 'trip') mapView.invalidateSize()
  mapView.raiseRadars(activeTab === 'trip')
  if (activeTab === 'trip') {
    const tp = tripController.currentUpdate?.state.lastPos ?? store.state.pos
    if (tp) mapView.focus(tp, TRIP_ZOOM)
  }
}

// Set when a card opens, so only that render moves focus into it.
let focusCard = false

function selectStation(station: Station): void {
  selectedStation = station
  focusCard = true
  render()
}

// Focus goes back to the row the card was opened from, found again by id
// because the render just rebuilt every row.
function closeCard(): void {
  const id = selectedStation?.id
  selectedStation = undefined
  render()
  const rows = viewEl.querySelectorAll<HTMLElement>('[data-station]')
  // Opened from a map pin while the pane lists radars: no row to go back to.
  const back =
    [...rows].find((row) => row.dataset.station === id) ??
    viewEl.querySelector<HTMLElement>('.pane-switch input:checked')
  back?.focus()
}

function renderCard(reference: PriceReference | undefined): void {
  if (!selectedStation) {
    cardEl.hidden = true
    cardEl.replaceChildren()
    return
  }
  // Every render rebuilds the card; whoever was on its close button stays there.
  const closeHadFocus = document.activeElement?.classList.contains('detail-card__close') ?? false
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'detail-card__close'
  close.setAttribute('aria-label', t('nav.close'))
  close.textContent = '×'
  close.addEventListener('click', closeCard)
  const detailContainer = document.createElement('div')
  const { settings, pos } = store.state
  renderDetail(detailContainer, selectedStation, undefined, {
    fuel: settings.fuel,
    origin: pos,
    reference,
    tripActive: tripController.isActive,
  })
  cardEl.replaceChildren(close, detailContainer)
  cardEl.dataset.host = cardHost(activeTab, isDesktop())
  cardEl.hidden = false
  if (focusCard) {
    focusCard = false
    const heading = cardEl.querySelector<HTMLElement>('.station-detail__brand')
    if (heading) {
      heading.tabIndex = -1
      heading.focus()
    }
  } else if (closeHadFocus) {
    close.focus()
  }
}

function endFirstRun(): void {
  if (!firstRun) return
  // Skipped while still checking the permission: the default fuel stands.
  if (firstRun !== 'checking') store.setSettings({ fuel: firstRunFuel })
  firstRun = undefined
  markFirstRunDone()
}

function locate(): void {
  endFirstRun()
  locating = true
  render()
  getOnce()
    .then(
      (pos) => {
        locationError = undefined
        gpsDenied = false
        if (store.state.settings.manualPlace) store.setSettings({ manualPlace: undefined })
        return store.loadFor(pos)
      },
      (err: unknown) => {
        locationError = locationProblem(err)
        gpsDenied = locationError === 'denied'
      },
    )
    .finally(() => {
      locating = false
      render()
    })
}

// Lazy: the town list is only fetched by someone who needs it, and the
// service worker precaches the chunk so it is there offline too.
function loadPlaces(): Promise<readonly Place[]> {
  places ??= import('./core/places.data').then((m) =>
    placesFromRows(m.PLACE_ROWS, m.PLACE_PROVINCES),
  )
  return places
}

function usePlace(place: Place): void {
  endFirstRun()
  locationError = undefined
  placeQuery = ''
  const { name, province, pos } = place
  store.setSettings({ manualPlace: { name, province, pos } })
  void store.loadFor(pos)
}

function renderPlaceStripIn(container: HTMLElement): void {
  const manual = store.state.settings.manualPlace
  if (manual) container.appendChild(renderPlaceStrip({ name: manual.name, onUseGps: locate }))
}

function actionButton(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = primary ? 'notice__action' : 'notice__action notice__action--secondary'
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function pickPaneView(view: PaneView): void {
  paneView = view
  savePaneView(view)
}

function showRadars(): void {
  pickPaneView('radars')
  if (!store.state.settings.radarLayerEnabled) store.setSettings({ radarLayerEnabled: true })
  showTab(isDesktop() ? 'list' : 'map')
}

function hasRadarsAround(pos: LatLon): boolean {
  return nearbyRadars(pos, RADARS, store.state.settings.radiusKm, 1).length > 0
}

// Loading and an empty radius are ordinary states and stay quiet; a failure
// gets a toned box and a way forward, not just a sentence and Retry.
function renderNotice(notice: ViewNotice): void {
  const { title, hint } = viewNoticeText(notice, !navigator.onLine)
  if (notice.kind !== 'location' && notice.kind !== 'loadFailed') {
    viewEl.appendChild(placeholder(title))
    return
  }
  const box = document.createElement('section')
  box.className = 'notice'
  box.dataset.tone = notice.kind === 'location' ? 'warn' : 'error'
  const heading = document.createElement('p')
  heading.className = 'notice__title'
  heading.textContent = title
  box.appendChild(heading)
  if (hint) {
    const detail = document.createElement('p')
    detail.className = 'notice__hint'
    detail.textContent = hint
    box.appendChild(detail)
  }
  const actions = document.createElement('div')
  actions.className = 'notice__actions'
  if (notice.kind === 'location') {
    box.appendChild(
      renderPlaceSearch({
        load: loadPlaces,
        onPick: usePlace,
        query: placeQuery,
        onQuery: (q) => {
          placeQuery = q
        },
      }),
    )
    actions.appendChild(actionButton(t('action.retry'), false, locate))
  } else {
    const pos = store.state.pos
    if (pos && hasRadarsAround(pos))
      actions.appendChild(actionButton(t('radar.offline.offer'), true, showRadars))
    actions.appendChild(
      actionButton(t('action.retry'), false, () => {
        void store.refresh()
      }),
    )
  }
  box.appendChild(actions)
  viewEl.appendChild(box)
}

function pickTownFirst(): void {
  firstRun = 'search'
  render()
  viewEl.querySelector<HTMLInputElement>('.first-run .place-search input')?.focus()
}

function renderFirstRunIn(container: HTMLElement): void {
  container.appendChild(
    renderFirstRun({
      onLocate: locate,
      onPickTown: pickTownFirst,
      fuel: firstRunFuel,
      onFuel: (fuel) => {
        firstRunFuel = fuel
      },
      search:
        firstRun === 'search'
          ? {
              load: loadPlaces,
              onPick: usePlace,
              query: placeQuery,
              onQuery: (q) => {
                placeQuery = q
              },
            }
          : undefined,
    }),
  )
}

function isInlineError(notice: ViewNotice | undefined): boolean {
  return notice?.kind === 'location' || notice?.kind === 'loadFailed'
}

function renderStationList(
  container: HTMLElement,
  sorted: Station[],
  fuel: Settings['fuel'],
  origin: LatLon,
  sort: SortKey,
  reference: PriceReference | undefined,
  selectedId?: string,
  answer?: HTMLElement,
): void {
  container.appendChild(
    renderSortBar(sort, (key) => store.setSettings({ sort: key }), {
      current: fuel,
      onChange: (next) => store.setSettings({ fuel: next }),
    }),
  )
  if (answer) container.appendChild(answer)
  if (reference) container.appendChild(renderBandLegend(store.state.settings.radiusKm))
  const listContainer = document.createElement('div')
  container.appendChild(listContainer)
  renderList(listContainer, sorted, fuel, origin, selectStation, { selectedId, reference })
}

function answerCard(
  nearby: readonly Station[],
  pos: LatLon,
  reference: PriceReference | undefined,
): HTMLElement | undefined {
  const { fuel, tankLitres } = store.state.settings
  const choice = bestChoice(nearby, fuel, pos, tankLitres, new Date())
  return (
    choice && renderAnswerCard(choice, { fuel, reference, tankLitres, onSelect: selectStation })
  )
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
  refreshButton.setAttribute('aria-label', t('app.refresh'))
  refreshButton.title = t('app.refresh')
  const desktop = isDesktop()
  const shown = navTabs(desktop)
  for (const button of tabButtons) {
    const tab = button.dataset.tab as Tab
    button.textContent = t(tabLabelKey(tab, desktop))
    button.hidden = !shown.includes(tab)
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

function mapLayersAround(pos: LatLon): {
  radarHits: RadarHit[]
  serviceHits: ServiceAreaHit[]
} {
  const { radarLayerEnabled, servicesLayerEnabled, radiusKm } = store.state.settings
  return {
    radarHits: radarLayerEnabled ? nearbyRadars(pos, RADARS, radiusKm, RADAR_MARKER_CAP) : [],
    serviceHits: servicesLayerEnabled
      ? nearbyServiceAreas(pos, SERVICE_AREAS, radiusKm, SERVICE_MARKER_CAP)
      : [],
  }
}

// The map beside the stations: stacked on a phone, side by side on a desktop,
// where the list pane comes first so keyboard order follows the eye. The pane
// opens on a switch between the stations and the radars around; the map keeps
// both layers whichever the pane lists.
function renderMapSplit(
  pos: LatLon,
  sorted: Station[],
  reference: PriceReference | undefined,
  radarHits: RadarHit[],
  serviceHits: ServiceAreaHit[],
  answer?: HTMLElement,
  noStations?: ViewNotice,
): void {
  const { settings } = store.state
  const desktop = isDesktop()
  const selectedId = selectedStation?.id
  const split = document.createElement('div')
  split.className = 'map-split'
  const mapWrap = document.createElement('div')
  mapWrap.className = 'map-split__map'
  mapWrap.appendChild(mapContainer)
  const listWrap = document.createElement('div')
  listWrap.className = 'map-split__list'
  listWrap.dataset.pane = ''
  // The open card covers this pane; its rows must not take focus behind it.
  listWrap.inert = selectedStation !== undefined && cardHost(activeTab, desktop) === 'pane'
  // The list counts what it shows, so it does not hang on the map layer toggle.
  const listedRadars = nearbyRadars(pos, RADARS, settings.radiusKm, RADAR_LIST_CAP)
  listWrap.appendChild(
    renderPaneSwitch(paneView, listedRadars.length, (view) => {
      pickPaneView(view)
      focusSwitch = true
      render()
    }),
  )
  renderPlaceStripIn(listWrap)
  if (desktop) split.append(listWrap, mapWrap)
  else split.append(mapWrap, listWrap)
  viewEl.appendChild(split)
  mapView.render(pos, sorted, settings.fuel, selectStation, {
    selectedId,
    reference,
    radiusKm: settings.radiusKm,
  })
  if (radarHits.length > 0) mapView.renderRadars(radarHits.map((h) => h.radar))
  else mapView.clearRadars()
  if (serviceHits.length > 0) mapView.renderServiceAreas(serviceHits.map((h) => h.area))
  else mapView.clearServiceAreas()
  mapView.invalidateSize()
  const frame = `${pos.lat},${pos.lon},${settings.radiusKm}`
  if (frame !== mapFramedFor) {
    mapFramedFor = frame
    mapView.fitRadius(pos, settings.radiusKm)
  }
  if (selectedStation) mapView.panTo(selectedStation.pos)
  if (paneView === 'radars') {
    if (listedRadars.length > 0) {
      listWrap.appendChild(renderRadarList(listedRadars, undefined, RADAR_LIST_CAP, pos))
    } else {
      listWrap.appendChild(
        placeholder(t('radar.nearby.empty').replace('{radius}', formatNumber(settings.radiusKm))),
      )
    }
  } else if (sorted.length > 0) {
    renderStationList(
      listWrap,
      sorted,
      settings.fuel,
      pos,
      settings.sort,
      reference,
      selectedId,
      answer,
    )
  } else if (noStations && noStations.kind !== 'loadFailed') {
    // A failed load already speaks from the banner above.
    listWrap.appendChild(placeholder(viewNoticeText(noStations, !navigator.onLine).title))
  }
}

function placeholder(text: string): HTMLElement {
  const el = document.createElement('p')
  el.className = 'placeholder'
  el.textContent = text
  return el
}

function render(): void {
  const state = store.state
  const desktop = isDesktop()

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
  // On a desktop the view does not scroll, its panes do; each render rebuilds
  // them, so a re-render of the same tab carries their scroll over.
  const paneScroll =
    desktop && activeTab === renderedTab && paneView === renderedPaneView
      ? (viewEl.querySelector<HTMLElement>('[data-pane]')?.scrollTop ?? 0)
      : 0
  renderedTab = activeTab
  renderedPaneView = paneView
  viewEl.replaceChildren()

  const selectedId = selectedStation?.id
  // One reference per render, shared by the list, the map and the card.
  const reference = state.pos
    ? radiusReference(state.stations, state.settings.fuel, state.pos, state.settings.radiusKm)
    : undefined
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
  const introducing = !state.pos && (firstRun === 'intro' || firstRun === 'search')
  // The card bands like the surface it was opened from.
  let cardReference = reference

  if (activeTab === 'list') {
    const nearby = state.pos ? withinRadius(state.stations, state.pos, state.settings.radiusKm) : []
    // On a desktop this is Map's view too: radars drawn on it are worth showing
    // with no station around, and taking up the offline offer needs just that.
    const layers = state.pos && desktop ? mapLayersAround(state.pos) : undefined
    const shown = nearby.length + (layers?.radarHits.length ?? 0)
    notice = introducing ? undefined : noticeFor(shown)
    const split = layers !== undefined && !introducing && !notice
    // The split draws the strip in its own list pane.
    if (!split) renderPlaceStripIn(viewEl)
    if (introducing) {
      renderFirstRunIn(viewEl)
    } else if (notice) {
      renderNotice(notice)
    } else if (state.pos && layers) {
      const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
      const answer = answerCard(nearby, state.pos, reference)
      renderMapSplit(
        state.pos,
        sorted,
        reference,
        layers.radarHits,
        layers.serviceHits,
        answer,
        noticeFor(nearby.length),
      )
    } else if (state.pos) {
      const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
      renderStationList(
        viewEl,
        sorted,
        state.settings.fuel,
        state.pos,
        state.settings.sort,
        reference,
        selectedId,
        answerCard(nearby, state.pos, reference),
      )
    }
  } else if (activeTab === 'map') {
    if (state.pos) {
      const nearby = withinRadius(state.stations, state.pos, state.settings.radiusKm)
      const { radarHits, serviceHits } = mapLayersAround(state.pos)
      notice = noticeFor(nearby.length + radarHits.length + serviceHits.length)
      if (notice) {
        renderPlaceStripIn(viewEl)
        renderNotice(notice)
      } else {
        const sorted = sortStations(nearby, state.settings.fuel, state.pos, state.settings.sort)
        renderMapSplit(state.pos, sorted, reference, radarHits, serviceHits)
      }
    } else if (introducing) {
      renderFirstRunIn(viewEl)
    } else {
      notice = noticeFor(0)
      renderNotice(notice ?? { kind: 'loading' })
    }
  } else if (activeTab === 'trip') {
    const tripPos = tripController.currentUpdate?.state.lastPos ?? state.pos
    // Around the car, not the last List position: the radius moves with the trip.
    const tripReference = tripPos
      ? radiusReference(state.stations, state.settings.fuel, tripPos, state.settings.radiusKm)
      : undefined
    cardReference = tripReference
    const readout = document.createElement('div')
    readout.className = 'trip-readout'
    // On a desktop the readout is the side pane, left of the map and first in
    // keyboard order; on a phone it follows the map down the page.
    if (desktop) {
      readout.dataset.pane = ''
      viewEl.appendChild(readout)
    }
    if (tripPos) {
      const nearby = withinRadius(state.stations, tripPos, state.settings.radiusKm)
      const mapWrap = document.createElement('div')
      mapWrap.className = 'trip-map'
      mapWrap.appendChild(mapContainer)
      viewEl.appendChild(mapWrap)
      // Mid-trip the car sits low on the map, facing what lies ahead.
      const aheadDeg = tripController.isActive
        ? tripController.currentUpdate?.state.headingDeg
        : undefined
      mapView.render(
        tripPos,
        tripController.stationsForMap(nearby),
        state.settings.fuel,
        selectStation,
        { recenter: true, selectedId, aheadDeg, reference: tripReference },
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
    if (!desktop) viewEl.appendChild(readout)
    const pricesUnavailable = state.error !== undefined && state.stations.length === 0
    // The trip view says what is left without prices; the top banner would say
    // it twice. A refused location takes that place while no trip runs.
    if (pricesUnavailable && (tripController.isActive || !gpsDenied))
      notice = { kind: 'loadFailed' }
    tripController.render(readout, tripController.currentUpdate, selectedId, {
      locationDenied: gpsDenied,
      pricesUnavailable,
      reference: tripReference,
    })
  } else if (activeTab === 'settings') {
    renderSettings(viewEl, state.settings, handleSettingsChange)
  }

  const inline = isInlineError(notice)
  inlineError = inline
  renderAges()
  // The inline error sits in the view, outside the live region; voice it once here.
  const announcement = inline && notice ? joinNotice(viewNoticeText(notice, !navigator.onLine)) : ''
  if (announceEl.textContent !== announcement) announceEl.textContent = announcement

  if (paneScroll > 0) {
    const pane = viewEl.querySelector<HTMLElement>('[data-pane]')
    if (pane) pane.scrollTop = paneScroll
  }
  // The pick rebuilt the switch; arrow keys go on from the option just chosen.
  if (focusSwitch) {
    focusSwitch = false
    viewEl.querySelector<HTMLElement>('.pane-switch input:checked')?.focus()
  }

  renderCard(cardReference)
}

// The position watch outlives a hidden page but gets no fixes there, so the
// trip alerts pause until the page is back, and then say so.
let tripHidden = false
function onVisibilityChange(): void {
  syncFreshnessTimer()
  const visible = document.visibilityState === 'visible'
  if (!tripController.isActive) tripHidden = false
  else if (!visible) tripHidden = true
  else if (tripHidden) {
    tripHidden = false
    announce(t('trip.resumed'), 'polite')
  }
}

store.subscribe(render)
render()
document.addEventListener('visibilitychange', onVisibilityChange)
syncFreshnessTimer()
watchConnectivity(window, {
  delayMs: RECONNECT_SETTLE_MS,
  onChange: render,
  shouldRefresh: () => needsRefreshOnReconnect(store.state, Date.now()),
  refresh: () => store.refresh(),
})

// A town picked by hand outlives a reload: asking for the location again would
// only bring back the prompt or the refusal the user already worked around.
const manualPlace = store.state.settings.manualPlace
if (manualPlace) {
  void store.loadFor(manualPlace.pos)
  void navigator.permissions
    ?.query({ name: 'geolocation' })
    .then((status) => {
      gpsDenied = status.state === 'denied'
      render()
    })
    .catch(() => {})
} else if (isFirstRun()) {
  firstRun = 'checking'
  render()
  // Granted needs no explaining, and denied would only reach the refusal later.
  void geolocationPermission().then((permission) => {
    if (firstRun !== 'checking') return
    if (permission === 'granted' || permission === 'denied') {
      locate()
    } else {
      firstRun = 'intro'
      render()
    }
  })
} else {
  locate()
}
