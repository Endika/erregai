import { normalizeServiceAreas, areaId, kindOf } from '../scripts/lib/services-normalize.mjs'
import { nearbyServiceAreas, type ServiceArea } from '../src/core/services'
import fixture from './fixtures/overpass-services.json'

// The generator is plain .mjs, so its output arrives untyped; the cast is the
// point where we assert it really is shaped like the dataset the app imports.
const normalized = (): ServiceArea[] => normalizeServiceAreas(fixture.areas, fixture.pois) as ServiceArea[]
const byId = (id: string): ServiceArea | undefined => normalized().find(a => a.id === id)

describe('normalizeServiceAreas', () => {
  it('keeps only highway=services with usable coordinates', () => {
    expect(normalized().map(a => a.id)).toEqual(['w100', 'w200'])
  })

  it('collects the services found inside an area', () => {
    expect(byId('w100')?.services).toEqual(['fuel', 'restaurant', 'shop'])
  })

  it('takes opening hours from the eatery, not from the 24/7 fuel pump', () => {
    expect(byId('w100')?.hours).toBe('Mo-Su 07:00-23:00')
  })

  it('leaves hours undefined when nothing inside is tagged with them', () => {
    expect(byId('w200')?.hours).toBeUndefined()
  })

  it('assigns each POI to its nearest area', () => {
    expect(byId('w200')?.services).toEqual(['toilets'])
  })

  it('drops POIs too far from any area and tags it does not understand', () => {
    const services = normalized().flatMap(a => [...a.services])
    expect(services).not.toContain('parking')
    expect(normalized().every(a => a.services.length > 0)).toBe(true)
  })

  it('names areas only when OSM does', () => {
    expect(byId('w100')?.name).toBe('Área de La Muela')
    expect(byId('w200')?.name).toBeUndefined()
  })

  it('emits stable OSM-derived ids in a stable order', () => {
    const first = normalizeServiceAreas(fixture.areas, fixture.pois)
    const second = normalizeServiceAreas([...fixture.areas].reverse(), [...fixture.pois].reverse())
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('derives ids from the OSM type and id', () => {
    expect(areaId({ type: 'way', id: 42 })).toBe('w42')
    expect(areaId({ type: 'relation', id: 7 })).toBe('r7')
  })

  it('maps tags to service kinds and ignores the rest', () => {
    expect(kindOf({ amenity: 'restaurant' })).toBe('restaurant')
    expect(kindOf({ shop: 'convenience' })).toBe('shop')
    expect(kindOf({ amenity: 'parking' })).toBeUndefined()
  })
})

describe('nearbyServiceAreas', () => {
  const areas: ServiceArea[] = [
    { id: 'near', lat: 41.0, lon: -1.0, services: ['fuel'] },
    { id: 'mid', lat: 41.2, lon: -1.0, services: ['restaurant'] },
    { id: 'far', lat: 42.0, lon: -1.0, services: ['fuel'] },
  ]

  it('returns areas within the radius, nearest first', () => {
    const hits = nearbyServiceAreas({ lat: 41.0, lon: -1.0 }, areas, 30, 10)
    expect(hits.map(h => h.area.id)).toEqual(['near', 'mid'])
  })

  it('caps the result at the limit', () => {
    expect(nearbyServiceAreas({ lat: 41.0, lon: -1.0 }, areas, 500, 1)).toHaveLength(1)
  })
})
