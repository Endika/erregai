import {
  displayName,
  displayProvince,
  placesFromStations,
} from '../scripts/lib/places-normalize.mjs'
import { normalizeQuery, placesFromRows, searchPlaces, type Place } from '../src/core/places'

const place = (name: string, n: number, province = 'Gipuzkoa'): Place => ({
  name,
  province,
  pos: { lat: 43, lon: -2 },
  stations: n,
})

const PLACES: Place[] = [
  place('Donostia-San Sebastián', 16),
  place('San Sebastián de los Reyes', 18, 'Madrid'),
  place('A Coruña', 31, 'A Coruña'),
  place('Valencia de Don Juan', 2, 'León'),
  place('Valencia', 65, 'Valencia / València'),
  place('Vitoria-Gasteiz', 39, 'Araba/Álava'),
  place('Ávila', 12, 'Ávila'),
]
const names = (q: string): string[] => searchPlaces(q, PLACES).map((p) => p.name)

describe('searchPlaces', () => {
  it('finds a place by the start of its name', () => {
    expect(names('Donosti')[0]).toBe('Donostia-San Sebastián')
  })

  it('ignores accents and case on both sides', () => {
    expect(names('coruña')).toEqual(['A Coruña'])
    expect(names('CORUNA')).toEqual(['A Coruña'])
    expect(names('avila')).toEqual(['Ávila'])
  })

  it('matches any word of a two-language or compound name', () => {
    expect(names('gasteiz')).toEqual(['Vitoria-Gasteiz'])
    expect(names('san sebas')).toEqual(['San Sebastián de los Reyes', 'Donostia-San Sebastián'])
  })

  it('puts an exact name first, then the places with more stations', () => {
    expect(names('valencia')).toEqual(['Valencia', 'Valencia de Don Juan'])
  })

  it('waits for two letters and caps the suggestions', () => {
    expect(names('v')).toEqual([])
    expect(searchPlaces('a', PLACES)).toEqual([])
    expect(searchPlaces('va', PLACES, 1)).toHaveLength(1)
  })

  it('normalizes punctuation and spacing in the query', () => {
    expect(normalizeQuery('  Donostia–San   Sebastián ')).toBe('donostia san sebastian')
  })

  it('reads the compact rows the generator writes', () => {
    expect(placesFromRows([['Bilbao', 1, 43.257, -2.924, 10]], ['Araba/Álava', 'Bizkaia'])).toEqual(
      [{ name: 'Bilbao', province: 'Bizkaia', pos: { lat: 43.257, lon: -2.924 }, stations: 10 }],
    )
  })
})

describe('places generator', () => {
  it('puts the trailing article first', () => {
    expect(displayName('Coruña (A)')).toBe('A Coruña')
    expect(displayName('Palmas de Gran Canaria (Las)')).toBe('Las Palmas de Gran Canaria')
    expect(displayName("Hospitalet de Llobregat (L')")).toBe("L'Hospitalet de Llobregat")
    expect(displayName('Bilbao')).toBe('Bilbao')
    expect(displayName('Noáin (Valle de Elorz)/Noain (Elortzibar)')).toBe(
      'Noáin (Valle de Elorz)/Noain (Elortzibar)',
    )
  })

  it('writes province names the way they are read', () => {
    expect(displayProvince('CORUÑA (A)')).toBe('A Coruña')
    expect(displayProvince('SANTA CRUZ DE TENERIFE')).toBe('Santa Cruz de Tenerife')
    expect(displayProvince('VALENCIA / VALÈNCIA')).toBe('Valencia / València')
    expect(displayProvince('ARABA/ÁLAVA')).toBe('Araba/Álava')
    expect(displayProvince('BALEARS (ILLES)')).toBe('Illes Balears')
  })

  it('centres each municipality on its stations and counts them', () => {
    const row = (id: string, name: string, lat: string, lon: string) => ({
      IDMunicipio: id,
      Municipio: name,
      Provincia: 'BIZKAIA',
      Latitud: lat,
      'Longitud (WGS84)': lon,
    })
    expect(
      placesFromStations([
        row('1', 'Bilbao', '43,2', '-2,9'),
        row('1', 'Bilbao', '43,3', '-3,0'),
        row('2', 'Getxo', '43,35', '-3,01'),
        row('3', 'Nowhere', '', ''),
      ]),
    ).toEqual([
      { name: 'Bilbao', province: 'Bizkaia', lat: 43.25, lon: -2.95, n: 2 },
      { name: 'Getxo', province: 'Bizkaia', lat: 43.35, lon: -3.01, n: 1 },
    ])
  })
})
