/**
 * Choose a city out of a Mapbox forward lookup, for the venue snapshot.
 *
 * The snapshot used to take the first place Mapbox returned in the right country. For
 * "Sharm El-Shaikh" that was a village called Kafr El Sheikh in the Nile Delta, and for "Bahah" it
 * was Bahrah, near Jeddah, which reached the committed data. A place is now taken only when it
 * carries one of the city's own names, and the city's other names are tried when one finds
 * nothing, because the dataset's Latin spelling is often not Mapbox's.
 */

const ARTICLES = new Set(['el', 'al']);

const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const withoutArticles = (name) =>
  name
    .split(' ')
    .filter((word) => !ARTICLES.has(word))
    .join(' ');

const cityNames = (city) =>
  [city.name, city.nameFr, city.nameAr, city.slug?.replaceAll('-', ' ')]
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);

/**
 * The lookups to try for a city, in order: its name, its French name, its Arabic name, and last
 * its name with the article that Mapbox keeps and the dataset sometimes drops (Arish is "Al Arish").
 */
export const lookupsFor = (city) => {
  const lookups = [{ query: city.name, language: 'en' }];
  if (city.nameFr && city.nameFr !== city.name)
    lookups.push({ query: city.nameFr, language: 'en' });
  if (city.nameAr?.trim())
    lookups.push({ query: city.nameAr.trim(), language: 'ar' });
  const [firstWord] = normalize(city.name).split(' ');
  if (!ARTICLES.has(firstWord))
    lookups.push({ query: `Al ${city.name}`, language: 'en' });
  return lookups;
};

/** How a feature's own names meet the city's: 2 for the same name, 1 for containing it, else 0. */
const closeness = (feature, names) => {
  const candidates = [
    feature.properties?.name,
    feature.properties?.name_preferred,
  ]
    .filter(Boolean)
    .map(normalize);
  const isSame = (candidate, name) =>
    candidate === name ||
    (withoutArticles(candidate) !== '' &&
      withoutArticles(candidate) === withoutArticles(name));
  if (
    candidates.some((candidate) =>
      names.some((name) => isSame(candidate, name)),
    )
  )
    return 2;
  return candidates.some((candidate) =>
    names.some((name) => candidate.includes(name)),
  )
    ? 1
    : 0;
};

const isInside = ([west, south, east, north], [longitude, latitude]) =>
  longitude >= west &&
  longitude <= east &&
  latitude >= south &&
  latitude <= north;

const typeRank = (feature) =>
  feature.properties?.feature_type === 'place' ? 0 : 1;

/**
 * The centre and bounds of the feature that is this city, or null when none is.
 *
 * Only a feature in the market, with bounds around its own point and one of the city's names, is
 * considered. A place ranks above a locality, which is a part of a town; then the same name above
 * one that merely contains it, so Beni Suef is not New Beni Suef; then Mapbox's own order.
 */
export const pickCity = (features, city, market) => {
  const names = cityNames(city);
  const [best] = features
    .map((feature, order) => ({
      feature,
      order,
      bounds: feature.bbox ?? feature.properties?.bbox,
      score: closeness(feature, names),
    }))
    .filter(
      ({ feature, bounds, score }) =>
        score > 0 &&
        feature.properties?.context?.country?.country_code === market &&
        Array.isArray(bounds) &&
        isInside(bounds, feature.geometry.coordinates),
    )
    .sort(
      (a, b) =>
        typeRank(a.feature) - typeRank(b.feature) ||
        b.score - a.score ||
        a.order - b.order,
    );
  if (!best) return null;
  const [longitude, latitude] = best.feature.geometry.coordinates;
  return { center: { latitude, longitude }, bounds: best.bounds };
};
