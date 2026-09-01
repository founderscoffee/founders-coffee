import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostCreatePage } from './HostCreatePage';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateEvent: () => ({ mutateAsync: mocks.mutateAsync }),
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
  }) => (
    <button
      onClick={() =>
        onVenueSelect({
          providerId: 'poi-cafe',
          name: 'Founders Café',
          address: '12 Startup Street, Algiers',
          latitude: 36.7538,
          longitude: 3.0588,
        })
      }
    >
      Choose venue
    </button>
  ),
}));

vi.mock('./VenueSearch', () => ({
  VenueSearch: () => null,
}));

vi.mock('./DatetimePicker', () => ({
  DatetimePicker: ({
    onChange,
  }: {
    onChange: (startsAt: number, endsAt: number) => void;
  }) => (
    <button
      onClick={() =>
        onChange(
          new Date('2099-01-15T18:00:00Z').getTime(),
          new Date('2099-01-15T19:00:00Z').getTime(),
        )
      }
    >
      Set schedule
    </button>
  ),
}));

vi.mock('./ScheduleSummary', () => ({
  ScheduleSummary: () => null,
}));

vi.mock('../auth/Turnstile', () => ({
  Turnstile: ({
    onToken,
    resetKey,
  }: {
    onToken: (token: string | null) => void;
    resetKey?: number;
  }) => (
    <button
      data-testid="event-turnstile"
      data-reset-key={resetKey}
      onClick={() => onToken('single-use-token')}
    >
      Complete verification
    </button>
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

describe('HostCreatePage Turnstile submission', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('submits one token and requires a reissued token after mutation failure', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('creation failed'));
    render(
      <HostCreatePage
        locale="en"
        market={market}
        city={city}
        mapboxToken="map-token"
        turnstileSiteKey="site-key"
        isTurnstileBypassed={false}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose venue' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set schedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Protected meetup' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'A complete protected meetup for founders.' },
    });

    const publish = screen.getByRole('button', { name: 'Publish' });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Complete verification' }),
    );
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(publish);

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      data: {
        event: expect.objectContaining({
          marketCode: 'DZ',
          cityCode: '1',
          title: 'Protected meetup',
        }),
        turnstileToken: 'single-use-token',
      },
    });
    await waitFor(() =>
      expect(
        screen.getByTestId('event-turnstile').getAttribute('data-reset-key'),
      ).toBe('1'),
    );
    expect((publish as HTMLButtonElement).disabled).toBe(true);
  });
});
