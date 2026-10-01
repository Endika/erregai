// The Ministerio publishes addresses in capitals ("POLIGONO GRANADA, S/N").
// Title case reads better, but road codes, roman numerals, initials and "S/N"
// must survive it, and nothing is added that the source did not say: no
// accents, no expanded abbreviations.

const PARTICLES = new Set([
  'de',
  'del',
  'dels',
  'la',
  'las',
  'les',
  'los',
  'el',
  'els',
  'en',
  'al',
  'por',
  'con',
  'do',
  'da',
  'dos',
  'das',
])
const ROAD = /^[A-Z]{1,4}-(\d+[A-Z]?|[IVX]+)$/
// Up to XXXIX: an address numeral is a road or a king, and "CL" is a street.
const ROMAN = /^X{0,3}(IX|IV|V?I{0,3})$/
const KEEP = new Set(['S/N', 'SN', 'PK'])
// Street types abbreviated as a short code that is not a road: "CL 5" is a calle.
const STREET_TYPES = new Set(['CL', 'CR', 'AV', 'CM', 'PZ', 'PS'])
const LEADING = /^[([¿"«]*/
const TRAILING = /[,.;:)\]"»]*$/

const lower = (s: string): string => s.toLocaleLowerCase('es')
const capitalise = (s: string): string => s.charAt(0) + lower(s.slice(1))

function caseWord(word: string, atStart: boolean): string {
  // Mixed case is the station's own spelling; digits-only has nothing to case.
  if (/\p{Ll}/u.test(word) || !/\p{Lu}/u.test(word)) return word
  if (/^KM(?![A-ZÑ])/.test(word)) return `km${word.slice(2)}`
  if (ROAD.test(word) || KEEP.has(word)) return word
  const split = (sep: string): string =>
    word
      .split(sep)
      .map((part, i) => caseWord(part, atStart || i > 0))
      .join(sep)
  if (word.includes(',')) return split(',')
  // "A7", "12B", "E-5/A-4": codes and numbers stay as published.
  if (/\d/.test(word)) return word
  for (const sep of ['/', '-', '.']) if (word.includes(sep)) return split(sep)
  const elided = /^([A-Z])'(.+)$/.exec(word)
  if (elided) {
    const [, article, rest] = elided
    return `${atStart ? article : lower(article)}'${caseWord(rest, true)}`
  }
  if (word.length === 1) return !atStart && (word === 'Y' || word === 'E') ? lower(word) : word
  if (!atStart && PARTICLES.has(lower(word))) return lower(word)
  if (ROMAN.test(word)) return word
  return capitalise(word)
}

// A road code split by a space ("AP - 7", "CV 40") is still a road code.
function isSpacedRoad(core: string, trail: string, next: string | undefined): boolean {
  return (
    /^[A-Z]{1,2}$/.test(core) &&
    trail === '' &&
    /^(-|\d)/.test(next ?? '') &&
    !['KM', 'Y', 'E'].includes(core) &&
    !STREET_TYPES.has(core) &&
    !PARTICLES.has(lower(core))
  )
}

export function readableAddress(raw: string): string {
  const tokens = raw.split(/(\s+)/)
  const words = tokens.filter((token) => token && !/^\s+$/.test(token))
  let atStart = true
  let index = 0
  return tokens
    .map((token) => {
      if (!token || /^\s+$/.test(token)) return token
      const next = words[++index]
      const lead = LEADING.exec(token)![0]
      const trail = TRAILING.exec(token.slice(lead.length))![0]
      const core = token.slice(lead.length, token.length - trail.length)
      const word = isSpacedRoad(core, trail, next) ? core : caseWord(core, atStart)
      atStart = trail.includes(',') || /,\S*$/.test(core)
      return `${lead}${word}${trail}`
    })
    .join('')
}

// "L-D: 24H" reads as a code; "24 h" is how the hours are written.
export function readableSchedule(raw: string): string {
  return raw.replace(/\b24\s?H\b/g, '24 h')
}
