import {
  averageDelta,
  formatDate,
  formatDateTime,
  formatDistance,
  formatKm,
  formatNumber,
  formatPrice,
} from '../src/i18n/format'
import { intlLocale, langTag, setLocale, type Locale } from '../src/i18n'

afterEach(() => setLocale('es'))

describe('formatPrice', () => {
  it('always shows three decimals with the locale separator', () => {
    const expected: Record<Locale, string> = {
      es: '1,739',
      eu: '1,739',
      ca: '1,739',
      va: '1,739',
      gl: '1,739',
      en: '1.739',
    }
    for (const [locale, text] of Object.entries(expected) as [Locale, string][]) {
      expect(formatPrice(1.739, locale)).toBe(text)
    }
    expect(formatPrice(1.4, 'es')).toBe('1,400')
    expect(formatPrice(1.4, 'en')).toBe('1.400')
  })

  it('follows the active locale when none is given', () => {
    setLocale('en')
    expect(formatPrice(1.5)).toBe('1.500')
    setLocale('eu')
    expect(formatPrice(1.5)).toBe('1,500')
  })
})

describe('formatKm', () => {
  it('shows one decimal and the unit', () => {
    expect(formatKm(1.04, 'es')).toBe('1,0 km')
    expect(formatKm(12.36, 'gl')).toBe('12,4 km')
    expect(formatKm(12.36, 'en')).toBe('12.4 km')
    expect(formatKm(3.25, 'va')).toBe('3,3 km')
  })
})

describe('formatDistance', () => {
  it('shows whole metres below a kilometre', () => {
    expect(formatDistance(0.8504, 'es')).toBe('850 m')
    expect(formatDistance(0.3, 'eu')).toBe('300 m')
    expect(formatDistance(0.0004, 'en')).toBe('0 m')
  })

  it('switches to kilometres from 1000 m, including what rounds up to it', () => {
    expect(formatDistance(1, 'es')).toBe('1,0 km')
    expect(formatDistance(0.9996, 'es')).toBe('1,0 km')
    expect(formatDistance(1.5, 'ca')).toBe('1,5 km')
    expect(formatDistance(1.5, 'en')).toBe('1.5 km')
  })
})

describe('formatNumber', () => {
  it('uses the locale decimal separator', () => {
    expect(formatNumber(7.5, 'es')).toBe('7,5')
    expect(formatNumber(15, 'eu')).toBe('15')
    expect(formatNumber(7.5, 'en')).toBe('7.5')
  })
})

describe('formatDate', () => {
  it('spells out a calendar date in every locale, never ISO', () => {
    const expected: Record<Locale, string> = {
      es: '1 de octubre de 2026',
      gl: '1 de outubro de 2026',
      ca: '1 d’octubre del 2026',
      va: '1 d’octubre del 2026',
      eu: '2026(e)ko urriaren 1(a)',
      en: 'October 1, 2026',
    }
    for (const [locale, text] of Object.entries(expected) as [Locale, string][]) {
      expect(formatDate('2026-10-01', locale)).toBe(text)
    }
  })
})

describe('formatDateTime', () => {
  it('formats a timestamp with date and time for the locale', () => {
    const at = new Date(2026, 9, 1, 16, 56, 12).getTime()
    expect(formatDateTime(at, 'es')).toBe('1 oct 2026, 16:56')
    expect(formatDateTime(at, 'en')).toMatch(/^Oct 1, 2026, 4:56\sPM$/)
  })
})

describe('locale tags', () => {
  it('maps Valencian to Catalan for Intl and to a valid BCP-47 tag for lang', () => {
    expect(intlLocale('va')).toBe('ca')
    expect(intlLocale('eu')).toBe('eu')
    expect(langTag('va')).toBe('ca-ES-valencia')
    expect(langTag('gl')).toBe('gl')
  })
})

// Chromium on Linux ships ICU without Basque or Galician, and Intl then
// formats those silently in English.
describe('locales the browser has no Intl data for', () => {
  afterEach(() => vi.restoreAllMocks())

  const withoutBasque = () => {
    const drop = (tags: Intl.LocalesArgument) =>
      [tags ?? []].flat().filter((tag): tag is string => tag !== 'eu')
    vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf').mockImplementation(drop)
    vi.spyOn(Intl.RelativeTimeFormat, 'supportedLocalesOf').mockImplementation(drop)
  }

  it('keeps the Spanish separators for numbers instead of English ones', () => {
    withoutBasque()
    expect(formatPrice(1.739, 'eu')).toBe('1,739')
    expect(formatKm(1.25, 'eu')).toBe('1,3 km')
  })

  it('writes dates numerically, day first, instead of in English', () => {
    withoutBasque()
    expect(formatDate('2026-10-01', 'eu')).toBe('1/10/2026')
    expect(formatDateTime(new Date(2026, 9, 1, 16, 56).getTime(), 'eu')).toBe('1/10/2026, 16:56')
  })
})

describe('averageDelta', () => {
  it('signs the difference with a true minus and a plus', () => {
    expect(averageDelta(-8, 'es')).toBe('\u22128 cént. frente a la media')
    expect(averageDelta(5, 'es')).toBe('+5 cént. frente a la media')
    expect(averageDelta(-12, 'en')).toBe('\u221212 ct vs. the average')
  })

  it('says it sits on the average rather than showing a signed zero', () => {
    expect(averageDelta(0, 'es')).toBe('En la media')
    expect(averageDelta(0, 'eu')).toBe('Batez bestekoan')
  })
})
