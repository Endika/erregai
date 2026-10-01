import type { LatLon } from '../core/geo'

export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

const EARTH_RADIUS_KM = 6371

// The box around the radius circle: what the Map tab has to show for "within
// N km" to be true on screen. Longitude spreads by 1/cos(lat), so at Spain's
// latitudes the box is about a third wider in degrees than it is tall.
export function radiusBounds(pos: LatLon, radiusKm: number): Bounds {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI)
  const dLon = dLat / Math.cos((pos.lat * Math.PI) / 180)
  return {
    south: pos.lat - dLat,
    west: pos.lon - dLon,
    north: pos.lat + dLat,
    east: pos.lon + dLon,
  }
}
