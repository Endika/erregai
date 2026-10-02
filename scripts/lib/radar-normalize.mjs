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

// Where a source publishes them, a radar also carries its kilometre point, the
// way it faces (a destination, or 'creciente'/'decreciente' along the PK) and
// its speed limit. A value that does not read cleanly is left out, never guessed.
const withExtras = (radar, { pk, dir, limit }) => ({
  ...radar,
  ...(pk !== undefined && { pk }),
  ...(dir && { dir }),
  ...(limit !== undefined && { limit }),
})

// A single kilometre point; a section range ("539,2-545,1") has no one PK.
export function parsePk(v) {
  const s = str(v)
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) return undefined
  return Math.round(num(s) * 1000) / 1000
}

// One posted limit, unit optional. A dash or a variable "60/80" is no limit.
export function parseLimit(v) {
  const m = str(v).match(/^(\d+)(?:\s*km\/h)?$/i)
  const n = m ? Number(m[1]) : NaN
  return n >= 20 && n <= 120 && n % 10 === 0 ? n : undefined
}

const LOWER = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'i', 'da', 'do', 'das', 'dos'])
// DGT runs this one together; every other name is shown as published.
const ALIASES = { ACORUÑA: 'A Coruña' }

// Sources publish destinations in capitals; a name already in mixed case, or a
// road code like "AG-64", is shown as is.
export function displayPlace(v) {
  const s = str(v).replace(/\s+-\s+/g, '-').replace(/\s+/g, ' ')
  if (ALIASES[s]) return ALIASES[s]
  if (s !== s.toUpperCase() || /\d/.test(s)) return s
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) =>
      i > 0 && LOWER.has(w) ? w : w.replace(/(^|[-/])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()),
    )
    .join(' ')
}

const DGT_RELATIVE = { positive: 'creciente', negative: 'decreciente' }

// DGT DATEX2 fixed-radar cabins. The generator feeds rows shaped as
// { Carretera, Latitud, Longitud, Distancia, Sentido, Relativo }: WGS84 decimal
// degrees, the reference distance in metres (the PK) and both directions.
export function normalizeDgt(rows) {
  return rows.map((row, i) => {
    const metres = str(row.Distancia)
    return withExtras(
      {
        id: `dgt-${i}`,
        lat: num(row.Latitud ?? row.LATITUD ?? row.latitud),
        lon: num(row.Longitud ?? row.LONGITUD ?? row.longitud),
        via: str(row.Carretera ?? row.CARRETERA ?? row.carretera),
        source: 'dgt',
      },
      {
        pk: /^\d+(?:\.\d+)?$/.test(metres) ? Math.round(Number(metres)) / 1000 : undefined,
        dir: row.Sentido ? displayPlace(row.Sentido) : DGT_RELATIVE[str(row.Relativo)],
      },
    )
  })
}

// Euskadi (Trafikoa) fixed-radar cabins. Rows carry UTM 30N easting/northing
// (ETRS89, EPSG:25830); converted to WGS84. Falls back to lat/lon if present.
export function normalizeEuskadi(rows) {
  return rows.map((row, i) => {
    const hasLatLon = row.lat != null || row.latitud != null || row.LATITUD != null
    const coords = hasLatLon
      ? { lat: num(row.lat ?? row.latitud ?? row.LATITUD), lon: num(row.lon ?? row.longitud ?? row.LONGITUD) }
      : utmToWgs84(num(row.x ?? row.utm_x), num(row.y ?? row.utm_y), 'EPSG:25830')
    return withExtras(
      {
        id: `euskadi-${i}`,
        lat: coords.lat,
        lon: coords.lon,
        via: str(row.via ?? row.carretera ?? row.errepidea),
        source: 'euskadi',
      },
      {
        pk: parsePk(row.pk),
        dir: row.sentido ? displayPlace(row.sentido) : undefined,
        limit: parseLimit(row.velocidad),
      },
    )
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
    return withExtras(
      {
        id: `cat-${i}`,
        lat: coords.lat,
        lon: coords.lon,
        via: str(row.carretera ?? row.via),
        source: 'catalunya',
      },
      { pk: parsePk(row.pk), limit: parseLimit(row.velocitat) },
    )
  })
}

