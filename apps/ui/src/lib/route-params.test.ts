import { describe, expect, it } from 'vitest';

import { declaredRoutes, sourceOf } from './route-contract.fixtures';

const LOCALE_SEGMENT = '/$locale';

const GUARD_FILE = 'routes/$locale';

const prefixed = () =>
  declaredRoutes().filter(({ fullPath }) => fullPath.startsWith('/$'));

/**
 * The route files that ask what kind of value one of their own parameters holds.
 *
 * `isLocale(params.x)` is the signature of a segment carrying two kinds of value: a route that
 * knows what its parameter is does not have to test it. One file may still ask — the layout that
 * turns an unprefixed address into a prefixed one — and that is the whole point of concentrating
 * it there, so the count is what is asserted rather than the absence.
 */
const filesTestingTheirOwnParams = (): string[] =>
  declaredRoutes()
    .filter(({ file }) => /isLocale\(\s*params\./u.test(sourceOf(file)))
    .map(({ file }) => file);

describe('what each route segment is named for', () => {
  it('reads the generated tree', () => {
    expect(
      prefixed().length,
      'no parameterised routes parsed out of the tree, so every assertion below is vacuous',
    ).toBeGreaterThan(10);
  });

  it('names the segment that holds a language after the language', () => {
    const misnamed = prefixed()
      .filter(({ fullPath }) => !fullPath.startsWith(LOCALE_SEGMENT))
      .map(
        ({ fullPath, file }) =>
          `${fullPath} (${file}) opens on a parameter that holds a locale but is not called $locale`,
      );

    expect(misnamed, misnamed.join('\n')).toEqual([]);
  });

  it('leaves no route asking what its own segment holds', () => {
    const asking = filesTestingTheirOwnParams();

    expect(
      asking,
      `a route that tests its own parameter is a route whose parameter carries two kinds of value; the next one added under it has to guess which, and guessing wrong renders a page in the reader's cookie language rather than the URL's, which resolves, renders and answers 200:\n${asking.join('\n')}`,
    ).toEqual([]);
  });

  it('answers an unprefixed address once, on the layout the rest inherit from', () => {
    const guard = sourceOf(GUARD_FILE);

    expect(guard, `could not read ${GUARD_FILE}`).not.toBe('');
    expect(
      guard,
      'the layout every prefixed address passes through is the one place that can settle this for all of them',
    ).toMatch(/beforeLoad/u);
    expect(
      guard,
      'settling it means sending the reader to the prefixed address, not rendering something in its place',
    ).toMatch(/redirect\(/u);
    expect(
      guard,
      'an address that names neither a language nor a market is not an address here, and saying so with a redirect would hand the shared cache a hop to keep',
    ).toMatch(/notFound\(/u);
  });
});
