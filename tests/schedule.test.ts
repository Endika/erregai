import { parseSchedule, scheduleStatus } from '../src/core/schedule'
import fixture from './fixtures/horarios.json'

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
