import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import { haversineKm, type LatLon } from '../core/geo'
import { bandForThresholds, bandThresholds, priceOf } from '../core/pricing'
import { t } from '../i18n'

export function renderList(
  container: HTMLElement,
  stations: Station[],
  fuel: FuelId,
  origin: LatLon,
  onSelect: (s: Station) => void,
  selectedId?: string,
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

    row.append(brand, town, distance, priceEl)
    row.addEventListener('click', () => onSelect(station))
    list.appendChild(row)
  }

  container.replaceChildren(list)
  selectedRow?.scrollIntoView({ block: 'nearest' })
}
