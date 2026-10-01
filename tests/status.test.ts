import {
  formatAge,
  freshnessStamp,
  freshnessText,
  locationProblem,
  needsRefreshOnReconnect,
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
  const storedAt = new Date(2026, 9, 1, 16, 56, 12).getTime()
  const loaded = state({ dataDate: '01/10/2026 16:56:12', dataStoredAt: storedAt })

  it('leaves "Loading…" once a load ends in error', () => {
    expect(freshnessText(state({ error: 'boom' }), false, storedAt)).toBe('')
  })
  it('reports refreshing while busy', () => {
    expect(freshnessText(loaded, true, storedAt)).toBe(t('app.refreshing'))
  })
  it('says how old the prices are, short enough for the header', () => {
    setLocale('es')
    expect(freshnessText(loaded, false, storedAt + 25 * 60_000)).toBe('Actualizado hace 25 min')
    setLocale('eu')
    expect(freshnessText(loaded, false, storedAt + 7 * 3_600_000)).toBe('Eguneratua duela 7 ordu')
    setLocale('va')
    expect(freshnessText(loaded, false, storedAt + 2 * 3_600_000)).toBe('Actualitzat fa 2 h')
    setLocale('es')
  })
  it('agrees with the offline banner on the age it reports', () => {
    const now = storedAt + 7 * 3_600_000 + 10 * 60_000
    expect(freshnessText(loaded, false, now)).toContain('7 h')
    expect(formatAge(now - storedAt)).toBe('hace 7 horas')
  })
})

describe('freshnessStamp', () => {
  it('keeps the absolute time for the tooltip and a machine-readable datetime', () => {
    setLocale('es')
    const storedAt = new Date(2026, 9, 1, 16, 56, 12).getTime()
    expect(freshnessStamp(state({ dataStoredAt: storedAt }))).toEqual({
      datetime: new Date(storedAt).toISOString(),
      title: 'Actualizado: 1 oct 2026, 16:56',
    })
    expect(freshnessStamp(state({}))).toBeUndefined()
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

describe('formatAge without Intl data for the locale', () => {
  afterEach(() => vi.restoreAllMocks())

  it('falls back to the locale own words, never to English', () => {
    vi.spyOn(Intl.RelativeTimeFormat, 'supportedLocalesOf').mockReturnValue([])
    expect(formatAge(25 * 60_000, 'eu')).toBe('duela 25 min')
    expect(formatAge(7 * 3_600_000, 'eu')).toBe('duela 7 h')
    expect(formatAge(3 * 86_400_000, 'eu')).toBe('duela 3 egun')
    expect(formatAge(7 * 3_600_000, 'gl', 'short')).toBe('hai 7 h')
  })
})

describe('needsRefreshOnReconnect', () => {
  const HOUR = 3_600_000
  const NOW = 100 * HOUR
  const pos = { lat: 43.263, lon: -2.935 }

  it('refreshes after a load that failed with nothing to show', () => {
    expect(needsRefreshOnReconnect(state({ pos, error: 'x' }), NOW)).toBe(true)
  })
  it('refreshes after a refresh that failed over cached prices', () => {
    expect(
      needsRefreshOnReconnect(state({ pos, refreshError: 'x', dataStoredAt: NOW - HOUR }), NOW),
    ).toBe(true)
  })
  it('refreshes prices older than the cache keeps them', () => {
    expect(needsRefreshOnReconnect(state({ pos, dataStoredAt: NOW - 7 * HOUR }), NOW)).toBe(true)
  })
  it('leaves fresh prices that loaded fine alone', () => {
    expect(needsRefreshOnReconnect(state({ pos, dataStoredAt: NOW - HOUR }), NOW)).toBe(false)
  })
  it('waits while a load is already running', () => {
    expect(needsRefreshOnReconnect(state({ pos, error: 'x', loading: true }), NOW)).toBe(false)
  })
  it('has nothing to refresh without a position', () => {
    expect(needsRefreshOnReconnect(state({ error: 'x' }), NOW)).toBe(false)
  })
})
