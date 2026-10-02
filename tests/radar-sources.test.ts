import { readFileSync } from 'node:fs'
import {
  parseDgtXml,
  parseCatalunyaTxt,
  parseTrafikoaHtml,
  parsePk,
  parseLimit,
  displayPlace,
  normalizeDgt,
  normalizeCatalunya,
  normalizeEuskadi,
  parseDataset,
} from '../scripts/lib/radar-normalize.mjs'

// Trimmed copies of the real source files: a few rows each, kept byte for byte.
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/radars/${name}`, import.meta.url))

describe('parsePk', () => {
  it('reads a kilometre point with a decimal comma or a decimal point', () => {
    expect(parsePk('445,35')).toBe(445.35)
    expect(parsePk('123.500')).toBe(123.5)
    expect(parsePk('85')).toBe(85)
  })

  it('leaves out a section range, a word or nothing at all', () => {
    expect(parsePk('539,2-545,1')).toBeUndefined()
    expect(parsePk('1,8-3,0')).toBeUndefined()
    expect(parsePk('nord')).toBeUndefined()
    expect(parsePk('')).toBeUndefined()
    expect(parsePk(undefined)).toBeUndefined()
  })
})

describe('parseLimit', () => {
  it('reads a single limit with or without its unit', () => {
    expect(parseLimit('80 km/h')).toBe(80)
    expect(parseLimit('70 Km/h')).toBe(70)
    expect(parseLimit('80')).toBe(80)
    expect(parseLimit('120')).toBe(120)
  })

  it('leaves out a dash, a variable limit and anything off the signposted steps', () => {
    expect(parseLimit('-')).toBeUndefined()
    expect(parseLimit('60/80 km/h')).toBeUndefined()
    expect(parseLimit('85')).toBeUndefined()
    expect(parseLimit('48,085')).toBeUndefined()
    expect(parseLimit('150')).toBeUndefined()
  })
})

describe('displayPlace', () => {
  it('turns a shouted name into a written one', () => {
    expect(displayPlace('ZARAGOZA')).toBe('Zaragoza')
    expect(displayPlace('SAN SEBASTIÁN')).toBe('San Sebastián')
    expect(displayPlace('MADRIGAL DE LA VERA')).toBe('Madrigal de la Vera')
    expect(displayPlace('LA ALMUNIA')).toBe('La Almunia')
    expect(displayPlace('STO. DOMINGO')).toBe('Sto. Domingo')
    expect(displayPlace('DONOSTIA / SAN SEBASTIÁN')).toBe('Donostia / San Sebastián')
  })

  it('joins a spaced hyphen and trims the stray space', () => {
    expect(displayPlace('VITORIA - GASTEIZ ')).toBe('Vitoria-Gasteiz')
  })

  it('keeps a name already written in mixed case, and a road code', () => {
    expect(displayPlace('Santiago de Compostela')).toBe('Santiago de Compostela')
    expect(displayPlace('Ponte Pasaxe')).toBe('Ponte Pasaxe')
    expect(displayPlace('AG-64')).toBe('AG-64')
  })

  it('mends the one name DGT runs together', () => {
    expect(displayPlace('ACORUÑA')).toBe('A Coruña')
  })
})

describe('DGT DATEX2', () => {
  const rows = parseDgtXml(fixture('dgt.xml'))
  const radars = normalizeDgt(rows)

  it('reads only the fixed cabins, never the section radars before them', () => {
    expect(rows).toHaveLength(2)
    expect(radars.map((r: { via: string }) => r.via)).toEqual(['A-2', 'CA-33'])
  })

  it('takes the PK from the reference distance in metres', () => {
    expect(radars[0].pk).toBe(202.33)
    expect(radars[1].pk).toBe(3.97)
  })

  it('prefers the named destination and falls back to the PK direction', () => {
    expect(radars[0].dir).toBe('Zaragoza')
    expect(radars[1].dir).toBe('creciente')
  })

  it('reads a decreasing direction too', () => {
    const [r] = normalizeDgt([
      {
        Latitud: '40',
        Longitud: '-3',
        Carretera: 'A-4',
        Distancia: '417588.0',
        Relativo: 'negative',
      },
    ])
    expect(r.dir).toBe('decreciente')
  })

  it('publishes no speed limit', () => {
    expect(radars.every((r: object) => !('limit' in r))).toBe(true)
  })
})

describe('Servei Català de Trànsit export', () => {
  const rows = parseCatalunyaTxt(fixture('catalunya.txt'))
  const radars = normalizeCatalunya(rows)
  const byPk = (pk: number) => radars.find((r: { pk?: number }) => r.pk === pk)

  it('keeps every row with its road', () => {
    expect(rows).toHaveLength(10)
    expect(radars[0]).toMatchObject({ via: 'A-2', pk: 445.35, limit: 120 })
  })

  it('takes the road from a row that names its carriageway', () => {
    expect(byPk(85)).toMatchObject({ via: 'C-32', limit: 120 })
    expect(byPk(48.085)).toMatchObject({ via: 'C-32', limit: 120 })
  })

  it('leaves the PK out of a section range, but keeps its limit', () => {
    const range = radars.find((r: { via: string }) => r.via === 'C-58cc')
    expect(range).not.toHaveProperty('pk')
    expect(range).toMatchObject({ limit: 90 })
    expect(radars[1]).not.toHaveProperty('pk')
  })

  it('publishes no direction', () => {
    expect(radars.every((r: object) => !('dir' in r))).toBe(true)
  })
})

describe('Trafikoa page', () => {
  const rows = parseTrafikoaHtml(fixture('euskadi.html'))
  const radars = normalizeEuskadi(rows)
  const named = (via: string) => radars.find((r: { via: string }) => r.via === via)

  it('reads one row per cabin', () => {
    expect(rows).toHaveLength(5)
  })

  it('takes the PK, the destination and the limit', () => {
    expect(named('A-8')).toMatchObject({ pk: 123.5, dir: 'Donostia / San Sebastián', limit: 80 })
    expect(named('A-124')).toMatchObject({ pk: 64.3, dir: 'Vitoria-Gasteiz', limit: 50 })
  })

  it('leaves out a variable limit and a camera with none', () => {
    expect(named('N-637')).toMatchObject({ pk: 11.475, dir: 'Getxo / Barakaldo' })
    expect(named('N-637')).not.toHaveProperty('limit')
    expect(named('N-634')).not.toHaveProperty('limit')
  })
})

describe('parseDataset with the optional fields', () => {
  it('reads back pk, dir and limit, and leaves them out where a row has none', () => {
    const text = [
      `  { id: "euskadi-0", lat: 43.29, lon: -2.99, via: "A-8", source: "euskadi", pk: 123.5, dir: "Donostia / San Sebastián", limit: 80 },`,
      `  { id: "dgt-1", lat: 41.3, lon: -1.9, via: "A-2", source: "dgt" },`,
    ].join('\n')
    expect(parseDataset(text).rows).toEqual([
      {
        id: 'euskadi-0',
        lat: 43.29,
        lon: -2.99,
        via: 'A-8',
        source: 'euskadi',
        pk: 123.5,
        dir: 'Donostia / San Sebastián',
        limit: 80,
      },
      { id: 'dgt-1', lat: 41.3, lon: -1.9, via: 'A-2', source: 'dgt' },
    ])
  })
})
