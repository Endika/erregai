import type { Station } from './station'
import type { FuelId } from './fuels'
import { haversineKm, type LatLon } from './geo'
import { priceOf } from './pricing'
import { parseSchedule, scheduleStatus } from './schedule'

const LITRES_PER_KM = 6.5 / 100

export interface BestChoice {
  station: Station
  price: number
  distanceKm: number
  // 'nearest': nothing beats the nearest open station; 'only': it is the only one.
  kind: 'saving' | 'nearest' | 'only'
  // Net euros on a full tank, only when kind is 'saving'.
  saving?: number
  closingSoon: boolean
}

interface Candidate {
  station: Station
  price: number
  distanceKm: number
  closingSoon: boolean
}

// You would drive to the nearest anyway, so only the distance past it counts,
// there and back.
export function detourCost(extraKm: number, price: number): number {
  return Math.max(0, extraKm) * 2 * LITRES_PER_KM * price
}

const cents = (euros: number): number => Math.round(euros * 100)

// `stations` are the ones within the radius. An unreadable schedule is left
// out with the closed ones: the card says "open now" and must not guess.
export function bestChoice(
  stations: readonly Station[],
  fuel: FuelId,
  origin: LatLon,
  tankLitres: number,
  now: Date,
): BestChoice | undefined {
  const candidates: Candidate[] = []
  for (const station of stations) {
    const price = priceOf(station, fuel)
    if (price === undefined) continue
    const status = scheduleStatus(parseSchedule(station.schedule), now)
    if (status !== 'open' && status !== 'closing-soon') continue
    candidates.push({
      station,
      price,
      distanceKm: haversineKm(origin, station.pos),
      closingSoon: status === 'closing-soon',
    })
  }
  if (candidates.length === 0) return undefined

  candidates.sort((a, b) => a.distanceKm - b.distanceKm || a.price - b.price)
  const nearest = candidates[0]
  if (candidates.length === 1) return { ...nearest, kind: 'only' }

  // Saving = (nearest's price − its price) × tank − detour cost.
  const netSaving = (c: Candidate): number =>
    (nearest.price - c.price) * tankLitres - detourCost(c.distanceKm - nearest.distanceKm, c.price)
  let best: Candidate = nearest
  let bestSaving = 0
  for (const c of candidates.slice(1)) {
    const saving = netSaving(c)
    // Already sorted by distance, so a tie to the cent stays with the nearer one.
    if (cents(saving) > cents(bestSaving)) {
      best = c
      bestSaving = saving
    }
  }
  if (best === nearest) return { ...nearest, kind: 'nearest' }
  return { ...best, kind: 'saving', saving: bestSaving }
}
