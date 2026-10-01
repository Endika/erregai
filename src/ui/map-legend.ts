import { glyphSvg, type Glyph } from './map-icons'
import { t } from '../i18n'

const PIN_PX = 22
const RING = '0 1px 3px rgba(0, 0, 0, 0.35)'

// The same disc the map draws, coloured from the same token, so the key can
// never drift from the pins it explains. Constant markup only.
function pin(glyph: Glyph, fill: string, ink: string, ring: string): string {
  const style = `background:${fill};color:${ink};box-shadow:0 0 0 2px ${ring}, ${RING}`
  return `<span class="map-legend__pin"><span class="map-pin__disc" style="${style}">${glyphSvg(glyph, Math.round(PIN_PX * 0.6))}</span></span>`
}

const bandPin = (kind: string): string =>
  pin('fuel', `var(--map-marker-${kind})`, '#ffffff', '#ffffff')

const ROWS: readonly { key: string; swatch: string }[] = [
  { key: 'band.cheap', swatch: bandPin('cheap') },
  { key: 'band.mid', swatch: bandPin('mid') },
  { key: 'band.expensive', swatch: bandPin('expensive') },
  { key: 'map.legend.noPrice', swatch: bandPin('unknown') },
  {
    key: 'map.legend.radar',
    swatch: pin('camera', '#ffffff', 'var(--map-marker-radar)', 'var(--map-marker-radar)'),
  },
  {
    // Both shapes a service area takes: a glyph when OSM says what it offers,
    // the bare square when it does not.
    key: 'map.legend.services',
    swatch:
      pin('cutlery', 'var(--map-marker-services)', '#ffffff', '#ffffff') +
      '<span class="map-service-marker__box" style="background:var(--map-marker-services)"></span>',
  },
]

// A key in miniature: the three band colours, each against a line of text.
const TOGGLE_ICON =
  '<svg class="map-legend__icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
  ['cheap', 'mid', 'expensive']
    .map(
      (kind, i) =>
        `<circle cx="5" cy="${6 + i * 6}" r="2.75" style="fill:var(--map-marker-${kind})"/>` +
        `<path d="M10.5 ${6 + i * 6}H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    )
    .join('') +
  '</svg>'

let legendCount = 0

export function renderMapLegend(): HTMLElement {
  const legend = document.createElement('div')
  legend.className = 'leaflet-control map-control map-legend'

  const panel = document.createElement('div')
  panel.className = 'map-legend__panel'
  panel.id = `map-legend-${++legendCount}`
  panel.hidden = true

  const heading = document.createElement('p')
  heading.className = 'map-legend__heading'
  heading.dataset.label = 'map.legend.prices'

  const list = document.createElement('ul')
  list.className = 'map-legend__list'
  for (const { key, swatch } of ROWS) {
    const row = document.createElement('li')
    row.className = 'map-legend__row'
    const icon = document.createElement('span')
    icon.className = 'map-legend__swatch'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = swatch
    const label = document.createElement('span')
    label.dataset.label = key
    row.append(icon, label)
    list.appendChild(row)
  }
  panel.append(heading, list)

  // After the panel, so in a bottom corner the key opens upwards over the map.
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'map-legend__toggle'
  toggle.innerHTML = TOGGLE_ICON
  const name = document.createElement('span')
  name.className = 'visually-hidden'
  name.dataset.label = 'map.legend.toggle'
  toggle.appendChild(name)
  toggle.setAttribute('aria-controls', panel.id)
  toggle.setAttribute('aria-expanded', 'false')

  let open = false
  const setOpen = (next: boolean): void => {
    open = next
    panel.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
  }
  toggle.addEventListener('click', () => setOpen(!open))
  legend.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return
    setOpen(false)
    toggle.focus()
  })

  legend.append(panel, toggle)
  relabelMapLegend(legend)
  return legend
}

export function relabelMapLegend(legend: HTMLElement): void {
  for (const el of legend.querySelectorAll<HTMLElement>('[data-label]')) {
    el.textContent = t(el.dataset.label!)
  }
}
