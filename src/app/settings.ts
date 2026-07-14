import { DEFAULT_FUEL, type FuelId } from '../core/fuels'
import type { SortKey } from '../core/pricing'

export interface Settings { fuel: FuelId; sort: SortKey; radiusKm: number; locale: string }
export const DEFAULT_SETTINGS: Settings = { fuel: DEFAULT_FUEL, sort: 'price', radiusKm: 15, locale: 'es' }
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
