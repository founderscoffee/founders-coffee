import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getCitySuggestions,
  idle,
  getVenueLookups,
  resetVenueStep,
  showVenueStep,
  venueHint,
} from './HostVenueStep.fixtures';

afterEach(resetVenueStep);

const lookups = getVenueLookups();
const cities = getCitySuggestions();

const CAFE = {
  providerId: 'osm:node/1',
  kind: 'poi' as const,
  name: 'Café Tantonville',
  address: 'Alger',
  latitude: 36.77,
  longitude: 3.06,
  category: 'cafe' as const,
  eligible: true,
};
const MEDEA = { code: '26', name: 'Medea', nameAr: 'المدية' };
const KSAR = { code: '929', stateCode: '26', name: 'Ksar El Boukhari' };
const ALGIERS = { code: '556', stateCode: '16', name: 'Alger' };

const panel = (isCollapsed: boolean) => ({
  isCollapsed,
  onToggle: vi.fn(),
  onCoverChange: vi.fn(),
});

describe('the venue step floating over the map', () => {
  it('names its list once, in a header that folds it away', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const overlay = panel(false);
    showVenueStep('', undefined, { overlay });

    expect(
      screen.getAllByText('Cafés and coworking spaces nearby'),
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Cafés and coworking spaces nearby' }),
    );
    expect(overlay.onToggle).toHaveBeenCalledOnce();
  });

  it('tells the search box and the header when the list is folded', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: panel(true) });

    const header = screen.getByRole('button', {
      name: 'Cafés and coworking spaces nearby',
    });
    const body = document.getElementById(
      header.getAttribute('aria-controls') ?? '',
    );
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(body?.className).toContain('max-lg:hidden');
    expect(
      screen.getByRole('combobox').getAttribute('aria-expanded'),
      'a folded list is not one the search box can move into',
    ).toBe('false');
  });

  it('never folds away the one line an empty list leaves', () => {
    showVenueStep('', undefined, { overlay: panel(true) });

    expect(screen.queryByRole('button', { name: /nearby/u })).toBeNull();
    expect(
      venueHint().closest('.max-lg\\:hidden'),
      'with no header to open it again, a folded empty panel hid its hint for good',
    ).toBeNull();
  });
});

describe('the venue step when the wizard can move to another city', () => {
  it('offers the cities a search names, leaving out the one the map is on', () => {
    cities.list = [
      { city: ALGIERS, state: { code: '16', name: 'Alger' } },
      { city: KSAR, state: MEDEA },
    ];
    const onCitySelect = vi.fn();
    showVenueStep('ks', undefined, { onCitySelect });

    const offered = within(
      screen.getByRole('list', { name: 'Cities' }),
    ).getAllByRole('button');
    expect(offered).toHaveLength(1);
    fireEvent.click(offered[0]);

    expect(onCitySelect).toHaveBeenCalledWith(KSAR);
    expect(
      document.activeElement,
      'the suggestion leaves with the query, so the search box takes the focus back',
    ).toBe(screen.getByRole('combobox'));
  });

  it('offers none where the step cannot move, as when a meetup is edited', () => {
    cities.list = [{ city: KSAR, state: MEDEA }];
    showVenueStep('ks');

    expect(screen.queryByRole('list', { name: 'Cities' })).toBeNull();
  });
});
