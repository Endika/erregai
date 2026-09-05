// @vitest-environment jsdom
import { renderList } from '../src/ui/list'
import { renderDetail } from '../src/ui/detail'
import type { Station } from '../src/core/station'

const station = (id: string, schedule: string): Station => ({
  id,
  brand: 'REPSOL',
  name: 'REPSOL',
  pos: { lat: 40, lon: -3 },
  address: 'Calle X',
  town: 'Madrid',
  schedule,
  prices: { gasoleoA: 1.5 },
})

// Wednesday 2026-01-07, 23:00 local.
const lateWednesday = new Date(2026, 0, 7, 23, 0)
const origin = { lat: 40, lon: -3 }

const renderRows = (stations: Station[]): HTMLElement => {
  const el = document.createElement('div')
  renderList(el, stations, 'gasoleoA', origin, () => {}, undefined, lateWednesday)
  return el
}

describe('schedule badge in the list', () => {
  it('badges a closed station and leaves a 24 h one bare', () => {
    const el = renderRows([station('closed', 'L-D: 06:00-22:00'), station('always', 'L-D: 24H')])
    const badges = el.querySelectorAll('.station-row__schedule')
    expect(badges.length).toBe(1)
    expect(badges[0].getAttribute('data-schedule')).toBe('closed')
    expect(el.querySelector('[data-station="always"] .station-row__schedule')).toBeNull()
  })

  it('badges a station about to close', () => {
    const el = renderRows([station('soon', 'L-D: 06:00-23:30')])
    expect(el.querySelector('.station-row__schedule')?.getAttribute('data-schedule')).toBe(
      'closing-soon',
    )
  })

  it('says nothing when the schedule cannot be understood', () => {
    const el = renderRows([station('weird', 'cuando el dueno quiera'), station('empty', '')])
    expect(el.querySelectorAll('.station-row__schedule').length).toBe(0)
  })

  it('says nothing for the single-day 24H data-entry case', () => {
    const el = renderRows([station('monday', 'L: 24H')])
    expect(el.querySelectorAll('.station-row__schedule').length).toBe(0)
  })
})

describe('schedule status in the detail card', () => {
  it('keeps the raw text and adds the derived state', () => {
    const el = document.createElement('div')
    renderDetail(el, station('closed', 'L-D: 06:00-22:00'), lateWednesday)
    const line = el.querySelector('.station-detail__schedule')
    expect(line?.textContent).toContain('L-D: 06:00-22:00')
    expect(
      line?.querySelector('.station-detail__schedule-status')?.getAttribute('data-schedule'),
    ).toBe('closed')
  })

  it('marks an open station open', () => {
    const el = document.createElement('div')
    renderDetail(el, station('open', 'L-D: 24H'), lateWednesday)
    expect(
      el.querySelector('.station-detail__schedule-status')?.getAttribute('data-schedule'),
    ).toBe('open')
  })

  it('shows the raw text with no state when it cannot be parsed', () => {
    const el = document.createElement('div')
    renderDetail(el, station('weird', 'a ratos'), lateWednesday)
    expect(el.querySelector('.station-detail__schedule')?.textContent).toContain('a ratos')
    expect(el.querySelector('.station-detail__schedule-status')).toBeNull()
  })
})
