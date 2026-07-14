import { DEFAULT_FUEL, type FuelId } from '../core/fuels'
import type { SortKey } from '../core/pricing'
import type { Locale } from '../i18n'

// locale is left unset by default: the app falls back to browser-detected
// locale until the user explicitly picks one in settings (see main.ts).
export interface Settings { fuel: FuelId; sort: SortKey; radiusKm: number; locale?: Locale }
export const DEFAULT_SETTINGS: Settings = { fuel: DEFAULT_FUEL, sort: 'price', radiusKm: 15 }
const KEY = 'erregai.settings'

export function loadSettings(store: Storage = localStorage): Settings {
  try {
    const raw = store.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<Settings> }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(s: Settings, store: Storage = localStorage): void {
  store.setItem(KEY, JSON.stringify(s))
}
