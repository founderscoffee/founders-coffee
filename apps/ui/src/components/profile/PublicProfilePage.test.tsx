import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) =>
    createElement('a', props, children),
}));

import { PublicProfilePage } from './PublicProfilePage';

const profile = {
  id: 'usr_host01',
  name: 'Amina Host',
  image: null,
  role: 'host',
  homeCityName: 'Algiers',
  homeCityNameAr: 'الجزائر',
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
  capacity: 20,
  rsvps: 3,
  language: 'fr',
  category: 'coffee-meetup',
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

    expect(document.querySelector('.stat-value')?.textContent).toBe('0');
    expect(screen.getByText(/No events hosted yet/i)).toBeTruthy();
  });

  it('counts and lists the events the host is running', () => {
    renderProfile([hostedEvent]);

    expect(document.querySelector('.stat-value')?.textContent).toBe('1');
    expect(screen.getByText('Coffee and Code')).toBeTruthy();
    expect(screen.queryByText(/No events hosted yet/i)).toBeNull();
  });

  it('skips an event whose market is not visible rather than crashing', () => {
    renderProfile([{ ...(hostedEvent as object), marketCode: 'ZZ' }]);

    expect(screen.queryByText('Coffee and Code')).toBeNull();
  });
});
