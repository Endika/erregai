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
})
