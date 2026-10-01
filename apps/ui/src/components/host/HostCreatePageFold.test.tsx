import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getHostCreateMocks,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';

const NEARBY_CAFE = {
  providerId: 'osm-hamou',
  kind: 'poi' as const,
  name: 'Hamou',
  address: 'Alger',
  latitude: 36.75,
  longitude: 3.06,
  eligible: true,
};

const coverage = vi.hoisted(() => ({ height: 238 }));

vi.mock('./useCoveredHeight', () => {
  const refs = new Map<
    (height: number) => void,
    (node: HTMLElement | null) => void
  >();
  return {
    useCoveredHeight: (onCoverChange: (height: number) => void) => {
      if (!refs.has(onCoverChange)) {
        refs.set(onCoverChange, (node) =>
          onCoverChange(node ? coverage.height : 0),
        );
      }
      return refs.get(onCoverChange);
    },
  };
});

const SEARCH_BOX = 'Search cafés and coworking venues';

const searchBox = () => screen.queryByLabelText(SEARCH_BOX);

const searchButton = () => screen.queryByRole('button', { name: 'Search' });

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

const landFocusMovedOnTheNextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(async () => {
  await landFocusMovedOnTheNextFrame();
  resetHostCreateFixtures();
  coverage.height = 238;
});

describe('the venue list folded over the map on a phone', () => {
  it('folds once the host picks a place from it, leaving the map to show the pin', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('option'));

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      searchBox(),
      'a place picked from the list is a search that worked, not a host who chose the map',
    ).toBeTruthy();
  });

  it('folds at a tap on the map, and stays open for a tap in the search box', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });

    fireEvent.pointerDown(screen.getByLabelText(SEARCH_BOX));
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerDown(screen.getByTestId('host-map'));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('folds at a tap on the name question, as at any tap outside it', async () => {
    renderHostCreateWizard();
    press('Choose address');
    press('Search');
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerDown(screen.getByLabelText('What is this place called?'));

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens when Next finds nothing chosen, offering the places to choose from', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });
    fireEvent.pointerDown(screen.getByTestId('host-map'));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    press('Next');

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('the search box put away while the host works the map on a phone', () => {
  it('keeps the search box through a drag, and puts it away once the host lets go', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    await screen.findByRole('button', { name: 'Places nearby' });

    press('Move the map');
    expect(
      searchBox(),
      'gone mid-drag, the box would resize the map under the finger moving it',
    ).toBeTruthy();

    press('Let go of the map');
    expect(searchBox()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Places nearby' })).toBeNull();
    expect(searchButton()).toBeTruthy();
    expect(screen.getByText('Pick a spot on the map.')).toBeTruthy();
  });

  it('names the place a tap chose where the search box was', async () => {
    renderHostCreateWizard();
    press('Choose venue');

    expect(searchBox()).toBeNull();
    const choice = await screen.findByRole('group', {
      name: 'Selected location',
    });
    expect(choice.textContent).toContain('Founders Café');
    expect(choice.textContent).toContain('12 Startup Street, Algiers');
  });

  it('asks for the name of an address a tap chose below that line, outside the panel', () => {
    renderHostCreateWizard();
    press('Choose address');
    const panel = searchButton()?.closest('[class*="max-lg:absolute"]');

    expect(panel).toBeTruthy();
    expect(
      panel?.contains(screen.getByLabelText('What is this place called?')),
      'inside the panel, the question would hide behind the search button',
    ).toBe(false);
  });

  it('stays put away when Next finds the chosen address unnamed, and says so at the question', () => {
    renderHostCreateWizard();
    press('Choose address');

    press('Next');

    expect(
      searchBox(),
      'the question is already in view, so bringing the box back only pushed it down',
    ).toBeNull();
    expect(
      screen.getByText('Name the venue so attendees can find the entrance.'),
    ).toBeTruthy();
  });

  it('brings the box back from the search button, with the cursor in it and the places nearby open', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    press('Choose address');

    press('Search');

    expect(document.activeElement).toBe(searchBox());
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });
    expect(
      toggle.getAttribute('aria-expanded'),
      'the host who does not know what to type still has the cafés around them',
    ).toBe('true');
    expect(screen.getByRole('option', { name: /Hamou/u })).toBeTruthy();
  });

  it('brings the box back with the list open when Next finds nothing chosen', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    await screen.findByRole('button', { name: 'Places nearby' });
    press('Let go of the map');

    press('Next');

    expect(searchBox()).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Places nearby' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('leaves the box alone while the host is typing in it', async () => {
    renderHostCreateWizard();
    await screen.findByRole('button', { name: 'Choose venue' });
    searchBox()?.focus();

    press('Let go of the map');

    expect(searchBox()).toBeTruthy();
    expect(searchButton()).toBeNull();
  });

  it('leaves the box in the rail from lg up, where the list sits beside the map', async () => {
    coverage.height = 0;
    renderHostCreateWizard();
    await screen.findByRole('button', { name: 'Choose venue' });

    press('Let go of the map');
    press('Choose venue');

    expect(searchBox()).toBeTruthy();
    expect(searchButton()).toBeNull();
  });
});
