import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RosterList } from './RosterList';
import type { HostState, RosterUser } from '../useEventLive';

const show = (
  roster: RosterUser[],
  host: HostState | null = null,
  currentUserId = 'usr_me',
) =>
  render(
    <RosterList
      roster={roster}
      host={host}
      currentUserId={currentUserId}
      locale="ar"
    />,
  );

const hostOf = (overrides: Partial<HostState> = {}): HostState => ({
  userId: 'usr_1',
  arrived: false,
  ...overrides,
});

const amina = {
  userId: 'usr_1',
  name: 'Amina Benali',
  status: 'arrived',
} satisfies RosterUser;

const me = {
  userId: 'usr_me',
  name: 'Yacine Mokrani',
  status: 'running_late',
  etaMinutes: 12,
} satisfies RosterUser;

afterEach(() => cleanup());

describe('who is in the room', () => {
  it('stands each person in for their photo with their initials', () => {
    show([amina]);

    expect(screen.getByText('AB')).toBeTruthy();
  });

  it('marks the reader rather than leaving them to find themselves', () => {
    show([amina, me]);

    const rows = screen.getAllByRole('listitem');
    expect(rows[1]?.textContent).toContain('أنت');
    expect(rows[0]?.textContent).not.toContain('أنت');
  });

  it('writes the status out, so the colour is never the only thing saying it', () => {
    show([amina]);

    expect(screen.getByText(/في المكان/)).toBeTruthy();
  });
});

describe('how long someone running late will be', () => {
  it('shows the minutes they entered', () => {
    show([me]);

    expect(
      screen.getByText(/12/),
      'the ETA is the whole point of saying you are late, and it used to render as the words "ETA in minutes"',
    ).toBeTruthy();
  });

  it('says nothing about minutes for someone who gave none', () => {
    show([amina]);

    expect(screen.queryByText(/دقيقة|دقائق/)).toBeNull();
  });
});

describe('an empty room', () => {
  it('says so instead of showing nothing at all', () => {
    show([]);

    expect(screen.getByText('لا يوجد مشاركون متصلون')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('the host in the room', () => {
  it('stands in the list with everyone else, wearing the badge', () => {
    show([amina, me], hostOf());

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('مضيف');
    expect(
      rows[1]?.textContent,
      'only the host wears it, or the badge says nothing',
    ).not.toContain('مضيف');
  });

  it('says where to find them once they are at the venue', () => {
    show(
      [amina],
      hostOf({ arrived: true, tableNumber: 4, visualCue: 'سترة حمراء' }),
    );

    expect(screen.getByText('طاولة 4 · سترة حمراء')).toBeTruthy();
  });

  it('says nothing about a table for a host who has not turned up', () => {
    show([amina], hostOf({ tableNumber: 4, visualCue: 'سترة حمراء' }));

    expect(
      screen.queryByText(/طاولة 4/),
      'a table they are not sitting at yet sends people to an empty chair',
    ).toBeNull();
  });

  it('shows their status from the roster like anyone else', () => {
    show([{ ...amina, status: 'arrived' }], hostOf({ arrived: true }));

    const row = screen.getAllByRole('listitem')[0];
    expect(row?.textContent).toContain('في المكان');
  });
});
