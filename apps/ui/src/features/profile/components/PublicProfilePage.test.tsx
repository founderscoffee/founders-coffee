import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../events/hooks', () => ({
  useHostedEvents: () => ({
    data: undefined,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) =>
    createElement('a', props, children),
}));

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
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
};

const markets = [
  { code: 'DZ', slug: 'algeria', timezone: 'Africa/Algiers' },
] as never;

const hostedEvent = {
  id: 'evt_1',
  slug: 'coffee-and-code',
  title: 'Coffee and Code',
  marketCode: 'DZ',
  cityCode: '556',
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
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
    expect(screen.queryByText(/No events hosted yet/i)).toBeNull();
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
    const link = screen.getByRole('link', {
      name: 'https://example.com/work',
    });
    expect(link.getAttribute('rel')).toContain('nofollow');
  });

  it('shows no detail row for a projection that published nothing', () => {
    render(
      <PublicProfilePage
        locale="en"
        markets={markets}
        events={[]}
        profile={publicProfile}
      />,
    );

    expect(screen.queryByText('Founder')).toBeNull();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });
});
