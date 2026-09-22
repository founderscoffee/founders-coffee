import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type Kind = 'protocol' | 'redirect' | 'unresolved' | 'root';

type Exemption = { readonly kind: Kind; readonly why: string };

const UNPREFIXED: Readonly<Record<string, Exemption>> = {
  '/': {
    kind: 'root',
    why: 'names no market yet, so it has no locale to prefix with; it redirects once a market can be named and renders the chooser when one cannot',
  },

  '/events.json': { kind: 'protocol', why: 'machine-readable feed' },
  '/og/e/$id': {
    kind: 'protocol',
    why: 'an image for link scrapers, which have no language of their own to prefix for; the card is drawn in the language the `l` parameter names, set by the page that publishes the address',
  },
  '/llms.txt': { kind: 'protocol', why: 'protocol file' },
  '/robots.txt': { kind: 'protocol', why: 'protocol file' },
  '/sitemap.xml': {
    kind: 'protocol',
    why: 'protocol file, and it carries the localised URLs itself',
  },
  '/sw.js': {
    kind: 'protocol',
    why: 'service worker scope, which must sit at the origin root',
  },
  '/.well-known/security.txt': {
    kind: 'protocol',
    why: 'RFC 9116 fixes the path',
  },

  '/about': { kind: 'redirect', why: 'company page stub' },
  '/community': { kind: 'redirect', why: 'company page stub' },
  '/contact': { kind: 'redirect', why: 'company page stub' },
  '/cookies': { kind: 'redirect', why: 'company page stub' },
  '/faq': { kind: 'redirect', why: 'company page stub' },
  '/legal': { kind: 'redirect', why: 'company page stub' },
  '/organizers': { kind: 'redirect', why: 'company page stub' },
  '/privacy': { kind: 'redirect', why: 'company page stub' },
  '/terms': { kind: 'redirect', why: 'company page stub' },
  '/account': {
    kind: 'redirect',
    why: 'legacy address, now under /{locale}/profile',
  },
  '/activity': {
    kind: 'redirect',
    why: 'legacy address, now under /{locale}/profile',
  },
  '/preferences': {
    kind: 'redirect',
    why: 'legacy address, now under /{locale}/profile',
  },
  '/closeout/$eventId': {
    kind: 'redirect',
    why: '8f59f74 — notifications already enqueued carry this address',
  },
  '/feedback/$eventId': {
    kind: 'redirect',
    why: '8f59f74 — notifications already enqueued carry this address',
  },
  '/edit/$eventId': {
    kind: 'redirect',
    why: '#14 — renders nothing; it answers the locale-free address with the prefixed one',
  },

  '/login': {
    kind: 'unresolved',
    why: '#58 — renders in the cookie language, so a French reader following a French link signs in in Arabic',
  },
  '/onboarding': {
    kind: 'unresolved',
    why: '#58 — same as /login, behind requireSession',
  },
  '/profile': { kind: 'unresolved', why: '#58' },
  '/profile/': { kind: 'unresolved', why: '#58' },
  '/profile/account': { kind: 'unresolved', why: '#58' },
  '/profile/activity': { kind: 'unresolved', why: '#58' },
  '/profile/notifications': { kind: 'unresolved', why: '#58' },
  '/u/$userId': {
    kind: 'unresolved',
    why: '#58 — a public profile, so this one is also a crawler-visible address with no locale',
  },
};

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/**
 * Every route the generator declared, paired with the file it came from.
 *
 * Read out of `routeTree.gen.ts` as text rather than by importing it. Importing would pull in every
 * route module and everything they render, to answer a question about addresses; the generated file
 * already states the answer, and it is regenerated and committed by `nx sync`, so reading it is
 * reading the same source of truth the router uses.
 */
