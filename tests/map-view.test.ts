// @vitest-environment jsdom
import * as L from 'leaflet'
import { MapView } from '../src/ui/map'
import { radiusBounds } from '../src/ui/map-frame'
import { setLocale, t } from '../src/i18n'
import type { Station } from '../src/core/station'
import type { Radar } from '../src/core/radars'

const BILBAO = { lat: 43.263, lon: -2.935 }

// jsdom has no layout; Leaflet sizes the map from the container's client box.
function sizedContainer(width = 390, height = 380): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height })
  document.body.appendChild(el)
  return el
}

const leafletOf = (view: MapView): L.Map => (view as unknown as { map: L.Map }).map

function radiusCircles(map: L.Map): L.Circle[] {
  const found: L.Circle[] = []
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle) found.push(layer)
  })
  return found
}

function framesRadius(map: L.Map, km: number): boolean {
  const { south, west, north, east } = radiusBounds(BILBAO, km)
  return map.getBounds().contains(L.latLngBounds([south, west], [north, east]))
}

let view: MapView
let container: HTMLElement

beforeEach(() => {
  setLocale('es')
  container = sizedContainer()
  view = new MapView(container)
})

afterEach(() => {
  view.destroy()
  container.remove()
})

describe('MapView radius framing', () => {
  it('fits the whole radius into view, which zoom 12 cropped', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    expect(framesRadius(leafletOf(view), 15)).toBe(false)
    view.fitRadius(BILBAO, 15)
    expect(framesRadius(leafletOf(view), 15)).toBe(true)
  })

  it('draws the radius as one circle on the map tab, and none on the trip map', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    const circles = radiusCircles(leafletOf(view))
    expect(circles).toHaveLength(1)
    expect(circles[0].getRadius()).toBe(15_000)
    expect(circles[0].options.interactive).toBe(false)

    view.render(BILBAO, [], 'gasoleoA', () => {}, { recenter: true })
    expect(radiusCircles(leafletOf(view))).toHaveLength(0)
  })
})

describe('MapView fit control', () => {
  const fitButton = (): HTMLButtonElement | null =>
    container.querySelector<HTMLButtonElement>('.map-fit')

  it('is a labelled, keyboard-reachable button', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    const button = fitButton()!
    expect(button.tagName).toBe('BUTTON')
    expect(button.type).toBe('button')
    expect(button.tabIndex).toBe(0)
    expect(button.getAttribute('aria-label')).toBe(t('map.fit'))
    expect(button.title).toBe(t('map.fit'))
  })

  it('reframes the radius after the user has wandered off', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    const map = leafletOf(view)
    map.setView([40.4, -3.7], 16, { animate: false })
    fitButton()!.click()
    expect(framesRadius(map, 15)).toBe(true)
    expect(map.getCenter().distanceTo([BILBAO.lat, BILBAO.lon])).toBeLessThan(50)
  })

  it('follows a new radius and position', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 5 })
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 25 })
    fitButton()!.click()
    expect(framesRadius(leafletOf(view), 25)).toBe(true)
  })

  it('is not offered on the trip map, where there is no radius to frame', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    view.render(BILBAO, [], 'gasoleoA', () => {}, { recenter: true })
    expect(fitButton()).toBeNull()
  })

  it('relabels itself when the language changes', () => {
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    setLocale('en')
    view.render(BILBAO, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    expect(fitButton()!.getAttribute('aria-label')).toBe(t('map.fit', 'en'))
  })
})

describe('MapView stacking', () => {
  // leaflet.css stacks its own marker pane at 600; jsdom never loads the sheet.
  const LEAFLET_MARKER_PANE_Z = 600
  const paneZ = (el: Element): number => {
    const pane = el.closest<HTMLElement>('.leaflet-pane')!
    return pane.classList.contains('leaflet-marker-pane')
      ? LEAFLET_MARKER_PANE_Z
      : Number(pane.style.zIndex)
  }
  const station: Station = {
    id: 's1',
    brand: 'REPSOL',
    name: 'REPSOL',
    pos: BILBAO,
    address: '',
    town: 'Bilbao',
    schedule: '',
    prices: { gasoleoA: 1.5 },
  }
  const radar: Radar = { id: 'r1', ...BILBAO, via: 'A-8', source: 'euskadi' }

  it('keeps every station pin above the radars', () => {
    view.render(BILBAO, [station], 'gasoleoA', () => {}, { radiusKm: 15 })
    view.renderRadars([radar])
    const pins = [...container.querySelectorAll('.leaflet-marker-icon')]
    const stationPin = pins.find((el) => el.closest('.leaflet-marker-pane'))!
    const radarPin = pins.find((el) => !el.closest('.leaflet-marker-pane'))!
    expect(radarPin).toBeDefined()
    expect(paneZ(radarPin)).toBeLessThan(paneZ(stationPin))
    // Above the radius ring and Leaflet's overlay pane, so it is never hidden there.
    expect(paneZ(radarPin)).toBeGreaterThan(400)
  })

  it('lifts the radars above the stations while driving', () => {
    view.raiseRadars(true)
    view.render(BILBAO, [station], 'gasoleoA', () => {}, { radiusKm: 15 })
    view.renderRadars([radar])
    const pins = [...container.querySelectorAll('.leaflet-marker-icon')]
    const stationPin = pins.find((el) => el.closest('.leaflet-marker-pane'))!
    const radarPin = pins.find((el) => !el.closest('.leaflet-marker-pane'))!
    expect(paneZ(radarPin)).toBeGreaterThan(paneZ(stationPin))
    view.raiseRadars(false)
    expect(paneZ(radarPin)).toBeLessThan(paneZ(stationPin))
  })
})
