import type { Station } from '../core/station'
import { FUELS } from '../core/fuels'
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

export function renderDetail(container: HTMLElement, station: Station, now: Date = new Date()): void {
  const wrapper = document.createElement('div')
  wrapper.className = 'station-detail'

  const heading = document.createElement('h2')
  heading.className = 'station-detail__brand'
  heading.textContent = station.brand
  wrapper.appendChild(heading)

  const address = document.createElement('p')
  address.className = 'station-detail__address'
  address.textContent = `${t('detail.address')}: ${station.address}, ${station.town}`
  wrapper.appendChild(address)

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
    const key = status === 'open' ? 'schedule.open' : status === 'closed' ? 'schedule.closed' : 'schedule.closingSoon'
    badge.textContent = t(key)
    schedule.append(' ', badge)
  }
  wrapper.appendChild(schedule)

  const priceList = document.createElement('ul')
  priceList.className = 'station-detail__prices'
  for (const fuel of FUELS) {
    const price = station.prices[fuel.id]
    const item = document.createElement('li')
    item.className = 'station-detail__price-row'

    const label = document.createElement('span')
    label.className = 'station-detail__price-label'
    label.textContent = t(fuel.i18nKey)

    const value = document.createElement('span')
    value.className = 'station-detail__price-value'
    value.textContent = price !== undefined ? price.toFixed(3) : '—'

    item.append(label, value)
    priceList.appendChild(item)
  }
  wrapper.appendChild(priceList)

  const mapsLink = document.createElement('a')
  mapsLink.className = 'station-detail__maps-link'
  mapsLink.href = mapsUrl(station)
  mapsLink.target = '_blank'
  mapsLink.rel = 'noopener noreferrer'
  mapsLink.textContent = t('detail.openInMaps')
  wrapper.appendChild(mapsLink)

  container.replaceChildren(wrapper)
}
