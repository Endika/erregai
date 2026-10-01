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

// Errors mean there is nothing to show; notices report a failure while the
// cached stations stay on screen.
export function statusBanner(state: AppState, ctx: BannerContext): Banner | undefined {
  if (!ctx.inline) {
    if (ctx.locationError) {
      const text = joinNotice(
        viewNoticeText({ kind: 'location', reason: ctx.locationError }, !ctx.online),
      )
      return { text, tone: 'error' }
    }
    if (state.error) {
      return {
        text: joinNotice(viewNoticeText({ kind: 'loadFailed' }, !ctx.online)),
        tone: 'error',
      }
    }
  }
  const notices: string[] = []
  if (state.refreshError) notices.push(cachedNotice(state, ctx))
  if (state.storageFailed) notices.push(t('error.storage'))
  return notices.length > 0 ? { text: notices.join(' · '), tone: 'notice' } : undefined
}

function cachedNotice(state: AppState, ctx: BannerContext): string {
  if (state.dataStoredAt === undefined) return t('error.refreshFailed')
  const key = ctx.online ? 'status.cached.failed' : 'status.cached.offline'
  return t(key).replace('{age}', formatAge(ctx.now - state.dataStoredAt))
}
