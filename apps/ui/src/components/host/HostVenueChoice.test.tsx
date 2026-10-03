import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HostVenueChoice } from './HostVenueChoice';

afterEach(cleanup);

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
  it('names the place chosen and where it is, each part setting its own direction', () => {
    render(<HostVenueChoice locale="en" venue={CAFE} venueName={CAFE.name} />);

    const parts = [...choice().querySelectorAll('bdi')].map(
      (part) => part.textContent,
    );
    expect(parts).toEqual([CAFE.name, CAFE.address]);
  });

  it('starts each line on the page’s side, whatever the script of the place', () => {
    render(<HostVenueChoice locale="ar" venue={CAFE} venueName={CAFE.name} />);

    const group = screen.getByRole('group', { name: 'الموقع المحدد' });
    for (const part of group.querySelectorAll('bdi')) {
      expect(
        part.className,
        'laid out as a line of its own, a Latin name took the line’s direction and started at the left of an Arabic page',
      ).toBe('');
      expect(part.parentElement?.className.split(' ')).toContain('block');
    }
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

  it('reads as the place chosen, not as a field still to fill', () => {
    render(<HostVenueChoice locale="en" venue={CAFE} venueName={CAFE.name} />);

    const classes = choice().className.split(' ');
    expect(
      classes.filter((name) => /^(border|bg-|rounded-xl|h-)/u.test(name)),
      'drawn as a box at the search box’s height, the choice still looked like a search bar',
    ).toEqual([]);
  });

  it('reads in Arabic on an Arabic page', () => {
    render(<HostVenueChoice locale="ar" venue={CAFE} venueName={CAFE.name} />);

    expect(
      screen.getByRole('group', { name: 'الموقع المحدد' }).textContent,
    ).toContain(CAFE.name);
  });
});
