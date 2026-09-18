import { locales, type Locale } from '@founders-coffee/i18n';

/**
 * The manifest a page in this locale points the browser at.
 *
 * Three manifests rather than one, because the install dialog quotes `description` and the home
 * screen quotes `short_name` and the shortcut names, and a French installer reading Arabic is the
 * same defect the English-only description was. `id` is `/` in all three, so a member who installs
 * from a French page and one who installs from an Arabic page hold the same app rather than two.
 *
 * Arabic keeps the conventional `/manifest.json` because it is the default locale and the address
 * every crawler and audit tool guesses at.
 */
export const manifestHref = (locale: Locale): string =>
  locale === 'ar' ? '/manifest.json' : `/manifest.${locale}.json`;

/** Every manifest the build ships, in locale order. */
export const manifestHrefs = (): readonly string[] =>
  locales.map((locale) => manifestHref(locale));
