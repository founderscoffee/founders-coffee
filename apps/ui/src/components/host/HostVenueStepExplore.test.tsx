import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getVenueLookups,
  idle,
  resetVenueStep,
  showVenueStep,
  venueStep,
} from './HostVenueStep.fixtures';
import type { VenueOverlay } from './HostVenueStep';

afterEach(resetVenueStep);

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

const STREET = {
  ...CAFE,
  providerId: 'address-yousfi',
  kind: 'address' as const,
  name: '15 Rue Yousfi Mohamed',
  address: '15 Rue Yousfi Mohamed, Alger',
};

const LOCATE = { width: 94, height: 24 };

const onTheMap = (state: Partial<VenueOverlay> = {}): VenueOverlay => ({
  isSearchOpen: false,
  isListOpen: false,
  row: LOCATE,
  onCoverChange: vi.fn(),
  onPick: vi.fn(),
  ...state,
});

const panelOf = (element: Element | null) =>
  element?.closest('[class*="max-lg:absolute"]') as HTMLElement;

const hiddenBelowLg = (element: Element) => element.closest('.max-lg\\:hidden');

describe('the venue step once the host works the map', () => {
  it('gives the map back, leaving over it only the place chosen', () => {
    getVenueLookups().nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, {
      overlay: onTheMap(),
      venue: CAFE,
      venueName: CAFE.name,
    });

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(hiddenBelowLg(screen.getByRole('listbox'))).not.toBeNull();
    const choice = screen.getByRole('group', { name: 'Selected location' });
    expect(within(choice).getByText(CAFE.name)).toBeTruthy();
    expect(hiddenBelowLg(choice)).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Search' }),
      'Search lives on the map, beside Locate me, not in the panel',
    ).toBeNull();
  });

  it('hides the whole panel over the map while nothing is chosen', () => {
    getVenueLookups().nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: onTheMap() });

    expect(panelOf(screen.getByRole('listbox')).className).toContain(
      'max-lg:hidden',
    );
    expect(
      screen.queryByRole('group', { name: 'Selected location' }),
    ).toBeNull();
  });

  it('keeps the places in their rail from lg up, whatever the map does', () => {
    getVenueLookups().nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, {
      overlay: onTheMap(),
      venue: CAFE,
      venueName: CAFE.name,
    });

    const list = screen.getByRole('listbox');
    expect(list.closest('.hidden, .lg\\:hidden')).toBeNull();
    expect(screen.getByText('Places nearby')).toBeTruthy();
    expect(
      screen
        .getByRole('group', { name: 'Selected location' })
        .closest('.lg\\:hidden'),
      'beside the list, the place chosen is already the row marked selected',
    ).not.toBeNull();
  });

  it('asks for the name an address needs beside the place chosen, not in the list', () => {
    showVenueStep('', undefined, {
      overlay: onTheMap(),
      venue: STREET,
      venueName: '',
    });

    const name = screen.getByLabelText('What is this place called?');
    expect(hiddenBelowLg(name)).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Selected location' }).textContent,
    ).toBe(STREET.address);
  });

  it('hands the focus to the place chosen when the list that held it gives way', () => {
    getVenueLookups().nearby = { ...idle(), data: [CAFE] };
    const { rerender } = showVenueStep('', undefined, {
      overlay: onTheMap({ isListOpen: true }),
      venue: CAFE,
      venueName: CAFE.name,
    });
    screen.getByRole('option').focus();

    rerender(
      venueStep('', undefined, {
        overlay: onTheMap(),
        venue: CAFE,
        venueName: CAFE.name,
      }),
    );

    expect(
      document.activeElement?.contains(
        screen.getByRole('group', { name: 'Selected location' }),
      ),
      'the list hid the row that held the focus, and dropped it on the page',
    ).toBe(true);
  });
});
