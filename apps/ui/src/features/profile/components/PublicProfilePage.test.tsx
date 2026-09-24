import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../events/hooks', () => ({
  useHostedEvents: (
    _params: unknown,
    options: {
      initialPage?: {
        nextCursor: unknown;
        items: readonly unknown[];
        total: number;
      };
    } = {},
  ) => ({
    data: options.initialPage ? { pages: [options.initialPage] } : undefined,
    hasNextPage: Boolean(options.initialPage?.nextCursor),
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) =>
    createElement('a', props, children),
}));

import type { RootMarket } from '../../markets/api';
import type { PublicProfile } from '../api';
import { PublicProfilePage } from './PublicProfilePage';

const profile = {
  userId: 'usr_host01',
  displayName: 'Amina Host',
  photoAssetId: null,
  introduction: null,
};

const publicProfile: PublicProfile = {
  ...profile,
  headline: null,
  stage: null,
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
};

const markets: readonly RootMarket[] = [
  {
    code: 'DZ',
    slug: 'algeria',
    name: 'Algeria',
    nameAr: 'الجزائر',
    nameFr: 'Algérie',
    timezone: 'Africa/Algiers',
  },
];

const hostedEvent = {
  id: 'evt_1',
  slug: 'coffee-and-code',
  title: 'Coffee and Code',
  marketCode: 'DZ',
  cityCode: '556',
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  cityNameFr: 'Alger',
  venue: 'Café des Délices',
  startsAt: new Date('2099-04-01T18:00:00Z'),
  endsAt: new Date('2099-04-01T19:00:00Z'),
  rsvps: 3,
  language: 'fr',
} as never;

const renderProfile = (events: readonly unknown[]) =>
  render(
    <PublicProfilePage
      locale="en"
      profile={publicProfile}
      events={events as never}
      eventsTotal={events.length}
      markets={markets}
    />,
  );

describe('PublicProfilePage', () => {
  afterEach(cleanup);

  it('says so plainly when a host has no upcoming events', () => {
    renderProfile([]);

    expect(screen.getByRole('heading', { name: 'Amina Host' })).toBeTruthy();
    expect(document.querySelector('.stat-value')).toBeNull();
    expect(screen.getByText(/No events hosted yet/i)).toBeTruthy();
  });

  it('lists hosted events under a heading that does not promise they are upcoming', () => {
    renderProfile([hostedEvent]);

    expect(screen.getByText('Gatherings hosted')).toBeTruthy();
    expect(screen.getByText('Coffee and Code')).toBeTruthy();
    expect(screen.getByText('Showing 1 of 1')).toBeTruthy();
    expect(screen.queryByText(/No events hosted yet/i)).toBeNull();
  });

  it("renders event times in the market's zone, not the runtime's", () => {
    renderProfile([hostedEvent]);

    expect(screen.getByText('19:00\u201320:00')).toBeTruthy();
  });

  it('keeps the server cursor available for the next hosted-events page', () => {
    render(
      <PublicProfilePage
        locale="en"
        profile={publicProfile}
        events={[hostedEvent] as never}
        eventsNextCursor={{ startsAt: 1, id: 'evt_1' }}
        eventsTotal={2}
        markets={markets}
      />,
    );

    expect(screen.getByText('Showing 1 of 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('skips an event whose market is not visible rather than crashing', () => {
    renderProfile([{ ...(hostedEvent as object), marketCode: 'ZZ' }]);

    expect(screen.queryByText('Coffee and Code')).toBeNull();
  });

  it('renders every published detail and nothing the projection withheld', () => {
    render(
      <PublicProfilePage
        locale="en"
        markets={markets}
        events={[]}
        eventsTotal={0}
        profile={{
          ...publicProfile,
          interests: ['product', 'community'],
          spokenLanguages: ['ar', 'fr'],
          professionalLink: 'https://example.com/work',
        }}
      />,
    );

    expect(screen.queryByText('Founder')).toBeNull();
    expect(screen.getByText('Product')).toBeTruthy();
    expect(screen.getByText('Community')).toBeTruthy();
    expect(screen.getByText('Arabic · French')).toBeTruthy();
    const link = screen.getByRole('link', { name: /example\.com\/work/ });
    expect(link.getAttribute('rel')).toContain('nofollow');
  });

  it('shows no detail row for a projection that published nothing', () => {
    render(
      <PublicProfilePage
        locale="en"
        markets={markets}
        events={[]}
        eventsTotal={0}
        profile={publicProfile}
      />,
    );

    expect(screen.queryByText('Founder')).toBeNull();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });
});
