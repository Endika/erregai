import { t } from '../i18n'
import { formatDistance, formatPrice } from '../i18n/format'
import type { FuelId } from '../core/fuels'

export type AlertKind = 'radar' | 'cheapest' | 'fuel'

export interface SlotAlert {
  kind: AlertKind
  key: string
  label: string
  // The radar or station behind the alert; the key changes on every fix, this does not.
  id?: string
  // Where the key opens with a station's name, the part that may be cut short.
  brand?: string
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

export function cheapestLabel(fuel: FuelId): string {
  return t('trip.cheapestAhead').replace('{fuel}', t(`fuel.${fuel}`))
}

export function fuelKey(brand: string, price: number, km: number): string {
  return `${brand} ${formatPrice(price)} · ${formatDistance(km)}`
}

// Which alert leads the slot: the same radar drawing nearer is not a new alert.
export function slotId(slot: AlertSlot | undefined): string {
  return slot ? `${slot.primary.kind}:${slot.primary.id ?? slot.primary.key}` : ''
}

// The slot keeps its height with or without an alert, so nothing below it moves
// when one comes or goes; a new alert fades in where the last one was.
export function renderSlotArea(
  slot: AlertSlot | undefined,
  { entering = false }: { entering?: boolean } = {},
): HTMLElement {
  const area = document.createElement('div')
  area.className = 'trip-view__slot'
  area.classList.toggle('trip-view__slot--enter', entering)
  if (slot) {
    area.appendChild(renderSlot(slot))
  } else {
    const empty = document.createElement('p')
    empty.className = 'trip-view__slot-empty'
    empty.textContent = t('trip.slot.empty')
    area.appendChild(empty)
  }
  return area
}

export function renderSlot(slot: AlertSlot): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'trip-view__alerts'

  const banner = document.createElement('div')
  banner.className = `trip-view__banner trip-view__banner--${slot.primary.kind}`
  const key = document.createElement('span')
  key.className = 'trip-view__banner-key'
  appendKey(key, slot.primary, 'trip-view__banner-brand')
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
      item.append(tag, ' ')
      appendKey(item, alert, 'trip-view__more-brand')
      more.appendChild(item)
    }
    wrap.appendChild(more)
  }
  return wrap
}

// A long station name is cut on its own, so price and distance always show.
function appendKey(parent: HTMLElement, alert: SlotAlert, brandClass: string): void {
  const { key, brand } = alert
  if (!brand || !key.startsWith(`${brand} `)) {
    parent.append(key)
    return
  }
  const name = document.createElement('span')
  name.className = brandClass
  name.textContent = brand
  const rest = document.createElement('span')
  rest.className = 'trip-view__key-rest'
  rest.textContent = key.slice(brand.length + 1)
  parent.append(name, ' ', rest)
}
