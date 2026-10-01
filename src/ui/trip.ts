import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import type { LatLon } from '../core/geo'
import { haversineKm } from '../core/geo'
import {
  newTripState,
  updateTrip,
  type TripConfig,
  type TripState,
  type TripUpdate,
} from '../core/trip'
import type { FixInfo } from '../core/heading'
import { radarsAhead, nextRadarAlerts, type RadarHit } from '../core/radars'
import { nextProximityAlerts } from '../core/proximity'
import { cheapAhead } from '../core/fuel-alert'
import { RADARS, RADARS_DATASET_DATE } from '../core/radars.data'
import { watchPosition } from '../adapters/geolocation'
import { ensureNotifyPermission, notify } from '../adapters/notifications'
import { keepScreenAwake } from '../adapters/wakeLock'
import {
  playRadarBeep,
  playFuelChime,
  unlockAudio,
  startBackgroundAudio,
  stopBackgroundAudio,
} from '../adapters/audio'
import { vibrateRadar, vibrateFuel } from '../adapters/vibrate'
import { bandForThresholds, bandThresholds, priceOf, sortStations } from '../core/pricing'
import { provinceFor } from '../core/provinces'
import { t } from '../i18n'
import { formatDate, formatDistance, formatKm, formatPrice, priceWithBand } from '../i18n/format'
import { renderSortBar } from './sortBar'
import { renderRadarList } from './radar-list'
import type { MapView } from './map'
import type { Store } from '../app/store'
import type { Announce } from './announcer'

const DEFAULT_CORRIDOR_DEG = 45
const ADJACENT_PROVINCES = 2
const NEARBY_RADARS = 3
// Max radars drawn as icons on the trip map (bounds DOM/Leaflet in dense areas).
const RADAR_LAYER_CAP = 60

type GpsStatus = 'waiting' | 'active' | 'lost'
// 'heading': fixes are arriving but the car has not moved far enough to tell where it is going.
type GpsLine = GpsStatus | 'heading'

// The banner shows the distance from the latest fix, but screen readers hear
// the text once, as it was when the alert fired.
interface Alert {
  id: string
  target: LatLon
  label: string
  key: (km: number) => string
  spoken: string
}

function makeAlert(
  id: string,
  target: LatLon,
  label: string,
  key: (km: number) => string,
  km: number,
): Alert {
  return { id, target, label, key, spoken: `${key(km)}. ${label}` }
}

const distanceLabel = (template: string) => (km: number) =>
  template.replace('{distance}', formatDistance(km))

export class TripController {
  private tripState: TripState = newTripState()
  private lastUpdate: TripUpdate | undefined
  private lastProvinceId: string | undefined
  private stopFn: (() => void) | undefined
  private active = false
  private banner: Alert | undefined
  private radarBanner: Alert | undefined
  private alertedRadarIds = new Set<string>()
  private radarHits: RadarHit[] = []
  private fuelBanner: Alert | undefined
  private alertedFuelIds = new Set<string>()
  private releaseWakeLock: (() => void) | undefined
  private gps: GpsStatus = 'waiting'

  constructor(
    private store: Store,
    private map: MapView,
    private onChange: () => void,
    private onSelect: (station: Station) => void,
    private announce: Announce = () => {},
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
    // Same gesture, same reason: routing the cues through a media element is
    // what keeps them audible once the phone backgrounds the page or hands the
    // audio session to Android Auto.
    startBackgroundAudio({ title: t('trip.mediaSession.title'), artist: t('app.title') })
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
    this.gps = 'waiting'
    this.map.clearRadars()
    this.releaseWakeLock = keepScreenAwake()

    await ensureNotifyPermission()

    this.stopFn = watchPosition(
      (pos, fix) => {
        this.gps = 'active'
        void this.onFix(pos, fix)
      },
      () => {
        if (this.gps === 'lost') return
        this.gps = 'lost'
        this.onChange()
      },
    )
    this.onChange()
  }