// Parse the DGT DATEX2 XML: keep only the CabinasCinemometro (fixed) set and
// read each cabin's point, road (linkName), reference distance and directions.
export function parseDgtXml(buf) {
  if (!buf) return []
  const xml = buf.toString('utf8')
  const start = xml.indexOf('GUID_Inventario_CabinasCinemometro')
  if (start < 0) return []
  // Bound the section to the next inventory set (if any) so tramo radars never
  // leak in should DATEX2 reorder its sets — do not slice blindly to EOF.
  const nextSet = xml.indexOf('GUID_Inventario_', start + 1)
  const section = nextSet < 0 ? xml.slice(start) : xml.slice(start, nextSet)
  const tag = (block, name) => block.match(new RegExp(`<_0:${name}>([^<]*)</_0:${name}>`))?.[1]
  const rows = []
  const pointRe =
    /<_0:latitude>([-0-9.]+)<\/_0:latitude>\s*<_0:longitude>([-0-9.]+)<\/_0:longitude>([\s\S]*?)<\/_0:point>([\s\S]*?)(?=<_0:latitude>|$)/g
  let m
  while ((m = pointRe.exec(section)) !== null) {
    const [, lat, lon, tail, ref] = m
    const link = tail.match(
      /<_0:value>([^<]*)<\/_0:value>\s*<\/_0:descriptor>\s*<_0:tpegDescriptorType>linkName/,
    )
    rows.push({
      Latitud: lat,
      Longitud: lon,
      Carretera: link ? link[1] : '',
      Distancia: tag(ref, 'referencePointDistance'),
      Sentido: tag(ref, 'directionNamed'),
      Relativo: tag(ref, 'directionRelative'),
    })
  }
  return rows
}

// Parse the Catalunya text export (whitespace-aligned columns, latin-1).
// Layout: "Via  PK  Velocitat  X  Y". X/Y (UTM) and the limit are always the
// last three tokens and the road the first; what sits between is the PK, a
// section range ("1,8 -3,0") or a carriageway word ("C-32 nord 85").
export function parseCatalunyaTxt(buf) {
  if (!buf) return []
  const text = buf.toString('latin1')
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('(') || line.startsWith('Via')) continue
    const tok = line.trim().split(/\s+/)
    if (tok.length < 5) continue
    const between = tok.slice(1, -3).filter((t) => !/^[a-z]+$/i.test(t))
    rows.push({
      via: tok[0],
      pk: between.join(''),
      velocitat: tok[tok.length - 3],
      x: tok[tok.length - 2],
      y: tok[tok.length - 1],
    })
  }
  return rows
}

// Parse the Trafikoa HTML: each fixed cabin is inlined as a JS block holding
// "var x"/"var y" (UTM 30N easting/northing) and, before the per-language
// switch, a Spanish "popupValores" array: name, direction, town, territory,
// road, PK, limit. The lazy match stops at the first popupValores in each
// block, so the eu_ES duplicate inside the switch is ignored.
export function parseTrafikoaHtml(buf) {
  if (!buf) return []
  const html = buf.toString('utf8')
  const rows = []
  const blockRe =
    /var x = ([-0-9.]+);[\s\S]*?var y = ([-0-9.]+);[\s\S]*?var popupValores = (\[[\s\S]*?\]);/g
  let m
  while ((m = blockRe.exec(html)) !== null) {
    let values = []
    try {
      values = JSON.parse(m[3])
    } catch {
      values = []
    }
    rows.push({
      x: m[1],
      y: m[2],
      via: values[4] ?? '',
      sentido: values[1],
      pk: values[5],
      velocidad: values[6],
    })
  }
  return rows
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
  // Each row is a one-line object literal; its optional fields may be absent.
  const fieldRe = /(\w+): ("(?:[^"\\]|\\.)*"|-?[0-9.]+)/g
  const rows = [...text.matchAll(/^ {2}\{ (id: .*) \},$/gm)].map((line) =>
    Object.fromEntries([...line[1].matchAll(fieldRe)].map((f) => [f[1], JSON.parse(f[2])])),
  )
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
