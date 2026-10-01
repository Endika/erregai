import type { AppState } from '../app/store'
import { t } from '../i18n'
import { formatAge, joinNotice, viewNoticeText, type LocationProblem } from './status'

export interface Banner {
  text: string
  tone: 'error' | 'notice'
}

export interface BannerContext {
  online: boolean
  now: number
  locationError?: LocationProblem
  // The active view already shows the error with its Retry; say it only once.
  inline?: boolean
}

// Errors mean prices could not load; notices report a failure the user can
// work around: cached stations still on screen, prices that cannot update while
// offline, or a refused location that a town picked by hand replaces.
export function statusBanner(state: AppState, ctx: BannerContext): Banner | undefined {
  if (!ctx.inline) {
    if (ctx.locationError) {
      const text = joinNotice(
        viewNoticeText({ kind: 'location', reason: ctx.locationError }, !ctx.online),
      )
      return { text, tone: 'notice' }
    }
    if (state.error) {
      return {
        text: joinNotice(viewNoticeText({ kind: 'loadFailed' }, !ctx.online)),
        tone: 'error',
      }
    }
  }
  const notices: string[] = []
  // Fresh prices are not refetched, so nothing would fail to tell of a lost connection.
  if (state.refreshError || (!ctx.online && state.dataStoredAt !== undefined))
    notices.push(cachedNotice(state, ctx))
  if (state.storageFailed) notices.push(t('error.storage'))
  return notices.length > 0 ? { text: notices.join(' · '), tone: 'notice' } : undefined
}

function cachedNotice(state: AppState, ctx: BannerContext): string {
  if (state.dataStoredAt === undefined) return t('error.refreshFailed')
  const key = ctx.online ? 'status.cached.failed' : 'status.cached.offline'
  return t(key).replace('{age}', formatAge(ctx.now - state.dataStoredAt))
}
