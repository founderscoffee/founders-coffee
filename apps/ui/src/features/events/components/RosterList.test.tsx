import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RosterList } from './RosterList';
import type { RosterUser } from '../useEventLive';

const show = (roster: RosterUser[], currentUserId = 'usr_me') =>
  render(
    <RosterList roster={roster} currentUserId={currentUserId} locale="ar" />,
  );

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
