import { readFileSync } from 'node:fs';

export const E2E_LOCALES = ['ar', 'fr', 'en'] as const;

export type E2eLocale = (typeof E2E_LOCALES)[number];

const catalogue = (locale: E2eLocale): Record<string, string> =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../libs/i18n/messages/${locale}.json`, import.meta.url),
      'utf8',
    ),
  ) as Record<string, string>;

const CATALOGUES: Record<E2eLocale, Record<string, string>> = {
  ar: catalogue('ar'),
  fr: catalogue('fr'),
  en: catalogue('en'),
};

/**
 * The application's own copy for one locale, read from the message catalogues.
 *
 * Every control the wizard exposes is named by translated copy, so a spec that hardcodes English
 * only ever proves the English build. Reading the same JSON the app compiles from keeps the three
 * locale runs honest and fails loudly when a key is renamed rather than silently matching nothing.
 */
export const t = (locale: E2eLocale, key: string): string => {
  const value = CATALOGUES[locale][key];
  if (!value)
    throw new Error(`Missing i18n key "${key}" for locale "${locale}"`);
  return value;
};

export const LOCALE_DIRECTION: Record<E2eLocale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  fr: 'ltr',
  en: 'ltr',
};
