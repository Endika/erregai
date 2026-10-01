import type { AppState } from '../app/store'
import { getLocale, t, type Locale } from '../i18n'

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
      return { title: t('list.empty').replace('{radius}', String(notice.radiusKm)) }
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

export function freshnessText(state: AppState, busy: boolean): string {
  if (busy) return t('app.refreshing')
  return state.dataDate ? `${t('app.updated')} ${state.dataDate}` : ''
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatAge(ms: number, locale: Locale = getLocale()): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'va' ? 'ca' : locale, { numeric: 'always' })
  if (ms < HOUR) return rtf.format(-Math.max(1, Math.floor(ms / MINUTE)), 'minute')
  if (ms < 2 * DAY) return rtf.format(-Math.floor(ms / HOUR), 'hour')
  return rtf.format(-Math.floor(ms / DAY), 'day')
}

// GeolocationPositionError.PERMISSION_DENIED is 1.
export function locationProblem(err: unknown): LocationProblem {
  const code =
    typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return code === 1 ? 'denied' : 'unavailable'
}
