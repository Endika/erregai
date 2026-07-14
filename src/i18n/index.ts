import { es } from './es'
import { en } from './en'
import { ca } from './ca'
import { eu } from './eu'
import { va } from './va'
import { gl } from './gl'

export type Locale = 'es' | 'en' | 'ca' | 'eu' | 'va' | 'gl'

export const LOCALE_ORDER: readonly Locale[] = ['es', 'en', 'ca', 'eu', 'va', 'gl']

const DEFAULT_LOCALE: Locale = 'es'

const LOCALES: Record<Locale, Record<string, string>> = { es, en, ca, eu, va, gl }

let currentLocale: Locale = DEFAULT_LOCALE

export function setLocale(l: Locale): void {
  currentLocale = l
}

export function getLocale(): Locale {
  return currentLocale
}

export function detectLocale(): Locale {
  const lang = navigator.language?.slice(0, 2).toLowerCase() ?? ''
  // Valencian ('va') has no browser language code; it is only chosen manually.
  return (LOCALE_ORDER as readonly string[]).includes(lang) ? (lang as Locale) : DEFAULT_LOCALE
}

export function t(key: string, locale: Locale = currentLocale): string {
  return LOCALES[locale][key] ?? key
}
