import { FUELS, DEFAULT_FUEL } from '../src/core/fuels'
describe('fuels', () => {
  it('maps gasoleoA to the API key', () => {
    const f = FUELS.find(x => x.id === 'gasoleoA')!
    expect(f.apiKey).toBe('Precio Gasoleo A')
  })
  it('default fuel exists in catalog', () => {
    expect(FUELS.some(f => f.id === DEFAULT_FUEL)).toBe(true)
  })
  it('every fuel has a unique id and non-empty i18nKey', () => {
    const ids = FUELS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(FUELS.every(f => f.i18nKey.length > 0)).toBe(true)
  })
})
