/**
 * Turn the raw Overpass snapshot into the committed TypeScript modules the app imports.
 *
 * Kept separate from the fetch so the slow, rate-limited network pass never has to be repeated to
 * change the shape of what ships. Run: `node tools/osm/build-venue-modules.mjs`.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const IN_DIR = `${ROOT}/.osm-snapshot`;
const OUT_DIR = `${ROOT}/libs/domain/src/venues/data`;
const MARKETS = ['DZ', 'EG', 'SA'];

/**
 * City names, so a venue with no OSM address tags still says where it is.
 *
 * Most Algerian cafés carry no `addr:*` tags at all, and an empty address fails the event schema's
 * venue-address bound — a venue that cannot be published is worse than a vague one. The Latin name
 * is used rather than the Arabic one because the snapshot stores a single string for every locale,
 * and most OSM venue names in these markets are Latin anyway.
 */
const cityNames = (market) => {
  const src = readFileSync(
    `${ROOT}/libs/domain/src/geo/data/${market.toLowerCase()}.ts`,
    'utf8',
  );
  const names = {};
  const re =
    /\{\s*code:\s*'([^']+)',\s*name:\s*'([^']*)',\s*nameAr:\s*'([^']*)'/g;
  for (const m of src.matchAll(re)) names[m[1]] = { name: m[2], nameAr: m[3] };
  return names;
};

mkdirSync(OUT_DIR, { recursive: true });
const files = (() => {
  try {
    return readdirSync(IN_DIR).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
})();

for (const market of MARKETS) {
  const cities = {};
  const names = cityNames(market);
  for (const file of files.filter((name) => name.startsWith(`${market}-`))) {
    const snapshot = JSON.parse(readFileSync(`${IN_DIR}/${file}`, 'utf8'));
    const fallback = names[snapshot.cityCode];
    snapshot.venues = snapshot.venues
      .map((venue) => ({
        ...venue,
        address:
          venue.address.trim().length >= 2
            ? venue.address
            : fallback
              ? fallback.name
              : '',
      }))
      .filter((venue) => venue.address.trim().length >= 2);
    /*
     * Ineligible venues exist to teach the rule — a host who expected the restaurant next door
     * sees why it is not offered. A handful does that; the rest is payload nobody can select.
     */
    const eligible = snapshot.venues.filter((venue) => venue.eligible);
    const ineligible = snapshot.venues.filter((venue) => !venue.eligible);
    snapshot.venues = [...eligible.slice(0, 50), ...ineligible.slice(0, 6)];
    if (snapshot.venues.length > 0) cities[snapshot.cityCode] = snapshot;
  }
  const constant = `${market}_CITY_VENUES`;
  writeFileSync(
    `${OUT_DIR}/${market.toLowerCase()}.ts`,
    `import type { CityVenueSnapshot } from '../types.js';\n\n` +
      `export const ${constant}: Record<string, CityVenueSnapshot> = ${JSON.stringify(cities, null, 2)};\n`,
  );
  console.log(
    `${market}: ${Object.keys(cities).length} cities, ${Object.values(cities).reduce((n, c) => n + c.venues.length, 0)} venues`,
  );
}
