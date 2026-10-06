import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

const MAP_LIBRARY =
  /^(?:mapbox-gl|react-map-gl|@vis\.gl\/react-mapbox)(?:\/|$)/u;

const STATIC_IMPORT =
  /^(?:import|export)(\s+type)?\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/gmu;

const BARE_IMPORT = /^import\s*['"]([^'"]+)['"]/gmu;

const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/gu;

const MODULE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

const POLICIES =
  'the cookie policy (cookies.ts, legal-en-cookies.ts, legal-fr-cookies.ts) and the privacy policy (privacy-data.ts, legal-en-privacy.ts, legal-fr-privacy.ts) tell readers that only creating a meetup and editing its venue load Mapbox’s map library, which keeps an identifier in local storage and sends it to Mapbox: correct both in ar, fr and en, and date them, before changing this list';

const SOURCES = new Map(
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter(
      (name) => /\.tsx?$/u.test(name) && !/\.(?:test|fixtures)\./u.test(name),
    )
    .map((name) => [name, readFileSync(join(SRC, name), 'utf8')] as const),
);

/**
 * The modules a source file loads when it runs. A type-only import loads nothing, so it is left out.
 */
const runtimeSpecifiers = (source: string): string[] => [
  ...[...source.matchAll(STATIC_IMPORT)]
    .filter(([, typeOnly]) => typeOnly === undefined)
    .map(([, , specifier]) => specifier),
  ...[...source.matchAll(BARE_IMPORT)].map(([, specifier]) => specifier),
  ...[...source.matchAll(DYNAMIC_IMPORT)].map(([, specifier]) => specifier),
];

/**
 * The source file a relative specifier names, or null for a package or anything outside the scan.
 */
const resolveSource = (importer: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null;
  const base = join(dirname(importer), specifier);
  return (
    MODULE_SUFFIXES.map((suffix) => base + suffix).find((candidate) =>
      SOURCES.has(candidate),
    ) ?? null
  );
};

const IMPORTERS = new Map<string, string[]>();

for (const [file, source] of SOURCES)
  for (const specifier of runtimeSpecifiers(source)) {
    const target = resolveSource(file, specifier);
    if (target) IMPORTERS.set(target, [...(IMPORTERS.get(target) ?? []), file]);
  }

/**
 * Every source file that loads one of `files`, directly or through other files, `files` included.
 */
const loadersOf = (files: readonly string[]): Set<string> => {
  const reached = new Set(files);
  for (const file of reached)
    for (const importer of IMPORTERS.get(file) ?? []) reached.add(importer);
  return reached;
};

const LIBRARY_LOADERS = [...SOURCES]
  .filter(([, source]) =>
    runtimeSpecifiers(source).some((specifier) => MAP_LIBRARY.test(specifier)),
  )
  .map(([file]) => file)
  .sort();

const PAGES = [...loadersOf(LIBRARY_LOADERS)]
  .filter((file) => file.startsWith('routes/'))
  .sort();

describe('the pages the policies say load Mapbox’s map library', () => {
  it('reads the app’s source, so a scan that matched nothing cannot pass', () => {
    expect(SOURCES.size).toBeGreaterThan(300);
    expect(IMPORTERS.size).toBeGreaterThan(200);
  });

  it('loads the library only from the host’s map', () => {
    expect(LIBRARY_LOADERS, POLICIES).toEqual([
      'components/host/HostMap.tsx',
      'lib/mapbox-csp.ts',
    ]);
  });

  it('reaches it from creating a meetup and editing its venue, and from no other page', () => {
    expect(PAGES, POLICIES).toEqual([
      'routes/$locale.$market.host.create.tsx',
      'routes/$locale.edit.$eventId.tsx',
    ]);
  });
});
