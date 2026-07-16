import type { RadarHit } from '../core/radars'
import { t } from '../i18n'

// Shared radar list used by both the trip view and the map tab: a titled list of
// radar hits (road name + distance), nearest first, capped to `limit`.
export function renderRadarList(hits: readonly RadarHit[], titleKey: string, limit: number): HTMLElement {
  const section = document.createElement('div')
  section.className = 'radar-list'

  const title = document.createElement('p')
  title.className = 'radar-list__title'
  title.textContent = t(titleKey)
  section.appendChild(title)

  const list = document.createElement('div')
  list.className = 'radar-list__items'

  for (const hit of hits.slice(0, limit)) {
    const row = document.createElement('div')
    row.className = 'radar-list__row'

    const via = document.createElement('span')
    via.className = 'radar-list__via'
    via.textContent = hit.radar.via

    const distance = document.createElement('span')
    distance.className = 'radar-list__distance'
    distance.textContent = `${Math.round(hit.distanceKm * 1000)} m`

    row.append(via, distance)
    list.appendChild(row)
  }

  section.appendChild(list)
  return section
}
