import { normalizeStation, parseSpanishNumber } from '../src/core/station'

const RAW = {
  'IDEESS': '11306', 'Rótulo': 'GALP', 'Dirección': 'AUTOPISTA AP 7 KM. 696',
  'Localidad': 'AGOST', 'Municipio': 'Agost', 'Horario': 'L-D: 24H',
  'Latitud': '38,406528', 'Longitud (WGS84)': '-0,599972',
  'Precio Gasoleo A': '1,609', 'Precio Gasolina 95 E5': '1,649',
  'Precio Gasoleo B': '', 'Precio Gases licuados del petróleo': '',
}

describe('station', () => {
  it('parses spanish numbers, blanks -> undefined', () => {
    expect(parseSpanishNumber('1,609')).toBeCloseTo(1.609, 3)
    expect(parseSpanishNumber('')).toBeUndefined()
    expect(parseSpanishNumber('foo')).toBeUndefined()
  })
  it('normalizes a raw record', () => {
    const s = normalizeStation(RAW)
    expect(s.id).toBe('11306')
    expect(s.brand).toBe('GALP')
    expect(s.pos.lat).toBeCloseTo(38.406528, 5)
    expect(s.pos.lon).toBeCloseTo(-0.599972, 5)
    expect(s.prices.gasoleoA).toBeCloseTo(1.609, 3)
    expect(s.prices.gasoleoB).toBeUndefined()   // blank omitted
    expect('glp' in s.prices).toBe(false)        // blank omitted
  })
})
