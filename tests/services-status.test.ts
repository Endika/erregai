import { serviceAreaStatus, nearbyServiceAreas, type ServiceArea } from '../src/core/services'

const area = (hours?: string): ServiceArea => ({
  id: 'w1',
  lat: 41,
  lon: -1,
  name: 'Área de prueba',
  services: ['restaurant'],
  hours,
})

// Wednesday 2026-01-07, 12:00 local.
const midday = new Date(2026, 0, 7, 12, 0)

describe('serviceAreaStatus', () => {
  it('resolves the restaurant hours when OSM has them', () => {
    expect(serviceAreaStatus(area('Mo-Su 07:00-23:00'), midday)).toBe('open')
    expect(serviceAreaStatus(area('Mo-Su 18:00-23:00'), midday)).toBe('closed')
  })

  it('never claims closed when the area has no hours at all', () => {
    expect(serviceAreaStatus(area(undefined), midday)).toBe('unknown')
    expect(serviceAreaStatus(area(''), midday)).toBe('unknown')
  })

  it('never claims closed when the hours cannot be modelled', () => {
    expect(serviceAreaStatus(area('24/7; Jun 15-Sep 15 07:30-22:30 off'), midday)).toBe('unknown')
  })
})

describe('nearbyServiceAreas caps and ordering', () => {
  const areas: ServiceArea[] = [
    { id: 'a', lat: 41.0, lon: -1.0, services: [] },
    { id: 'b', lat: 41.1, lon: -1.0, services: [] },
    { id: 'c', lat: 41.05, lon: -1.0, services: [] },
  ]

  it('orders by distance and honours the limit', () => {
    const hits = nearbyServiceAreas({ lat: 41.0, lon: -1.0 }, areas, 50, 2)
    expect(hits.map((h) => h.area.id)).toEqual(['a', 'c'])
  })

  it('returns nothing when everything is out of range', () => {
    expect(nearbyServiceAreas({ lat: 0, lon: 0 }, areas, 10, 10)).toEqual([])
  })
})
