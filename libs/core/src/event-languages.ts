import type { Locale } from './locale.js';

/**
 * The languages a stored meetup is held in, never an empty list.
 *
 * Every meetup that existed when meetups began to list several languages was given its one
 * language as its list, but a Worker rolled back past that change still writes new ones with the
 * list left empty. Reading the lead language as the list keeps such a meetup on its card and under
 * the language filters instead of listing it in no language at all.
 */
export const eventLanguages = (event: {
  readonly languages: readonly string[];
  readonly language: Locale;
}): readonly string[] =>
  event.languages.length > 0 ? event.languages : [event.language];
