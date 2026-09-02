import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import { HostCreatePage } from './HostCreatePage';

const hostCreateMocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  navigate: vi.fn(),
  isAuthenticated: true,
  isLoading: false,
}));

export const getHostCreateMocks = () => hostCreateMocks;

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hostCreateMocks.navigate,
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({
    isAuthenticated: hostCreateMocks.isAuthenticated,
    isLoading: hostCreateMocks.isLoading,
  }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateEvent: () => ({ mutateAsync: hostCreateMocks.mutateAsync }),
  useHostMapContext: () => ({
    data: {
      center: { latitude: 36.7538, longitude: 3.0588 },
      bounds: [2.9, 36.6, 3.3, 36.9],
    },
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./ClientOnly', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./HostMap', () => ({
  HostMap: ({
    onVenueSelect,
  }: {
    onVenueSelect: (venue: {
      providerId: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    }) => void;
  }) =>
    createElement(
      'button',
      {
        onClick: () =>
          onVenueSelect({
            providerId: 'poi-cafe',
            name: 'Founders Café',
            address: '12 Startup Street, Algiers',
            latitude: 36.7538,
            longitude: 3.0588,
          }),
      },
      'Choose venue',
    ),
}));

vi.mock('./VenueSearch', () => ({
  VenueSearch: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) =>
    createElement('input', {
      id: 'venue-search',
      'aria-label': 'Search cafés and coworking venues',
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value),
    }),
}));

vi.mock('./DatetimePicker', () => ({
  DatetimePicker: ({
    onChange,
  }: {
    onChange: (startsAt: number, endsAt: number) => void;
  }) =>
    createElement(
      'button',
      {
        id: 'host-schedule',
        onClick: () =>
          onChange(
            new Date('2099-01-15T18:00:00Z').getTime(),
            new Date('2099-01-15T19:00:00Z').getTime(),
          ),
      },
      'Set schedule',
    ),
}));

vi.mock('./ScheduleSummary', () => ({
  ScheduleSummary: () => createElement('div', null, 'Schedule summary'),
}));

vi.mock('../auth/Turnstile', () => ({
  Turnstile: ({
    onToken,
    resetKey,
  }: {
    onToken: (token: string | null) => void;
    resetKey?: number;
  }) =>
    createElement(
      'button',
      {
        'data-testid': 'event-turnstile',
        'data-reset-key': resetKey,
        onClick: () => onToken('single-use-token'),
      },
      'Complete verification',
    ),
}));

const market = {
  code: 'DZ',
  slug: 'algeria',
  timezone: 'Africa/Algiers',
} as never;

const city = {
  code: '1',
  name: 'Algiers',
  nameAr: 'الجزائر',
} as never;

export const renderHostCreateWizard = (locale: 'ar' | 'fr' | 'en' = 'en') =>
  render(
    createElement(HostCreatePage, {
      locale,
      market,
      city,
      mapboxToken: 'map-token',
      turnstileSiteKey: 'site-key',
      isTurnstileBypassed: false,
    }),
  );

export const goToHostDetails = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Choose venue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Set schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
};

export const fillHostDetails = () => {
  fireEvent.change(screen.getByLabelText(/^Title/), {
    target: { value: 'Protected meetup' },
  });
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: 'A complete protected meetup for founders.' },
  });
};

export const resetHostCreateFixtures = () => {
  cleanup();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  hostCreateMocks.isAuthenticated = true;
  hostCreateMocks.isLoading = false;
  vi.clearAllMocks();
};
