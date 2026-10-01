// @vitest-environment jsdom
import { applyDocumentLang, setLocale } from '../src/i18n'

afterEach(() => setLocale('es'))

describe('document language', () => {
  it('follows setLocale, with Valencian as its BCP-47 variant', () => {
    setLocale('eu')
    expect(document.documentElement.lang).toBe('eu')
    setLocale('va')
    expect(document.documentElement.lang).toBe('ca-ES-valencia')
    setLocale('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('can be applied on startup without changing the locale', () => {
    setLocale('gl')
    document.documentElement.lang = 'en'
    applyDocumentLang()
    expect(document.documentElement.lang).toBe('gl')
  })
})
