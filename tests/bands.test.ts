// @vitest-environment jsdom
import { renderList } from '../src/ui/list'
import { renderDetail } from '../src/ui/detail'
import { MapView } from '../src/ui/map'
import { radiusReference } from '../src/core/pricing'
import { setLocale } from '../src/i18n'
import type { Station } from '../src/core/station'

const origin = { lat: 43.263, lon: -2.935 }
const station = (id: string, price: number, lat = 43.263): Station => ({
  id,
  brand: id.toUpperCase(),
  name: id,
  pos: { lat, lon: -2.935 },
  address: '',
  town: 'Bilbao',
  schedule: 'L-D: 24H',
  prices: { gasoleoA: price },
})

// Within 15 km, 1,469 is the cheapest third. The map also draws stations well
// outside the radius, all cheaper, against which it would be the dearest.
const target = station('target', 1.469)
const nearby = [target, station('b', 1.55), station('c', 1.6), station('d', 1.62)]
const beyond = [0, 1, 2, 3, 4, 5].map((i) => station(`far${i}`, 1.3, 44 + i * 0.01))
const reference = radiusReference([...nearby, ...beyond], 'gasoleoA', origin, 15)

const MARKER_COLORS = { cheap: '#00aa00', mid: '#aaaa00', expensive: '#aa0000' }

beforeEach(() => {
  setLocale('es')
  for (const [band, color] of Object.entries(MARKER_COLORS))
    document.documentElement.style.setProperty(`--map-marker-${band}`, color)
})

function mapBand(stations: Station[]): string | undefined {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const view = new MapView(container)
  view.render(origin, stations, 'gasoleoA', () => {}, { reference })
  const fills = [...container.querySelectorAll<HTMLElement>('.map-pin__disc')].map(
    (disc) => disc.style.background,
  )
  view.destroy()
  container.remove()
  const fill = fills[stations.indexOf(target)]
  const hex = (c: string) => {
    const probe = document.createElement('span')
    probe.style.background = c
    return probe.style.background
  }
  return Object.entries(MARKER_COLORS).find(([, c]) => hex(c) === fill)?.[0]
}

describe('one price reference for every surface', () => {
  it('gives the same station the same band on the list, the card and the map', () => {
    const list = document.createElement('div')
    renderList(list, nearby, 'gasoleoA', origin, () => {}, {})
    const row = list.querySelector<HTMLElement>('[data-station="target"]')

    const card = document.createElement('div')
    renderDetail(card, target, undefined, { fuel: 'gasoleoA', origin, reference })
    const lead = card.querySelector<HTMLElement>('.station-detail__lead')

    expect(row?.dataset.band).toBe('cheap')
    expect(lead?.dataset.band).toBe('cheap')
    expect(mapBand([...nearby, ...beyond])).toBe('cheap')
  })
})
