// Turns the Ministerio's nationwide station listing into the place rows baked
// into src/core/places.data.ts. Kept free of I/O so it can be tested directly.

const ARTICLES = new Set(['el', 'la', "l'", 'los', 'las', 'les', 'els', 'es', 'sa', 'ses', 'a', 'o', 'as', 'os', 'illes'])

// The Ministerio files names article-last ("Coruña (A)", "Palmas (Las)").
// People type and read them article-first. Any other bracket, such as the
// Basque name in "Noáin (Valle de Elorz)/Noain (Elortzibar)", stays as filed.
export function displayName(raw) {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  const m = trimmed.match(/^([^()]*\S)\s*\(([^()]+)\)$/)
  if (!m || !ARTICLES.has(m[2].toLocaleLowerCase('es'))) return trimmed
  const [, head, article] = m
  return /['’]$/.test(article) ? `${article}${head}` : `${article} ${head}`
}

const LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'i', 'a', "d'", "l'"])

// Province names arrive in capitals ("SANTA CRUZ DE TENERIFE", "CORUÑA (A)").
export function displayProvince(raw) {
  const titled = raw
    .toLocaleLowerCase('es')
    .split(/(\s+|\/|-)/)
    .map((word, i) =>
      i > 0 && LOWER_WORDS.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase('es') + word.slice(1),
    )
    .join('')
  const name = displayName(titled)
  return name.charAt(0).toLocaleUpperCase('es') + name.slice(1)
}

const parseCoord = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

const round3 = (n) => Math.round(n * 1000) / 1000

// One row per municipality that has at least one station: its centre is the
// mean of those stations, and the station count ranks a search's matches so
// "Valencia" finds the city before Valencia de Don Juan.
export function placesFromStations(rows) {
  const byId = new Map()
  for (const row of rows) {
    const id = row.IDMunicipio
    const lat = parseCoord(row.Latitud)
    const lon = parseCoord(row['Longitud (WGS84)'])
    if (!id || !row.Municipio || lat === undefined || lon === undefined) continue
    let acc = byId.get(id)
    if (!acc) {
      acc = { name: displayName(row.Municipio), province: displayProvince(row.Provincia ?? ''), lat: 0, lon: 0, n: 0 }
      byId.set(id, acc)
    }
    acc.lat += lat
    acc.lon += lon
    acc.n += 1
  }
  return [...byId.values()]
    .map((p) => ({ name: p.name, province: p.province, lat: round3(p.lat / p.n), lon: round3(p.lon / p.n), n: p.n }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.province.localeCompare(b.province, 'es'))
}
