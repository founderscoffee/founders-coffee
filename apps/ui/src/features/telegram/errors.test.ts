import { describe, expect, it } from 'vitest';

import { telegramErrorFor } from './errors';

const refusal = (code: string) => Object.assign(new Error(code), { code });

describe('telegramErrorFor', () => {
  it('asks for a minute when Telegram itself did not answer', () => {
    expect(telegramErrorFor(refusal('telegram_unavailable'), 'en')).toBe(
      "Telegram isn't answering right now. Try again in a minute.",
    );
  });

  it('asks for a few minutes once the budget is spent', () => {
    expect(telegramErrorFor(refusal('rate_limited'), 'en')).toBe(
      'Too many attempts. Wait a few minutes and try again.',
    );
  });

  it.each([
    'telegram_group_unavailable',
    'rsvp_not_found',
    'event_already_ended',
    'event_is_cancelled',
  ])('says the group is closed to newcomers on %s', (code) => {
    expect(telegramErrorFor(refusal(code), 'en')).toBe(
      "This meetup's group isn't taking new members.",
    );
  });

  it('falls back to trying again for anything else', () => {
    expect(telegramErrorFor(new Error('offline'), 'en')).toBe(
      "That didn't work. Try again.",
    );
  });

  it('speaks the reader’s language', () => {
    expect(telegramErrorFor(refusal('rate_limited'), 'ar')).toBe(
      'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.',
    );
  });
});
