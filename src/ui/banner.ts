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
  if (state.refreshError) return { text: t('error.refreshFailed'), tone: 'notice' }
  return undefined
}
