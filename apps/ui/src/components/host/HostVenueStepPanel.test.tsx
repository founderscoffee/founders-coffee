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
  onDismiss: vi.fn(),
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
    expect(
      hint.className,
      'with no card around it, the alert casts the shadow itself',
    ).toContain('max-lg:shadow-lg');
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
    expect(
      open.className,
      'open across the map, the list has no button beside it to match',
    ).not.toContain('max-lg:h-[var(--row-height)]');

    rerender(
      venueStep('', undefined, {
        overlay: { ...panel(true), neighbour: LOCATE },
      }),
    );
    const header = screen.getByRole('button', { name: 'Places nearby' });
    const folded = panelOf(header);
    expect(folded.className).toContain('max-lg:start-[var(--row-start)]');
    expect(folded.style.getPropertyValue('--row-height')).toBe('24px');
    expect(
      folded.className,
      'the folded list stood 44px tall beside a 24px button',
    ).toContain('max-lg:h-[var(--row-height)]');
    expect(
      folded.className,
      'as tall as the button, it starts level with it',
    ).toContain('max-lg:mt-3');
    expect(
      header.className,
      'drawn at the button’s height, it still answers a thumb over 44px',
    ).toContain('tap-target');
    expect(header.querySelector('svg')?.getAttribute('class')).toContain(
      'size-4',
    );
  });

  it('spans a folded list across the map until Locate me reports its size', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    showVenueStep('', undefined, { overlay: panel(true) });

    expect(
      panelOf(screen.getByRole('button', { name: 'Places nearby' })).className,
    ).toContain('max-lg:inset-x-3');
  });
});

describe('the venue list dropping down over the map', () => {
  it('folds once a place is picked from it', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const overlay = panel(false);
    const onVenueSelect = vi.fn();
    showVenueStep('', undefined, { overlay, onVenueSelect });

    fireEvent.click(screen.getByRole('option'));

    expect(onVenueSelect).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: CAFE.providerId }),
    );
    expect(overlay.onDismiss).toHaveBeenCalledOnce();
  });

  it('folds at a touch anywhere outside it, but not in its search box or its own rows', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const overlay = panel(false);
    showVenueStep('', undefined, { overlay });

    fireEvent.pointerDown(screen.getByRole('combobox'));
    fireEvent.pointerDown(screen.getByRole('option'));
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Places nearby' }),
    );
    expect(
      overlay.onDismiss,
      'the search box and the list are one dropdown, so refining a search keeps it open',
    ).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(overlay.onDismiss).toHaveBeenCalledOnce();
  });

  it('listens for no touch outside while folded, or while it holds only its hint', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const folded = panel(true);
    const { unmount } = showVenueStep('', undefined, { overlay: folded });
    fireEvent.pointerDown(document.body);
    unmount();

    lookups.nearby = idle();
    const hint = panel(false);
    showVenueStep('', undefined, { overlay: hint });
    fireEvent.pointerDown(document.body);

    expect(folded.onDismiss).not.toHaveBeenCalled();
    expect(
      hint.onDismiss,
      'a hint has no header to open it again, so folding it would hide it for good',
    ).not.toHaveBeenCalled();
  });

  it('hands the focus to its header when it folds around it', () => {
    lookups.nearby = { ...idle(), data: [CAFE] };
    const { rerender } = showVenueStep('', undefined, {
      overlay: panel(false),
    });
    screen.getByRole('option').focus();

    rerender(venueStep('', undefined, { overlay: panel(true) }));

    expect(
      document.activeElement,
      'the folded list hid the row that held the focus, and dropped it on the page',
    ).toBe(screen.getByRole('button', { name: 'Places nearby' }));
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
