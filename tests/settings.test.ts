import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../src/app/settings'

const memStore = (): Storage => {
  const m = new Map<string, string>()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage
}

describe('settings', () => {
  it('returns defaults when empty', () => {
    expect(loadSettings(memStore())).toEqual(DEFAULT_SETTINGS)
  })
  it('round-trips saved settings', () => {
    const s = memStore()
    saveSettings({ ...DEFAULT_SETTINGS, fuel: 'gasolina95', radiusKm: 25 }, s)
    expect(loadSettings(s).fuel).toBe('gasolina95')
    expect(loadSettings(s).radiusKm).toBe(25)
  })
  it('ignores corrupt json and returns defaults', () => {
    const s = memStore(); s.setItem('erregai.settings', '{bad')
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })
  it('provides radar defaults and preserves them across a partial merge', () => {
    const s = memStore(); s.setItem('erregai.settings', JSON.stringify({ radiusKm: 20 }))
    const merged = loadSettings(s)
    expect(merged.radiusKm).toBe(20)
    expect(merged.radarAlertsEnabled).toBe(true)
    expect(merged.radarAlertDistanceM).toBe(800)
    expect(merged.radarSound).toBe(true)
  })
  it('defaults fuel alerts to cheap mode with 2 km distance and sound on', () => {
    expect(DEFAULT_SETTINGS.fuelAlertMode).toBe('cheap')
    expect(DEFAULT_SETTINGS.fuelAlertDistanceM).toBe(2000)
    expect(DEFAULT_SETTINGS.fuelSound).toBe(true)
  })
  it('provides fuel defaults across a partial merge', () => {
    const s = memStore(); s.setItem('erregai.settings', JSON.stringify({ radiusKm: 20 }))
    const merged = loadSettings(s)
    expect(merged.fuelAlertMode).toBe('cheap')
    expect(merged.fuelAlertDistanceM).toBe(2000)
    expect(merged.fuelSound).toBe(true)
  })
})
