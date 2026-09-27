import proj4 from 'proj4'

// ETRS89 / UTM zones used by the regional sources: 30N for Euskadi, 31N for
// Catalonia. The CRS differs per source, so utmToWgs84 takes it explicitly.
proj4.defs('EPSG:25830', '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

export function utmToWgs84(easting, northing, epsg = 'EPSG:25831') {
  const [lon, lat] = proj4(epsg, 'EPSG:4326', [easting, northing])
  return { lat, lon }
}

const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').trim()))
const str = (v) => String(v ?? '').trim()

// DGT DATEX2 fixed-radar cabins. The generator feeds rows shaped as
// { Carretera, Latitud, Longitud } already in WGS84 decimal degrees.
export function normalizeDgt(rows) {
  return rows.map((row, i) => ({
    id: `dgt-${i}`,
    lat: num(row.Latitud ?? row.LATITUD ?? row.latitud),
    lon: num(row.Longitud ?? row.LONGITUD ?? row.longitud),
    via: str(row.Carretera ?? row.CARRETERA ?? row.carretera),
    source: 'dgt',
  }))
}

// Euskadi (Trafikoa) fixed-radar cabins. Rows carry UTM 30N easting/northing
// (ETRS89, EPSG:25830); converted to WGS84. Falls back to lat/lon if present.
export function normalizeEuskadi(rows) {
  return rows.map((row, i) => {
    const hasLatLon = row.lat != null || row.latitud != null || row.LATITUD != null
    const coords = hasLatLon
      ? { lat: num(row.lat ?? row.latitud ?? row.LATITUD), lon: num(row.lon ?? row.longitud ?? row.LONGITUD) }
      : utmToWgs84(num(row.x ?? row.utm_x), num(row.y ?? row.utm_y), 'EPSG:25830')
    return {
      id: `euskadi-${i}`,
      lat: coords.lat,
      lon: coords.lon,
      via: str(row.via ?? row.carretera ?? row.errepidea),
      source: 'euskadi',
    }
  })
}

// Servei Catala de Transit fixed radars. Rows carry UTM 31N easting/northing
// (ETRS89); converted to WGS84. Falls back to lat/lon when present.
export function normalizeCatalunya(rows) {
  return rows.map((row, i) => {
    const hasLatLon = row.latitud != null || row.lat != null
    const coords = hasLatLon
      ? { lat: num(row.latitud ?? row.lat), lon: num(row.longitud ?? row.lon) }
      : utmToWgs84(num(row.utm_x ?? row.x ?? row.coord_x), num(row.utm_y ?? row.y ?? row.coord_y))
    return {
      id: `cat-${i}`,
      lat: coords.lat,
      lon: coords.lon,
      via: str(row.carretera ?? row.via),
      source: 'catalunya',
    }
  })
}

export function dedupeRadars(radars, precision = 4) {
  const seen = new Set()
  const out = []
  for (const r of radars) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue
    const key = `${r.lat.toFixed(precision)},${r.lon.toFixed(precision)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

// Reads back a generated radars.data.ts: its date, its rows, and the sources an
// earlier run already had to keep, with the date their rows really come from.
export function parseDataset(text) {
  const date = text.match(/RADARS_DATASET_DATE = '([^']+)'/)?.[1] ?? null
  const rowRe =
    /\{ id: ("[^"]*"), lat: ([-0-9.]+), lon: ([-0-9.]+), via: ("(?:[^"\\]|\\.)*"), source: ("[^"]*") \}/g
  const rows = [...text.matchAll(rowRe)].map((m) => ({
    id: JSON.parse(m[1]),
    lat: Number(m[2]),
    lon: Number(m[3]),
    via: JSON.parse(m[4]),
    source: JSON.parse(m[5]),
  }))
  const keptSince = Object.fromEntries(
    [...text.matchAll(/^\/\/ kept: (\w+) from (\S+)$/gm)].map((m) => [m[1], m[2]]),
  )
  return { date, rows, keptSince }
}

// Each source covers its own territory, so one that yields nothing would leave a
// whole region without radars while the total still looks plausible. Its rows
// from the previous dataset are kept instead, and reported with their real date.
// Trafikoa, for one, refuses connections from outside Spain, CI runners included.
export function keepUnreachable(bySource, previous) {
  const kept = []
  const missing = []
  const out = { ...bySource }
  for (const [name, rows] of Object.entries(bySource)) {
    if (rows.length > 0) continue
    const old = previous?.rows.filter((r) => r.source === name) ?? []
    if (old.length === 0) {
      missing.push(name)
      continue
    }
    out[name] = old
    kept.push({ source: name, count: old.length, since: previous.keptSince[name] ?? previous.date })
  }
  return { bySource: out, kept, missing }
}
