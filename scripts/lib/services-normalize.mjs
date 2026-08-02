// Turns raw Overpass elements into the ServiceArea rows baked into
// src/core/services.data.ts. Kept free of I/O so it can be tested directly.

// OSM tag -> ServiceKind. Anything not listed here is dropped rather than
// guessed at: a wrong icon on a motorway sign is worse than no icon.
const AMENITY_KINDS = {
  fuel: 'fuel',
  restaurant: 'restaurant',
  cafe: 'cafe',
  fast_food: 'fast_food',
  toilets: 'toilets',
}

// Areas are large (a full service plaza), so a POI can sit a few hundred metres
// from the centroid Overpass reports. Beyond this it is likelier to belong to
// the twin area on the opposite carriageway.
const MAX_POI_DISTANCE_KM = 0.6

const KIND_ORDER = ['fuel', 'restaurant', 'cafe', 'fast_food', 'shop', 'toilets']

export function centreOf(element) {
  if (element.center) return { lat: element.center.lat, lon: element.center.lon }
  if (typeof element.lat === 'number') return { lat: element.lat, lon: element.lon }
  return undefined
}

// Equirectangular approximation. Only ever used to compare distances under a
// kilometre, where the error against haversine is centimetres.
function roughKm(a, b) {
  const dLat = (a.lat - b.lat) * 111
  const dLon = (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

// OSM type+id, so the generated file diffs cleanly when the cron reruns: a new
// area appearing in Navarra must not renumber every row after it.
export function areaId(element) {
  const prefix = (element.type ?? 'way')[0]
  return `${prefix}${element.id}`
}

export function kindOf(tags) {
  if (tags.shop) return 'shop'
  return AMENITY_KINDS[tags.amenity] ?? undefined
}

export function normalizeServiceAreas(areaElements, poiElements) {
  const areas = []
  for (const element of areaElements) {
    if (element.tags?.highway !== 'services') continue
    const centre = centreOf(element)
    if (!centre || !Number.isFinite(centre.lat) || !Number.isFinite(centre.lon)) continue
    areas.push({
      id: areaId(element),
      lat: centre.lat,
      lon: centre.lon,
      name: element.tags.name?.trim() || undefined,
      kinds: new Set(),
      hours: element.tags.opening_hours?.trim() || undefined,
    })
  }

  for (const poi of poiElements) {
    const centre = centreOf(poi)
    const tags = poi.tags ?? {}
    const kind = kindOf(tags)
    if (!centre || !kind) continue

    let nearest
    let nearestKm = Infinity
    for (const area of areas) {
      const km = roughKm(centre, area)
      if (km < nearestKm) { nearestKm = km; nearest = area }
    }
    if (!nearest || nearestKm > MAX_POI_DISTANCE_KM) continue

    nearest.kinds.add(kind)
    // Eating-place hours are what a driver actually wants; a 24 h fuel pump
    // says nothing about whether the restaurant is serving.
    const eatery = kind === 'restaurant' || kind === 'cafe' || kind === 'fast_food'
    if (eatery && tags.opening_hours && !nearest.hours) nearest.hours = tags.opening_hours.trim()
  }

  return areas
    .map(area => ({
      id: area.id,
      lat: area.lat,
      lon: area.lon,
      name: area.name,
      services: KIND_ORDER.filter(kind => area.kinds.has(kind)),
      hours: area.hours,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
