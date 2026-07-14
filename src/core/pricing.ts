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

export interface BandThresholds { low: number; high: number }

export function bandThresholds(prices: number[]): BandThresholds {
  const sorted = [...prices].sort((a, b) => a - b)
  return { low: percentile(sorted, 0.33), high: percentile(sorted, 0.66) }
}

export function bandForThresholds(price: number, t: BandThresholds): PriceBand {
  if (price <= t.low) return 'cheap'
  if (price >= t.high) return 'expensive'
  return 'mid'
}

export function bandFor(price: number, all: number[]): PriceBand {
  return bandForThresholds(price, bandThresholds(all))
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
