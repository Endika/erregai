import type { Station } from '../core/station'
import { FUELS, type Fuel, type FuelId } from '../core/fuels'
import { haversineKm, type LatLon } from '../core/geo'
import { bandForThresholds, bandThresholds, priceOf } from '../core/pricing'
import { parseSchedule, scheduleStatus } from '../core/schedule'
import { t } from '../i18n'

// Deep-link that respects the device's default maps app: Apple Maps on iOS
// (which does not handle geo:), the OS chooser via geo: elsewhere (Android
// respects the user's default; desktop browsers offer their handler).
function mapsUrl(station: Station): string {
  const { lat, lon } = station.pos
  const label = encodeURIComponent(station.brand)
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  return isIOS
    ? `https://maps.apple.com/?ll=${lat},${lon}&q=${label}`
    : `geo:${lat},${lon}?q=${lat},${lon}(${label})`
}

// `nearby` must be the same set the list bands against, so the card and the
// row it came from never disagree on cheap/mid/expensive.
export interface DetailContext {
  fuel: FuelId
  origin?: LatLon
  nearby: Station[]
}

function renderLead(station: Station, { fuel, origin, nearby }: DetailContext): HTMLElement {
  const lead = document.createElement('div')
  lead.className = 'station-detail__lead'

  const fuelLabel = document.createElement('p')
  fuelLabel.className = 'station-detail__lead-fuel'
  fuelLabel.textContent = t(FUELS.find((f) => f.id === fuel)?.i18nKey ?? fuel)

  const figures = document.createElement('p')
  figures.className = 'station-detail__lead-figures'
  const price = priceOf(station, fuel)
  if (price === undefined) {
    const missing = document.createElement('span')
    missing.className = 'station-detail__lead-missing'
    missing.textContent = t('detail.noPrice')
    figures.appendChild(missing)
  } else {
    const known = nearby.map((s) => priceOf(s, fuel)).filter((p): p is number => p !== undefined)
    const band = bandForThresholds(price, bandThresholds(known.length > 0 ? known : [price]))
    lead.dataset.band = band

    const priceEl = document.createElement('span')
    priceEl.className = 'station-detail__lead-price'
    const unit = document.createElement('span')
    unit.className = 'station-detail__lead-unit'
    unit.textContent = '€/l'
    priceEl.append(price.toFixed(3), ' ', unit)

    const bandEl = document.createElement('span')
    bandEl.className = 'station-detail__band'
    bandEl.textContent = t(`band.${band}`)
    figures.append(priceEl, bandEl)
  }
  if (origin) {
    const distance = document.createElement('span')
    distance.className = 'station-detail__distance'
    distance.textContent = `${haversineKm(origin, station.pos).toFixed(1)} km`
    figures.appendChild(distance)
  }

  lead.append(fuelLabel, figures)
  return lead
}

function priceList(station: Station, fuels: readonly Fuel[]): HTMLElement {
  const list = document.createElement('ul')
  list.className = 'station-detail__prices'
  for (const fuel of fuels) {
    const item = document.createElement('li')
    item.className = 'station-detail__price-row'

    const label = document.createElement('span')
    label.className = 'station-detail__price-label'
    label.textContent = t(fuel.i18nKey)

    const value = document.createElement('span')
    value.className = 'station-detail__price-value'
    value.textContent = station.prices[fuel.id]?.toFixed(3) ?? ''

    item.append(label, value)
    list.appendChild(item)
  }
  return list
}

// Without a context (no fuel chosen yet) there is nothing to lead with, so the
// priced fuels are listed openly instead of folded.
export function renderDetail(
  container: HTMLElement,
  station: Station,
  now: Date = new Date(),
  context?: DetailContext,
): void {
  const wrapper = document.createElement('div')
  wrapper.className = 'station-detail'

  const heading = document.createElement('h2')
  heading.className = 'station-detail__brand'
  heading.textContent = station.brand
  wrapper.appendChild(heading)

  const address = document.createElement('p')
  address.className = 'station-detail__address'
  address.textContent = `${t('detail.address')}: ${station.address}, ${station.town}`

  // The raw text stays visible whatever we make of it: the derived state is an
  // aid, not a replacement for what the Ministerio actually published.
  const schedule = document.createElement('p')
  schedule.className = 'station-detail__schedule'
  schedule.textContent = `${t('detail.schedule')}: ${station.schedule}`
  const status = scheduleStatus(parseSchedule(station.schedule), now)
  if (status !== 'unknown') {
    const badge = document.createElement('span')
    badge.className = 'station-detail__schedule-status'
    badge.dataset.schedule = status
    const key =
      status === 'open'
        ? 'schedule.open'
        : status === 'closed'
          ? 'schedule.closed'
          : 'schedule.closingSoon'
    badge.textContent = t(key)
    schedule.append(' ', badge)
  }

  const pricedFuels = FUELS.filter((f) => station.prices[f.id] !== undefined)
  const directions = document.createElement('a')
  directions.className = 'station-detail__directions'
  directions.href = mapsUrl(station)
  directions.target = '_blank'
  directions.rel = 'noopener noreferrer'
  directions.textContent = t('detail.directions')

  if (!context) {
    wrapper.append(directions, address, schedule)
    if (pricedFuels.length > 0) wrapper.appendChild(priceList(station, pricedFuels))
    container.replaceChildren(wrapper)
    return
  }

  wrapper.append(renderLead(station, context), directions, address, schedule)

  const others = pricedFuels.filter((f) => f.id !== context.fuel)
  if (others.length > 0) {
    const details = document.createElement('details')
    details.className = 'station-detail__others'
    const summary = document.createElement('summary')
    summary.textContent = t('detail.otherFuels').replace('{n}', String(others.length))
    details.append(summary, priceList(station, others))
    wrapper.appendChild(details)
  }

  container.replaceChildren(wrapper)
}
