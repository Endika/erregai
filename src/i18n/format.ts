import type { PriceBand } from '../core/pricing'
import { getLocale, intlLocale, t, type Locale } from '.'

const numberFormats = new Map<string, Intl.NumberFormat>()

// Chromium on Linux and some WebViews ship ICU without Basque or Galician, and
// Intl then formats them silently in English. Spanish shares their separators.
const FALLBACK = 'es'

function hasIntlData(ctor: { supportedLocalesOf(tag: string): string[] }, locale: Locale) {
  return ctor.supportedLocalesOf(intlLocale(locale)).length > 0
}

function numberFormat(locale: Locale, key: string, opts: Intl.NumberFormatOptions) {
  const id = `${locale}|${key}`
  let f = numberFormats.get(id)
  if (!f) {
    f = new Intl.NumberFormat([intlLocale(locale), FALLBACK], opts)
    numberFormats.set(id, f)
  }
  return f
}

// Without data for the locale, a numeric day-first date reads right in any
// language spoken in Spain, where month names in another language would not.
function dateFormat(
  locale: Locale,
  opts: Intl.DateTimeFormatOptions,
  numeric: Intl.DateTimeFormatOptions,
) {
  return hasIntlData(Intl.DateTimeFormat, locale)
    ? new Intl.DateTimeFormat(intlLocale(locale), opts)
    : new Intl.DateTimeFormat(FALLBACK, numeric)
}

export function formatPrice(price: number, locale: Locale = getLocale()): string {
  return numberFormat(locale, 'price', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(price)
}

export function formatKm(km: number, locale: Locale = getLocale()): string {
  const n = numberFormat(locale, 'km', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${n.format(km)} km`
}

// Ten-metre steps: a distance redrawn on every GPS fix would otherwise flicker
// through every metre.
export function formatDistance(km: number, locale: Locale = getLocale()): string {
  const m = Math.round(km * 100) * 10
  if (m >= 1000) return formatKm(km, locale)
  return `${numberFormat(locale, 'm', { maximumFractionDigits: 0 }).format(m)} m`
}

// Whole percent with the locale's own spacing and sign order: "70 %", "% 70".
export function formatPercent(fraction: number, locale: Locale = getLocale()): string {
  return numberFormat(locale, 'percent', { style: 'percent', maximumFractionDigits: 0 }).format(
    fraction,
  )
}

export function formatNumber(n: number, locale: Locale = getLocale()): string {
  return numberFormat(locale, 'plain', {}).format(n)
}

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
}

export function hasRelativeTimeData(locale: Locale): boolean {
  return hasIntlData(Intl.RelativeTimeFormat, locale)
}

// A calendar date ('2026-10-01'), read as local so it never shifts a day.
export function formatDate(isoDate: string, locale: Locale = getLocale()): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return dateFormat(locale, { dateStyle: 'long' }, NUMERIC_DATE).format(new Date(y, m - 1, d))
}

export function formatDateTime(at: number, locale: Locale = getLocale()): string {
  return dateFormat(
    locale,
    { dateStyle: 'medium', timeStyle: 'short' },
    { ...NUMERIC_DATE, hour: '2-digit', minute: '2-digit' },
  ).format(at)
}

// What a screen reader hears for a price pill: the price first, the band after.
export function priceWithBand(
  price: number,
  band: PriceBand,
  locale: Locale = getLocale(),
): string {
  return t('price.withBand', locale)
    .replace('{price}', formatPrice(price, locale))
    .replace('{band}', t(`band.${band}`, locale).toLocaleLowerCase(intlLocale(locale)))
}

// A true minus, not a hyphen, and no signed zero: "on the average" instead.
export function averageDelta(cents: number, locale: Locale = getLocale()): string {
  if (cents === 0) return t('detail.atAverage', locale)
  const sign = cents < 0 ? '\u2212' : '+'
  return t('detail.vsAverage', locale).replace(
    '{delta}',
    `${sign}${formatNumber(Math.abs(cents), locale)}`,
  )
}
