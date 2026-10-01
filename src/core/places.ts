import type { LatLon } from './geo'

// [name, province index, lat, lon, station count], as scripts/build-places.mjs writes it.
export type PlaceRow = readonly [string, number, number, number, number]

export interface Place {
  name: string
  province: string
  pos: LatLon
  stations: number
}

const MIN_QUERY = 2
const DEFAULT_LIMIT = 8

export function placesFromRows(rows: readonly PlaceRow[], provinces: readonly string[]): Place[] {
  return rows.map(([name, province, lat, lon, stations]) => ({
    name,
    province: provinces[province] ?? '',
    pos: { lat, lon },
    stations,
  }))
}

// "Donostia–San Sebastián" and "donostia san sebastian" are the same search.
export function normalizeQuery(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const index = new WeakMap<Place, string>()
function key(place: Place): string {
  let k = index.get(place)
  if (k === undefined) {
    k = normalizeQuery(place.name)
    index.set(place, k)
  }
  return k
}

// 0 exact, 1 start of the name, 2 start of any later word; undefined is no match.
function rank(name: string, q: string): number | undefined {
  if (name === q) return 0
  if (name.startsWith(q)) return 1
  if (name.includes(` ${q}`)) return 2
  return undefined
}

export function searchPlaces(
  query: string,
  places: readonly Place[],
  limit = DEFAULT_LIMIT,
): Place[] {
  const q = normalizeQuery(query)
  if (q.length < MIN_QUERY) return []
  const hits: { place: Place; rank: number }[] = []
  for (const place of places) {
    const r = rank(key(place), q)
    if (r !== undefined) hits.push({ place, rank: r })
  }
  return hits
    .sort((a, b) => a.rank - b.rank || b.place.stations - a.place.stations)
    .slice(0, limit)
    .map((h) => h.place)
}
