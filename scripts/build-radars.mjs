// Regenerates src/core/radars.data.ts from official open-data sources.
// Downloads server-side (no CORS); falls back to a local raw file for dev.
// Raw source files are NOT committed. This is what the CI cron job runs.
//
//   DGT       DATEX2 XML, fixed-radar cabins (CabinasCinemometro set), WGS84.
//   Catalunya Servei Catala de Transit plain-text export, UTM 31N (ETRS89).
//   Euskadi   Trafikoa cabinas-de-radar-fijo HTML page; each cabin is inlined
//             as JS (var x/y in UTM 30N ETRS89, road in popupValores[4]).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import {
  normalizeDgt,
  normalizeEuskadi,
  normalizeCatalunya,
  dedupeRadars,
} from './lib/radar-normalize.mjs'

const SRC = new URL('../../erregai-notes/radar-sources/', import.meta.url)
const OUT = new URL('../src/core/radars.data.ts', import.meta.url)

const URLS = {
  dgt: 'http://infocar.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml',
  catalunya: 'http://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars.txt',
  euskadi: 'https://apps.trafikoa.euskadi.eus/lfr/web/trafikoa/cabinas-de-radar-fijo',
}

// Trafikoa serves the radar page only to browser-like clients.
const UA = { 'User-Agent': 'Mozilla/5.0' }

// Coarse mainland+islands+Canary bounding box, used to discard corrupt rows.
const inSpain = (lat, lon) => lat > 27 && lat < 44 && lon > -19 && lon < 5

// Fetch a URL server-side; on failure fall back to a local raw file (dev).
async function fetchOrLocal(url, localName, headers) {
  try {
    if (url) {
      const res = await fetch(url, headers ? { headers } : undefined)
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      console.warn(`fetch ${localName}: HTTP ${res.status}`)
    }
  } catch (e) {
    console.warn(`fetch failed for ${localName}: ${e.message}`)
  }
  const p = new URL(localName, SRC)
  if (existsSync(p)) {
    console.warn(`using local ${localName}`)
    return readFileSync(p)
  }
  console.warn(`no source for ${localName} - skipping`)
  return null
}

// Parse the DGT DATEX2 XML: keep only the CabinasCinemometro (fixed) set and
// extract each point's coordinates and road name (linkName descriptor).
function parseDgtXml(buf) {
  if (!buf) return []
  const xml = buf.toString('utf8')
  const start = xml.indexOf('GUID_Inventario_CabinasCinemometro')
  if (start < 0) return []
  // Bound the section to the next inventory set (if any) so tramo radars never
  // leak in should DATEX2 reorder its sets — do not slice blindly to EOF.
  const nextSet = xml.indexOf('GUID_Inventario_', start + 1)
  const section = nextSet < 0 ? xml.slice(start) : xml.slice(start, nextSet)
  const rows = []
  const pointRe =
    /<_0:latitude>([-0-9.]+)<\/_0:latitude>\s*<_0:longitude>([-0-9.]+)<\/_0:longitude>([\s\S]*?)<\/_0:point>/g
  let m
  while ((m = pointRe.exec(section)) !== null) {
    const [, lat, lon, tail] = m
    const link = tail.match(
      /<_0:value>([^<]*)<\/_0:value>\s*<\/_0:descriptor>\s*<_0:tpegDescriptorType>linkName/,
    )
    rows.push({ Latitud: lat, Longitud: lon, Carretera: link ? link[1] : '' })
  }
  return rows
}

// Parse the Catalunya text export (whitespace-aligned columns, latin-1).
// Layout: "Via  PK  Velocitat  X  Y" - X/Y (UTM) are always the last two
// tokens; Via/PK may themselves contain spaces, so anchor on the tail.
function parseCatalunyaTxt(buf) {
  if (!buf) return []
  const text = buf.toString('latin1')
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('(') || line.startsWith('Via')) continue
    const tok = line.trim().split(/\s+/)
    if (tok.length < 5) continue
    rows.push({ via: tok[0], x: tok[tok.length - 2], y: tok[tok.length - 1] })
  }
  return rows
}

// Parse the Trafikoa HTML: each fixed cabin is inlined as a JS block holding
// "var x"/"var y" (UTM 30N easting/northing) and, before the per-language
// switch, a Spanish "popupValores" array whose index 4 is the road name.
// The lazy match stops at the first popupValores in each block (the Spanish
// one), so the eu_ES duplicate inside the switch is ignored.
function parseTrafikoaHtml(buf) {
  if (!buf) return []
  const html = buf.toString('utf8')
  const rows = []
  const blockRe =
    /var x = ([-0-9.]+);[\s\S]*?var y = ([-0-9.]+);[\s\S]*?var popupValores = (\[[\s\S]*?\]);/g
  let m
  while ((m = blockRe.exec(html)) !== null) {
    let via = ''
    try {
      via = JSON.parse(m[3])[4] ?? ''
    } catch {
      via = ''
    }
    rows.push({ x: m[1], y: m[2], via })
  }
  return rows
}

const [dgtBuf, catBuf, euskBuf] = await Promise.all([
  fetchOrLocal(URLS.dgt, 'dgt.xml'),
  fetchOrLocal(URLS.catalunya, 'catalunya.txt'),
  fetchOrLocal(URLS.euskadi, 'euskadi.html', UA),
])

const bySource = {
  dgt: normalizeDgt(parseDgtXml(dgtBuf)),
  catalunya: normalizeCatalunya(parseCatalunyaTxt(catBuf)),
  euskadi: normalizeEuskadi(parseTrafikoaHtml(euskBuf)),
}
for (const [name, list] of Object.entries(bySource)) {
  console.log(`  ${name}: ${list.length} rows`)
}

const all = dedupeRadars(
  [...bySource.dgt, ...bySource.catalunya, ...bySource.euskadi].filter((r) =>
    inSpain(r.lat, r.lon),
  ),
)
if (all.length === 0) {
  console.error('no radars produced - aborting')
  process.exit(1)
}

const round = (n) => Math.round(n * 1e5) / 1e5
const body = all
  .map(
    (r) =>
      `  { id: ${JSON.stringify(r.id)}, lat: ${round(r.lat)}, lon: ${round(r.lon)}, ` +
      `via: ${JSON.stringify(r.via)}, source: ${JSON.stringify(r.source)} },`,
  )
  .join('\n')
const generatedOn = new Date().toISOString().slice(0, 10)
writeFileSync(
  OUT,
  `// GENERATED by scripts/build-radars.mjs - do not edit by hand.\n` +
    `import type { Radar } from './radars'\n\n` +
    `export const RADARS_DATASET_DATE = '${generatedOn}'\n\n` +
    `export const RADARS: readonly Radar[] = [\n${body}\n]\n`,
)
console.log(`Wrote ${all.length} radars (date ${generatedOn}).`)
