import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LiveDashboard } from './LiveDashboard';
import type { UseEventLiveResult } from '../useEventLive';

const live = {
  roster: [
    {
      userId: 'usr_1',
      name: 'Amina',
      status: 'arrived',
    },
  ],
  host: null,
  connectionState: 'connected',
  error: null,
  notAttending: false,
  sendArrived: vi.fn(),
  sendWalkingIn: vi.fn(),
  sendRunningLate: vi.fn(),
  sendTablePin: vi.fn(),
  disconnect: vi.fn(),
} as unknown as UseEventLiveResult;

const show = () =>
  render(<LiveDashboard live={live} currentUserId="usr_1" locale="ar" />);

describe('what the live section is for', () => {
  it('reports the room', () => {
    show();

    expect(screen.getByText('Amina')).toBeTruthy();
  });

  it('does not ask the reader about themselves', () => {
    show();

    expect(
      screen.queryByRole('button', { name: 'أمشي نحو المكان' }),
      'a reader’s own status belongs in their seat panel; offering it here too is the same control in two places',
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'متأخر' })).toBeNull();
    expect(screen.queryByText('حالتك')).toBeNull();
  });
});
