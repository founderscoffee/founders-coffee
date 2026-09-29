import { z } from 'zod';

import { isLocale, type Locale } from '@founders-coffee/i18n';

import { SPOKEN_LANGUAGES, spokenLanguageSchema } from '../profile/schemas.js';

export const eventLanguagesSchema = z
  .array(spokenLanguageSchema)
  .min(1)
  .max(SPOKEN_LANGUAGES.length)
  .refine(
    (values) => new Set(values).size === values.length,
    'Languages must be unique',
  );

/**
 * The one language the site writes in about a meetup: the first of its languages the site is
 * itself written in, or `fallback` when it lists none of them.
 *
 * A meetup can be held in several languages, and in ones the site has no pages in, but its Telegram
 * group posts, the address stored for it and the language its calendar entry is tagged with each
 * need exactly one of the site's. The host's order decides, since the first language they picked is
 * the one they lead with; a meetup held only in, say, Tamazight takes the caller's `fallback`.
 */
export const leadLocale = (
  languages: readonly string[],
  fallback: Locale,
): Locale => languages.find(isLocale) ?? fallback;
