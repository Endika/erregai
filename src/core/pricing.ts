import type { Station } from './station'
import type { FuelId } from './fuels'
import { haversineKm, type LatLon } from './geo'

export type PriceBand = 'cheap' | 'mid' | 'expensive'
export type SortKey = 'price' | 'distance'

export function priceOf(s: Station, fuel: FuelId): number | undefined {
  return s.prices[fuel]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const idx = Math.floor((sorted.length - 1) * p)
  return sorted[idx]
}

export function bandFor(price: number, all: number[]): PriceBand {
  const sorted = [...all].sort((a, b) => a - b)
  const low = percentile(sorted, 0.33), high = percentile(sorted, 0.66)
  if (price <= low) return 'cheap'
  if (price >= high) return 'expensive'
  return 'mid'
}

export function sortStations(stations: Station[], fuel: FuelId, origin: LatLon, key: SortKey): Station[] {
  return [...stations].sort((a, b) => {
    if (key === 'distance') return haversineKm(origin, a.pos) - haversineKm(origin, b.pos)
    const pa = priceOf(a, fuel), pb = priceOf(b, fuel)
    if (pa === undefined && pb === undefined) return 0
    if (pa === undefined) return 1
    if (pb === undefined) return -1
    return pa - pb
  })
}
