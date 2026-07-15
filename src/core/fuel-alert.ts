import type { Station } from './station'
import type { FuelId } from './fuels'
import { haversineKm, isAhead, type LatLon } from './geo'
import { priceOf } from './pricing'

export type FuelAlertMode = 'cheap' | 'any'

export interface CheapAheadConfig {
  fuel: FuelId
  radiusKm: number
  corridorDeg: number
  alertDistanceKm: number
  mode: FuelAlertMode
}

export interface FuelHit { station: Station; distanceKm: number }

// Stations ahead in the heading cone that warrant a proximity alert, nearest
// first. A station qualifies iff it has a price for `fuel`, is within
// `alertDistanceKm`, and is ahead (cone-filtered when heading is defined). In
// `'cheap'` mode it must also be at or below the average price of all
// same-fuel-priced stations within `radiusKm` of `pos`; `'any'` mode drops that
// price filter.
export function cheapAhead(
  pos: LatLon,
  heading: number | undefined,
  stations: readonly Station[],
  cfg: CheapAheadConfig,
): FuelHit[] {
  const priced = stations
    .map(station => ({ station, price: priceOf(station, cfg.fuel) }))
    .filter((s): s is { station: Station; price: number } => s.price !== undefined)

  const nearbyPrices = priced
    .filter(s => haversineKm(pos, s.station.pos) <= cfg.radiusKm)
    .map(s => s.price)
  const avg = nearbyPrices.length > 0
    ? nearbyPrices.reduce((a, b) => a + b, 0) / nearbyPrices.length
    : Infinity

  return priced
    .map(s => ({ station: s.station, distanceKm: haversineKm(pos, s.station.pos), price: s.price }))
    .filter(h => h.distanceKm <= cfg.alertDistanceKm)
    .filter(h => heading === undefined ? true : isAhead(pos, heading, h.station.pos, cfg.corridorDeg))
    .filter(h => cfg.mode === 'any' ? true : h.price <= avg)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map(h => ({ station: h.station, distanceKm: h.distanceKm }))
}
