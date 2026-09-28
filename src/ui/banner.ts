import type { AppState } from '../app/store'
import { t } from '../i18n'

export interface Banner {
  text: string
  tone: 'error' | 'notice'
}

// Errors mean there is nothing to show; notices report a failure while the
// cached stations stay on screen.
export function statusBanner(state: AppState, locationError?: string): Banner | undefined {
  if (locationError) return { text: locationError, tone: 'error' }
  if (state.error) return { text: `${t('error.network')}: ${state.error}`, tone: 'error' }
  const notices: string[] = []
  if (state.refreshError) notices.push(t('error.refreshFailed'))
  if (state.storageFailed) notices.push(t('error.storage'))
  return notices.length > 0 ? { text: notices.join(' · '), tone: 'notice' } : undefined
}
