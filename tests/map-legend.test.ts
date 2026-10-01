// @vitest-environment jsdom
import { renderMapLegend, relabelMapLegend } from '../src/ui/map-legend'
import { MapView } from '../src/ui/map'
import { setLocale, t } from '../src/i18n'

beforeEach(() => setLocale('es'))

const toggleOf = (legend: HTMLElement): HTMLButtonElement =>
  legend.querySelector<HTMLButtonElement>('.map-legend__toggle')!
const panelOf = (legend: HTMLElement): HTMLElement =>
  legend.querySelector<HTMLElement>('.map-legend__panel')!

describe('map legend', () => {
  it('starts closed behind a labelled toggle', () => {
    const legend = renderMapLegend()
    const toggle = toggleOf(legend)
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.type).toBe('button')
    expect(toggle.textContent).toBe(t('map.legend.toggle'))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBe(panelOf(legend).id)
    expect(panelOf(legend).hidden).toBe(true)
  })

  it('opens and closes from the toggle', () => {
    const legend = renderMapLegend()
    toggleOf(legend).click()
    expect(toggleOf(legend).getAttribute('aria-expanded')).toBe('true')
    expect(panelOf(legend).hidden).toBe(false)
    toggleOf(legend).click()
    expect(toggleOf(legend).getAttribute('aria-expanded')).toBe('false')
    expect(panelOf(legend).hidden).toBe(true)
  })

  it('closes on Escape and hands focus back to the toggle', () => {
    const legend = renderMapLegend()
    document.body.appendChild(legend)
    toggleOf(legend).click()
    panelOf(legend).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panelOf(legend).hidden).toBe(true)
    expect(document.activeElement).toBe(toggleOf(legend))
    legend.remove()
  })

  it('names the bands within the radius, the unpriced grey, the radar and the service area', () => {
    const legend = renderMapLegend()
    expect(legend.querySelector('.map-legend__heading')!.textContent).toBe(t('map.legend.prices'))
    const rows = [...legend.querySelectorAll<HTMLElement>('.map-legend__row')]
    expect(rows.map((r) => r.textContent)).toEqual([
      t('band.cheap'),
      t('band.mid'),
      t('band.expensive'),
      t('map.legend.noPrice'),
      t('map.legend.radar'),
      t('map.legend.services'),
    ])
  })

  it('draws each swatch from the pins’ own tokens and glyphs', () => {
    const legend = renderMapLegend()
    const discs = [...legend.querySelectorAll<HTMLElement>('.map-legend .map-pin__disc')]
    const styles = discs.map((d) => d.getAttribute('style') ?? '')
    for (const kind of ['cheap', 'mid', 'expensive', 'unknown', 'radar', 'services'])
      expect(styles.some((s) => s.includes(`var(--map-marker-${kind})`))).toBe(true)
    expect(legend.querySelectorAll('.map-legend svg.map-glyph').length).toBe(discs.length)
    expect(legend.querySelector('.map-service-marker__box')).not.toBeNull()
    // Purely illustrative: the row's text is what a screen reader reads.
    for (const disc of discs) expect(disc.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('follows a language change without closing', () => {
    const legend = renderMapLegend()
    toggleOf(legend).click()
    setLocale('eu')
    relabelMapLegend(legend)
    expect(toggleOf(legend).textContent).toBe(t('map.legend.toggle', 'eu'))
    expect(legend.querySelector('.map-legend__row')!.textContent).toBe(t('band.cheap', 'eu'))
    expect(panelOf(legend).hidden).toBe(false)
  })

  it('sits bottom-left on the map, on the trip map too', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const view = new MapView(container)
    const pos = { lat: 43.263, lon: -2.935 }
    view.render(pos, [], 'gasoleoA', () => {}, { radiusKm: 15 })
    expect(container.querySelectorAll('.leaflet-bottom.leaflet-left .map-legend')).toHaveLength(1)
    view.render(pos, [], 'gasoleoA', () => {}, { recenter: true })
    expect(container.querySelectorAll('.leaflet-bottom.leaflet-left .map-legend')).toHaveLength(1)
    view.destroy()
    container.remove()
  })
})
