import type { Station } from '../core/station'
import type { LatLon } from '../core/geo'
import { haversineKm } from '../core/geo'
import { newTripState, updateTrip, type TripConfig, type TripState, type TripUpdate } from '../core/trip'
import { radarsAhead, nextRadarAlerts, type RadarHit } from '../core/radars'
import { RADARS } from '../core/radars.data'
import { watchPosition } from '../adapters/geolocation'
import { ensureNotifyPermission, notify } from '../adapters/notifications'
import { playRadarBeep } from '../adapters/audio'
import { priceOf, sortStations } from '../core/pricing'
import { provinceFor } from '../core/provinces'
import { t } from '../i18n'
import { renderSortBar } from './sortBar'
import type { MapView } from './map'
import type { Store } from '../app/store'

const DEFAULT_CORRIDOR_DEG = 45
const ADJACENT_PROVINCES = 2
const NEARBY_RADARS = 3

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
    if (this.active) return
    this.active = true
    this.tripState = newTripState()
    this.lastUpdate = undefined
    this.lastProvinceId = undefined
    this.banner = undefined
    this.radarBanner = undefined
    this.alertedRadarIds = new Set<string>()
    this.radarHits = []
    this.map.clearRadars()

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
    this.tripState = newTripState()
    this.lastUpdate = undefined
    this.lastProvinceId = undefined
    this.banner = undefined
    this.radarBanner = undefined
    this.alertedRadarIds = new Set<string>()
    this.radarHits = []
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
      this.map.renderRadars(hits.map(h => h.radar))
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
      this.map.clearRadars()
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

    if (this.active) {
      const sort = this.store.state.settings.tripSort
      wrapper.appendChild(renderSortBar(sort, key => this.store.setSettings({ tripSort: key })))
      wrapper.appendChild(this.renderAhead(update, selectedId))
      if (this.store.state.settings.radarAlertsEnabled && this.radarHits.length > 0) {
        wrapper.appendChild(this.renderRadarList())
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

  private renderRadarList(): HTMLElement {
    const section = document.createElement('div')
    section.className = 'trip-view__radars'

    const title = document.createElement('p')
    title.className = 'trip-view__radars-title'
    title.textContent = t('radar.list.title')
    section.appendChild(title)

    const list = document.createElement('div')
    list.className = 'trip-view__radar-list'

    for (const hit of this.radarHits.slice(0, NEARBY_RADARS)) {
      const row = document.createElement('div')
      row.className = 'trip-view__radar-row'

      const via = document.createElement('span')
      via.className = 'trip-view__radar-via'
      via.textContent = hit.radar.via

      const distance = document.createElement('span')
      distance.className = 'trip-view__radar-distance'
      distance.textContent = `${Math.round(hit.distanceKm * 1000)} m`

      row.append(via, distance)
      list.appendChild(row)
    }

    section.appendChild(list)
    return section
  }
}
