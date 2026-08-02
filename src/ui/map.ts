import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import type { LatLon } from '../core/geo'
import type { Radar } from '../core/radars'
import { serviceAreaStatus, type ServiceArea } from '../core/services'
import { bandForThresholds, bandThresholds, priceOf, type PriceBand } from '../core/pricing'
import { t } from '../i18n'

type MarkerKind = PriceBand | 'unknown' | 'user' | 'radar' | 'services'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const INITIAL_ZOOM = 12
const FALLBACK_MARKER_COLOR = '#666666'
const SELECTED_STROKE = '#111111'
const MARKER_KINDS: readonly MarkerKind[] = ['cheap', 'mid', 'expensive', 'unknown', 'user', 'radar', 'services']

function readMarkerColors(): Record<MarkerKind, string> {
  const style = getComputedStyle(document.documentElement)
  const colors = {} as Record<MarkerKind, string>
  for (const kind of MARKER_KINDS) {
    colors[kind] = style.getPropertyValue(`--map-marker-${kind}`).trim() || FALLBACK_MARKER_COLOR
  }
  return colors
}

// Built as a real element rather than an HTML string: area names come from OSM,
// which anyone can edit, and must never be interpreted as markup.
function servicePopup(area: ServiceArea, now: Date): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'service-popup'

  const title = document.createElement('strong')
  title.textContent = area.name ?? t('services.unnamed')
  wrapper.appendChild(title)

  if (area.services.length > 0) {
    const list = document.createElement('p')
    list.className = 'service-popup__services'
    list.textContent = area.services.map(kind => t(`services.kind.${kind}`)).join(' · ')
    wrapper.appendChild(list)
  }

  // No hours tagged means no claim: neither "open" nor "closed" is shown.
  const status = serviceAreaStatus(area, now)
  if (status !== 'unknown' && area.hours) {
    const line = document.createElement('p')
    line.className = 'service-popup__hours'
    const badge = document.createElement('span')
    badge.dataset.schedule = status
    badge.textContent = t(status === 'open' ? 'schedule.open' : status === 'closed' ? 'schedule.closed' : 'schedule.closingSoon')
    line.append(badge, ` ${area.hours}`)
    wrapper.appendChild(line)
  }
  return wrapper
}

export class MapView {
  private map?: L.Map
  private markers?: L.LayerGroup
  private radarMarkers?: L.LayerGroup
  private serviceMarkers?: L.LayerGroup
  private userMarker?: L.CircleMarker

  constructor(private container: HTMLElement) {}

  render(pos: LatLon, stations: Station[], fuel: FuelId, onSelect: (s: Station) => void, opts: { recenter?: boolean; selectedId?: string } = {}): void {
    if (!this.map) this.init(pos)
    if (!this.map || !this.markers) return

    if (opts.recenter) this.map.setView([pos.lat, pos.lon], this.map.getZoom(), { animate: false })
    this.userMarker?.setLatLng([pos.lat, pos.lon])
    this.markers.clearLayers()

    const knownPrices = stations
      .map(s => priceOf(s, fuel))
      .filter((p): p is number => p !== undefined)
    const thresholds = bandThresholds(knownPrices)
    const colors = readMarkerColors()

    for (const station of stations) {
      const price = priceOf(station, fuel)
      const kind: MarkerKind = price !== undefined ? bandForThresholds(price, thresholds) : 'unknown'
      const selected = station.id === opts.selectedId
      const marker = L.circleMarker([station.pos.lat, station.pos.lon], {
        radius: selected ? 12 : 8,
        color: selected ? SELECTED_STROKE : '#ffffff',
        weight: selected ? 4 : 2,
        fillColor: colors[kind],
        fillOpacity: selected ? 1 : 0.9,
      })
      const priceLabel = price !== undefined ? price.toFixed(3) : '—'
      marker.bindTooltip(`${station.brand} · ${priceLabel}`)
      marker.on('click', () => onSelect(station))
      this.markers.addLayer(marker)
      if (selected) { marker.bringToFront(); marker.openTooltip() }
    }
  }

  renderRadars(radars: readonly Radar[]): void {
    if (!this.map || !this.radarMarkers) return
    this.radarMarkers.clearLayers()
    const color = readMarkerColors().radar
    for (const radar of radars) {
      const marker = L.circleMarker([radar.lat, radar.lon], {
        radius: 6,
        color,
        weight: 3,
        fillColor: '#ffffff',
        fillOpacity: 1,
      })
      if (radar.via) marker.bindTooltip(radar.via)
      this.radarMarkers.addLayer(marker)
    }
  }

  clearRadars(): void {
    this.radarMarkers?.clearLayers()
  }

  // Square markers, so a service area reads as a different thing from a fuel
  // station (filled circle) and a radar (hollow circle) at a glance.
  renderServiceAreas(areas: readonly ServiceArea[], now: Date = new Date()): void {
    if (!this.map || !this.serviceMarkers) return
    this.serviceMarkers.clearLayers()
    const color = readMarkerColors().services
    for (const area of areas) {
      const marker = L.marker([area.lat, area.lon], {
        icon: L.divIcon({
          className: 'map-service-marker',
          html: `<span class="map-service-marker__box" style="background:${color}"></span>`,
          iconSize: [14, 14],
        }),
      })
      marker.bindPopup(servicePopup(area, now))
      this.serviceMarkers.addLayer(marker)
    }
  }

  clearServiceAreas(): void {
    this.serviceMarkers?.clearLayers()
  }

  invalidateSize(): void {
    this.map?.invalidateSize()
  }

  focus(pos: LatLon, zoom: number): void {
    this.map?.setView([pos.lat, pos.lon], zoom, { animate: false })
  }

  panTo(pos: LatLon): void {
    this.map?.panTo([pos.lat, pos.lon], { animate: true })
  }

  destroy(): void {
    this.map?.remove()
    this.map = undefined
    this.markers = undefined
    this.radarMarkers = undefined
    this.serviceMarkers = undefined
    this.userMarker = undefined
  }

  private init(pos: LatLon): void {
    const map = L.map(this.container).setView([pos.lat, pos.lon], INITIAL_ZOOM)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    this.markers = L.layerGroup().addTo(map)
    this.radarMarkers = L.layerGroup().addTo(map)
    this.serviceMarkers = L.layerGroup().addTo(map)
    const colors = readMarkerColors()
    this.userMarker = L.circleMarker([pos.lat, pos.lon], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: colors.user,
      fillOpacity: 1,
    }).addTo(map)
    this.map = map
  }
}
