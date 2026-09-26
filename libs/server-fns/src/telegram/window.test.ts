import { describe, expect, it } from 'vitest';

import {
  isAdmitting,
  isConnectable,
  meetupEndsAt,
  telegramWrapUpAt,
} from './window.js';

const startsAt = new Date('2099-01-15T18:00:00Z');
const endsAt = new Date('2099-01-15T21:30:00Z');

describe("a meetup's Telegram window", () => {
  it('ends a meetup at its end, or two hours after a start with no end', () => {
    expect(meetupEndsAt({ startsAt, endsAt })).toEqual(endsAt);
    expect(meetupEndsAt({ startsAt, endsAt: null })).toEqual(
      new Date('2099-01-15T20:00:00Z'),
    );
  });

  it('says goodbye a day after the meetup is over', () => {
    expect(telegramWrapUpAt({ startsAt, endsAt })).toEqual(
      new Date('2099-01-16T21:30:00Z'),
    );
    expect(telegramWrapUpAt({ startsAt, endsAt: null })).toEqual(
      new Date('2099-01-16T20:00:00Z'),
    );
  });

  it('lets a group connect until the published meetup is over, and never to a cancelled one', () => {
    const published = { status: 'published' as const, startsAt, endsAt };

    expect(isConnectable(published, new Date('2099-01-15T21:29:59Z'))).toBe(
      true,
    );
    expect(isConnectable(published, endsAt)).toBe(false);
    expect(
      isConnectable(
        { ...published, endsAt: null },
        new Date('2099-01-15T20:00:01Z'),
      ),
    ).toBe(false);
    expect(
      isConnectable(
        { ...published, status: 'cancelled' },
        new Date('2099-01-15T12:00:00Z'),
      ),
    ).toBe(false);
  });

  it('lets members in until a day after the published meetup is over', () => {
    const published = { status: 'published' as const, startsAt, endsAt };

    expect(isAdmitting(published, new Date('2099-01-16T21:29:59Z'))).toBe(true);
    expect(isAdmitting(published, new Date('2099-01-16T21:30:00Z'))).toBe(
      false,
    );
    expect(
      isAdmitting(
        { ...published, status: 'cancelled' },
        new Date('2099-01-15T12:00:00Z'),
      ),
    ).toBe(false);
  });
});
