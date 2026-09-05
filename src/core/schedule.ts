// Opening-hours model shared by fuel stations (Ministerio `Horario` field) and,
// later, OSM service areas. Both parse into the same DayRange[], so the
// "is it open right now?" logic lives in exactly one place.

export type ScheduleStatus = 'open' | 'closed' | 'closing-soon' | 'unknown'

// days: 0 = Monday .. 6 = Sunday. from/to are minutes since midnight, 0..1440.
// `to <= from` means the range crosses midnight into the following day.
export interface DayRange {
  days: readonly number[]
  from: number
  to: number
}

const DAY_LETTERS = 'LMXJVSD'
const DAY = 1440
const WEEK = 7 * DAY
const CLOSING_SOON_MIN = 60

const SEGMENT =
  /^\s*([LMXJVSD](?:\s*-\s*[LMXJVSD])?(?:\s*,\s*[LMXJVSD](?:\s*-\s*[LMXJVSD])?)*)\s*:\s*(.+)$/i
const HH_MM = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/

function dayIndex(letter: string): number {
  return DAY_LETTERS.indexOf(letter.toUpperCase())
}

// `L-V` -> [0,1,2,3,4]. Wraps, so `S-L` is Saturday, Sunday, Monday.
function expandDays(spec: string): number[] | undefined {
  const days = new Set<number>()
  for (const token of spec.split(',')) {
    const [rawStart, rawEnd] = token.split('-').map((s) => s.trim())
    const start = dayIndex(rawStart)
    if (start < 0) return undefined
    if (rawEnd === undefined) {
      days.add(start)
      continue
    }
    const end = dayIndex(rawEnd)
    if (end < 0) return undefined
    for (let i = 0; i <= (end - start + 7) % 7; i++) days.add((start + i) % 7)
  }
  return [...days].sort((a, b) => a - b)
}

function minutes(hours: string, mins: string): number | undefined {
  const h = Number(hours)
  const m = Number(mins)
  if (h > 24 || m > 59) return undefined
  const total = h * 60 + m
  return total <= DAY ? total : undefined
}

function parseTimes(spec: string): { from: number; to: number }[] | undefined {
  const out: { from: number; to: number }[] = []
  for (const raw of spec.split(/\s+y\s+/i)) {
    const part = raw.trim()
    if (/^24H$/i.test(part)) {
      out.push({ from: 0, to: DAY })
      continue
    }
    const m = HH_MM.exec(part)
    if (!m) return undefined
    const from = minutes(m[1], m[2])
    const to = minutes(m[3], m[4])
    if (from === undefined || to === undefined) return undefined
    out.push({ from, to })
  }
  return out.length > 0 ? out : undefined
}

// Returns undefined when *any* segment fails to parse. Deliberately all-or-
// nothing: a half-understood schedule would let us claim "closed" on a station
// that is open, and being silent is always better than being confidently wrong.
export function parseSchedule(raw: string): DayRange[] | undefined {
  if (!raw.trim()) return undefined
  const ranges: DayRange[] = []
  for (const segment of raw.split(';')) {
    if (!segment.trim()) continue
    const m = SEGMENT.exec(segment)
    if (!m) return undefined
    const days = expandDays(m[1])
    const times = parseTimes(m[2])
    if (!days || !times) return undefined
    for (const { from, to } of times) ranges.push({ days, from, to })
  }
  return ranges.length > 0 ? ranges : undefined
}

