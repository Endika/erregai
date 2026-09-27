import { normalizeStation, type RawStation, type Station } from '../core/station'

export type FetchFn = typeof fetch
export const API_BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes'
export interface ProvinceResult {
  fecha: string
  stations: Station[]
}

export async function fetchProvince(id: string, fetchFn: FetchFn = fetch): Promise<ProvinceResult> {
  const res = await fetchFn(`${API_BASE}/EstacionesTerrestres/FiltroProvincia/${id}`)
  if (!res.ok) throw new Error(`API ${res.status} for province ${id}`)
  const data: unknown = await res.json()
  if (!isProvincePayload(data)) throw new Error(`unexpected response for province ${id}`)
  const list = data.ListaEESSPrecio
  const stations = list
    .filter((raw) => raw['IDEESS'])
    .map(normalizeStation)
    .filter((s) => Number.isFinite(s.pos.lat) && Number.isFinite(s.pos.lon))
  // A stray station without id or coordinates is skipped, but losing all of them means the fields moved.
  if (list.length > 0 && stations.length === 0)
    throw new Error(`no usable station for province ${id}`)
  return { fecha: data.Fecha, stations }
}

function isProvincePayload(
  data: unknown,
): data is { Fecha: string; ListaEESSPrecio: RawStation[] } {
  if (typeof data !== 'object' || data === null) return false
  const { Fecha, ListaEESSPrecio } = data as Record<string, unknown>
  return typeof Fecha === 'string' && Fecha !== '' && Array.isArray(ListaEESSPrecio)
}
