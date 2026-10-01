import type { Station } from './station'
import type { FuelId } from './fuels'
import { haversineKm, isAhead, type LatLon } from './geo'
import { nextHeading, type FixInfo } from './heading'
import { priceOf } from './pricing'

export interface TripConfig {
  fuel: FuelId
  radiusKm: number
  corridorDeg: number
}
export interface TripState {
  headingDeg: number | undefined
  headingAnchor: LatLon | undefined
  lastPos: LatLon | undefined
  bestSeenPrice: number | undefined
}
export interface TripUpdate {
  state: TripState
  ahead: Station[]
  alert: Station | undefined
}

export function newTripState(): TripState {
  return {
    headingDeg: undefined,
    headingAnchor: undefined,
    lastPos: undefined,
    bestSeenPrice: undefined,
  }
}

export function updateTrip(
  state: TripState,
  pos: LatLon,
  stations: Station[],
  cfg: TripConfig,
  fix?: FixInfo,
): TripUpdate {
  const { headingDeg: heading, anchor } = nextHeading(
    { headingDeg: state.headingDeg, anchor: state.headingAnchor },
    pos,
    fix,
  )
  // Until the direction of travel is known, "ahead" would include what lies behind.
  const ahead =
    heading === undefined
      ? []
      : stations
          .filter((s) => priceOf(s, cfg.fuel) !== undefined)
          .filter((s) => haversineKm(pos, s.pos) <= cfg.radiusKm)
          .filter((s) => isAhead(pos, heading, s.pos, cfg.corridorDeg))
          .sort((a, b) => priceOf(a, cfg.fuel)! - priceOf(b, cfg.fuel)!)

  let alert: Station | undefined
  let bestSeenPrice = state.bestSeenPrice
  const cheapest = ahead[0]
  if (cheapest) {
    const p = priceOf(cheapest, cfg.fuel)!
    if (bestSeenPrice === undefined || p < bestSeenPrice) {
      alert = cheapest
      bestSeenPrice = p
    }
  }
  return {
    state: { headingDeg: heading, headingAnchor: anchor, lastPos: pos, bestSeenPrice },
    ahead,
    alert,
  }
}
