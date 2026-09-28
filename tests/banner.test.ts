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

describe('statusBanner', () => {
  it('shows nothing when every load went fine', () => {
    expect(statusBanner(state({}))).toBeUndefined()
  })
  it('a refresh failure over cached data is a notice, not the no-data error', () => {
    expect(statusBanner(state({ refreshError: 'offline' }))).toEqual({
      text: t('error.refreshFailed'),
      tone: 'notice',
    })
  })
  it('a failure that left no data is an error and wins over a refresh notice', () => {
    expect(statusBanner(state({ error: 'boom', refreshError: 'offline' }))).toEqual({
      text: `${t('error.network')}: boom`,
      tone: 'error',
    })
  })
  it('a location error wins over everything', () => {
    expect(statusBanner(state({ error: 'boom' }), t('error.location'))).toEqual({
      text: t('error.location'),
      tone: 'error',
    })
  })
})
