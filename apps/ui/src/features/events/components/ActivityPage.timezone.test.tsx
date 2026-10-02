import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { activity_hosted, type Locale } from '@founders-coffee/i18n';

const listed = vi.hoisted(() => {
  const items = [
    {
      id: 'evt_algiers',
      slug: 'late-coffee-algiers',
      title: 'Late coffee in Algiers',
      venue: 'Café des Délices',
      marketCode: 'DZ',
      status: 'published',
      startsAt: new Date('2099-01-15T23:30:00Z'),
    },
    {
      id: 'evt_riyadh',
      slug: 'late-coffee-riyadh',
      title: 'Late coffee in Riyadh',
      venue: 'Café Najd',
      marketCode: 'SA',
      status: 'published',
      startsAt: new Date('2099-01-22T22:00:00Z'),
    },
  ];
  return {
    data: { pages: [{ items, total: items.length, nextCursor: null }] },
  };
});

vi.mock('../hooks', () => ({
  useMyJoinedEvents: () => ({
    ...listed,
    userId: 'usr_1',
    isAuthLoading: false,
  }),
  useHostedEvents: () => listed,
}));
vi.mock('../../chat/hooks', () => ({
  useChatUnreadCounts: () => new Map(),
}));
vi.mock('../../operations/hooks', () => ({
  useMyCloseoutStates: () => ({ data: [] }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));
vi.mock('../../account/components/ProfileSectionNav', () => ({
  ProfileSectionNav: () => <nav data-testid="section-nav" />,
}));

const { ActivityPage } = await import('./ActivityPage');

const MARKETS = [
  { code: 'DZ', slug: 'algeria', timezone: 'Africa/Algiers' },
  { code: 'SA', slug: 'saudi-arabia', timezone: 'Asia/Riyadh' },
];

const MARKET_DAY: Record<Locale, { algiers: string; riyadh: string }> = {
  ar: { algiers: 'الجمعة، 16 يناير', riyadh: 'الجمعة، 23 يناير' },
  fr: { algiers: 'vendredi 16 janv.', riyadh: 'vendredi 23 janv.' },
  en: { algiers: 'Friday, Jan 16', riyadh: 'Friday, Jan 23' },
};

const READER_ZONES = [
  'America/New_York',
  'UTC',
  'Africa/Algiers',
  'Pacific/Kiritimati',
];

const runtimeZone = process.env.TZ;

afterEach(() => {
  cleanup();
  if (runtimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = runtimeZone;
});

const rowText = (title: RegExp) =>
  screen.getByRole('link', { name: title }).textContent;

const expectMarketDays = (locale: Locale) => {
  expect(
    rowText(/Late coffee in Algiers/),
    'a meetup at 00:30 in Algiers was listed on the day before to a reader in New York, a day off its own page and its card',
  ).toContain(MARKET_DAY[locale].algiers);
  expect(
    rowText(/Late coffee in Riyadh/),
    'each row takes its own market’s zone, so 01:00 in Riyadh is not the evening before it still is in Algiers',
  ).toContain(MARKET_DAY[locale].riyadh);
};

describe.each<Locale>(['ar', 'fr', 'en'])(
  'the day a row of your own activity gives a meetup, in %s',
  (locale) => {
    it.each(READER_ZONES)(
      'is the day in its own market, on both tabs, to a reader in %s',
      (zone) => {
        process.env.TZ = zone;

        render(<ActivityPage locale={locale} markets={MARKETS} />);
        expectMarketDays(locale);

        fireEvent.click(
          screen.getByRole('tab', { name: activity_hosted({}, { locale }) }),
        );
        expectMarketDays(locale);
      },
    );
  },
);
