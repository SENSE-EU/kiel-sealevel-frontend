export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** The language to fill gaps from: German falls back to English and vice versa. */
export function fallbackLocale(locale: Locale): Locale {
  return locale === 'de' ? 'en' : 'de';
}
