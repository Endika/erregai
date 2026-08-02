import { parseSchedule, parseOsmHours, scheduleStatus } from '../src/core/schedule'
import fixture from './fixtures/horarios.json'
import osmFixture from './fixtures/osm-hours.json'

// 2026-01-05 is a Monday, so dayIdx maps 0..6 onto Monday..Sunday.
const at = (dayIdx: number, hours: number, mins = 0): Date => new Date(2026, 0, 5 + dayIdx, hours, mins)
const status = (raw: string, when: Date): string => scheduleStatus(parseSchedule(raw), when)

const MON = 0, TUE = 1, WED = 2, SAT = 5, SUN = 6

describe('parseSchedule', () => {
  it('parses every distinct Horario value in the real Ministerio sample', () => {
    const failures = fixture.filter(entry => parseSchedule(entry.raw) === undefined)
    expect(failures.map(f => f.raw)).toEqual([])
    expect(fixture.length).toBeGreaterThan(300)
  })

  it('returns undefined for empty and unrecognised input', () => {
    for (const raw of ['', '   ', 'sunrise-sunset', 'L-D', 'Lunes de 9 a 5', 'Z: 24H', 'L-D: 25:00-26:00']) {
      expect(parseSchedule(raw)).toBeUndefined()
    }
  })

  it('rejects the whole schedule when any single segment is unparseable', () => {
    expect(parseSchedule('L-V: 06:00-22:00; S-D: cuando toque')).toBeUndefined()
  })
})

describe('scheduleStatus', () => {
  it('treats 24H every day as always open, including across midnight', () => {
    expect(status('L-D: 24H', at(WED, 3))).toBe('open')
    expect(status('L-D: 24H', at(SUN, 23, 30))).toBe('open')
  })

  it('resolves a plain daily range', () => {
    expect(status('L-D: 06:00-22:00', at(WED, 5))).toBe('closed')
    expect(status('L-D: 06:00-22:00', at(WED, 12))).toBe('open')
    expect(status('L-D: 06:00-22:00', at(WED, 21, 30))).toBe('closing-soon')
  })

  it('handles ranges that cross midnight', () => {
    expect(status('L: 22:00-06:00', at(TUE, 2))).toBe('open')
    expect(status('L: 22:00-06:00', at(TUE, 7))).toBe('closed')
  })

  it('wraps a Sunday night range onto Monday morning', () => {
    expect(status('D: 22:00-06:00', at(MON, 2))).toBe('open')
  })

  it('applies per-segment days', () => {
    const raw = 'L-V: 06:00-22:00; S-D: 08:00-22:00'
    expect(status(raw, at(SAT, 6, 30))).toBe('closed')
    expect(status(raw, at(SAT, 9))).toBe('open')
    expect(status(raw, at(WED, 6, 30))).toBe('open')
  })

  it('applies day lists', () => {
    const raw = 'L,X,V: 09:00-13:00'
    expect(status(raw, at(WED, 10))).toBe('open')
    expect(status(raw, at(TUE, 10))).toBe('closed')
  })

  it('applies split ranges joined by "y"', () => {
    const raw = 'L-V: 09:00-13:00 y 15:00-18:00'
    expect(status(raw, at(WED, 14))).toBe('closed')
    expect(status(raw, at(WED, 16))).toBe('open')
  })

  it('reports unknown for a single day marked 24H, which is bad data rather than a Monday-only station', () => {
    expect(status('L: 24H', at(MON, 12))).toBe('unknown')
    expect(status('L: 24H', at(WED, 12))).toBe('unknown')
  })

  it('reports unknown when there is nothing to go on', () => {
    expect(scheduleStatus(undefined, at(MON, 12))).toBe('unknown')
    expect(scheduleStatus([], at(MON, 12))).toBe('unknown')
  })
})

const osmStatus = (raw: string, when: Date): string => scheduleStatus(parseOsmHours(raw), when)

describe('parseOsmHours', () => {
  // The one value left out is `24/7; Jun 15-Sep 15 07:30-22:30 off`: a seasonal
  // override we cannot model, and claiming 24/7 through August would be wrong.
  const SEASONAL = '24/7; Jun 15-Sep 15 07:30-22:30 off'

  it('parses every opening_hours value in the shipped dataset bar the seasonal one', () => {
    const failures = osmFixture.filter(e => parseOsmHours(e.raw) === undefined).map(e => e.raw)
    expect(failures).toEqual([SEASONAL])
    expect(osmFixture.length).toBe(38)
  })

  it('treats 24/7 as always open', () => {
    expect(osmStatus('24/7', at(SUN, 4))).toBe('open')
    expect(osmStatus('00:00-24:00', at(SUN, 4))).toBe('open')
  })

  it('applies a plain weekday range', () => {
    expect(osmStatus('Mo-Su 07:00-23:00', at(WED, 23, 30))).toBe('closed')
    expect(osmStatus('Mo-Su 07:00-23:00', at(WED, 12))).toBe('open')
  })

  it('ignores the public-holiday marker in a day list', () => {
    expect(osmStatus('Mo-Su,PH 07:00-22:00', at(WED, 12))).toBe('open')
    expect(osmStatus('PH,Mo-Su 08:00-16:00', at(WED, 12))).toBe('open')
  })

  it('reads "off" as a closure rather than a parse failure', () => {
    const raw = 'Mo-Fr 06:00-21:00; Sa 09:00-15:00; Su off'
    expect(parseOsmHours(raw)).toBeDefined()
    expect(osmStatus(raw, at(SUN, 12))).toBe('closed')
    expect(osmStatus(raw, at(SAT, 12))).toBe('open')
  })

  it('handles day lists, wrapping ranges and several ranges per day', () => {
    expect(osmStatus('Mo-Fr 07:00-19:00; Sa,Su 08:00-14:00', at(SAT, 9))).toBe('open')
    expect(osmStatus('Fr-We 06:00-18:00', at(MON, 10))).toBe('open')
    expect(osmStatus('Mo-Su 13:00-16:30,19:30-23:30', at(WED, 18))).toBe('closed')
    expect(osmStatus('Mo-Su 13:00-16:30,19:30-23:30', at(WED, 20))).toBe('open')
  })

  it('crosses midnight, carrying the previous day\'s block into the small hours', () => {
    // Tuesday's block runs until 00:30 on Wednesday, so at 00:15 it is still
    // serving — and, being 15 minutes from closing, worth warning about.
    expect(osmStatus('Tu-Su 07:00-00:30', at(WED, 0, 15))).toBe('closing-soon')
    expect(osmStatus('Tu-Su 07:00-00:30', at(WED, 22))).toBe('open')
    expect(osmStatus('Tu-Su 07:00-00:30', at(MON, 12))).toBe('closed')
  })

  it('refuses syntax it cannot model instead of guessing', () => {
    for (const raw of [SEASONAL, 'sunrise-sunset', 'Jan-Mar 09:00-17:00', 'Mo-Su 07:00', '']) {
      expect(parseOsmHours(raw)).toBeUndefined()
    }
  })
})
