/**
 * Snapshot nearby venues per featured city from OpenStreetMap.
 *
 * Run manually, never at request time: `node tools/osm/snapshot-venues.mjs [DZ|EG|SA]`.
 * Requires MAPBOX_TOKEN in apps/ui/.dev.vars — one forward geocode per city resolves the centre
 * and bounds that Overpass then queries inside, because GeoCity carries no coordinates.
 *
 * Mapbox indexes almost no cafés in Algiers or Cairo (verified: zero category results across the
 * Algiers wilaya), so OSM is the only source with real data in those markets. Overpass rejects
 * bursts, which is precisely why this is an offline script and not a server function.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readGeoRecords } from '../geo/geo-records.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = `${ROOT}/.osm-snapshot`;
/*
 * Planet-wide Overpass instances only. `overpass.osm.ch` serves a Swiss regional extract: it
 * answers 200 with an empty result for anything outside its bbox, which silently recorded Algiers
 * and Cairo as having no cafés at all. A mirror must be verified against a non-European city
 * before it joins this list.
 */
const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const MAPBOX = 'https://api.mapbox.com/search/searchbox/v1/forward';
const THROTTLE_MS = 4000;
/* Overpass mirrors reject a default runtime User-Agent with a plain-text notice rather than JSON, */
/* and OSM's usage policy asks for an identifying one. Without this every query silently returns */
/* nothing and every city looks like it has no cafés. */
const USER_AGENT =
  'founders-coffee-venue-snapshot/1.0 (+https://founders.coffee)';

const token = readFileSync(`${ROOT}/apps/ui/.dev.vars`, 'utf8')
  .split('\n')
  .find((line) => line.startsWith('MAPBOX_TOKEN='))
  ?.slice('MAPBOX_TOKEN='.length)
  .trim();
if (!token) throw new Error('MAPBOX_TOKEN missing from apps/ui/.dev.vars');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readCities = (market) => {
  const file = `${ROOT}/libs/domain/src/geo/data/${market.toLowerCase()}.ts`;
  const source = readFileSync(file, 'utf8');
  return readGeoRecords(source, `${market.toUpperCase()}_CITIES`).filter(
    (city) => city.featured,
  );
};

const resolveCity = async (market, city) => {
  const url = new URL(MAPBOX);
  url.search = new URLSearchParams({
    q: `${city.name}, ${market}`,
    country: market,
    language: 'en',
    limit: '5',
    types: 'city,place,locality',
    access_token: token,
  }).toString();
  const response = await fetch(url);
  if (!response.ok) return null;
  const body = await response.json();
  const feature = (body.features ?? []).find(
    (f) => f.properties?.context?.country?.country_code === market,
  );
  const bounds = feature?.bbox ?? feature?.properties?.bbox;
  if (!feature || !bounds) return null;
  const [longitude, latitude] = feature.geometry.coordinates;
  return { center: { latitude, longitude }, bounds };
};

const CATEGORY_BY_TAGS = (tags) => {
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'coworking_space' || tags.office === 'coworking')
    return 'coworking';
  if (tags.amenity === 'restaurant') return 'restaurant';
  return null;
};

/*
 * A house number on its own is not an address. `addr:housenumber=1` with no street produced the
 * string "1", which is truthy enough to beat every fallback and short enough to fail the event
 * schema's two-character venue-address bound — a venue the host can select but never publish.
 */
