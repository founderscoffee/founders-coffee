import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveDashboard } from './LiveDashboard';
import type { UseEventLiveResult } from '../useEventLive';

const live = {
  roster: [
    {
      userId: 'usr_1',
      name: 'Amina',
      status: 'arrived',
    },
    {
      userId: 'usr_2',
      name: 'Yacine',
      status: 'walking_in',
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

afterEach(() => cleanup());

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
    expect(screen.queryByRole('button', { name: 'سأتأخر' })).toBeNull();
    expect(screen.queryByText('حالتك')).toBeNull();
  });

  it('describes another attendee in the third person', () => {
    show();

    expect(
      screen.getByText('في الطريق'),
      'a roster badge is about the person named beside it, so it cannot speak as them',
    ).toBeTruthy();
    expect(screen.queryByText('أمشي نحو المكان')).toBeNull();
  });

  it('says what the room is and how full it is in one heading', () => {
    show();

    const heading = screen.getByRole('heading');
    expect(heading.textContent).toContain('مباشر');
    expect(heading.textContent).toContain('في المكان (1/2)');
  });

  it('keeps متصل for the socket alone, not for a person', () => {
    show();

    const rows = screen.getAllByRole('listitem');
    expect(rows.some((r) => r.textContent?.includes('متصل'))).toBe(false);
  });
});
