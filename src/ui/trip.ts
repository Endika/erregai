import type { Station } from '../core/station'
import type { LatLon } from '../core/geo'
import { haversineKm } from '../core/geo'
import { newTripState, updateTrip, type TripConfig, type TripState, type TripUpdate } from '../core/trip'
import { radarsAhead, nearbyRadars, nextRadarAlerts, type RadarHit } from '../core/radars'
import { nextProximityAlerts } from '../core/proximity'
import { cheapAhead } from '../core/fuel-alert'
import { RADARS, RADARS_DATASET_DATE } from '../core/radars.data'
import { watchPosition } from '../adapters/geolocation'
import { ensureNotifyPermission, notify } from '../adapters/notifications'
import { keepScreenAwake } from '../adapters/wakeLock'
import { playRadarBeep, playFuelChime, unlockAudio } from '../adapters/audio'
import { priceOf, sortStations } from '../core/pricing'
import { provinceFor } from '../core/provinces'
import { t } from '../i18n'
import { renderSortBar } from './sortBar'
import { renderRadarList } from './radar-list'
import type { MapView } from './map'
import type { Store } from '../app/store'

const DEFAULT_CORRIDOR_DEG = 45
const ADJACENT_PROVINCES = 2
const NEARBY_RADARS = 3
// Max radars drawn as icons on the trip map (bounds DOM/Leaflet in dense areas).
const RADAR_LAYER_CAP = 60

export class TripController {
  private tripState: TripState = newTripState()
  private lastUpdate: TripUpdate | undefined
  private lastProvinceId: string | undefined
  private stopFn: (() => void) | undefined
  private active = false
  private banner: Station | undefined
  private radarBanner: string | undefined
  private alertedRadarIds = new Set<string>()
  private radarHits: RadarHit[] = []
  private fuelBanner: string | undefined
  private alertedFuelIds = new Set<string>()
  private releaseWakeLock: (() => void) | undefined

  constructor(
    private store: Store,
    private map: MapView,
    private onChange: () => void,
    private onSelect: (station: Station) => void,
  ) {}

  get isActive(): boolean {
    return this.active
  }

  get currentUpdate(): TripUpdate | undefined {
    return this.lastUpdate
  }

  async start(): Promise<void> {
    // Runs within the toggle button's click handler, so this synchronous
    // prefix is still a user gesture — unlock audio before any await, or the
    // gesture context is lost and mobile cues stay silent.
    unlockAudio()
    if (this.active) return
    this.active = true
    this.tripState = newTripState()
    this.lastUpdate = undefined
    this.lastProvinceId = undefined
    this.banner = undefined
    this.radarBanner = undefined
    this.alertedRadarIds = new Set<string>()
    this.radarHits = []
    this.fuelBanner = undefined
    this.alertedFuelIds = new Set<string>()
    this.map.clearRadars()
    this.releaseWakeLock = keepScreenAwake()

    await ensureNotifyPermission()

    this.stopFn = watchPosition(
      pos => { void this.onFix(pos) },
      () => { /* location errors surface via the app-wide location banner */ },
    )
    this.onChange()
  }

  stop(): void {
    this.active = false
    this.stopFn?.()
    this.stopFn = undefined
    this.releaseWakeLock?.()
    this.releaseWakeLock = undefined
    this.tripState = newTripState()
    this.lastUpdate = undefined
    this.lastProvinceId = undefined
    this.banner = undefined
    this.radarBanner = undefined
    this.alertedRadarIds = new Set<string>()
    this.radarHits = []
    this.fuelBanner = undefined
    this.alertedFuelIds = new Set<string>()
    this.map.clearRadars()
    this.onChange()
  }

  private async onFix(pos: LatLon): Promise<void> {
    const provinceId = provinceFor(pos).id
    if (provinceId !== this.lastProvinceId) {
      this.lastProvinceId = provinceId
      await this.store.ensureAround(pos, ADJACENT_PROVINCES)
    }

    const settings = this.store.state.settings
    const cfg: TripConfig = { fuel: settings.fuel, radiusKm: settings.radiusKm, corridorDeg: DEFAULT_CORRIDOR_DEG }
    const update = updateTrip(this.tripState, pos, this.store.state.stations, cfg)
    this.tripState = update.state
    this.lastUpdate = update

    if (update.alert) {
      const price = priceOf(update.alert, cfg.fuel)
      const distanceKm = haversineKm(pos, update.alert.pos).toFixed(1)
      const priceLabel = price !== undefined ? price.toFixed(3) : '—'
      notify(t('trip.cheapestAhead'), `${update.alert.brand} · ${priceLabel} · ${distanceKm} km`)
      this.banner = update.alert
    }

    if (settings.radarAlertsEnabled) {
      const alertDistanceKm = settings.radarAlertDistanceM / 1000
      const hits = radarsAhead(pos, this.tripState.headingDeg, RADARS, { radiusKm: alertDistanceKm, corridorDeg: DEFAULT_CORRIDOR_DEG })
      this.radarHits = hits
      const { alertedIds, newlyAlerted } = nextRadarAlerts(this.alertedRadarIds, hits, alertDistanceKm)
      this.alertedRadarIds = alertedIds
      if (newlyAlerted.length > 0) {
        const nearest = newlyAlerted[0]
        const meters = Math.round(nearest.distanceKm * 1000)
        this.radarBanner = t('radar.alert.banner').replace('{m}', String(meters))
        notify(t('radar.alert.title'), t('radar.alert.body').replace('{via}', nearest.radar.via))
        if (settings.radarSound) playRadarBeep()
      }
    } else {
      this.radarHits = []
    }

    // Map visibility has its own toggle, independent of the audio/notification
    // alert: show nearby radars as icons even before an alert would fire.
    if (settings.radarLayerEnabled) {
      const displayRadars = nearbyRadars(pos, RADARS, settings.radiusKm, RADAR_LAYER_CAP)
      this.map.renderRadars(displayRadars.map(h => h.radar))
    } else {
      this.map.clearRadars()
    }

    if (settings.fuelAlertMode !== 'off') {
      const alertDistanceKm = settings.fuelAlertDistanceM / 1000
      const hits = cheapAhead(pos, this.tripState.headingDeg, this.store.state.stations, {
        fuel: settings.fuel,
        radiusKm: settings.radiusKm,
        corridorDeg: DEFAULT_CORRIDOR_DEG,
        alertDistanceKm,
        mode: settings.fuelAlertMode,
      })
      const { alertedIds, newlyAlerted } = nextProximityAlerts(
        this.alertedFuelIds,
        hits.map(h => ({ id: h.station.id, distanceKm: h.distanceKm })),
        alertDistanceKm,
      )
      this.alertedFuelIds = alertedIds
      if (newlyAlerted.length > 0) {
        const nearest = hits.find(h => h.station.id === newlyAlerted[0].id)!
        const meters = Math.round(nearest.distanceKm * 1000)
        this.fuelBanner = t('fuel.alert.banner').replace('{brand}', nearest.station.brand).replace('{m}', String(meters))
        notify(t('fuel.alert.title'), t('fuel.alert.body').replace('{brand}', nearest.station.brand))
        if (settings.fuelSound) playFuelChime()
      }
    }

    this.onChange()
  }

