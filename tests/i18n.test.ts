import { t } from '../src/i18n'
import { FUELS } from '../src/core/fuels'
describe('i18n', () => {
  it('resolves a known key in both locales', () => {
    expect(t('fuel.gasoleoA', 'es')).toMatch(/[Dd]i[ée]sel|Gas[oó]leo/)
    expect(t('fuel.gasoleoA', 'en')).toMatch(/[Dd]iesel/)
  })
  it('has a translation for every fuel i18nKey', () => {
    for (const f of FUELS) {
      expect(t(f.i18nKey, 'es')).not.toBe(f.i18nKey)
      expect(t(f.i18nKey, 'en')).not.toBe(f.i18nKey)
    }
  })
})
