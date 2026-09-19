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
 * `nameFr` is read but nothing sets it yet, so French falls through to `name` exactly as it did
 * before this existed (FC-28). That is the whole of the French gap: one absent field, not a
 * missing branch at each of the places that render a name.
 */
export const localizedName = (named: LocalizedNames, locale: Locale): string =>
  (locale === 'ar' ? named.nameAr : locale === 'fr' ? named.nameFr : null) ??
  named.name;
