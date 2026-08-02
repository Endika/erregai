import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import { haversineKm, type LatLon } from '../core/geo'
import { bandForThresholds, bandThresholds, priceOf } from '../core/pricing'
import { parseSchedule, scheduleStatus } from '../core/schedule'
import { t } from '../i18n'

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
  selectedId?: string,
  now: Date = new Date(),
): void {
  const knownPrices = stations
    .map(s => priceOf(s, fuel))
    .filter((p): p is number => p !== undefined)
  const thresholds = bandThresholds(knownPrices)

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

    const town = document.createElement('span')
    town.className = 'station-row__town'
    town.textContent = station.town

    const distance = document.createElement('span')
    distance.className = 'station-row__distance'
    distance.textContent = `${haversineKm(origin, station.pos).toFixed(1)} km`

    const priceEl = document.createElement('span')
    priceEl.className = 'station-row__price'
    priceEl.textContent = price !== undefined ? price.toFixed(3) : '—'

    if (price !== undefined) {
      const band = bandForThresholds(price, thresholds)
      row.dataset.band = band
      const bandLabel = t(`band.${band}`)
      priceEl.title = bandLabel
      priceEl.setAttribute('aria-label', bandLabel)
    }

    const cells: HTMLElement[] = [brand, town, distance]
    const status = scheduleStatus(parseSchedule(station.schedule), now)
    if (status === 'closed' || status === 'closing-soon') {
      const badge = document.createElement('span')
      badge.className = 'station-row__schedule'
      badge.dataset.schedule = status
      badge.textContent = t(status === 'closed' ? 'schedule.closed' : 'schedule.closingSoon')
      cells.push(badge)
    }
    cells.push(priceEl)

    row.append(...cells)
    row.addEventListener('click', () => onSelect(station))
    list.appendChild(row)
  }

  container.replaceChildren(list)
  selectedRow?.scrollIntoView({ block: 'nearest' })
}
