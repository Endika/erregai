import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import type { LatLon } from '../core/geo'
import { bandFor, priceOf, type PriceBand } from '../core/pricing'

type MarkerKind = PriceBand | 'unknown' | 'user'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const INITIAL_ZOOM = 12

function markerColor(kind: MarkerKind): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--map-marker-${kind}`).trim()
  return value || '#666666'
}

export class MapView {
  private map?: L.Map
  private markers?: L.LayerGroup
  private userMarker?: L.CircleMarker

  constructor(private container: HTMLElement) {}

  render(pos: LatLon, stations: Station[], fuel: FuelId, onSelect: (s: Station) => void): void {
    if (!this.map) this.init(pos)
    if (!this.map || !this.markers) return

    this.userMarker?.setLatLng([pos.lat, pos.lon])
    this.markers.clearLayers()

    const knownPrices = stations
      .map(s => priceOf(s, fuel))
      .filter((p): p is number => p !== undefined)

    for (const station of stations) {
      const price = priceOf(station, fuel)
      const kind: MarkerKind = price !== undefined ? bandFor(price, knownPrices) : 'unknown'
      const marker = L.circleMarker([station.pos.lat, station.pos.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: markerColor(kind),
        fillOpacity: 0.9,
      })
      const priceLabel = price !== undefined ? price.toFixed(3) : '—'
      marker.bindTooltip(`${station.brand} · ${priceLabel}`)
      marker.on('click', () => onSelect(station))
      this.markers.addLayer(marker)
    }
  }

  invalidateSize(): void {
    this.map?.invalidateSize()
  }

  destroy(): void {
    this.map?.remove()
    this.map = undefined
    this.markers = undefined
    this.userMarker = undefined
  }

  private init(pos: LatLon): void {
    const map = L.map(this.container).setView([pos.lat, pos.lon], INITIAL_ZOOM)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    this.markers = L.layerGroup().addTo(map)
    this.userMarker = L.circleMarker([pos.lat, pos.lon], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: markerColor('user'),
      fillOpacity: 1,
    }).addTo(map)
    this.map = map
  }
}
