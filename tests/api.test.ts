import { fetchProvince } from '../src/adapters/api'

const fakeFetch = (body: unknown, ok = true): typeof fetch =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch

describe('api', () => {
  it('parses a province payload into stations', async () => {
    const body = { Fecha: '14/07/2026', ResultadoConsulta: 'OK', ListaEESSPrecio: [
      { IDEESS: '1', 'Rótulo': 'REPSOL', Latitud: '40,0', 'Longitud (WGS84)': '-3,0', 'Precio Gasoleo A': '1,5' },
      { IDEESS: '2', 'Rótulo': 'CEPSA', Latitud: '', 'Longitud (WGS84)': '', 'Precio Gasoleo A': '1,4' }, // bad coords dropped
    ] }
    const res = await fetchProvince('28', fakeFetch(body))
    expect(res.fecha).toBe('14/07/2026')
    expect(res.stations.map(s => s.id)).toEqual(['1'])
  })
  it('throws on http error', async () => {
    await expect(fetchProvince('28', fakeFetch({}, false))).rejects.toThrow()
  })
})
