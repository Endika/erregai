export type LatLon = { lat: number; lon: number }
const R = 6371
const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function bearingDeg(from: LatLon, to: LatLon): number {
  const y = Math.sin(toRad(to.lon - from.lon)) * Math.cos(toRad(to.lat))
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lon - from.lon))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function angularDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function isAhead(pos: LatLon, heading: number, target: LatLon, corridorDeg: number): boolean {
  return angularDelta(heading, bearingDeg(pos, target)) <= corridorDeg
}
