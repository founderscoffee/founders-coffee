import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostVenueChoice } from './HostVenueChoice';

const lookup = vi.hoisted(() => ({ isLocating: false }));

vi.mock('../../features/events/hooks', () => ({
  useIsLocatingVenue: () => lookup.isLocating,
}));

afterEach(() => {
  cleanup();
  lookup.isLocating = false;
});

const CAFE = {
  providerId: 'osm:node/1',
  kind: 'poi' as const,
  name: 'Café Tantonville',
  address: 'Rue Didouche Mourad, Alger',
  latitude: 36.77,
  longitude: 3.06,
};

const STREET = {
  providerId: 'address-yousfi',
  kind: 'address' as const,
  name: '15 Rue Yousfi Mohamed',
  address: '15 Rue Yousfi Mohamed, Alger',
  latitude: 36.75,
  longitude: 3.06,
};

const choice = () => screen.getByRole('group', { name: 'Selected location' });

describe('HostVenueChoice', () => {
  it('names the place chosen and where it is, each part starting on the page’s side', () => {
    render(<HostVenueChoice locale="en" venue={CAFE} venueName={CAFE.name} />);

    const parts = [...choice().querySelectorAll('bdi')].map(
      (part) => part.textContent,
    );
    expect(parts).toEqual([CAFE.name, CAFE.address]);
  });

  it('shows an unnamed street address once, then the name the host gives the place', () => {
    const { rerender } = render(
      <HostVenueChoice locale="en" venue={STREET} venueName="" />,
    );
    expect(
      choice().textContent,
      'the street standing in as its own name read twice on one line',
    ).toBe(STREET.address);

    rerender(
      <HostVenueChoice
        locale="en"
        venue={STREET}
        venueName="Café des Délices"
      />,
    );
    expect(choice().textContent).toBe(`Café des Délices${STREET.address}`);
  });

  it('says what to do while nothing is chosen, and that a tapped spot is being looked up', () => {
    const { rerender } = render(
      <HostVenueChoice locale="en" venue={null} venueName="" />,
    );
    expect(screen.getByText('Pick a spot on the map.')).toBeTruthy();

    lookup.isLocating = true;
    rerender(<HostVenueChoice locale="en" venue={null} venueName="" />);

    expect(screen.queryByText('Pick a spot on the map.')).toBeNull();
    expect(screen.getByText('Locating the venue…')).toBeTruthy();
  });

  it('stands at the search box’s own height in every state, so the map below never moves', () => {
    const { rerender } = render(
      <HostVenueChoice locale="en" venue={CAFE} venueName={CAFE.name} />,
    );
    const heights = () => {
      const line = screen
        .getByText(/Café Tantonville|Pick a spot/u)
        .closest('.rounded-xl');
      return (line?.getAttribute('class') ?? '')
        .split(' ')
        .filter((name) => /(^|:)h-/u.test(name));
    };
    expect(heights()).toEqual(['h-8', 'md:h-10']);

    rerender(<HostVenueChoice locale="en" venue={null} venueName="" />);
    expect(heights()).toEqual(['h-8', 'md:h-10']);
  });

  it('reads in Arabic on an Arabic page', () => {
    render(<HostVenueChoice locale="ar" venue={CAFE} venueName={CAFE.name} />);

    expect(
      screen.getByRole('group', { name: 'الموقع المحدد' }).textContent,
    ).toContain(CAFE.name);
  });
});
