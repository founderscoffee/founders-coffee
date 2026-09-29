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

const COMBINING_MARKS = /\p{M}/gu;
const TATWEEL = /ـ/gu;
const ALEF_FORMS = /[آأإٱ]/gu;
const ALEF = 'ا';
const ALEF_MAQSURA = /ى/gu;
const YAA = 'ي';
const TAA_MARBUTA = /ة/gu;
const HAA = 'ه';
const WHITESPACE = /\s+/gu;

/**
 * One spelling of a name, so that two spellings of the same name compare equal.
 *
 * Arabic is written with several characters a reader treats as one. `أ`, `إ` and `آ` are all alef;
 * `ة` is a final `ه` in most hands; `ى` and `ي` are used for each other freely. The short vowels
 * are optional and usually absent, and tatweel stretches a word without changing it. None of that
 * is spelling variation the person typing intends, so a search that compares as written answers a
 * query about `مقهى` with nothing while holding a venue recorded as `مقهي حيدرة`.
 *
 * `NFKD` does most of it: decomposing `أ` leaves an alef with a hamza above it, and the hamza is a
 * combining mark like any French accent, so one pass over `\p{M}` removes both. The rest are
 * characters in their own right rather than marks, and are folded by hand.
 *
 * Lives in core rather than beside the venue search that first needed it because the place search
 * asks the same question of the geography datasets, whose Arabic names carry a hamza wherever one
 * is written: two copies would fold differently the first time one of them was taught a new letter.
 */
export const foldForSearch = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(TATWEEL, '')
    .replace(ALEF_FORMS, ALEF)
    .replace(ALEF_MAQSURA, YAA)
    .replace(TAA_MARBUTA, HAA)
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();

/**
 * A test of whether a place answers to `query` under any of the names it carries, rather than
 * only the one the reader is being shown. It is made once per query because a search puts it to
 * every place in a market, thousands of them, and the query need only be folded once.
 *
 * Searching a single locale's name is wrong in both directions: a French visitor pastes `Alger`
 * out of a message written in Arabic, and someone reading in Arabic types `Bejaia` off a road
 * sign (FC-28). Latin names compare case-insensitively and are not accent-folded, which costs
 * nothing today because a place whose French name carries accents keeps the bare spelling in
 * `name`. The Arabic name compares through `foldForSearch`, query and name alike, because Arabic
 * is mostly typed without the hamza the datasets write: `ابها` has to find `أبها`. A query that
 * folds away to nothing, such as a lone tatweel, is not taken to be inside every Arabic name.
 */
export const localizedNameMatcher = (
  query: string,
): ((named: LocalizedNames) => boolean) => {
  const lowered = query.toLowerCase();
  const folded = foldForSearch(query);
  return (named) =>
    named.name.toLowerCase().includes(lowered) ||
    (folded !== '' && foldForSearch(named.nameAr ?? '').includes(folded)) ||
    (named.nameFr?.toLowerCase().includes(lowered) ?? false);
};
