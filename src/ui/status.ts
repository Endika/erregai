import type { AppState } from '../app/store'
import { TTL_MS } from '../adapters/cache'
import { getLocale, intlLocale, t, type Locale } from '../i18n'
import { formatDateTime, formatNumber, hasRelativeTimeData } from '../i18n/format'

export type LocationProblem = 'denied' | 'unavailable'

export type ViewNotice =
  | { kind: 'loading' }
  | { kind: 'empty'; radiusKm: number }
  | { kind: 'loadFailed' }
  | { kind: 'location'; reason: LocationProblem }

export interface ViewNoticeInput {
  hasPos: boolean
  nearby: number
  radiusKm: number
  loading: boolean
  locating: boolean
  error?: string
  locationError?: LocationProblem
}

// What the List/Map body says when it has nothing to draw; undefined when it does.
export function viewNotice(input: ViewNoticeInput): ViewNotice | undefined {
  if (!input.hasPos) {
    if (input.locating || !input.locationError) return { kind: 'loading' }
    return { kind: 'location', reason: input.locationError }
  }
  if (input.nearby > 0) return undefined
  if (input.loading) return { kind: 'loading' }
  if (input.error) return { kind: 'loadFailed' }
  return { kind: 'empty', radiusKm: input.radiusKm }
}

export interface NoticeText {
  title: string
  hint?: string
}

export function viewNoticeText(notice: ViewNotice, offline: boolean): NoticeText {
  switch (notice.kind) {
    case 'loading':
      return { title: t('app.loading') }
    case 'empty':
      return { title: t('list.empty').replace('{radius}', formatNumber(notice.radiusKm)) }
    case 'loadFailed':
      return {
        title: t('error.load.title'),
        hint: t(offline ? 'error.load.offline' : 'error.load.server'),
      }
    case 'location':
      return notice.reason === 'denied'
        ? { title: t('error.location.denied'), hint: t('error.location.deniedHint') }
        : { title: t('error.location.unavailable'), hint: t('error.location.unavailableHint') }
  }
}

export function joinNotice({ title, hint }: NoticeText): string {
  return hint ? `${title}. ${hint}` : title
}

// Worth a fetch when the connection comes back: the last load failed, or the
// prices are older than the cache would keep them.
export function needsRefreshOnReconnect(state: AppState, now: number): boolean {
  if (!state.pos || state.loading) return false
  if (state.error || state.refreshError) return true
  return state.dataStoredAt !== undefined && now - state.dataStoredAt >= TTL_MS
}

// Ages from dataStoredAt, the same clock the cached-prices banner reads, so the
// header and the banner never disagree on how old the prices are.
export function freshnessText(state: AppState, busy: boolean, now: number): string {
  if (busy) return t('app.refreshing')
  if (state.dataStoredAt === undefined) return ''
  return t('app.updatedAgo').replace(
    '{age}',
    formatAge(now - state.dataStoredAt, getLocale(), 'short'),
  )
}

export interface FreshnessStamp {
  datetime: string
  title: string
}

export function freshnessStamp(state: AppState): FreshnessStamp | undefined {
  if (state.dataStoredAt === undefined) return undefined
  return {
    datetime: new Date(state.dataStoredAt).toISOString(),
    title: `${t('app.updated')}: ${formatDateTime(state.dataStoredAt)}`,
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatAge(
  ms: number,
  locale: Locale = getLocale(),
  style: Intl.RelativeTimeFormatStyle = 'long',
): string {
  const [n, unit] = ageIn(ms)
  // Abbreviated units need no plural, and days only start at 2.
  if (!hasRelativeTimeData(locale)) return t(`age.${unit}`, locale).replace('{n}', String(n))
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'always', style })
  return rtf.format(-n, unit)
}

function ageIn(ms: number): [number, 'minute' | 'hour' | 'day'] {
  if (ms < HOUR) return [Math.max(1, Math.floor(ms / MINUTE)), 'minute']
  if (ms < 2 * DAY) return [Math.floor(ms / HOUR), 'hour']
  return [Math.floor(ms / DAY), 'day']
}

// GeolocationPositionError.PERMISSION_DENIED is 1.
export function locationProblem(err: unknown): LocationProblem {
  const code =
    typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return code === 1 ? 'denied' : 'unavailable'
}
