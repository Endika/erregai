import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import { haversineKm, type LatLon } from '../core/geo'
import { priceOf, priceReference, stationBand, type PriceReference } from '../core/pricing'
import { parseSchedule, scheduleStatus } from '../core/schedule'
import { t } from '../i18n'
import { formatKm, formatPrice, priceWithBand } from '../i18n/format'

const BANDS = ['cheap', 'mid', 'expensive'] as const

// The same pills as the rows, so the legend is the thing it explains.
export function renderBandLegend(radiusKm: number): HTMLElement {
  const legend = document.createElement('p')
  legend.className = 'band-legend'
  const scope = document.createElement('span')
  scope.className = 'band-legend__scope'
  scope.textContent = t('band.legend').replace('{radius}', String(radiusKm))
  legend.appendChild(scope)
  for (const band of BANDS) {
    const item = document.createElement('span')
    item.className = 'legend__item'
    item.dataset.band = band
    item.textContent = t(`band.${band}`)
    legend.append(' ', item)
  }
  return legend
}

export interface ListOptions {
  selectedId?: string
  now?: Date
  // Defaults to the listed stations themselves.
  reference?: PriceReference
}

// Only the states worth interrupting for get a badge: more than half the feed
// is 24 h, so marking those "open" would put a label on most rows and mean
// nothing. `now` is read once per render rather than per row, and injectable
// so tests can pin the clock.
export function renderList(
  container: HTMLElement,
  stations: Station[],
  fuel: FuelId,
  origin: LatLon,
  onSelect: (s: Station) => void,
  { selectedId, now = new Date(), reference = priceReference(stations, fuel) }: ListOptions = {},
): void {
  const list = document.createElement('div')
  list.className = 'station-list'
  let selectedRow: HTMLElement | undefined

  for (const station of stations) {
    const price = priceOf(station, fuel)

    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'station-row'
    row.dataset.station = station.id
    if (station.id === selectedId) {
      row.classList.add('is-selected')
      selectedRow = row
    }

    const brand = document.createElement('span')
    brand.className = 'station-row__brand'
    brand.textContent = station.brand

    const priceEl = document.createElement('span')
    priceEl.className = 'station-row__price'
    const value = document.createElement('span')
    value.className = 'station-row__price-value'
    value.textContent = price !== undefined ? formatPrice(price) : '—'
    priceEl.appendChild(value)

    const band = stationBand(station, fuel, reference)
    if (price !== undefined) {
      // The aria-label already says "€/l", so the visible unit stays silent.
      const unit = document.createElement('span')
      unit.className = 'station-row__price-unit'
      unit.setAttribute('aria-hidden', 'true')
      unit.textContent = '€/l'
      priceEl.append(' ', unit)
      if (band) {
        row.dataset.band = band
        priceEl.title = t(`band.${band}`)
        priceEl.setAttribute('aria-label', priceWithBand(price, band))
      }
    }

    const head = document.createElement('span')
    head.className = 'station-row__head'
    head.append(brand, priceEl)

    const town = document.createElement('span')
    town.className = 'station-row__town'
    town.textContent = station.town

    const separator = document.createElement('span')
    separator.className = 'station-row__sep'
    separator.setAttribute('aria-hidden', 'true')
    separator.textContent = '·'

    const distance = document.createElement('span')
    distance.className = 'station-row__distance'
    distance.textContent = formatKm(haversineKm(origin, station.pos))

    const meta = document.createElement('span')
    meta.className = 'station-row__meta'
    meta.append(town, separator, distance)
    const status = scheduleStatus(parseSchedule(station.schedule), now)
    if (status === 'closed' || status === 'closing-soon') {
      const badge = document.createElement('span')
      badge.className = 'station-row__schedule'
      badge.dataset.schedule = status
      badge.textContent = t(status === 'closed' ? 'schedule.closed' : 'schedule.closingSoon')
      meta.appendChild(badge)
    }

    row.append(head, meta)
    row.addEventListener('click', () => onSelect(station))
    list.appendChild(row)
  }

  container.replaceChildren(list)
  selectedRow?.scrollIntoView({ block: 'nearest' })
}
