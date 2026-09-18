import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostVenueList, type VenueRow } from './HostVenueList';

const row = (overrides: Partial<VenueRow> = {}): VenueRow => ({
  providerId: 'osm:node/1',
  kind: 'poi',
  name: 'Founders Café',
  address: '12 Startup Street',
  latitude: 36.7538,
  longitude: 3.0588,
  category: 'cafe',
  eligible: true,
  ...overrides,
});

const rows: VenueRow[] = [
  row(),
  row({
    providerId: 'osm:node/2',
    name: 'Cowork Algiers',
    category: 'coworking',
  }),
  row({
    providerId: 'osm:node/3',
    name: 'Tantonville Rooftop',
    category: 'restaurant',
    eligible: false,
  }),
];

const renderList = (selectedProviderId?: string) => {
  const onSelect = vi.fn();
  render(
    <HostVenueList
      locale="en"
      label="Cafés nearby"
      venues={rows}
      selectedProviderId={selectedProviderId}
      showAttribution
      onSelect={onSelect}
    />,
  );
  return onSelect;
};

describe('HostVenueList', () => {
  afterEach(cleanup);

  it('exposes one radio per venue and checks only the selected one', () => {
    renderList('osm:node/2');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('shows an ineligible venue with its reason and refuses to select it', () => {
    const onSelect = renderList();
    expect(
      screen.getByText('Restaurant · not a café or coworking space'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Tantonville Rooftop'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects an eligible venue on click', () => {
    const onSelect = renderList();
    fireEvent.click(screen.getByText('Cowork Algiers'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'osm:node/2' }),
    );
  });

  it('moves between eligible venues with the arrow keys, skipping the ineligible one', () => {
    const onSelect = renderList('osm:node/2');
    fireEvent.keyDown(screen.getAllByRole('radio')[1], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'osm:node/1' }),
    );
  });

  it('keeps exactly one row in the tab order', () => {
    renderList('osm:node/2');
    const tabbable = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute('data-venue')).toBe('osm:node/2');
  });

  it('keeps a selection visible when it is the only row', () => {
    const onSelect = vi.fn();
    render(
      <HostVenueList
        locale="en"
        label="Search results"
        venues={[
          row({ providerId: 'mapbox-1', name: 'Sofitel', category: undefined }),
        ]}
        selectedProviderId="mapbox-1"
        showAttribution={false}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Selected')).toBeTruthy();
  });

  it('omits the category when a row has none', () => {
    render(
      <HostVenueList
        locale="en"
        label="Search results"
        venues={[
          row({
            providerId: 'mapbox-2',
            address: '9 Rue Didouche',
            category: undefined,
          }),
        ]}
        showAttribution={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('9 Rue Didouche')).toBeTruthy();
  });

  it('credits OpenStreetMap when showing snapshot data', () => {
    renderList();
    expect(screen.getByText('© OpenStreetMap contributors')).toBeTruthy();
  });
});
