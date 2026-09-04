import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import { VenueSearch } from './VenueSearch';

const venueSearchMocks = vi.hoisted(() => ({
  useVenueSearch: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('../../features/events/hooks', () => ({
  useVenueSearch: venueSearchMocks.useVenueSearch,
}));

const venue: VenueSelection = {
  providerId: 'poi-cafe',
  kind: 'poi' as const,
  name: 'Founders Café',
  address: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
};

describe('VenueSearch', () => {
  beforeEach(() => {
    venueSearchMocks.useVenueSearch.mockReturnValue({
      data: [venue],
      error: null,
      isError: false,
      isFetching: false,
      refetch: venueSearchMocks.refetch,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns the normalized venue and closes results after selection', async () => {
    const onChange = vi.fn();
    const onVenueSelect = vi.fn();
    const view = render(
      <VenueSearch
        locale="en"
        cityName="Algiers"
        cityCode="1"
        marketCode="DZ"
        value=""
        onChange={onChange}
        onVenueSelect={onVenueSelect}
      />,
    );
    const searchbox = screen.getByRole('combobox', {
      name: 'Search cafés and coworking venues',
    });

    fireEvent.focus(searchbox);
    fireEvent.change(searchbox, { target: { value: 'cafe' } });
    view.rerender(
      <VenueSearch
        locale="en"
        cityName="Algiers"
        cityCode="1"
        marketCode="DZ"
        value="cafe"
        onChange={onChange}
        onVenueSelect={onVenueSelect}
      />,
    );

    const option = await screen.findByRole(
      'option',
      { name: /Founders Café/ },
      { timeout: 1_000 },
    );
    fireEvent.click(option);

    expect(onVenueSelect).toHaveBeenCalledWith(venue);
    expect(screen.queryByRole('option')).toBeNull();
    await waitFor(() =>
      expect(venueSearchMocks.useVenueSearch).toHaveBeenLastCalledWith({
        marketCode: 'DZ',
        cityCode: '1',
        locale: 'en',
        query: '',
      }),
    );
  });

  it('does not search while the map provider context is unavailable', () => {
    render(
      <VenueSearch
        locale="en"
        cityName="Algiers"
        cityCode="1"
        marketCode="DZ"
        value="cafe"
        isDisabled
        onChange={vi.fn()}
        onVenueSelect={vi.fn()}
      />,
    );

    const searchbox = screen.getByRole('combobox', {
      name: 'Search cafés and coworking venues',
    });
    expect(searchbox.hasAttribute('disabled')).toBe(true);
    expect(venueSearchMocks.useVenueSearch).toHaveBeenLastCalledWith({
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'en',
      query: '',
    });
  });

  it('supports arrow-key navigation and Enter selection', async () => {
    const onChange = vi.fn();
    const onVenueSelect = vi.fn();
    const view = render(
      <VenueSearch
        locale="en"
        cityName="Algiers"
        cityCode="1"
        marketCode="DZ"
        value=""
        onChange={onChange}
        onVenueSelect={onVenueSelect}
      />,
    );
    const searchbox = screen.getByRole('combobox', {
      name: 'Search cafés and coworking venues',
    });
    fireEvent.focus(searchbox);
    fireEvent.change(searchbox, { target: { value: 'cafe' } });
    view.rerender(
      <VenueSearch
        locale="en"
        cityName="Algiers"
        cityCode="1"
        marketCode="DZ"
        value="cafe"
        onChange={onChange}
        onVenueSelect={onVenueSelect}
      />,
    );
    await screen.findByRole('option', { name: /Founders Café/ });
    fireEvent.keyDown(searchbox, { key: 'ArrowDown' });
    expect(searchbox.getAttribute('aria-activedescendant')).toBe(
      'venue-search-option-0',
    );
    fireEvent.keyDown(searchbox, { key: 'Enter' });
    expect(onVenueSelect).toHaveBeenCalledWith(venue);
  });

  it('drops the highlight in the same render that changes the result set', async () => {
    const onChange = vi.fn();
    const onVenueSelect = vi.fn();
    const props = {
      locale: 'en' as const,
      cityName: 'Algiers',
      cityCode: '1',
      marketCode: 'DZ',
      onChange,
      onVenueSelect,
    };
    const view = render(<VenueSearch {...props} value="" />);
    const searchbox = screen.getByRole('combobox', {
      name: 'Search cafés and coworking venues',
    });
    fireEvent.focus(searchbox);
    fireEvent.change(searchbox, { target: { value: 'cafe' } });
    view.rerender(<VenueSearch {...props} value="cafe" />);
    await screen.findByRole('option', { name: /Founders Café/ });
    fireEvent.keyDown(searchbox, { key: 'ArrowDown' });
    expect(searchbox.getAttribute('aria-activedescendant')).toBe(
      'venue-search-option-0',
    );

    venueSearchMocks.useVenueSearch.mockReturnValue({
      data: [
        venue,
        { ...venue, providerId: 'poi-second', name: 'Second Café' },
      ],
      error: null,
      isError: false,
      isFetching: false,
      refetch: venueSearchMocks.refetch,
    });
    view.rerender(<VenueSearch {...props} value="cafe" />);

    expect(
      await screen.findByRole('option', { name: /Second Café/ }),
    ).toBeTruthy();
    expect(searchbox.getAttribute('aria-activedescendant')).toBeNull();
  });
});