const declaredRoutes = (): { fullPath: string; file: string }[] => {
  const source = read('../routeTree.gen.ts');
  const imports = new Map(
    [
      ...source.matchAll(/import \{ Route as (\w+) \} from '\.\/([^']+)'/gu),
    ].map((match) => [match[1] as string, match[2] as string]),
  );

  const declarations = source.slice(
    source.indexOf('interface FileRoutesByPath {'),
  );
  return [
    ...declarations.matchAll(
      /fullPath: '([^']*)'\s*preLoaderRoute: typeof (\w+)/gu,
    ),
  ].map((match) => ({
    fullPath: match[1] as string,
    file: imports.get(match[2] as string) ?? '',
  }));
};

const sourceOf = (file: string): string => {
  for (const extension of ['.tsx', '.ts'])
    try {
      return read(`../${file}${extension}`);
    } catch {
      continue;
    }
  return '';
};

/**
 * The routes that carry no locale, which are the only ones `UNPREFIXED` has anything to say about.
 *
 * The four kinds that map records are not interchangeable. `protocol` is a machine-readable file
 * with no reader to serve a language to. `redirect` is a stub that answers 307 to its prefixed form
 * and renders nothing — the addresses already sitting in somebody's inbox, which is why `8f59f74`
 * kept them rather than deleting them. `root` is `/` alone, which names no market yet. `unresolved`
 * is a page that really does render in whatever language the cookie happens to say: a defect with
 * an issue behind it rather than a decision, and the gate makes each one cost a line in that map
 * until it is fixed.
 */
const unprefixed = () =>
  declaredRoutes().filter(({ fullPath }) => !fullPath.startsWith('/$market'));

