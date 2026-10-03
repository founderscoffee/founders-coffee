import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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

const SEARCH_BOX = 'Search cafés and coworking venues';

const searchBox = () => screen.queryByLabelText(SEARCH_BOX);

const searchButton = () => screen.queryByRole('button', { name: 'Search' });

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

const mapLoaded = () => screen.findByRole('button', { name: 'Move the map' });

const isListHiddenBelowLg = () =>
  screen.getByRole('listbox').closest('.max-lg\\:hidden') !== null;

const landFocusMovedOnTheNextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(async () => {
  await landFocusMovedOnTheNextFrame();
  resetHostCreateFixtures();
});

describe('the venue search in the host wizard', () => {
  it('opens on the places nearby and the map, with no search box to fill', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    await mapLoaded();

    expect(await screen.findByRole('option', { name: /Hamou/u })).toBeTruthy();
    expect(
      searchBox(),
      'an empty box on arrival read as a field the host had to fill before Next',
    ).toBeNull();
    expect(isListHiddenBelowLg()).toBe(false);
    expect(searchButton()).toBeTruthy();
  });

  it('opens the box from Search on the map, with the cursor in it', async () => {
    renderHostCreateWizard();
    await mapLoaded();

    press('Search');

    expect(document.activeElement).toBe(searchBox());
    expect(
      searchButton(),
      'with the box open, the button that opens it steps aside',
    ).toBeNull();
  });

  it('puts the box and the places away as soon as the host moves the map', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    await mapLoaded();
    await screen.findByRole('option', { name: /Hamou/u });
    press('Search');

    press('Move the map');

    expect(searchBox()).toBeNull();
    expect(isListHiddenBelowLg()).toBe(true);
    expect(searchButton()).toBeTruthy();
  });

  it('puts them away at a tap on the map, and names the place it chose', async () => {
    renderHostCreateWizard();
    await mapLoaded();
    press('Search');

    press('Choose venue');

    expect(searchBox()).toBeNull();
    const choice = await screen.findByRole('group', {
      name: 'Selected location',
    });
    expect(choice.textContent).toContain('Founders Café');
    expect(choice.textContent).toContain('12 Startup Street, Algiers');
  });

  it('asks for the name of an address a tap chose, with no search box above it', async () => {
    renderHostCreateWizard();
    await mapLoaded();

    press('Choose address');

    expect(searchBox()).toBeNull();
    expect(screen.getByLabelText('What is this place called?')).toBeTruthy();
  });

  it('gives the map back once a place is picked from the list, and forgets the search', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    getHostCreateMocks().venueSearch = [NEARBY_CAFE];
    renderHostCreateWizard();
    await mapLoaded();
    press('Search');
    fireEvent.change(searchBox() as HTMLElement, { target: { value: 'Ha' } });

    fireEvent.click(await screen.findByRole('option', { name: /Hamou/u }));

    expect(
      searchBox(),
      'an empty box above the place picked read as a step still to do',
    ).toBeNull();
    expect(isListHiddenBelowLg()).toBe(true);
    press('Search');
    expect((searchBox() as HTMLInputElement).value).toBe('');
  });

  it('lists the places again when Next finds nothing chosen, with the focus on the first', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    await mapLoaded();
    await screen.findByRole('option', { name: /Hamou/u });
    press('Move the map');

    press('Next');

    expect(isListHiddenBelowLg()).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole('option', { name: /Hamou/u }),
    );
  });

  it('opens the search when Next finds nothing chosen and no place nearby to offer', () => {
    renderHostCreateWizard();

    press('Next');

    expect(document.activeElement).toBe(searchBox());
  });
});
