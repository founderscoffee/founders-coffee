import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) =>
    createElement('a', props, children),
}));

import { PublicProfilePage } from './PublicProfilePage';

const profile = {
  userId: 'usr_host01',
  displayName: 'Amina Host',
  photoAssetId: null,
  introduction: null,
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
      profile={profile as never}
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

  it('lists upcoming events without claiming they are a lifetime aggregate', () => {
    renderProfile([hostedEvent]);

    expect(screen.getByText('Upcoming hosted meetups')).toBeTruthy();
    expect(screen.getByText('Coffee and Code')).toBeTruthy();
    expect(screen.queryByText(/No events hosted yet/i)).toBeNull();
  });

  it('skips an event whose market is not visible rather than crashing', () => {
    renderProfile([{ ...(hostedEvent as object), marketCode: 'ZZ' }]);

    expect(screen.queryByText('Coffee and Code')).toBeNull();
  });
});