describe('the locale contract', () => {
  it('reads the generated tree', () => {
    const routes = declaredRoutes();
    expect(
      routes.length,
      'the generated tree parsed to nothing, so every assertion below is vacuous',
    ).toBeGreaterThan(30);
    expect(routes.every(({ file }) => file !== '')).toBe(true);
  });

  it('prefixes every route, or says in writing why this one cannot be', () => {
    const undeclared = unprefixed()
      .filter(({ fullPath }) => !(fullPath in UNPREFIXED))
      .map(
        ({ fullPath, file }) =>
          `${fullPath} (${file}) carries no locale and is not in UNPREFIXED — prefix it with /$market, or add an entry saying why it cannot be`,
      );

    expect(undeclared, undeclared.join('\n')).toEqual([]);
  });

  it('holds no exemption for a route that no longer exists', () => {
    const live = new Set(declaredRoutes().map(({ fullPath }) => fullPath));
    for (const fullPath of Object.keys(UNPREFIXED))
      expect(
        live.has(fullPath),
        `${fullPath} is exempted but is no longer a route — delete the entry`,
      ).toBe(true);
  });

  it('gives every exemption a reason, and every unresolved one an issue', () => {
    for (const [fullPath, { kind, why }] of Object.entries(UNPREFIXED)) {
      expect(why.trim(), `${fullPath} is exempted without saying why`).not.toBe(
        '',
      );
      if (kind === 'unresolved')
        expect(
          why,
          `${fullPath} is recorded as an open defect with no issue to close it against`,
        ).toMatch(/#\d+/u);
    }
  });

  /**
   * A stub that grew a component stopped being a stub.
   *
   * These addresses are the ones already printed in notifications and linked from elsewhere, and
   * their whole contract is that they hand the reader to the prefixed page rather than answering in
   * the cookie's language. Rendering anything here would reintroduce `8f59f74` quietly, on a route
   * nobody is looking at, so the shape is asserted rather than trusted.
   */
  it('keeps every redirect stub a redirect', () => {
    for (const { fullPath, file } of unprefixed()) {
      if (UNPREFIXED[fullPath]?.kind !== 'redirect') continue;
      const body = sourceOf(file);
      expect(body, `${fullPath}: could not read ${file}`).not.toBe('');
      expect(
        body,
        `${fullPath} is exempted as a redirect stub but declares a component — it now renders in the cookie's language`,
      ).not.toMatch(/\bcomponent:/u);
      expect(
        body,
        `${fullPath} is exempted as a redirect stub but has no beforeLoad, so nothing sends the reader to the prefixed page`,
      ).toMatch(/\bbeforeLoad\b/u);
    }
  });
});

/**
 * The routes that render nothing and exist only to hand the reader somewhere else.
 *
 * Read out of the tree rather than listed by hand, because a list by hand is what went stale:
 * `5f7a5f3` recorded that "every redirect-only route is now `preload: false`" and named seven, and
 * two more have been added to the tree since without anyone revisiting the sentence.
 *
 * A route qualifies when it declares no component, or one that renders `null`, and names a
 * redirect. Both exclusions carry weight. `/sw.js` renders `null` but throws `notFound`, which is
 * not a redirect and has nothing to opt out of. `/og/e/$id` does answer a redirect, but from a
 * `server` handler, which no `<Link>` can preload.
 */
const redirectOnlyRoutes = () =>
  declaredRoutes().filter(({ file }) => {
    const body = sourceOf(file);
    const rendersNothing =
      !/\bcomponent:/u.test(body) || /\bcomponent: \(\) => null\b/u.test(body);
    return (
      rendersNothing && /redirect/iu.test(body) && !/\bserver: \{/u.test(body)
    );
  });

/**
 * The window the router keeps a preloaded match fresh for, read through the constant that names it.
 *
 * Reading the call site alone would take `defaultPreloadStaleTime: PRELOAD_STALE_TIME_MS` at its
 * word, and the window can be closed just as well by zeroing the constant as by zeroing the call.
 * An expression this cannot resolve reads as `NaN`, which fails the assertion rather than passing
 * it, because a window nobody can read is not one anybody should be trusting.
 */
const preloadWindowMs = (): number => {
  const source = read('../router.tsx');
  const set = /defaultPreloadStaleTime: ([\w.]+),/u.exec(source)?.[1] ?? '';
  const literal = /^\d[\d_]*$/u.test(set)
    ? set
    : (new RegExp(`const ${set} = ([\\d_]+)`, 'u').exec(source)?.[1] ?? '');
  return Number(literal.replaceAll('_', ''));
};

describe('the preload contract', () => {
  it('finds the redirect-only routes, in both the shapes they come in', () => {
    const bodies = redirectOnlyRoutes().map(({ file }) => sourceOf(file));

    expect(
      bodies.length,
      'no route matched, so the assertions below pass without having read anything',
    ).toBeGreaterThan(10);
    expect(
      bodies.some((body) => !/\bcomponent:/u.test(body)),
      'nothing matched by declaring no component at all, which is the shape the company stubs have',
    ).toBe(true);
    expect(
      bodies.some((body) => /\bcomponent: \(\) => null\b/u.test(body)),
      'nothing matched by rendering null, which is the shape /$market/ and /$market/e/$slug have, and the one a narrowed filter would drop first',
    ).toBe(true);
  });

  it('keeps every redirect-only route out of preloading', () => {
    const preloadable = redirectOnlyRoutes()
      .filter(({ file }) => !/\bpreload: false\b/u.test(sourceOf(file)))
      .map(({ fullPath, file }) => `${fullPath} (${file})`);

    expect(
      preloadable,
      `these routes render nothing and throw a redirect, so preloading one spends requests to produce a page that draws nothing, and with a preload window open it also lets a cached match answer the click instead of the redirect:\n${preloadable.join('\n')}`,
    ).toEqual([]);
  });

  it('leaves the preload window open, which those opt-outs are what allow', () => {
    expect(
      preloadWindowMs(),
      'a window of 0 refetches the route under the cursor on every hover, which measured 13 requests for three hovers of one card against 7 with the window open. 518c334 closed it because redirect-only routes could still be preloaded; the assertion above is what holds that shut now, so the window no longer has to be the thing that does it',
    ).toBeGreaterThan(0);
  });
});
