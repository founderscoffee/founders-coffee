import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HostVenueCallout } from './HostVenueCallout';

const address = (name: string, full: string) => ({
  providerId: 'mapbox-1',
  kind: 'address' as const,
  name,
  address: full,
  latitude: 36.87,
  longitude: 6.9,
});

describe('HostVenueCallout', () => {
  afterEach(cleanup);

  it('prints an address that is its own name once, on up to two lines', () => {
    const whole = 'Café ، 21 بني زيد، الجزائر';
    render(
      <HostVenueCallout
        venue={address(whole, whole)}
        locale="ar"
        showHint={false}
      />,
    );

    const lines = screen.getAllByText(whole);
    expect(lines, 'the card printed the same address twice').toHaveLength(1);
    expect(
      lines[0]?.className,
      'with no address line under it, the name may take the two lines the address had',
    ).toContain('line-clamp-2');
  });

  it('keeps the address under a name that differs from it', () => {
    render(
      <HostVenueCallout
        venue={address('Café', 'Café, 21, Beni Zid, Skikda, Algeria')}
        locale="en"
        showHint={false}
      />,
    );

    expect(screen.getByText('Café').className).toContain('line-clamp-1');
    expect(
      screen.getByText('Café, 21, Beni Zid, Skikda, Algeria'),
    ).toBeTruthy();
  });
});
