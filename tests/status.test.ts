import {
  formatAge,
  freshnessText,
  locationProblem,
  viewNotice,
  viewNoticeText,
} from '../src/ui/status'
import { DEFAULT_SETTINGS } from '../src/app/settings'
import type { AppState } from '../src/app/store'
import { setLocale, t } from '../src/i18n'

const state = (over: Partial<AppState>): AppState => ({
  stations: [],
  loading: false,
  settings: { ...DEFAULT_SETTINGS },
  ...over,
})

const base = { hasPos: true, nearby: 0, radiusKm: 15, loading: false, locating: false }

describe('viewNotice', () => {
  it('shows nothing when there is something nearby, even with an error elsewhere', () => {
    expect(viewNotice({ ...base, nearby: 3, error: 'boom' })).toBeUndefined()
  })
  it('a failed load with nothing to show is a load failure, never "try a larger radius"', () => {
    expect(viewNotice({ ...base, error: 'Failed to fetch' })).toEqual({ kind: 'loadFailed' })
  })
  it('nothing nearby while still loading is loading, not empty', () => {
    expect(viewNotice({ ...base, loading: true })).toEqual({ kind: 'loading' })
  })
  it('nothing nearby after a good load is the empty state', () => {
    expect(viewNotice(base)).toEqual({ kind: 'empty', radiusKm: 15 })
  })
  it('without a position: locating, then the location problem', () => {
    expect(viewNotice({ ...base, hasPos: false, locating: true })).toEqual({ kind: 'loading' })
    expect(viewNotice({ ...base, hasPos: false, locationError: 'denied' })).toEqual({
      kind: 'location',
      reason: 'denied',
    })
  })
})

describe('viewNoticeText', () => {
  it('keeps technical detail out and tells offline from a failing service', () => {
    const offline = viewNoticeText({ kind: 'loadFailed' }, true)
    const server = viewNoticeText({ kind: 'loadFailed' }, false)
    expect(offline.title).toBe(t('error.load.title'))
    expect(offline.hint).toBe(t('error.load.offline'))
    expect(server.hint).toBe(t('error.load.server'))
    expect(`${offline.title} ${offline.hint}`).not.toMatch(/fetch|Error de red/i)
  })
  it('a denied location says how to fix it', () => {
    expect(viewNoticeText({ kind: 'location', reason: 'denied' }, false)).toEqual({
      title: t('error.location.denied'),
      hint: t('error.location.deniedHint'),
    })
  })
})

describe('freshnessText', () => {
  it('leaves "Loading…" once a load ends in error', () => {
    expect(freshnessText(state({ error: 'boom' }), false)).toBe('')
  })
  it('reports refreshing while busy and the data date once loaded', () => {
    expect(freshnessText(state({}), true)).toBe(t('app.refreshing'))
    expect(freshnessText(state({ dataDate: '01/10/2026 16:56:12' }), false)).toBe(
      `${t('app.updated')} 01/10/2026 16:56:12`,
    )
  })
})

describe('formatAge', () => {
  it('says minutes, hours or days, never "0 minutes"', () => {
    expect(formatAge(10_000, 'es')).toBe('hace 1 minuto')
    expect(formatAge(25 * 60_000, 'es')).toBe('hace 25 minutos')
    expect(formatAge(3 * 3_600_000 + 20 * 60_000, 'es')).toBe('hace 3 horas')
    expect(formatAge(3 * 86_400_000, 'es')).toBe('hace 3 días')
  })
  it('formats Valencian through Catalan', () => {
    expect(formatAge(2 * 3_600_000, 'va')).toBe('fa 2 hores')
  })
})

describe('locationProblem', () => {
  it('reads a denied permission apart from any other failure', () => {
    expect(locationProblem({ code: 1 })).toBe('denied')
    expect(locationProblem({ code: 3 })).toBe('unavailable')
    expect(locationProblem(new Error('x'))).toBe('unavailable')
  })
})

afterAll(() => setLocale('es'))
