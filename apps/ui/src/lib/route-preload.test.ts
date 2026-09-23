import { describe, expect, it } from 'vitest';

import { declaredRoutes, read, sourceOf } from './route-contract.fixtures';

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
      'nothing matched by rendering null, which is the shape /$locale/ and /$locale/e/$slug have, and the one a narrowed filter would drop first',
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
