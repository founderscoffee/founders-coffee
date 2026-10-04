import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getCitySuggestions,
  idle,
  getVenueLookups,
  resetVenueStep,
  showVenueStep,
  venueHint,
  venueStep,
} from './HostVenueStep.fixtures';
import type { VenueOverlay } from './HostVenueStep';

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

const LOCATE = { width: 94, height: 24 };

const STREET = {
  ...CAFE,
  providerId: 'address-yousfi',
  kind: 'address' as const,
  name: '15 Rue Yousfi Mohamed',
  address: '15 Rue Yousfi Mohamed, Alger',
};

const listing = (state: Partial<VenueOverlay> = {}): VenueOverlay => ({
  isSearchOpen: false,
  isListOpen: true,
  row: LOCATE,
  onCoverChange: vi.fn(),
  onPick: vi.fn(),
  ...state,
});

const panelOf = (element: Element | null) =>
  element?.closest('[class*="max-lg:absolute"]') as HTMLElement;

describe('the venue step floating over the map', () => {
  it('lists the places nearby on arrival under one label, with no box to fill', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: listing() });

    expect(
      screen.queryByRole('combobox'),
      'an empty search box on arrival read as a field the host had to fill before Next',
    ).toBeNull();
    expect(screen.getAllByText('Places nearby')).toHaveLength(1);
    expect(
      screen.getByRole('option', { name: /Café Tantonville/u }),
    ).toBeTruthy();
  });

  it('opens the search box above the places when the host asks for it', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, {
      overlay: listing({ isSearchOpen: true }),
    });

    const box = screen.getByRole('combobox');
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(
      box.compareDocumentPosition(screen.getByRole('listbox')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('searches only while the box is open, so a closed one leaves the places nearby', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    lookups.search = { ...idle(), data: [STREET] };
    const { rerender } = showVenueStep('Didouche', undefined, {
      overlay: listing(),
    });
    expect(screen.getByRole('listbox', { name: 'Places nearby' })).toBeTruthy();

    rerender(
      venueStep('Didouche', undefined, {
        overlay: listing({ isSearchOpen: true }),
      }),
    );
    expect(
      screen.getByRole('listbox', { name: 'Search results' }),
    ).toBeTruthy();
  });

  it('shows a pinned address alone, and the places nearby once the host opens the search', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const { rerender } = showVenueStep('', undefined, {
      overlay: listing(),
      venue: STREET,
    });
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([expect.stringContaining(STREET.name)]);

    rerender(
      venueStep('', undefined, {
        overlay: listing({ isSearchOpen: true }),
        venue: STREET,
      }),
    );
    expect(screen.getByRole('listbox', { name: 'Places nearby' })).toBeTruthy();
    expect(
      screen.getByRole('option', { name: /Café Tantonville/u }),
    ).toBeTruthy();
  });

  it('hangs below the map’s top row, clear of Locate me and Search', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: listing() });

    const floating = panelOf(screen.getByRole('listbox'));
    expect(floating.className).toContain('max-lg:inset-x-3');
    expect(floating.className).toContain(
      'max-lg:mt-[calc(var(--row-height,2rem)+var(--spacing)*5)]',
    );
    expect(floating.style.getPropertyValue('--row-height')).toBe('24px');
    expect(floating.className).toContain('max-lg:bg-base-100');
  });

  it('lets the hint carry its own surface when it is all there is', () => {
    showVenueStep('', undefined, { overlay: listing() });

    const hint = venueHint();
    expect(hint.textContent).toBe('Pick a spot on the map.');
    expect(
      panelOf(hint).className,
      'the alert brings its own surface, and a card around it drew a box in a box',
    ).not.toContain('max-lg:bg-base-100');
    expect(hint.className).toContain('max-lg:shadow-lg');
  });
});

describe('the venue list over the map', () => {
  it('gives the map back once a place is picked from it', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const overlay = listing();
    const onVenueSelect = vi.fn();
    showVenueStep('', undefined, { overlay, onVenueSelect });

    fireEvent.click(screen.getByRole('option'));

    expect(onVenueSelect).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: CAFE.providerId }),
    );
    expect(overlay.onPick).toHaveBeenCalledOnce();
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
