import { bearingDeg, type LatLon } from '../core/geo'
import type { Radar, RadarHit } from '../core/radars'
import { t } from '../i18n'
import { formatDistance, formatNumber, formatPk } from '../i18n/format'
import { glyphSvg } from './map-icons'

const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const

// Many radars carry only their road, so with an origin each row also says which
// way it lies: "2,5 km al norte" tells seven "A-8" rows apart.
function whereText(hit: RadarHit, origin: LatLon | undefined): string {
  const distance = formatDistance(hit.distanceKm)
  if (!origin) return distance
  const point = COMPASS[Math.round(bearingDeg(origin, hit.radar) / 45) % 8]
  return t(`radar.toward.${point}`).replace('{distance}', distance)
}

function dirText(dir: string): string {
  if (dir === 'creciente' || dir === 'decreciente') return t(`radar.dir.${dir}`)
  return t('radar.dir.to').replace('{place}', dir)
}

function part(cls: string, text: string): HTMLElement {
  const el = document.createElement('span')
  el.className = `radar-list__${cls}`
  el.textContent = text
  return el
}

// With a PK the row reads "A-8 · PK 112 · sentido Bilbao"; the dots are drawn by
// CSS so a part that wraps to a new line does not start with one.
function renderVia(radar: Radar): HTMLElement {
  if (radar.pk === undefined) return part('via', radar.via)
  const via = document.createElement('span')
  via.className = 'radar-list__via radar-list__via--pk'
  via.append(
    part('road', radar.via),
    ' ',
    part('pk', t('radar.pk').replace('{pk}', formatPk(radar.pk))),
  )
  if (radar.dir) {
    const dir = document.createElement('span')
    dir.className = 'radar-list__dir'
    dir.appendChild(part('dir-text', dirText(radar.dir)))
    via.append(' ', dir)
  }
  return via
}

export function radarAlertLabel(radar: Radar): string {
  if (radar.limit === undefined) return t('radar.alert.body').replace('{via}', radar.via)
  return t('radar.alert.bodyLimit')
    .replace('{via}', radar.via)
    .replace('{limit}', formatNumber(radar.limit))
}

// Shared radar list used by both the trip view and the map tab: a list of radar
// hits (road, PK and direction + distance), nearest first, capped to `limit`.
// Without a title where a control above already names it.
export function renderRadarList(
  hits: readonly RadarHit[],
  titleKey: string | undefined,
  limit: number,
  origin?: LatLon,
): HTMLElement {
  const section = document.createElement('div')
  section.className = 'radar-list'

  if (titleKey) {
    const title = document.createElement('p')
    title.className = 'radar-list__title'
    title.textContent = t(titleKey)
    section.appendChild(title)
  }

  const list = document.createElement('div')
  list.className = 'radar-list__items'

  for (const hit of hits.slice(0, limit)) {
    const row = document.createElement('div')
    row.className = 'radar-list__row'

    const icon = document.createElement('span')
    icon.className = 'radar-list__icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = glyphSvg('camera', 14)

    const via = renderVia(hit.radar)

    const distance = document.createElement('span')
    distance.className = 'radar-list__distance'
    distance.textContent = whereText(hit, origin)

    row.append(icon, via, distance)
    list.appendChild(row)
  }

  section.appendChild(list)
  return section
}
