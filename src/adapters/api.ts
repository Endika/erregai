import { normalizeStation, type RawStation, type Station } from '../core/station'

export type FetchFn = typeof fetch
export const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes'
export interface ProvinceResult { fecha: string; stations: Station[] }

export async function fetchProvince(id: string, fetchFn: FetchFn = fetch): Promise<ProvinceResult> {
  const res = await fetchFn(`${API_BASE}/EstacionesTerrestres/FiltroProvincia/${id}`)
  if (!res.ok) throw new Error(`API ${res.status} for province ${id}`)
  const data = await res.json() as { Fecha?: string; ListaEESSPrecio?: RawStation[] }
  const list = data.ListaEESSPrecio ?? []
  const stations = list.map(normalizeStation).filter(s => Number.isFinite(s.pos.lat) && Number.isFinite(s.pos.lon))
  return { fecha: data.Fecha ?? '', stations }
}
