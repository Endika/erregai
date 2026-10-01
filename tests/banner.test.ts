import { statusBanner } from '../src/ui/banner'
import { DEFAULT_SETTINGS } from '../src/app/settings'
import type { AppState } from '../src/app/store'
import { t } from '../src/i18n'

const state = (over: Partial<AppState>): AppState => ({
  stations: [],
  loading: false,
  settings: { ...DEFAULT_SETTINGS },
  ...over,
})

const HOUR = 3_600_000
const ctx = { online: true, now: 10 * HOUR }

describe('statusBanner', () => {
  it('shows nothing when every load went fine', () => {
    expect(statusBanner(state({}), ctx)).toBeUndefined()
  })
  it('a refresh failure over cached data says how old the prices are', () => {
    expect(statusBanner(state({ refreshError: 'x', dataStoredAt: 7 * HOUR }), ctx)).toEqual({
      text: t('status.cached.failed').replace('{age}', 'hace 3 horas'),
      tone: 'notice',
    })
    expect(
      statusBanner(state({ refreshError: 'x', dataStoredAt: 7 * HOUR }), { ...ctx, online: false })
        ?.text,
    ).toBe(t('status.cached.offline').replace('{age}', 'hace 3 horas'))
  })
  it('says it is offline over fresh prices that had no reason to refetch', () => {
    const fresh = state({
      pos: { lat: 43.263, lon: -2.935 },
      dataStoredAt: 10 * HOUR - 25 * 60_000,
    })
    expect(statusBanner(fresh, ctx)).toBeUndefined()
    expect(statusBanner(fresh, { ...ctx, online: false })).toEqual({
      text: t('status.cached.offline').replace('{age}', 'hace 25 minutos'),
      tone: 'notice',
    })
  })
  it('stays quiet offline while there are no prices yet to qualify', () => {
    expect(statusBanner(state({}), { ...ctx, online: false })).toBeUndefined()
  })
  it('falls back to the plain refresh notice when the cache age is unknown', () => {
    expect(statusBanner(state({ refreshError: 'x' }), ctx)?.text).toBe(t('error.refreshFailed'))
  })
  it('a failure that left no data is a human error, without the technical detail', () => {
    const banner = statusBanner(state({ error: 'Failed to fetch', refreshError: 'x' }), ctx)
    expect(banner).toEqual({
      text: `${t('error.load.title')}. ${t('error.load.server')}`,
      tone: 'error',
    })
    expect(banner?.text).not.toContain('Failed to fetch')
  })
  it('a location error wins over everything, as a warning with a way around it', () => {
    expect(statusBanner(state({ error: 'boom' }), { ...ctx, locationError: 'denied' })).toEqual({
      text: `${t('error.location.denied')}. ${t('error.location.deniedHint')}`,
      tone: 'notice',
    })
  })
  it('errors the view already shows inline are not repeated in the banner', () => {
    expect(
      statusBanner(state({ error: 'boom' }), { ...ctx, locationError: 'denied', inline: true }),
    ).toBeUndefined()
    expect(
      statusBanner(state({ error: 'boom', storageFailed: true }), { ...ctx, inline: true }),
    ).toEqual({ text: t('error.storage'), tone: 'notice' })
  })
  it('a storage failure is a notice, shown alongside a refresh notice', () => {
    expect(statusBanner(state({ storageFailed: true }), ctx)).toEqual({
      text: t('error.storage'),
      tone: 'notice',
    })
    expect(statusBanner(state({ refreshError: 'x', storageFailed: true }), ctx)?.text).toBe(
      `${t('error.refreshFailed')} · ${t('error.storage')}`,
    )
  })
})
