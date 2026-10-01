import { bearingDeg, type LatLon } from '../core/geo'
import type { RadarHit } from '../core/radars'
import { t } from '../i18n'
import { formatDistance } from '../i18n/format'
import { glyphSvg } from './map-icons'

const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const

// The bundled radars carry only their road, so with an origin each row also says
// which way it lies: "2,5 km al norte" tells seven "A-8" rows apart.
function whereText(hit: RadarHit, origin: LatLon | undefined): string {
  const distance = formatDistance(hit.distanceKm)
  if (!origin) return distance
  const point = COMPASS[Math.round(bearingDeg(origin, hit.radar) / 45) % 8]
  return t(`radar.toward.${point}`).replace('{distance}', distance)
}

// Shared radar list used by both the trip view and the map tab: a titled list of
// radar hits (road name + distance), nearest first, capped to `limit`.
export function renderRadarList(
  hits: readonly RadarHit[],
  titleKey: string,
  limit: number,
  origin?: LatLon,
): HTMLElement {
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

    const icon = document.createElement('span')
    icon.className = 'radar-list__icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = glyphSvg('camera', 14)

    const via = document.createElement('span')
    via.className = 'radar-list__via'
    via.textContent = hit.radar.via

    const distance = document.createElement('span')
    distance.className = 'radar-list__distance'
    distance.textContent = whereText(hit, origin)

    row.append(icon, via, distance)
    list.appendChild(row)
  }

  section.appendChild(list)
  return section
}
