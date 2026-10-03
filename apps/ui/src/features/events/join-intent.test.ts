import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rememberJoinIntent, takeJoinIntent } from './join-intent';

const PRESSED_AT = new Date('2026-10-02T14:35:00Z');
const MINUTE = 60_000;

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PRESSED_AT);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a Join pressed before signing in', () => {
  it('is owed to the meetup it was pressed on', () => {
    rememberJoinIntent('evt_oran');

    expect(takeJoinIntent('evt_oran')).toBe(true);
  });

  it('joins once, however often the page asks', () => {
    rememberJoinIntent('evt_oran');
    takeJoinIntent('evt_oran');

    expect(
      takeJoinIntent('evt_oran'),
      'a second read would join the reader again on every later visit',
    ).toBe(false);
  });

  it('is not owed to another meetup, and is spent by it all the same', () => {
    rememberJoinIntent('evt_oran');

    expect(takeJoinIntent('evt_algiers')).toBe(false);
    expect(takeJoinIntent('evt_oran')).toBe(false);
  });

  it('keeps for as long as the emailed code it may wait on', () => {
    rememberJoinIntent('evt_oran');
    vi.setSystemTime(PRESSED_AT.getTime() + 30 * MINUTE);

    expect(takeJoinIntent('evt_oran')).toBe(true);
  });

  it('lapses after that', () => {
    rememberJoinIntent('evt_oran');
    vi.setSystemTime(PRESSED_AT.getTime() + 30 * MINUTE + 1);

    expect(takeJoinIntent('evt_oran')).toBe(false);
  });

  it('only remembers the latest press', () => {
    rememberJoinIntent('evt_oran');
    rememberJoinIntent('evt_algiers');

    expect(takeJoinIntent('evt_oran')).toBe(false);
    rememberJoinIntent('evt_oran');
    rememberJoinIntent('evt_algiers');
    expect(takeJoinIntent('evt_algiers')).toBe(true);
  });

  it.each([
    ['not JSON', '{'],
    ['no meetup', JSON.stringify({ savedAt: PRESSED_AT.getTime() })],
    ['no time', JSON.stringify({ eventId: 'evt_oran' })],
    ['an empty meetup', JSON.stringify({ eventId: '', savedAt: 1 })],
  ])('owes nothing for a stored value with %s, and clears it', (_, stored) => {
    window.sessionStorage.setItem('fc:join-intent', stored);

    expect(takeJoinIntent('evt_oran')).toBe(false);
    expect(window.sessionStorage.getItem('fc:join-intent')).toBeNull();
  });

  it('leaves the reader at the button when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(() => rememberJoinIntent('evt_oran')).not.toThrow();
    expect(takeJoinIntent('evt_oran')).toBe(false);
  });
});
