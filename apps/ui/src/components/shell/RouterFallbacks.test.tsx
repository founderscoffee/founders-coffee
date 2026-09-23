import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

const state = {
  locale: 'ar' as Locale,
  marketSlug: 'algeria' as string | null,
};

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [name, value]) => path.replace(`$${name}`, value),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (s: {
      matches: readonly { routeId: string; context: unknown }[];
    }) => unknown;
  }) =>
    select({
      matches: [
        {
          routeId: '__root__',
          context: {
            locale: state.locale,
            activeMarket:
              state.marketSlug === null
                ? undefined
                : { slug: state.marketSlug },
          },
        },
      ],
    }),
}));

vi.mock('@founders-coffee/observability', () => ({
  logger: {},
  reportError: vi.fn(),
}));

const { RouterError, RouterNotFound } = await import('./RouterFallbacks');

const lost = (locale: Locale, marketSlug: string | null = 'algeria') => {
  state.locale = locale;
  state.marketSlug = marketSlug;
  return render(<RouterNotFound />);
};

afterEach(() => cleanup());

describe('the page a visitor lands on when nothing matched', () => {
  it('says what it is at the top level of the document', () => {
    lost('ar');

    expect(
      screen.getByRole('heading', { level: 1 }).textContent,
      'the page named itself in an h2, level with the footer column labels, so its own subject sat below nothing',
    ).toBe('الصفحة غير موجودة');
  });

  it.each<Locale>(['ar', 'en', 'fr'])(
    'keeps the %s reader in their own language on the way out',
    (locale) => {
      lost(locale);

      expect(
        screen.getByRole('link').getAttribute('href'),
        'the one way off this page pointed at the unprefixed root, which settles from a cookie the visitor may never have been given',
      ).toBe(`/${locale}/algeria`);
    },
  );

  it('offers somewhere worth going rather than only a way back', () => {
    lost('en');

    expect(
      screen.getByRole('link').textContent,
      'a 404 on a product about finding meetups should hand the reader the list of them',
    ).toBe('Explore meetups');
  });

  it('falls back to the root when no market could be resolved at all', () => {
    lost('ar', null);

    expect(
      screen.getByRole('link').getAttribute('href'),
      'the one case with nowhere in particular to send them is the one where the market list itself did not load, and / is what detects a market from scratch',
    ).toBe('/');
  });
});

describe('the page a visitor lands on when something broke', () => {
  const broke = (locale: Locale) => {
    state.locale = locale;
    state.marketSlug = 'algeria';
    return render(<RouterError error={new Error('boom')} />);
  };

  it('names itself at the top level, the same as every other page', () => {
    broke('ar');

    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe('');
  });

  it.each<Locale>(['ar', 'en', 'fr'])(
    'sends the %s reader home in their own language',
    (locale) => {
      broke(locale);

      expect(screen.getByRole('link').getAttribute('href')).toBe(
        `/${locale}/algeria`,
      );
    },
  );
});