const OSM_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const OSM_SEGMENT =
  /^\s*(?:([A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?(?:\s*,\s*[A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?)*)\s+)?(.+?)\s*$/
const OSM_RANGE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/

// `PH` is public holidays. We have no holiday calendar, so days that only apply
// on holidays contribute nothing rather than being guessed at either way.
function expandOsmDays(spec: string): number[] | undefined {
  const days = new Set<number>()
  for (const token of spec.split(',')) {
    const [rawStart, rawEnd] = token.split('-').map((s) => s.trim().toUpperCase())
    if (rawStart === 'PH' && rawEnd === undefined) continue
    const start = OSM_DAYS.indexOf(rawStart)
    if (start < 0) return undefined
    if (rawEnd === undefined) {
      days.add(start)
      continue
    }
    const end = OSM_DAYS.indexOf(rawEnd)
    if (end < 0) return undefined
    for (let i = 0; i <= (end - start + 7) % 7; i++) days.add((start + i) % 7)
  }
  return [...days].sort((a, b) => a - b)
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

// The subset of the OSM opening_hours grammar that Spanish service areas
// actually use: `24/7`, day ranges and lists, several time ranges per segment,
// `PH`, and `off`. Month rules, `sunrise`/`sunset` and week selectors are not
// supported and make the whole value unknown — ignoring a seasonal exception
// would have us claim a restaurant is open in August when it is shut.
export function parseOsmHours(raw: string): DayRange[] | undefined {
  const text = raw.trim()
  if (!text) return undefined
  if (/^24\/7$/i.test(text)) return [{ days: EVERY_DAY, from: 0, to: DAY }]

  const ranges: DayRange[] = []
  for (const segment of text.split(';')) {
    if (!segment.trim()) continue
    const m = OSM_SEGMENT.exec(segment)
    if (!m) return undefined
    const days = m[1] === undefined ? EVERY_DAY : expandOsmDays(m[1])
    if (!days) return undefined
    const times = m[2].trim()
    // "Sa-Su off" states a closure; with an open-intervals model that is simply
    // an absence, so the segment is dropped rather than rejected.
    if (/^off$/i.test(times)) continue
    if (days.length === 0) continue
    for (const part of times.split(',')) {
      const r = OSM_RANGE.exec(part.trim())
      if (!r) return undefined
      const from = minutes(r[1], r[2])
      const to = minutes(r[3], r[4])
      if (from === undefined || to === undefined) return undefined
      ranges.push({ days, from, to })
    }
  }
  return ranges.length > 0 ? ranges : undefined
}

interface Interval {
  start: number
  end: number
}

// Projects the ranges onto a single week measured in minutes, splitting the
// ones that cross midnight and wrapping Sunday night back onto Monday.
function weekIntervals(ranges: readonly DayRange[]): Interval[] {
  const raw: Interval[] = []
  for (const range of ranges) {
    const span = range.to > range.from ? range.to - range.from : range.to + DAY - range.from
    if (span === 0) continue
    for (const day of range.days) {
      const start = day * DAY + range.from
      const end = start + span
      if (end <= WEEK) raw.push({ start, end })
      else {
        raw.push({ start, end: WEEK })
        raw.push({ start: 0, end: end - WEEK })
      }
    }
  }
  raw.sort((a, b) => a.start - b.start)

  const merged: Interval[] = []
  for (const interval of raw) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

function weekMinute(at: Date): number {
  return ((at.getDay() + 6) % 7) * DAY + at.getHours() * 60 + at.getMinutes()
}

// A schedule naming a single day as 24H (`L: 24H`) is data-entry noise, not a
// station that opens only on Mondays — around 1.2% of the Ministerio feed. We
// refuse to draw any conclusion from it rather than mark it closed all week.
function isSingleDayAllDay(ranges: readonly DayRange[]): boolean {
  const days = new Set(ranges.flatMap((r) => [...r.days]))
  return days.size === 1 && ranges.every((r) => r.from === 0 && r.to === DAY)
}

export function scheduleStatus(ranges: readonly DayRange[] | undefined, at: Date): ScheduleStatus {
  if (!ranges || ranges.length === 0) return 'unknown'
  if (isSingleDayAllDay(ranges)) return 'unknown'

  const intervals = weekIntervals(ranges)
  if (intervals.length === 0) return 'unknown'
  if (intervals.length === 1 && intervals[0].start === 0 && intervals[0].end === WEEK) return 'open'

  const now = weekMinute(at)
  const active = intervals.find((i) => now >= i.start && now < i.end)
  if (!active) return 'closed'

  // A block ending exactly at the week boundary continues into Monday's first
  // block, so the two must be treated as one before deciding "closing soon".
  const wrapsIntoNextWeek = active.end === WEEK && intervals[0].start === 0
  const remaining = active.end - now + (wrapsIntoNextWeek ? intervals[0].end : 0)
  return remaining < CLOSING_SOON_MIN ? 'closing-soon' : 'open'
}