  stop(): void {
    this.active = false
    this.stopFn?.()
    this.stopFn = undefined
    this.releaseWakeLock?.()
    this.releaseWakeLock = undefined
    stopBackgroundAudio()
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

  // While a trip runs the map shows only what is ahead, like the list below it.
  stationsForMap(nearby: Station[]): Station[] {
    return this.active ? (this.lastUpdate?.ahead ?? []) : nearby
  }

  private async onFix(pos: LatLon, fix?: FixInfo): Promise<void> {
    const provinceId = provinceFor(pos).id
    if (provinceId !== this.lastProvinceId) {
      this.lastProvinceId = provinceId
      await this.store.ensureAround(pos, ADJACENT_PROVINCES)
    }

    const settings = this.store.state.settings
    const cfg: TripConfig = {
      fuel: settings.fuel,
      radiusKm: settings.radiusKm,
      corridorDeg: DEFAULT_CORRIDOR_DEG,
    }
    const update = updateTrip(this.tripState, pos, this.store.state.stations, cfg, fix)
    this.tripState = update.state
    this.lastUpdate = update
    const heading = update.state.headingDeg

    if (update.alert) {
      const price = priceOf(update.alert, cfg.fuel)
      const km = haversineKm(pos, update.alert.pos)
      const priceLabel = price !== undefined ? formatPrice(price) : '—'
      const title = t('trip.cheapestAhead').replace('{fuel}', t(`fuel.${cfg.fuel}`))
      notify(title, `${update.alert.brand} · ${priceLabel} · ${formatKm(km)}`)
      this.banner = makeAlert(
        update.alert.id,
        update.alert.pos,
        `${title}: ${update.alert.brand}`,
        (d) => `${priceLabel} · ${formatKm(d)}`,
        km,
      )
      this.announce(this.banner.spoken, 'polite')
    }

    if (settings.radarAlertsEnabled) {
      const alertDistanceKm = settings.radarAlertDistanceM / 1000
      // radarsAhead treats an undefined heading as "everything around"; on a
      // trip, an unknown direction means nothing is ahead yet.
      const hits =
        heading === undefined
          ? []
          : radarsAhead(pos, heading, RADARS, {
              radiusKm: alertDistanceKm,
              corridorDeg: DEFAULT_CORRIDOR_DEG,
            })
      this.radarHits = hits
      const { alertedIds, newlyAlerted } = nextRadarAlerts(
        this.alertedRadarIds,
        hits,
        alertDistanceKm,
      )
      this.alertedRadarIds = alertedIds
      if (newlyAlerted.length > 0) {
        const nearest = newlyAlerted[0]
        const body = t('radar.alert.body').replace('{via}', nearest.radar.via)
        this.radarBanner = makeAlert(
          nearest.radar.id,
          { lat: nearest.radar.lat, lon: nearest.radar.lon },
          body,
          distanceLabel(t('radar.alert.banner')),
          nearest.distanceKm,
        )
        this.announce(this.radarBanner.spoken, 'assertive')
        notify(t('radar.alert.title'), body)
        if (settings.radarSound) playRadarBeep({ volume: settings.alertVolume })
        if (settings.alertVibrate) vibrateRadar()
      }
    } else {
      this.radarHits = []
    }
    // A radar that is no longer ahead has been passed; a hazard banner left
    // behind would show a distance to something already behind the car.
    const radarId = this.radarBanner?.id
    if (radarId && !this.radarHits.some((h) => h.radar.id === radarId)) {
      this.radarBanner = undefined
    }

    // Map visibility has its own toggle, independent of the audio/notification
    // alert: show radars ahead as icons even before an alert would fire.
    if (settings.radarLayerEnabled) {
      const displayRadars =
        heading === undefined
          ? []
          : radarsAhead(pos, heading, RADARS, {
              radiusKm: settings.radiusKm,
              corridorDeg: DEFAULT_CORRIDOR_DEG,
            }).slice(0, RADAR_LAYER_CAP)
      this.map.renderRadars(displayRadars.map((h) => h.radar))
    } else {
      this.map.clearRadars()
    }

    if (settings.fuelAlertMode !== 'off') {
      const alertDistanceKm = settings.fuelAlertDistanceM / 1000
      const hits =
        heading === undefined
          ? []
          : cheapAhead(pos, heading, this.store.state.stations, {
              fuel: settings.fuel,
              radiusKm: settings.radiusKm,
              corridorDeg: DEFAULT_CORRIDOR_DEG,
              alertDistanceKm,
              mode: settings.fuelAlertMode,
            })
      const { alertedIds, newlyAlerted } = nextProximityAlerts(
        this.alertedFuelIds,
        hits.map((h) => ({ id: h.station.id, distanceKm: h.distanceKm })),
        alertDistanceKm,
      )
      this.alertedFuelIds = alertedIds
      if (newlyAlerted.length > 0) {
        const nearest = hits.find((h) => h.station.id === newlyAlerted[0].id)!
        this.fuelBanner = makeAlert(
          nearest.station.id,
          nearest.station.pos,
          t('fuel.alert.title'),
          distanceLabel(t('fuel.alert.banner').replace('{brand}', nearest.station.brand)),
          nearest.distanceKm,
        )
        this.announce(this.fuelBanner.spoken, 'polite')
        notify(
          t('fuel.alert.title'),
          t('fuel.alert.body').replace('{brand}', nearest.station.brand),
        )
        if (settings.fuelSound) playFuelChime({ volume: settings.alertVolume })
        if (settings.alertVibrate) vibrateFuel()
      }
    }

    this.onChange()
  }

  render(container: HTMLElement, update: TripUpdate | undefined, selectedId?: string): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'trip-view'

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'trip-view__toggle'
    toggle.classList.toggle('trip-view__toggle--stop', this.active)
    toggle.textContent = this.active ? t('trip.stop') : t('trip.start')
    toggle.addEventListener('click', () => {
      void (this.active ? this.stop() : this.start())
    })

    // Alerts sit right under the map, the radar first, so a glance finds them
    // without scrolling; stopping is rare and can wait one row lower.
    const alerts = this.renderAlerts()
    if (alerts) wrapper.appendChild(alerts)

    if (!this.active) {
      wrapper.append(this.renderIntro(), toggle)
    } else {
      const controls = document.createElement('div')
      controls.className = 'trip-view__controls'
      controls.append(this.renderGpsStatus(), toggle)
      wrapper.appendChild(controls)

      const { tripSort, fuel } = this.store.state.settings
      wrapper.appendChild(
        renderSortBar(tripSort, (key) => this.store.setSettings({ tripSort: key }), {
          current: fuel,
          onChange: (next) => this.changeFuel(next),
        }),
      )
      wrapper.appendChild(this.renderAhead(update, selectedId))
      if (this.store.state.settings.radarAlertsEnabled) {
        if (this.radarHits.length > 0)
          wrapper.appendChild(renderRadarList(this.radarHits, 'radar.list.title', NEARBY_RADARS))
        wrapper.appendChild(this.renderRadarNotice())
      }
    }

    container.replaceChildren(wrapper)
  }

