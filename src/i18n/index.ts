import { es } from './es'
import { en } from './en'

export type Locale = 'es' | 'en'

const DEFAULT_LOCALE: Locale = 'es'

const LOCALES: Record<Locale, Record<string, string>> = { es, en }

let currentLocale: Locale = DEFAULT_LOCALE

export function setLocale(l: Locale): void {
  currentLocale = l
}

export function detectLocale(): Locale {
  const lang = navigator.language?.slice(0, 2)
  return lang === 'en' ? 'en' : DEFAULT_LOCALE
}

export function t(key: string, locale: Locale = currentLocale): string {
  return LOCALES[locale][key] ?? key
}
