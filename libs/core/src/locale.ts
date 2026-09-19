import { z } from 'zod';

export const LOCALES = ['ar', 'en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export const localeSchema = z.enum(LOCALES);

export interface LocalizedNames {
  readonly name: string;
  readonly nameAr?: string | null;
  readonly nameFr?: string | null;
}

/**
 * The name to show a reader of `locale`, for anything carrying a name per language: a market, a
 * state, a city. `name` is the fallback and is never a display decision on its own, because it is
 * also the Latin key the Mapbox city lookup is matched against (it is requested in a fixed `en`),
 * and it is frozen into the venue snapshots as an address. Renaming it to read better somewhere
 * breaks both, so a language that wants a different word gets its own field here.
 *
 * `nameFr` is sparse on purpose (FC-28). Most Algerian place names in `name` already are the
 * French spelling, so a row only carries one where French has a genuinely different word for the
 * place — `Alger` for `Algiers`, `Algérie` for `Algeria`. Everything else falling through to
 * `name` is the correct answer rather than a gap waiting to be filled.
 */
export const localizedName = (named: LocalizedNames, locale: Locale): string =>
  (locale === 'ar' ? named.nameAr : locale === 'fr' ? named.nameFr : null) ??
  named.name;

/**
 * Whether `query` matches any of the names a place answers to, rather than only the one the
 * reader is being shown.
 *
 * Searching a single locale's name is wrong in both directions: a French visitor pastes `Alger`
 * out of a message written in Arabic, and someone reading in Arabic types `Bejaia` off a road
 * sign (FC-28). Latin names compare case-insensitively; Arabic has no case, so `nameAr` is
 * compared as written. Neither is accent-folded, which costs nothing today because a place whose
 * French name carries accents keeps the bare spelling in `name`.
 */
export const matchesLocalizedName = (
  named: LocalizedNames,
  query: string,
): boolean => {
  const lowered = query.toLowerCase();
  return (
    named.name.toLowerCase().includes(lowered) ||
    (named.nameAr?.includes(query) ?? false) ||
    (named.nameFr?.toLowerCase().includes(lowered) ?? false)
  );
};