  // The cheapest-ahead banner and the best price seen so far belong to the old
  // fuel: keeping either would show, or measure against, the wrong price.
  private changeFuel(fuel: FuelId): void {
    this.banner = undefined
    this.tripState = { ...this.tripState, bestSeenPrice: undefined }
    this.store.setSettings({ fuel })
  }

  private renderAlerts(): HTMLElement | undefined {
    const pos = this.tripState.lastPos
    const banners = [
      this.radarBanner && renderBanner(this.radarBanner, pos, 'radar'),
      this.banner && renderBanner(this.banner, pos, 'cheapest'),
      this.fuelBanner && renderBanner(this.fuelBanner, pos, 'fuel'),
    ].filter((b): b is HTMLElement => b !== undefined)
    if (banners.length === 0) return undefined
    const alerts = document.createElement('div')
    alerts.className = 'trip-view__alerts'
    alerts.append(...banners)
    return alerts
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

    const thresholds = bandThresholds(
      ahead.map((s) => priceOf(s, fuel)).filter((p): p is number => p !== undefined),
    )
    const display = origin
      ? sortStations(ahead, fuel, origin, this.store.state.settings.tripSort)
      : ahead

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
      if (origin) distance.textContent = formatKm(haversineKm(origin, station.pos))

      const priceEl = document.createElement('span')
      priceEl.className = 'trip-view__row-price'
      priceEl.textContent = price !== undefined ? formatPrice(price) : '—'
      if (price !== undefined) {
        const band = bandForThresholds(price, thresholds)
        row.dataset.band = band
        priceEl.title = t(`band.${band}`)
        priceEl.setAttribute('aria-label', priceWithBand(price, band))
      }

      row.append(brand, distance, priceEl)
      row.addEventListener('click', () => this.onSelect(station))
      list.appendChild(row)
    }

    return list
  }

  private renderIntro(): HTMLElement {
    const intro = document.createElement('ul')
    intro.className = 'trip-view__intro'
    for (const key of [
      'trip.intro.follow',
      'trip.intro.alerts',
      'trip.intro.notifications',
      'trip.intro.screen',
      'trip.foregroundOnly',
    ]) {
      const item = document.createElement('li')
      item.textContent = t(key)
      intro.appendChild(item)
    }
    return intro
  }

  private renderGpsStatus(): HTMLElement {
    const status = document.createElement('p')
    status.className = 'trip-view__gps'
    const line: GpsLine =
      this.gps === 'active' && this.tripState.headingDeg === undefined ? 'heading' : this.gps
    status.dataset.gps = line
    status.textContent = t(`trip.gps.${line}`)
    return status
  }

  private renderRadarNotice(): HTMLElement {
    const notice = document.createElement('p')
    notice.className = 'trip-view__radar-notice'
    const dataset = t('radar.notice.dataset').replace('{date}', formatDate(RADARS_DATASET_DATE))
    notice.textContent = `${t('radar.notice.fixedOnly')} ${dataset}`
    return notice
  }
}

function renderBanner(
  alert: Alert,
  pos: LatLon | undefined,
  kind: 'radar' | 'cheapest' | 'fuel',
): HTMLElement {
  const banner = document.createElement('div')
  banner.className = `trip-view__banner trip-view__banner--${kind}`
  const key = document.createElement('span')
  key.className = 'trip-view__banner-key'
  key.textContent = alert.key(pos ? haversineKm(pos, alert.target) : 0)
  const label = document.createElement('span')
  label.className = 'trip-view__banner-label'
  label.textContent = alert.label
  banner.append(key, label)
  return banner
}
