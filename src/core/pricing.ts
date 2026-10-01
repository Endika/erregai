import type { Station } from './station'
import type { FuelId } from './fuels'
import { haversineKm, type LatLon } from './geo'

export type PriceBand = 'cheap' | 'mid' | 'expensive'
export type SortKey = 'price' | 'distance'

export function priceOf(s: Station, fuel: FuelId): number | undefined {
  return s.prices[fuel]
}

export interface BandThresholds {
  low: number
  high: number
}

// The upper cut mirrors the lower one, as many places from the top as the
// lower is from the bottom: of three prices only the dearest is expensive.
export function bandThresholds(prices: number[]): BandThresholds {
  const sorted = [...prices].sort((a, b) => a - b)
  const cut = Math.floor((sorted.length - 1) * 0.33)
  return { low: sorted[cut] ?? NaN, high: sorted[sorted.length - 1 - cut] ?? NaN }
}

export function bandForThresholds(price: number, t: BandThresholds): PriceBand {
  if (price <= t.low) return 'cheap'
  if (price >= t.high) return 'expensive'
  return 'mid'
}

export function bandFor(price: number, all: number[]): PriceBand {
  return bandForThresholds(price, bandThresholds(all))
}

// The one set every surface bands against: the selected fuel's prices within
// the radius. A station keeps its band on the list, the map and the card,
// even where a surface draws more (or fewer) stations than that set.
export interface PriceReference {
  thresholds: BandThresholds
  mean: number
  count: number
}

// Below this, an average of two prices says nothing worth printing.
export const MIN_PRICES_FOR_AVERAGE = 3

export function withinRadius(
  stations: readonly Station[],
  origin: LatLon,
  radiusKm: number,
): Station[] {
  return stations.filter((s) => haversineKm(origin, s.pos) <= radiusKm)
}

export function priceReference(
  stations: readonly Station[],
  fuel: FuelId,
): PriceReference | undefined {
  const prices = stations.map((s) => priceOf(s, fuel)).filter((p): p is number => p !== undefined)
  if (prices.length === 0) return undefined
  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length
  return { thresholds: bandThresholds(prices), mean, count: prices.length }
}

export function radiusReference(
  stations: readonly Station[],
  fuel: FuelId,
  origin: LatLon,
  radiusKm: number,
): PriceReference | undefined {
  return priceReference(withinRadius(stations, origin, radiusKm), fuel)
}

export function stationBand(
  station: Station,
  fuel: FuelId,
  reference: PriceReference | undefined,
): PriceBand | undefined {
  const price = priceOf(station, fuel)
  if (price === undefined || !reference) return undefined
  const band = bandForThresholds(price, reference.thresholds)
  // Ties and a skewed set can put a tercile on the wrong side of the average;
  // the band never contradicts the difference printed beside it.
  const cents = centsFromAverage(price, reference)
  if (cents === undefined) return band
  if ((band === 'cheap' && cents >= 0) || (band === 'expensive' && cents <= 0)) return 'mid'
  return band
}

// Whole céntimos, half away from zero on both sides; toFixed first so float
// noise such as 0.4999999 does not decide the rounding.
export function centsFromAverage(
  price: number,
  reference: PriceReference | undefined,
): number | undefined {
  if (!reference || reference.count < MIN_PRICES_FOR_AVERAGE) return undefined
  const cents = Number(((price - reference.mean) * 100).toFixed(6))
  const rounded = Math.round(Math.abs(cents))
  return rounded === 0 ? 0 : Math.sign(cents) * rounded
}

export function sortStations(
  stations: Station[],
  fuel: FuelId,
  origin: LatLon,
  key: SortKey,
): Station[] {
  return [...stations].sort((a, b) => {
    if (key === 'distance') return haversineKm(origin, a.pos) - haversineKm(origin, b.pos)
    const pa = priceOf(a, fuel),
      pb = priceOf(b, fuel)
    if (pa === undefined && pb === undefined) return 0
    if (pa === undefined) return 1
    if (pb === undefined) return -1
    return pa - pb
  })
}