  render(container: HTMLElement, update: TripUpdate | undefined, selectedId?: string): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'trip-view'

    const note = document.createElement('p')
    note.className = 'trip-view__note'
    note.textContent = t('trip.foregroundOnly')
    wrapper.appendChild(note)

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'trip-view__toggle'
    toggle.textContent = this.active ? t('trip.stop') : t('trip.start')
    toggle.addEventListener('click', () => { void (this.active ? this.stop() : this.start()) })
    wrapper.appendChild(toggle)

    if (this.banner) {
      const banner = document.createElement('div')
      banner.className = 'trip-view__banner'
      const price = priceOf(this.banner, this.store.state.settings.fuel)
      banner.textContent = `${t('trip.cheapestAhead')}: ${this.banner.brand} · ${price !== undefined ? price.toFixed(3) : '—'}`
      wrapper.appendChild(banner)
    }

    if (this.radarBanner) {
      const radarBanner = document.createElement('div')
      radarBanner.className = 'trip-view__banner trip-view__banner--radar'
      radarBanner.textContent = this.radarBanner
      wrapper.appendChild(radarBanner)
    }

    if (this.fuelBanner) {
      const fuelBanner = document.createElement('div')
      fuelBanner.className = 'trip-view__banner trip-view__banner--fuel'
      fuelBanner.textContent = this.fuelBanner
      wrapper.appendChild(fuelBanner)
    }

    if (this.active) {
      const sort = this.store.state.settings.tripSort
      wrapper.appendChild(renderSortBar(sort, key => this.store.setSettings({ tripSort: key })))
      wrapper.appendChild(this.renderAhead(update, selectedId))
      if (this.store.state.settings.radarAlertsEnabled) {
        if (this.radarHits.length > 0) wrapper.appendChild(renderRadarList(this.radarHits, 'radar.list.title', NEARBY_RADARS))
        wrapper.appendChild(this.renderRadarNotice())
      }
    }

    container.replaceChildren(wrapper)
  }

  private renderAhead(update: TripUpdate | undefined, selectedId?: string): HTMLElement {
    const fuel = this.store.state.settings.fuel
    // update.ahead is price-sorted by the selector, so its head is the cheapest
    // regardless of the display order the user picks below.
    const ahead = update?.ahead ?? []
    const cheapestId = ahead[0]?.id
    const origin = update?.state.lastPos
    const list = document.createElement('div')
    list.className = 'trip-view__list'

    if (ahead.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'trip-view__empty'
      empty.textContent = t('trip.noneAhead')
      list.appendChild(empty)
      return list
    }

    const display = origin ? sortStations(ahead, fuel, origin, this.store.state.settings.tripSort) : ahead

    for (const station of display) {
      const price = priceOf(station, fuel)
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'trip-view__row'
      if (station.id === cheapestId) row.classList.add('trip-view__row--best')
      if (station.id === selectedId) row.classList.add('is-selected')

      const brand = document.createElement('span')
      brand.className = 'trip-view__row-brand'
      brand.textContent = station.brand

      const distance = document.createElement('span')
      distance.className = 'trip-view__row-distance'
      if (origin) distance.textContent = `${haversineKm(origin, station.pos).toFixed(1)} km`

      const priceEl = document.createElement('span')
      priceEl.className = 'trip-view__row-price'
      priceEl.textContent = price !== undefined ? price.toFixed(3) : '—'

      row.append(brand, distance, priceEl)
      row.addEventListener('click', () => this.onSelect(station))
      list.appendChild(row)
    }

    return list
  }

  private renderRadarNotice(): HTMLElement {
    const notice = document.createElement('p')
    notice.className = 'trip-view__radar-notice'
    const dataset = t('radar.notice.dataset').replace('{date}', RADARS_DATASET_DATE)
    notice.textContent = `${t('radar.notice.fixedOnly')} ${dataset}`
    return notice
  }
}
