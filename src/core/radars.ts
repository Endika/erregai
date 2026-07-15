import { type LatLon, haversineKm, isAhead } from './geo'
import { nextProximityAlerts } from './proximity'

export type RadarSource = 'dgt' | 'euskadi' | 'catalunya'
export type Radar = { id: string; lat: number; lon: number; via: string; source: RadarSource }
export type RadarHit = { radar: Radar; distanceKm: number }
export type RadarSelectConfig = { radiusKm: number; corridorDeg: number }

const posOf = (radar: Radar): LatLon => ({ lat: radar.lat, lon: radar.lon })

export function radarsAhead(
  pos: LatLon,
  heading: number | undefined,
  radars: readonly Radar[],
  cfg: RadarSelectConfig,
): RadarHit[] {
  return radars
    .map(radar => ({ radar, distanceKm: haversineKm(pos, posOf(radar)) }))
    .filter(h => h.distanceKm <= cfg.radiusKm)
    .filter(h => heading === undefined ? true : isAhead(pos, heading, posOf(h.radar), cfg.corridorDeg))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

export function nextRadarAlerts(
  prevAlertedIds: ReadonlySet<string>,
  hits: readonly RadarHit[],
  alertDistanceKm: number,
  hysteresisKm = 0.2,
): { alertedIds: Set<string>; newlyAlerted: RadarHit[] } {
  const byId = new Map(hits.map(h => [h.radar.id, h]))
  const items = hits.map(h => ({ id: h.radar.id, distanceKm: h.distanceKm }))
  const { alertedIds, newlyAlerted } = nextProximityAlerts(prevAlertedIds, items, alertDistanceKm, hysteresisKm)
  return { alertedIds, newlyAlerted: newlyAlerted.map(i => byId.get(i.id)!) }
}
