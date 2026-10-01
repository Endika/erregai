import { DEFAULT_FUEL, type FuelId } from '../core/fuels'
import type { SortKey } from '../core/pricing'
import type { LatLon } from '../core/geo'
import type { Locale } from '../i18n'

export type Theme = 'light' | 'system' | 'dark'
export type FuelAlertMode = 'cheap' | 'any' | 'off'

export interface ManualPlace {
  name: string
  province: string
  pos: LatLon
}

// locale is left unset by default: the app falls back to browser-detected
// locale until the user explicitly picks one in settings (see main.ts).
// alertVolume is a 0..1 multiplier shared by both cues, and alertVibrate the
// haptic fallback; both apply to radar and fuel alerts alike, so they live
// alongside the app-wide preferences rather than being duplicated per section.
export interface Settings {
  fuel: FuelId
  sort: SortKey
  radiusKm: number
  locale?: Locale
  theme: Theme
  alertVolume: number
  alertVibrate: boolean
  radarLayerEnabled: boolean
  servicesLayerEnabled: boolean
  radarAlertsEnabled: boolean
  radarAlertDistanceM: number
  radarSound: boolean
  fuelAlertMode: FuelAlertMode
  fuelAlertDistanceM: number
  fuelSound: boolean
  // Set while the user has picked a town by hand instead of sharing a location.
  manualPlace?: ManualPlace
}
export const DEFAULT_SETTINGS: Settings = {
  fuel: DEFAULT_FUEL,
  sort: 'price',
  radiusKm: 15,
  theme: 'system',
  alertVolume: 1,
  alertVibrate: true,
  radarLayerEnabled: true,
  servicesLayerEnabled: true,
  radarAlertsEnabled: true,
  radarAlertDistanceM: 800,
  radarSound: true,
  fuelAlertMode: 'cheap',
  fuelAlertDistanceM: 2000,
  fuelSound: true,
}
export const SETTINGS_KEY = 'erregai.settings'
// Older saves still carry these; they are dropped on the next save.
const RETIRED_KEYS = ['tripSort']

export function loadSettings(store: Storage = localStorage): Settings {
  try {
    const raw = store.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const saved = JSON.parse(raw) as Partial<Settings> & Record<string, unknown>
    for (const key of RETIRED_KEYS) delete saved[key]
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings, store: Storage = localStorage): void {
  store.setItem(SETTINGS_KEY, JSON.stringify(s))
}
