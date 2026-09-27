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

const LOCATE = { width: 94, height: 24 };

const panelOf = (element: Element | null) =>
  element?.closest('[class*="max-lg:absolute"]') as HTMLElement;

describe('the venue step floating over the map', () => {
  it('names its list once, in a header that folds it away', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const overlay = panel(false);
    showVenueStep('', undefined, { overlay });

    expect(screen.getAllByText('Places nearby')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Places nearby' }));
    expect(overlay.onToggle).toHaveBeenCalledOnce();
  });

  it('tells the search box and the header when the list is folded', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: panel(true) });

    const header = screen.getByRole('button', {
      name: 'Places nearby',
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

  it('pins its hint to the far edge of the map as the alert itself, clear of Locate me', () => {
    showVenueStep('', undefined, {
      overlay: { ...panel(false), neighbour: LOCATE },
    });

    const hint = venueHint();
    const floating = panelOf(hint);
    expect(hint.className).toContain('alert-info');
    expect(
      floating.className,
      'the alert brings its own surface, and a card around it drew a box in a box',
    ).not.toContain('max-lg:bg-base-100');
    expect(floating.className).toContain('max-lg:end-3');
    expect(
      floating.className,
      'Locate me holds the near corner, so the hint keeps to the far one',
    ).not.toContain('max-lg:start-[var(--row-start)]');
    expect(
      floating.className,
      'the alert is as wide as its words, not the rest of the row',
    ).toContain('max-lg:w-fit');
    expect(
      floating.style.getPropertyValue('--row-start'),
      'however long the words, the hint stops short of the button',
    ).toBe('calc(94px + var(--spacing) * 5)');
  });

  it('makes its hint as tall as Locate me, with an icon to match', () => {
    showVenueStep('', undefined, {
      overlay: { ...panel(false), neighbour: LOCATE },
    });

    const hint = venueHint();
    expect(panelOf(hint).style.getPropertyValue('--row-height')).toBe('24px');
    expect(hint.parentElement?.className).toContain(
      'max-lg:min-h-[var(--row-height)]',
    );
    expect(
      hint.className,
      'the alert’s own padding made it taller than the button',
    ).toContain('max-lg:py-0');
    const icon = hint.querySelector('svg')?.getAttribute('class');
    expect(icon).toContain('max-lg:size-4');
    expect(
      icon,
      'on its one line the icon is centred, not topped as on the first of several',
    ).toContain('max-lg:self-center');
  });

  it('opens a list across the map over Locate me, and folds it back into the row', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const { rerender } = showVenueStep('', undefined, {
      overlay: { ...panel(false), neighbour: LOCATE },
    });

    const open = panelOf(screen.getByRole('listbox'));
    expect(open.className).toContain('max-lg:inset-x-3');
    expect(open.style.getPropertyValue('--row-start')).toBe('');

    rerender(
      venueStep('', undefined, {
        overlay: { ...panel(true), neighbour: LOCATE },
      }),
    );
    const folded = panelOf(
      screen.getByRole('button', { name: 'Places nearby' }),
    );
    expect(folded.className).toContain('max-lg:start-[var(--row-start)]');
    expect(
      folded.style.getPropertyValue('--row-top'),
      'the folded header is taller than the button, so it is centred on it',
    ).toBe('calc(var(--spacing) * 3 + (24px - var(--spacing) * 11) / 2)');
  });

  it('spans a folded list across the map until Locate me reports its size', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: panel(true) });

    expect(
      panelOf(screen.getByRole('button', { name: 'Places nearby' })).className,
    ).toContain('max-lg:inset-x-3');
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
