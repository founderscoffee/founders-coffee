/**
 * Build the ISO 3166-2 -> GeoState.code table by asking Mapbox for each state we know.
 *
 * Run manually: `node tools/geo/probe-admin-codes.mjs`, then review the report before committing
 * the generated module. Our state codes are NOT ISO: Algeria's post-2019 wilayas disagree outright
 * (we call In Salah 53, Mapbox calls it DZ-57), and Egypt and Saudi use different alphabets
 * entirely. Nothing here may be assumed — every row is probed and every row is reviewed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = `${ROOT}/libs/domain/src/geo/admin-codes.ts`;
const MARKETS = ['DZ', 'EG', 'SA'];
const THROTTLE_MS = 250;

const token = readFileSync(`${ROOT}/apps/ui/.dev.vars`, 'utf8')
  .split('\n')
  .find((line) => line.startsWith('MAPBOX_TOKEN='))
  ?.slice('MAPBOX_TOKEN='.length)
  .trim();
if (!token) throw new Error('MAPBOX_TOKEN missing from apps/ui/.dev.vars');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readStates = (market) => {
  const src = readFileSync(
    `${ROOT}/libs/domain/src/geo/data/${market.toLowerCase()}.ts`,
    'utf8',
  );
  const head = src.slice(0, src.indexOf('_CITIES'));
  /* Names are single- or double-quoted: "M'Sila" carries an apostrophe. */
  return [
    ...head.matchAll(
      /\{ code: '([^']+)', name: (?:'([^']*)'|"([^"]*)"), nameAr:/g,
    ),
  ].map((m) => ({ code: m[1], name: m[2] ?? m[3] }));
};

const probe = async (market, state) => {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.search = new URLSearchParams({
    q: state.name,
    country: market,
    types: 'region',
    language: 'en',
    limit: '3',
    access_token: token,
  }).toString();
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = await response.json();
    const hits = (body.features ?? [])
      .map((f) => ({
        name: f.properties?.name,
        iso: f.properties?.context?.region?.region_code_full,
      }))
      .filter((h) => h.iso?.startsWith(`${market}-`));
    return hits;
  } catch {
    return null;
  }
};

const main = async () => {
  const tables = {};
  const review = [];
  for (const market of MARKETS) {
    tables[market] = {};
    for (const state of readStates(market)) {
      const hits = await probe(market, state);
      await sleep(THROTTLE_MS);
      if (!hits || hits.length === 0) {
        review.push(`${market} ${state.code} ${state.name}: NO MATCH`);
        continue;
      }
      const [best] = hits;
      tables[market][best.iso] = state.code;
      const exact = best.name?.toLowerCase() === state.name.toLowerCase();
      if (!exact || hits.length > 1) {
        review.push(
          `${market} ${state.code} "${state.name}" -> ${best.iso} "${best.name}"` +
            (hits.length > 1
              ? ` (also ${hits
                  .slice(1)
                  .map((h) => h.iso)
                  .join(', ')})`
              : ''),
        );
      }
    }
  }

  const duplicates = [];
  for (const market of MARKETS) {
    const seen = new Map();
    for (const [iso, code] of Object.entries(tables[market])) {
      if (seen.has(code))
        duplicates.push(
          `${market}: ${iso} and ${seen.get(code)} both -> ${code}`,
        );
      seen.set(code, iso);
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const body = MARKETS.map(
    (m) =>
      `  ${m}: ${JSON.stringify(tables[m], null, 4).replace(/\n/g, '\n  ')},`,
  ).join('\n');
  writeFileSync(
    OUT,
    `export const ISO_STATE_CODES: Readonly<\n  Record<string, Readonly<Record<string, string>>>\n> = {\n${body}\n};\n`,
  );

  console.log('--- review these by hand ---');
  for (const line of review) console.log(' ', line);
  if (duplicates.length > 0) {
    console.log(
      '--- DUPLICATES (two ISO codes mapped to one of our states) ---',
    );
    for (const line of duplicates) console.log(' ', line);
  }
  for (const market of MARKETS) {
    console.log(
      `${market}: ${Object.keys(tables[market]).length} mapped of ${readStates(market).length} states`,
    );
  }
};

await main();
