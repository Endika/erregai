import type { Station } from './station'
import type { FuelId } from './fuels'
import { bearingDeg, haversineKm, isAhead, type LatLon } from './geo'
import { priceOf } from './pricing'

export interface TripConfig { fuel: FuelId; radiusKm: number; corridorDeg: number }
export interface TripState { headingDeg: number | undefined; lastPos: LatLon | undefined; bestSeenPrice: number | undefined }
export interface TripUpdate { state: TripState; ahead: Station[]; alert: Station | undefined }

export function newTripState(): TripState {
  return { headingDeg: undefined, lastPos: undefined, bestSeenPrice: undefined }
}

export function updateTrip(state: TripState, pos: LatLon, stations: Station[], cfg: TripConfig): TripUpdate {
  let heading = state.headingDeg
  if (state.lastPos && (state.lastPos.lat !== pos.lat || state.lastPos.lon !== pos.lon)) {
    heading = bearingDeg(state.lastPos, pos)
  }
  const ahead = stations
    .filter(s => priceOf(s, cfg.fuel) !== undefined)
    .filter(s => haversineKm(pos, s.pos) <= cfg.radiusKm)
    .filter(s => heading === undefined ? true : isAhead(pos, heading, s.pos, cfg.corridorDeg))
    .sort((a, b) => priceOf(a, cfg.fuel)! - priceOf(b, cfg.fuel)!)

  let alert: Station | undefined
  let bestSeenPrice = state.bestSeenPrice
  const cheapest = ahead[0]
  if (cheapest) {
    const p = priceOf(cheapest, cfg.fuel)!
    if (bestSeenPrice === undefined || p < bestSeenPrice) { alert = cheapest; bestSeenPrice = p }
  }
  return { state: { headingDeg: heading, lastPos: pos, bestSeenPrice }, ahead, alert }
}
