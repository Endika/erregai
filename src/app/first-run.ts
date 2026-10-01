import { SETTINGS_KEY } from './settings'

const KEY = 'erregai.firstRunDone'

// Saved settings mean someone used the app before this flag existed.
export function isFirstRun(store: Storage = localStorage): boolean {
  try {
    return store.getItem(KEY) === null && store.getItem(SETTINGS_KEY) === null
  } catch {
    return false
  }
}

export function markFirstRunDone(store: Storage = localStorage): void {
  try {
    store.setItem(KEY, '1')
  } catch {
    /* private mode: the screen shows again next time, nothing worse */
  }
}

// Undefined where the Permissions API cannot tell, so the caller explains first.
export async function geolocationPermission(): Promise<PermissionState | undefined> {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state
  } catch {
    return undefined
  }
}
