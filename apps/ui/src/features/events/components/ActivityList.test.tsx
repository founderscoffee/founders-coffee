import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

const { ActivityList } = await import('./ActivityList');

const ALGIERS = { cityName: 'Algiers', cityNameAr: 'الجزائر العاصمة' };

const listedIn = (locale: Locale, city = ALGIERS) =>
  render(
    <ActivityList
      locale={locale}
      emptyNote="nothing yet"
      items={[
        {
          id: 'evt_1',
          slug: 'coffee-and-code',
          title: 'Coffee and code',
          venue: 'Café des Délices',
          marketCode: 'DZ',
          status: 'published',
          startsAt: new Date('2099-01-15T18:00:00Z'),
          ...city,
        },
      ]}
      total={1}
      marketSlugFor={() => 'algeria'}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={() => undefined}
    />,
  );

afterEach(() => cleanup());

describe('what a row of your own activity calls the city', () => {
  it('names it in Arabic to an Arabic reader', () => {
    const view = listedIn('ar');

    expect(
      view.container.textContent,
      'every other surface says الجزائر العاصمة for this city, and this row said Algiers in the middle of an Arabic line',
    ).toContain('الجزائر العاصمة');
    expect(view.container.textContent).not.toContain('Algiers');
  });

  it.each<Locale>(['en', 'fr'])(
    'names it in Latin to a %s reader',
    (locale) => {
      const view = listedIn(locale);

      expect(view.container.textContent).toContain('Algiers');
    },
  );

  it('falls back to the Latin name when no Arabic one was recorded', () => {
    const view = listedIn('ar', { cityName: 'Béjaïa', cityNameAr: '' });

    expect(
      view.container.textContent,
      'an empty Arabic name is not a name, and preferring it over the Latin one leaves the row ending in a bare separator',
    ).toContain('Béjaïa');
  });

  it('says nothing about a city the row does not carry', () => {
    const view = listedIn('ar', { cityName: '', cityNameAr: '' });

    expect(view.container.textContent).toContain('Coffee and code');
    expect(screen.queryByText(/·\s*$/u)).toBeNull();
  });
});
