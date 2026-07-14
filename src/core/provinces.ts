import { haversineKm, type LatLon } from './geo'
import { PROVINCE_BBOX } from './provinces.data'

export interface ProvinceBox {
  id: string; name: string
  minLat: number; maxLat: number; minLon: number; maxLon: number
  cLat: number; cLon: number
}

const boxes = PROVINCE_BBOX as readonly ProvinceBox[]
const contains = (b: ProvinceBox, p: LatLon) =>
  p.lat >= b.minLat && p.lat <= b.maxLat && p.lon >= b.minLon && p.lon <= b.maxLon

export function provinceFor(pos: LatLon): ProvinceBox {
  const inside = boxes.filter(b => contains(b, pos))
  const pool = inside.length ? inside : boxes
  return [...pool].sort((a, b) =>
    haversineKm(pos, { lat: a.cLat, lon: a.cLon }) - haversineKm(pos, { lat: b.cLat, lon: b.cLon }))[0]
}

export function adjacentProvinces(id: string, n = 2): ProvinceBox[] {
  const self = boxes.find(b => b.id === id)
  if (!self) return []
  return [...boxes].filter(b => b.id !== id)
    .sort((a, b) =>
      haversineKm({ lat: self.cLat, lon: self.cLon }, { lat: a.cLat, lon: a.cLon }) -
      haversineKm({ lat: self.cLat, lon: self.cLon }, { lat: b.cLat, lon: b.cLon }))
    .slice(0, n)
}