const addressOf = (tags) => {
  const street = tags['addr:street']
    ? [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
    : '';
  const candidate = (
    street ||
    tags['addr:suburb'] ||
    tags['addr:city'] ||
    ''
  ).trim();
  return candidate.length >= 2 ? candidate : '';
};

/**
 * Keep "nearby" honest and the query cheap.
 *
 * A city's administrative bounds can span a whole Saharan wilaya; Overpass times out on those and
 * a café 200km away is not nearby by any reading. Bounds are clamped to a ~55km box around the
 * centre before querying.
 */
const clampBounds = (bounds, center) => {
  const span = 0.25;
  const [w, s, e, n] = bounds;
  return [
    Math.max(w, center.longitude - span),
    Math.max(s, center.latitude - span),
    Math.min(e, center.longitude + span),
    Math.min(n, center.latitude + span),
  ];
};

const overpass = async (bounds) => {
  const [w, s, e, n] = bounds;
  const box = `${s},${w},${n},${e}`;
  const query = `[out:json][timeout:60];(node["amenity"~"^(cafe|coworking_space|restaurant)$"](${box});way["amenity"~"^(cafe|coworking_space|restaurant)$"](${box});node["office"="coworking"](${box});way["office"="coworking"](${box}););out center;`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const endpoint = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'user-agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) {
        /* Mirrors answer 200 with a plain-text notice or an XML error page when they are busy or */
        /* unhappy with the request, and 200 with a `remark` when a query ran out of memory. Any of */
        /* those parsed as "no results" would silently record a city as having no cafés at all. */
        const body = JSON.parse(await response.text());
        if (!body.remark && Array.isArray(body.elements)) return body.elements;
      }
    } catch {
      /* mirror unreachable — fall through to the next one */
    }
    await sleep(THROTTLE_MS * (attempt + 1));
  }
  return null;
};

const toVenue = (element) => {
  const tags = element.tags ?? {};
  const category = CATEGORY_BY_TAGS(tags);
  const name = tags['name:ar'] || tags.name;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!category || !name || latitude == null || longitude == null) return null;
  return {
    providerId: `osm:${element.type}/${element.id}`,
    kind: 'poi',
    name,
    nameLatin: tags.name ?? name,
    address: addressOf(tags),
    latitude,
    longitude,
    category,
    eligible: category !== 'restaurant',
  };
};

/*
 * Drop mirrors that cannot be reached from this machine before starting.
 * Otherwise every retry alternates between a working instance and a dead one, and each city pays
 * a connection timeout it did not need to.
 */
const reachableMirrors = async () => {
  const probe =
    '[out:json][timeout:10];node["amenity"="cafe"](47.37,8.54,47.38,8.55);out 1;';
  const live = [];
  for (const endpoint of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'user-agent': USER_AGENT },
        body: new URLSearchParams({ data: probe }),
      });
      if (response.ok) {
        JSON.parse(await response.text());
        live.push(endpoint);
      }
    } catch {
      /* unreachable from here */
    }
  }
  return live;
};

const main = async () => {
  const markets = process.argv[2] ? [process.argv[2]] : ['DZ', 'EG', 'SA'];
  const live = await reachableMirrors();
  if (live.length === 0) throw new Error('no Overpass mirror reachable');
  OVERPASS_MIRRORS.length = 0;
  OVERPASS_MIRRORS.push(...live);
  console.log(
    `using ${live.length} mirror(s): ${live.map((m) => new URL(m).host).join(', ')}`,
  );
  mkdirSync(OUT_DIR, { recursive: true });
  const index = {};
  for (const market of markets) {
    for (const city of readCities(market)) {
      const target = `${OUT_DIR}/${market}-${city.code}.json`;
      if (existsSync(target)) continue;
      const viewport = await resolveCity(market, city);
      if (!viewport) {
        console.log(
          `skip ${market}/${city.code} ${city.name}: city not resolved`,
        );
        continue;
      }
      await sleep(THROTTLE_MS);
      const elements = await overpass(
        clampBounds(viewport.bounds, viewport.center),
      );
      if (elements === null) {
        console.log(
          `skip ${market}/${city.code} ${city.name}: overpass failed`,
        );
        continue;
      }
      const venues = elements.map(toVenue).filter(Boolean);
      venues.sort((a, b) =>
        a.eligible === b.eligible
          ? a.name.localeCompare(b.name)
          : a.eligible
            ? -1
            : 1,
      );
      const payload = {
        market,
        cityCode: city.code,
        ...viewport,
        venues: [
          ...venues.filter((venue) => venue.eligible).slice(0, 50),
          ...venues.filter((venue) => !venue.eligible).slice(0, 8),
        ],
      };
      writeFileSync(target, `${JSON.stringify(payload)}\n`);
      index[`${market}-${city.code}`] = payload.venues.length;
      console.log(
        `${market}/${city.code} ${city.name}: ${payload.venues.length} venues`,
      );
      await sleep(THROTTLE_MS);
    }
  }
  console.log(`\nwrote ${Object.keys(index).length} city files to ${OUT_DIR}`);
};

await main();
