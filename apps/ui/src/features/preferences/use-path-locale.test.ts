import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname: routerState.pathname } }),
}));

const { usePathLocale } = await import('./use-path-locale');

let writes: string[] = [];

beforeEach(() => {
  writes = [];
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(
    (value: string) => {
      writes.push(value);
    },
  );
});

afterEach(() => vi.restoreAllMocks());

describe('what a locale-prefixed page leaves behind', () => {
  it('remembers the language it was read in, so a later bare path serves it too', () => {
    routerState.pathname = '/fr/algeria/e/some-event';

    renderHook(() => usePathLocale());

    expect(writes).toEqual([
      'PARAGLIDE_LOCALE=fr; path=/; max-age=31536000; samesite=lax',
    ]);
  });

  it('writes nothing from a path that names no language', () => {
    routerState.pathname = '/login';

    renderHook(() => usePathLocale());

    expect(
      writes,
      'an unprefixed path settles from the stored language, so recording it would be circular',
    ).toEqual([]);
  });

  it('lets a prefix replace a language stored earlier, since it is what the reader is reading', () => {
    routerState.pathname = '/en/algeria';

    renderHook(() => usePathLocale());

    expect(writes).toEqual([
      'PARAGLIDE_LOCALE=en; path=/; max-age=31536000; samesite=lax',
    ]);
  });
});

const rootLayout = (): string =>
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../routes/__root.tsx'),
    'utf8',
  );

describe('where the hook is wired', () => {
  it('runs in the root layout, the only place that applies to every page', () => {
    expect(rootLayout()).toContain('usePathLocale()');
  });

  it('runs after the account language is reconciled, so a prefix has the last word', () => {
    const root = rootLayout();

    expect(root.indexOf('usePathLocale()')).toBeGreaterThan(
      root.indexOf('useStoredLocale(locale)'),
    );
  });
});
