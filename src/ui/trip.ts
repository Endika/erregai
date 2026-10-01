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
import { priceOf, radiusReference, stationBand, type PriceReference } from '../core/pricing'
import { provinceFor } from '../core/provinces'
import { t } from '../i18n'
import { formatDate, formatKm, formatPrice, priceWithBand } from '../i18n/format'
import { renderFuelControl } from './sortBar'
import {
  composeSlot,
  fuelKey,
  radarKey,
  renderSlotArea,
  slotId,
  type SlotAlert,
} from './alert-slot'
import { renderRadarList } from './radar-list'
import type { MapView } from './map'
import type { Store } from '../app/store'
import type { Announce } from './announcer'

const DEFAULT_CORRIDOR_DEG = 45
const ADJACENT_PROVINCES = 2
const NEARBY_RADARS = 3
// Mid-trip only the best few stations ahead are listed; the rest wait behind a toggle.
const AHEAD_ROWS = 3
// Max radars drawn as icons on the trip map (bounds DOM/Leaflet in dense areas).
const RADAR_LAYER_CAP = 60

export interface TripRenderOptions {
  // The browser refused the location: a trip cannot run, so Start says why.
  locationDenied?: boolean
  // No prices and none cached: only the bundled radars are left to warn about.
  pricesUnavailable?: boolean
  // The radius set the trip map bands against; without it the rows work out
  // the same one from the store, so a station keeps its List band either way.
  reference?: PriceReference
}

type GpsStatus = 'waiting' | 'active' | 'lost'
// 'heading': fixes are arriving but the car has not moved far enough to tell where it is going.
type GpsLine = GpsStatus | 'heading'

// The slot measures the distance from the latest fix; a radar alert keeps
// where the radar is and on which road.
interface RadarAlert {
  id: string
  target: LatLon
  via: string
}

