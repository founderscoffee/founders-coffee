import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostLocateButton } from './HostLocateButton';
import {
  getVenueLookups,
  idle,
  resetVenueStep,
  showVenueStep,
} from './HostVenueStep.fixtures';

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

const LOCATE = { width: 94, height: 24 };

const exploring = () => ({
  isCollapsed: true,
  isExploring: true,
  neighbour: LOCATE,
  onToggle: vi.fn(),
  onCoverChange: vi.fn(),
  onDismiss: vi.fn(),
  onSearch: vi.fn(),
});

const panelOf = (element: Element | null) =>
  element?.closest('[class*="max-lg:absolute"]') as HTMLElement;

describe('the venue step while the host works the map', () => {
  it('gives the search box’s place to the place chosen, and the list’s to a search button', () => {
    getVenueLookups().nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, {
      overlay: exploring(),
      venue: CAFE,
      venueName: CAFE.name,
    });

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(
      within(
        screen.getByRole('group', { name: 'Selected location' }),
      ).getByText(CAFE.name),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
  });

  it('holds its search button at the far edge of Locate me’s row, as wide as its words', () => {
    showVenueStep('', undefined, { overlay: exploring() });

    const floating = panelOf(screen.getByRole('button', { name: 'Search' }));
    expect(floating.className).toContain('max-lg:end-3');
    expect(floating.className).toContain('max-lg:w-fit');
    expect(
      floating.className,
      'a panel surface drawn round a pill-shaped button showed as a square shadow behind it',
    ).not.toContain('max-lg:shadow-lg');
    expect(floating.className).not.toContain('max-lg:bg-base-100');
    expect(floating.style.getPropertyValue('--row-height')).toBe('24px');
  });

  it('draws its search button exactly as Locate me, so the two match in the row they share', () => {
    showVenueStep('', undefined, { overlay: exploring() });
    const search = screen.getByRole('button', { name: 'Search' });
    render(<HostLocateButton locale="en" onClick={vi.fn()} />);
    const locate = screen.getByRole('button', { name: 'Locate me' });

    const iconSize = (button: HTMLElement) =>
      (button.querySelector('svg')?.getAttribute('class') ?? '')
        .split(' ')
        .filter((name) => !name.startsWith('lucide'));
    expect(search.className).toBe(locate.className);
    expect(iconSize(search)).toEqual(iconSize(locate));
    expect(iconSize(search)).toContain('size-4');
  });

  it('asks for the search box back when its button is pressed', () => {
    const overlay = exploring();
    showVenueStep('', undefined, { overlay });

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(overlay.onSearch).toHaveBeenCalledOnce();
  });

  it('keeps the name question an address needs in view below the line', () => {
    const street = {
      ...CAFE,
      providerId: 'address-yousfi',
      kind: 'address' as const,
      name: '15 Rue Yousfi Mohamed',
      address: '15 Rue Yousfi Mohamed, Alger',
    };
    showVenueStep('', undefined, {
      overlay: exploring(),
      venue: street,
      venueName: '',
    });

    expect(screen.getByLabelText('What is this place called?')).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'Selected location' }).textContent,
    ).toBe(street.address);
  });
});
