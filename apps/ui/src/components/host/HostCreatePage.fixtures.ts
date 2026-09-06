import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import { HostCreatePage } from './HostCreatePage';

export const CREATED_EVENT = {
  id: 'evt_00000000000000000000000000000001',
  slug: 'protected-meetup',
  marketCode: 'DZ',
  cityCode: '1',
  hostId: 'usr_host01',
};

const hostCreateMocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  navigate: vi.fn(),
  routerInvalidate: vi.fn(),
  invalidateCreatedEvent: vi.fn(),
  isAuthenticated: true,
  isLoading: false,
  nearbyVenues: [] as unknown[],
  venueSearch: [] as unknown[],
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  signInSocial: vi.fn(),
  mapContext: {
    data: undefined as
      | { center: { latitude: number; longitude: number }; bounds: number[] }
      | undefined,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

const READY_MAP_CONTEXT = {
  center: { latitude: 36.7538, longitude: 3.0588 },
  bounds: [2.9, 36.6, 3.3, 36.9],
};

export const getHostCreateMocks = () => hostCreateMocks;

/**
 * Restore the default mutation outcome: a resolved create returning the persisted event.
 *
 * The wizard reads the created event's canonical route off the mutation result, so a bare `vi.fn()`
 * would fail every publish path for the wrong reason. Applied at module load as well as after each
 * test, since the first test in a file runs before any teardown hook has.
 */
const applyDefaultHostCreateMocks = () => {
  hostCreateMocks.mutateAsync.mockResolvedValue(CREATED_EVENT);
  hostCreateMocks.sendVerificationOtp.mockResolvedValue({ error: null });
  hostCreateMocks.signInEmailOtp.mockResolvedValue({ error: null });
  hostCreateMocks.invalidateCreatedEvent.mockResolvedValue(undefined);
  hostCreateMocks.mapContext.data = READY_MAP_CONTEXT;
  hostCreateMocks.nearbyVenues = [];
  hostCreateMocks.venueSearch = [];
  hostCreateMocks.mapContext.isError = false;
  hostCreateMocks.mapContext.error = null;
};

applyDefaultHostCreateMocks();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hostCreateMocks.navigate,
  useRouter: () => ({ invalidate: hostCreateMocks.routerInvalidate }),
  Link: ({ children }: { children: ReactNode }) =>
    createElement('a', { href: '#' }, children),
}));

vi.mock('../../lib/auth', () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: hostCreateMocks.sendVerificationOtp },
    signIn: {
      emailOtp: hostCreateMocks.signInEmailOtp,
      social: hostCreateMocks.signInSocial,
    },
  },
}));

vi.mock('../auth/Turnstile', () => ({
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) =>
    createElement(
      'button',
      { onClick: () => onToken('captcha-token') },
      'Solve captcha',
    ),
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({
    isAuthenticated: hostCreateMocks.isAuthenticated,
    isLoading: hostCreateMocks.isLoading,
  }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateEvent: () => ({ mutateAsync: hostCreateMocks.mutateAsync }),
  useInvalidateCreatedEvent: () => hostCreateMocks.invalidateCreatedEvent,
  useHostMapContext: () => hostCreateMocks.mapContext,
  useNearbyVenues: () => ({
    data: hostCreateMocks.nearbyVenues,
    isPending: false,
  }),
  useVenueSearch: () => ({
    data: hostCreateMocks.venueSearch,
    error: null,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./ClientOnly', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./HostMap', () => ({
  HostMap: ({
    isInteractive = true,
    onVenueSelect,
  }: {
    isInteractive?: boolean;
    onVenueSelect: (venue: {
      providerId: string;
      kind: 'poi' | 'address';
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    }) => void;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'host-map', 'data-interactive': String(isInteractive) },
      [
        createElement(
          'button',
          {
            key: 'poi',
            onClick: () =>
              onVenueSelect({
                providerId: 'poi-cafe',
                kind: 'poi' as const,
                name: 'Founders Café',
                address: '12 Startup Street, Algiers',
                latitude: 36.7538,
                longitude: 3.0588,
              }),
          },
          'Choose venue',
        ),
        createElement(
          'button',
          {
            key: 'address',
            onClick: () =>
              onVenueSelect({
                providerId: 'address-yousfi',
                kind: 'address' as const,
                name: '15 Rue Yousfi Mohamed',
                address: '15 Rue Yousfi Mohamed, Alger',
                latitude: 36.7501,
                longitude: 3.0601,
              }),
          },
          'Choose address',
        ),
      ],
    ),
}));

vi.mock('./VenueSearch', () => ({
  VenueSearch: ({
    value,
    isDisabled,
    onChange,
  }: {
    value: string;
    isDisabled?: boolean;
    onChange: (value: string) => void;
  }) =>
    createElement('input', {
      id: 'venue-search',
      'aria-label': 'Search cafés and coworking venues',
      value,
      disabled: isDisabled ?? false,
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
      turnstileSiteKey: 'test-site-key',
      hasSocial: false,
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
  applyDefaultHostCreateMocks();
};

export const publishHostEvent = async () => {
  await goToHostDetails();
  fillHostDetails();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and publish' }));
};