export class TripController {
  private tripState: TripState = newTripState()
  private lastUpdate: TripUpdate | undefined
  private lastProvinceId: string | undefined
  private stopFn: (() => void) | undefined
  private active = false
  // Fuel alerts hold only a station id, and show while that station is still
  // where it was when it alerted: first of the list ahead, or in it.
  private cheapestId: string | undefined
  private radarBanner: RadarAlert | undefined
  private alertedRadarIds = new Set<string>()
  private radarHits: RadarHit[] = []
  private nearbyId: string | undefined
  private alertedFuelIds = new Set<string>()
  // Voiced once per trip: a station that comes back ahead is shown, not repeated.
  private announcedFuelIds = new Set<string>()
  // The fuel the fuel alerts and the best price seen were measured in.
  private tripFuel: FuelId | undefined
  private releaseWakeLock: (() => void) | undefined
  private gps: GpsStatus = 'waiting'
  // The alert last drawn in the slot, so only a different one fades in.
  private shownSlotId = ''
  private showAllAhead = false
  // Set by the list toggle, whose own click re-renders it away.
  private refocusAheadToggle = false

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
    this.resetAlerts()
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
    this.resetAlerts()
    this.map.clearRadars()
    this.onChange()
  }

  private resetAlerts(): void {
    this.cheapestId = undefined
    this.radarBanner = undefined
    this.alertedRadarIds = new Set<string>()
    this.radarHits = []
    this.nearbyId = undefined
    this.alertedFuelIds = new Set<string>()
    this.announcedFuelIds = new Set<string>()
    this.tripFuel = undefined
    this.shownSlotId = ''
    this.showAllAhead = false
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
    // The fuel can change from the List tab mid-trip: alerts and the best price
    // seen belong to the old one, and would show or measure the wrong price.
    if (cfg.fuel !== this.tripFuel) {
      this.tripFuel = cfg.fuel
      this.cheapestId = undefined
      this.nearbyId = undefined
      this.tripState = { ...this.tripState, bestSeenPrice: undefined }
    }
    const update = updateTrip(this.tripState, pos, this.store.state.stations, cfg, fix)
    this.tripState = update.state
    this.lastUpdate = update
    const heading = update.state.headingDeg

    if (update.alert) {
      this.cheapestId = update.alert.id
      const alert = this.cheapestAlert(update.alert, pos)
      notify(alert.label, alert.key)
      this.announce(`${alert.key}. ${alert.label}`, 'polite')
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
        this.radarBanner = {
          id: nearest.radar.id,
          target: { lat: nearest.radar.lat, lon: nearest.radar.lon },
          via: nearest.radar.via,
        }
        this.announce(`${radarKey(nearest.distanceKm)}. ${body}`, 'assertive')
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
        this.nearbyId = nearest.station.id
        if (!this.announcedFuelIds.has(nearest.station.id)) {
          this.announcedFuelIds.add(nearest.station.id)
          const alert = this.nearbyAlert(nearest.station, pos)
          this.announce(`${alert.key}. ${alert.label}`, 'polite')
          notify(
            t('fuel.alert.title'),
            t('fuel.alert.body').replace('{brand}', nearest.station.brand),
          )
          if (settings.fuelSound) playFuelChime({ volume: settings.alertVolume })
          if (settings.alertVibrate) vibrateFuel()
        }
      }
    }

    this.onChange()
  }

  render(
    container: HTMLElement,
    update: TripUpdate | undefined,
    selectedId?: string,
    { locationDenied = false, pricesUnavailable = false, reference }: TripRenderOptions = {},
  ): void {
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

    if (!this.active && locationDenied) {
      // A disabled control alone says nothing; the reason sits right under it.
      const reason = document.createElement('p')
      reason.id = 'trip-start-reason'
      reason.className = 'trip-view__blocked'
      reason.textContent = t('trip.needsLocation')
      toggle.disabled = true
      toggle.setAttribute('aria-describedby', reason.id)
      wrapper.append(toggle, reason)
    } else if (!this.active && pricesUnavailable) {
      // Without prices the fuel picker has nothing to act on, and Start must
      // stay above the fold: one line says what the trip still does.
      wrapper.append(toggle, renderRadarsOnlyNote())
    } else if (!this.active) {
      // The fuel is chosen before setting off; mid-trip it would only compete
      // with the alerts, and the List tab still changes it. There is no order
      // to pick: a trip is after the cheapest fuel ahead.
      const fuelPicker = document.createElement('div')
      fuelPicker.className = 'trip-view__fuel'
      fuelPicker.appendChild(
        renderFuelControl({
          current: this.store.state.settings.fuel,
          onChange: (next) => this.store.setSettings({ fuel: next }),
        }),
      )
      wrapper.append(fuelPicker, this.renderIntro(), toggle)
    } else {
      wrapper.classList.add('trip-view--active')
      // The slot is reserved right under the map so a glance finds it without
      // scrolling, and keeps its height so the rows under it stay put.
      const slot = composeSlot(this.liveAlerts())
      const id = slotId(slot)
      wrapper.appendChild(renderSlotArea(slot, { entering: id !== this.shownSlotId }))
      this.shownSlotId = id
      // The top banner stays quiet on this tab, so this is the one place that
      // says why no station is listed.
      wrapper.appendChild(
        pricesUnavailable
          ? renderRadarsOnlyNote()
          : this.renderAhead(update, selectedId, reference),
      )
      if (this.store.state.settings.radarAlertsEnabled) {
        if (this.radarHits.length > 0)
          wrapper.appendChild(renderRadarList(this.radarHits, 'radar.list.title', NEARBY_RADARS))
        wrapper.appendChild(this.renderRadarNotice())
      }
      // Stop is docked at the foot of the screen, last in reading order: one tap
      // ends the trip, so it must never slide under the thumb as alerts change.
      const dock = document.createElement('div')
      dock.className = 'trip-view__dock'
      dock.append(this.renderGpsStatus(), toggle)
      wrapper.appendChild(dock)
    }

    container.replaceChildren(wrapper)
    if (this.refocusAheadToggle) {
      this.refocusAheadToggle = false
      wrapper.querySelector<HTMLElement>('.trip-view__ahead-toggle')?.focus({ preventScroll: true })
    }
  }

  // Every alert is rebuilt from the latest fix, so a station that is no longer
  // ahead drops out, and the cheapest one can only ever be the list's best row.
  private liveAlerts(): SlotAlert[] {
    const pos = this.tripState.lastPos
    if (!pos) return []
    const alerts: SlotAlert[] = []
    if (this.radarBanner) {
      alerts.push({
        kind: 'radar',
        id: this.radarBanner.id,
        key: radarKey(haversineKm(pos, this.radarBanner.target)),
        label: t('radar.alert.body').replace('{via}', this.radarBanner.via),
      })
    }
    if (this.tripFuel !== this.store.state.settings.fuel) return alerts
    const ahead = this.lastUpdate?.ahead ?? []
    const best = ahead[0]
    const cheapest = best && best.id === this.cheapestId ? best : undefined
    if (cheapest) alerts.push(this.cheapestAlert(cheapest, pos))
    const nearby = ahead.find((s) => s.id === this.nearbyId)
    if (nearby && nearby !== cheapest) alerts.push(this.nearbyAlert(nearby, pos))
    return alerts
  }

  private cheapestAlert(station: Station, pos: LatLon): SlotAlert {
    const fuel = this.store.state.settings.fuel
    return {
      kind: 'cheapest',
      id: station.id,
      brand: station.brand,
      key: fuelKey(station.brand, priceOf(station, fuel)!, haversineKm(pos, station.pos)),
      label: t('trip.cheapestAhead').replace('{fuel}', t(`fuel.${fuel}`)),
    }
  }

  private nearbyAlert(station: Station, pos: LatLon): SlotAlert {
    const fuel = this.store.state.settings.fuel
    return {
      kind: 'fuel',
      id: station.id,
      brand: station.brand,
      key: fuelKey(station.brand, priceOf(station, fuel)!, haversineKm(pos, station.pos)),
      label: t('fuel.alert.title'),
    }
  }

  private renderAhead(
    update: TripUpdate | undefined,
    selectedId?: string,
    radiusRef?: PriceReference,
  ): HTMLElement {
    const { fuel, radiusKm } = this.store.state.settings
    // update.ahead is sorted by price, the only order a trip needs: its head is
    // the cheapest, and the first few rows are the best on offer.
    const ahead = update?.ahead ?? []
    const cheapestId = ahead[0]?.id
    const origin = update?.state.lastPos
    const section = document.createElement('div')
    section.className = 'trip-view__ahead'
    const list = document.createElement('div')
    list.className = 'trip-view__list'
    list.id = 'trip-ahead-list'
    section.appendChild(list)

    if (ahead.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'trip-view__empty'
      empty.textContent = t('trip.noneAhead')
      list.appendChild(empty)
      return section
    }

    // Banded against the whole radius like the List, not the few stations
    // ahead, or the same price would be cheap here and dear there.
    const reference =
      radiusRef ??
      (origin ? radiusReference(this.store.state.stations, fuel, origin, radiusKm) : undefined)
    const display = this.showAllAhead ? ahead : ahead.slice(0, AHEAD_ROWS)

    for (const station of display) {
      const price = priceOf(station, fuel)
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'trip-view__row'
      row.dataset.station = station.id
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
      const value = document.createElement('span')
      value.className = 'trip-view__row-price-value'
      value.textContent = price !== undefined ? formatPrice(price) : '—'
      priceEl.appendChild(value)
      if (price !== undefined) {
        // The aria-label already says "€/l", so the visible unit stays silent.
        const unit = document.createElement('span')
        unit.className = 'trip-view__row-price-unit'
        unit.setAttribute('aria-hidden', 'true')
        unit.textContent = '€/l'
        priceEl.append(' ', unit)
        const band = stationBand(station, fuel, reference)
        if (band) {
          row.dataset.band = band
          priceEl.title = t(`band.${band}`)
          priceEl.setAttribute('aria-label', priceWithBand(price, band))
        }
      }

      row.append(brand, distance, priceEl)
      row.addEventListener('click', () => this.onSelect(station))
      list.appendChild(row)
    }

    if (ahead.length > AHEAD_ROWS) {
      const more = document.createElement('button')
      more.type = 'button'
      more.className = 'trip-view__ahead-toggle'
      more.setAttribute('aria-controls', list.id)
      more.setAttribute('aria-expanded', String(this.showAllAhead))
      more.textContent = this.showAllAhead
        ? t('trip.ahead.showFewer')
        : t('trip.ahead.showAll').replace('{n}', String(ahead.length))
      more.addEventListener('click', () => {
        this.showAllAhead = !this.showAllAhead
        this.refocusAheadToggle = true
        this.onChange()
      })
      section.appendChild(more)
    }

    return section
  }

  private renderIntro(): HTMLElement {
    const intro = document.createElement('ul')
    intro.className = 'trip-view__intro'
    for (const key of ['trip.intro.follow', 'trip.intro.alerts', 'trip.foregroundOnly']) {
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

function renderRadarsOnlyNote(): HTMLElement {
  const note = document.createElement('p')
  note.className = 'trip-view__note'
  note.textContent = t('trip.radarsOnly')
  return note
}
