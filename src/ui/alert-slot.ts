import { t } from '../i18n'
import { formatDistance, formatPrice } from '../i18n/format'

export type AlertKind = 'radar' | 'cheapest' | 'fuel'

export interface SlotAlert {
  kind: AlertKind
  key: string
  label: string
}

export interface AlertSlot {
  primary: SlotAlert
  more: SlotAlert[]
}

const PRIORITY: readonly AlertKind[] = ['radar', 'cheapest', 'fuel']

// One alert gets the slot; a hazard always outranks a price.
export function composeSlot(alerts: readonly SlotAlert[]): AlertSlot | undefined {
  const ranked = [...alerts].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))
  const [primary, ...more] = ranked
  return primary ? { primary, more } : undefined
}

export function radarKey(km: number): string {
  return `${t('trip.slot.radar')} · ${formatDistance(km)}`
}

export function fuelKey(brand: string, price: number, km: number): string {
  return `${brand} ${formatPrice(price)} · ${formatDistance(km)}`
}

export function renderSlot(slot: AlertSlot): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'trip-view__alerts'

  const banner = document.createElement('div')
  banner.className = `trip-view__banner trip-view__banner--${slot.primary.kind}`
  const key = document.createElement('span')
  key.className = 'trip-view__banner-key'
  key.textContent = slot.primary.key
  const label = document.createElement('span')
  label.className = 'trip-view__banner-label'
  label.textContent = slot.primary.label
  banner.append(key, label)
  wrap.appendChild(banner)

  if (slot.more.length > 0) {
    const more = document.createElement('p')
    more.className = 'trip-view__alerts-more'
    for (const [i, alert] of slot.more.entries()) {
      if (i > 0) more.append(' ')
      const item = document.createElement('span')
      item.className = `trip-view__more trip-view__more--${alert.kind}`
      const tag = document.createElement('span')
      tag.className = 'trip-view__more-tag'
      tag.textContent = `+ ${t(`trip.slot.more.${alert.kind}`)}:`
      item.append(tag, ` ${alert.key}`)
      more.appendChild(item)
    }
    wrap.appendChild(more)
  }
  return wrap
}
