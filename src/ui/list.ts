import type { Station } from '../core/station'
import type { FuelId } from '../core/fuels'
import { haversineKm, type LatLon } from '../core/geo'
import { bandFor, priceOf } from '../core/pricing'

export function renderList(
  container: HTMLElement,
  stations: Station[],
  fuel: FuelId,
  origin: LatLon,
  onSelect: (s: Station) => void,
): void {
  const knownPrices = stations
    .map(s => priceOf(s, fuel))
    .filter((p): p is number => p !== undefined)

  const list = document.createElement('div')
  list.className = 'station-list'

  for (const station of stations) {
    const price = priceOf(station, fuel)

    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'station-row'
    row.dataset.station = station.id
    if (price !== undefined) row.dataset.band = bandFor(price, knownPrices)

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

    row.append(brand, town, distance, priceEl)
    row.addEventListener('click', () => onSelect(station))
    list.appendChild(row)
  }

  container.replaceChildren(list)
}
