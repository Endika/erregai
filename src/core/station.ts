import type { LatLon } from './geo'
import { FUELS, type FuelId } from './fuels'

export type RawStation = Record<string, string>
export interface Station {
  id: string; brand: string; name: string; pos: LatLon
  address: string; town: string; schedule: string
  prices: Partial<Record<FuelId, number>>
}

export function parseSpanishNumber(s: string): number | undefined {
  if (!s || !s.trim()) return undefined
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

export function normalizeStation(raw: RawStation): Station {
  const prices: Partial<Record<FuelId, number>> = {}
  for (const f of FUELS) {
    const v = parseSpanishNumber(raw[f.apiKey] ?? '')
    if (v !== undefined) prices[f.id] = v
  }
  return {
    id: raw['IDEESS'] ?? '',
    brand: raw['Rótulo'] ?? '',
    name: raw['Rótulo'] ?? '',
    pos: {
      lat: parseSpanishNumber(raw['Latitud'] ?? '') ?? NaN,
      lon: parseSpanishNumber(raw['Longitud (WGS84)'] ?? '') ?? NaN,
    },
    address: raw['Dirección'] ?? '',
    town: raw['Municipio'] ?? raw['Localidad'] ?? '',
    schedule: raw['Horario'] ?? '',
    prices,
  }
}
