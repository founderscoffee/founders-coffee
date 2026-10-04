import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import {
  browserAsked,
  CAFE,
  camera,
  flewTo,
  hostMap,
  press,
  renderHostMap,
  reverse,
  settle,
  STREET,
  suggestions,
} from './HostMap.fixtures';

const KSAR_EL_BOUKHARI = {
  code: '929',
  stateCode: '26',
  name: 'Ksar El Boukhari',
  nameAr: 'قصر البخاري',
  nameFr: 'Ksar El Boukhari',
  slug: 'ksar-el-boukhari',
  featured: false,
};

const MEDEA = { code: '26', name: 'Médéa', nameAr: 'المدية', nameFr: 'Médéa' };

const HERE = { latitude: 36.7731, longitude: 3.0595 };

const ALGIERS = '556';

const ASKED = 'Let’s find a café near you';

const MISSED = 'We could not find a place at that spot on the map.';

const WHY =
  'Share your location or tell us your city, and the map will show you the cafés nearby.';

const nothingThere = () =>
  new AppError(
    'map_venue_not_found',
    'No address could be resolved near this point',
  );

const locationPrompt = () => document.querySelector('dialog');

const isAsking = () => locationPrompt()?.open === true;

const inPrompt = () => within(locationPrompt() as HTMLElement);

const tapTheMap = () => fireEvent.click(screen.getByTestId('map-surface'));

beforeEach(() => {
  reverse.mutateAsync.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  suggestions.cities = [];
  suggestions.asked = [];
});

describe('the host map asking where the host is', () => {
  it('asks a host who came without a city as the map appears, and asks the browser nothing yet', () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    renderHostMap({ onCitySelect: vi.fn() });

    expect(isAsking()).toBe(true);
    expect(inPrompt().getByRole('heading', { name: ASKED })).toBeTruthy();
    expect(inPrompt().queryByText(MISSED)).toBeNull();
    expect(
      getCurrentPosition,
      'the browser asks for the location only once the host chooses to share it',
    ).not.toHaveBeenCalled();
  });

  it('leaves a host who came from a city page to the city they chose', () => {
    renderHostMap({ onCitySelect: vi.fn(), cityCode: ALGIERS });

    expect(isAsking()).toBe(false);
  });

  it('leaves a host who has a café already to the café', () => {
    renderHostMap({ onCitySelect: vi.fn(), venue: CAFE });

    expect(isAsking()).toBe(false);
  });

  it('does not take the focus from a field the host is typing in', () => {
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();

    renderHostMap({ onCitySelect: vi.fn() });

    expect(isAsking()).toBe(false);
    field.remove();
  });

  it('never asks in a wizard that cannot change city, as a repeated meetup', () => {
    renderHostMap();

    expect(locationPrompt()).toBeNull();
  });

  it('locates the host from its own button, as Locate me on the map does', async () => {
    reverse.mutateAsync.mockResolvedValueOnce(STREET);
    const onVenueSelect = vi.fn();
    const browser = browserAsked();
    renderHostMap({ onCitySelect: vi.fn(), onVenueSelect });

    fireEvent.click(inPrompt().getByRole('button', { name: 'Locate me' }));
    expect(isAsking()).toBe(false);
    await settle(() => browser.found(HERE));

    await waitFor(() =>
      expect(onVenueSelect).toHaveBeenCalledWith({ ...STREET, ...HERE }),
    );
    expect(camera.flyTo).toHaveBeenCalledWith(flewTo(HERE, 17));
  });

  it('moves the wizard to the city the host types', () => {
    suggestions.cities = [{ city: KSAR_EL_BOUKHARI, state: MEDEA }];
    const onCitySelect = vi.fn();
    renderHostMap({ onCitySelect });

    fireEvent.change(inPrompt().getByLabelText('Or type your city'), {
      target: { value: 'Ksar' },
    });
    fireEvent.click(
      inPrompt().getByRole('button', { name: /Ksar El Boukhari/u }),
    );

    expect(onCitySelect).toHaveBeenCalledWith(KSAR_EL_BOUKHARI);
    expect(isAsking()).toBe(false);
    expect(suggestions.asked).toContainEqual({
      marketCode: 'DZ',
      query: 'Ksar',
    });
  });

  it('puts itself away on Not now, and stays away', () => {
    const onCitySelect = vi.fn();
    const { rerender } = renderHostMap({ onCitySelect });

    press('Not now');
    rerender(hostMap({ onCitySelect }));

    expect(isAsking()).toBe(false);
    expect(onCitySelect).not.toHaveBeenCalled();
  });

  it('puts itself away once the host goes on to the next step', () => {
    const onCitySelect = vi.fn();
    const { rerender } = renderHostMap({ onCitySelect });

    rerender(hostMap({ onCitySelect, isInteractive: false }));

    expect(isAsking()).toBe(false);
  });

  it('asks again when a tap finds nothing there, saying so, rather than raising an error', async () => {
    reverse.mutateAsync.mockRejectedValueOnce(nothingThere());
    const onMiss = vi.fn();
    renderHostMap({ onCitySelect: vi.fn(), cityCode: ALGIERS, onMiss });

    tapTheMap();

    await waitFor(() => expect(isAsking()).toBe(true));
    expect(
      onMiss,
      'the question is the answer to the miss: the places would open behind it',
    ).not.toHaveBeenCalled();
    const description = locationPrompt()
      ?.getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent);
    expect(
      description,
      'a reader hears why the map is asking again before what it asks',
    ).toEqual([MISSED, WHY]);
    expect(
      screen.queryByText('Choose a café, restaurant, or coworking space'),
      'the host tapped open country, not the wrong kind of place',
    ).toBeNull();
  });

  it('still raises a map that failed as an error, not as a question', async () => {
    reverse.mutateAsync.mockRejectedValueOnce(
      new AppError('map_provider_unavailable', 'Map provider request failed'),
    );
    renderHostMap({ onCitySelect: vi.fn(), cityCode: ALGIERS });

    tapTheMap();

    expect(
      await screen.findByText('Could not load the venue map.'),
    ).toBeTruthy();
    expect(isAsking()).toBe(false);
  });

  it('asks again after the browser closed it, as Escape does', async () => {
    reverse.mutateAsync.mockRejectedValueOnce(nothingThere());
    renderHostMap({ onCitySelect: vi.fn() });

    act(() => locationPrompt()?.close());
    expect(isAsking()).toBe(false);
    tapTheMap();

    await waitFor(() =>
      expect(
        isAsking(),
        'a prompt the browser closed without telling the map stayed open in its state, so it could never be shown again',
      ).toBe(true),
    );
  });
});
