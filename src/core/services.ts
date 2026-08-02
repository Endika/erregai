import { haversineKm, type LatLon } from './geo'
import { parseOsmHours, scheduleStatus, type ScheduleStatus } from './schedule'

// Motorway service areas (OSM `highway=services`) and what they offer. The
// dataset is baked in at build time, exactly like the radars, so the layer
// works offline and Overpass is never called from a user's device.
export type ServiceKind = 'fuel' | 'restaurant' | 'cafe' | 'fast_food' | 'toilets' | 'shop'

export interface ServiceArea {
  id: string
  lat: number
  lon: number
  name?: string
  services: readonly ServiceKind[]
  // Raw OSM `opening_hours` of the restaurant or cafe inside, when tagged.
  // Absent for most areas — see the honesty note in the README.
  hours?: string
}

export interface ServiceAreaHit { area: ServiceArea; distanceKm: number }

// Only 141 of the 999 areas publish opening hours, so `unknown` is the normal
// answer here, not an error path — the popup must read well without it.
export function serviceAreaStatus(area: ServiceArea, at: Date): ScheduleStatus {
  return scheduleStatus(parseOsmHours(area.hours ?? ''), at)
}

export function nearbyServiceAreas(
  pos: LatLon,
  areas: readonly ServiceArea[],
  radiusKm: number,
  limit: number,
): ServiceAreaHit[] {
  return areas
    .map(area => ({ area, distanceKm: haversineKm(pos, { lat: area.lat, lon: area.lon }) }))
    .filter(hit => hit.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
