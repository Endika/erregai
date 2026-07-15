import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import type { LatLon } from '../core/geo'
import type { Radar } from '../core/radars'
import { bandForThresholds, bandThresholds, priceOf, type PriceBand } from '../core/pricing'

type MarkerKind = PriceBand | 'unknown' | 'user' | 'radar'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const INITIAL_ZOOM = 12
const FALLBACK_MARKER_COLOR = '#666666'
const SELECTED_STROKE = '#111111'
const MARKER_KINDS: readonly MarkerKind[] = ['cheap', 'mid', 'expensive', 'unknown', 'user', 'radar']

function readMarkerColors(): Record<MarkerKind, string> {
  const style = getComputedStyle(document.documentElement)
  const colors = {} as Record<MarkerKind, string>
  for (const kind of MARKER_KINDS) {
    colors[kind] = style.getPropertyValue(`--map-marker-${kind}`).trim() || FALLBACK_MARKER_COLOR
  }
  return colors
}

export class MapView {
  private map?: L.Map
  private markers?: L.LayerGroup
  private radarMarkers?: L.LayerGroup
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
    this.userMarker = undefined
  }

  private init(pos: LatLon): void {
    const map = L.map(this.container).setView([pos.lat, pos.lon], INITIAL_ZOOM)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    this.markers = L.layerGroup().addTo(map)
    this.radarMarkers = L.layerGroup().addTo(map)
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
