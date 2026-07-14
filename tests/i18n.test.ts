import { LOCALE_ORDER, t } from '../src/i18n'
import { es } from '../src/i18n/es'
import { en } from '../src/i18n/en'
import { ca } from '../src/i18n/ca'
import { eu } from '../src/i18n/eu'
import { va } from '../src/i18n/va'
import { gl } from '../src/i18n/gl'
import { FUELS } from '../src/core/fuels'

const MAPS = { es, en, ca, eu, va, gl }

describe('i18n', () => {
  it('resolves a known key in both base locales', () => {
    expect(t('fuel.gasoleoA', 'es')).toMatch(/[Dd]i[ée]sel|Gas[oó]leo|Gasoil/)
    expect(t('fuel.gasoleoA', 'en')).toMatch(/[Dd]iesel/)
  })

  it('exposes exactly the six sister-app locales', () => {
    expect([...LOCALE_ORDER].sort()).toEqual(['ca', 'en', 'es', 'eu', 'gl', 'va'])
  })

  it('every locale has the exact same key set as Spanish (parity)', () => {
    const base = Object.keys(es).sort()
    for (const locale of LOCALE_ORDER) {
      expect(Object.keys(MAPS[locale]).sort()).toEqual(base)
    }
  })

  it('has a non-placeholder translation for every fuel i18nKey in every locale', () => {
    for (const locale of LOCALE_ORDER) {
      for (const f of FUELS) {
        expect(t(f.i18nKey, locale)).not.toBe(f.i18nKey)
      }
    }
  })
})
