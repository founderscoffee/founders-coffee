import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { RepeatEventTemplate } from '../../features/events/api';
import {
  getHostCreateMocks,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';

const hostCreateMocks = getHostCreateMocks();

const KSAR = { code: '929', stateCode: '26', name: 'Ksar El Boukhari' };

const REPEAT_TEMPLATE: RepeatEventTemplate = {
  sourceEventId: 'evt_previous',
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Previous founders breakfast',
  description: 'A relaxed breakfast for local founders.',
  venue: 'Founders Café',
  venueAddress: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
  language: 'ar' as const,
};

const search = (value: string) =>
  fireEvent.change(screen.getByLabelText('Search cafés and coworking venues'), {
    target: { value },
  });

describe('moving the wizard to a city the host searched for', () => {
  afterEach(resetHostCreateFixtures);

  it('opens it on that city, the way the city’s own page would', async () => {
    hostCreateMocks.citySuggestions = [
      { city: KSAR, state: { code: '26', name: 'Medea' } },
    ];
    renderHostCreateWizard();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose venue' }),
    );
    search('ksar');

    const cities = await screen.findByRole('list', { name: 'Cities' });
    fireEvent.click(within(cities).getByRole('button'));

    expect(hostCreateMocks.navigate).toHaveBeenCalledWith({
      to: '/$locale/$market/host/create',
      params: { locale: 'en', market: 'algeria' },
      search: { city: '929' },
      replace: true,
    });
    expect(
      (
        screen.getByLabelText(
          'Search cafés and coworking venues',
        ) as HTMLInputElement
      ).value,
    ).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByText('Choose a supported venue to continue.'),
      'a venue chosen in the last city would open the map there, not on the one the host asked for',
    ).toBeTruthy();
  });

  it('offers no other city while repeating a meetup, which keeps its own', async () => {
    hostCreateMocks.citySuggestions = [
      { city: KSAR, state: { code: '26', name: 'Medea' } },
    ];
    renderHostCreateWizard('en', REPEAT_TEMPLATE);
    search('ksar');

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(
      screen.queryByRole('list', { name: 'Cities' }),
      'the loader opens a repeat on its template’s city, so a city picked here would go nowhere',
    ).toBeNull();
  });
});
