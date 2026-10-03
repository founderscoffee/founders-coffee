import { describe, expect, it } from 'vitest';

import {
  allowSignInCode,
  mailboxOf,
  SIGN_IN_CODE_MAILBOX_BUDGET,
  SIGN_IN_CODE_SENDER_BUDGET,
} from './sign-in-code-limit.js';

const freshSender = (): string => `sender-${crypto.randomUUID()}`;

const freshMailbox = (): string => `member-${crypto.randomUUID()}@example.dz`;

const askRepeatedly = async (
  requests: ReadonlyArray<{ recipient: string; address: string }>,
): Promise<boolean[]> => {
  const outcomes: boolean[] = [];
  for (const request of requests) outcomes.push(await allowSignInCode(request));
  return outcomes;
};

describe('mailboxOf', () => {
  it.each([
    [' Member@Example.DZ ', 'member@example.dz'],
    ['member+meetups@example.dz', 'member@example.dz'],
    ['first.last@gmail.com', 'firstlast@gmail.com'],
    ['First.Last+x@GoogleMail.com', 'firstlast@gmail.com'],
    ['first.last@outlook.com', 'first.last@outlook.com'],
    ['no-at-sign', 'no-at-sign'],
  ])('counts %s as %s', (email, mailbox) => {
    expect(mailboxOf(email)).toBe(mailbox);
  });
});

describe('allowSignInCode (real RateLimiterDO via Miniflare)', () => {
  it('gives a mailbox its hourly codes, whoever asks, then refuses', async () => {
    const recipient = freshMailbox();
    const requests = Array.from(
      { length: SIGN_IN_CODE_MAILBOX_BUDGET.limit + 1 },
      () => ({
        recipient,
        address: freshSender(),
      }),
    );

    const outcomes = await askRepeatedly(requests);

    expect(
      outcomes.slice(0, SIGN_IN_CODE_MAILBOX_BUDGET.limit).every(Boolean),
    ).toBe(true);
    expect(outcomes.at(-1)).toBe(false);
  });

  it('counts every spelling of a Gmail address as one mailbox', async () => {
    const name = `m${crypto.randomUUID().replaceAll('-', '')}`;
    const spellings = [
      `${name}@gmail.com`,
      `${name.slice(0, 4)}.${name.slice(4)}@gmail.com`,
      `${name}+meetups@gmail.com`,
      `${name.toUpperCase()}@googlemail.com`,
      `${name.slice(0, 2)}.${name.slice(2)}+x@googlemail.com`,
      `${name}+again@gmail.com`,
    ];

    const outcomes = await askRepeatedly(
      spellings.map((recipient) => ({ recipient, address: freshSender() })),
    );

    expect(outcomes).toEqual([true, true, true, true, true, false]);
  });

  it('lets one sender ask for its limit across any mailboxes, then refuses', async () => {
    const address = freshSender();
    const requests = Array.from(
      { length: SIGN_IN_CODE_SENDER_BUDGET.limit + 1 },
      () => ({
        recipient: freshMailbox(),
        address,
      }),
    );

    const outcomes = await askRepeatedly(requests);

    expect(
      outcomes.slice(0, SIGN_IN_CODE_SENDER_BUDGET.limit).every(Boolean),
    ).toBe(true);
    expect(outcomes.at(-1)).toBe(false);
  });

  it("does not spend a mailbox's allowance for a sender over its limit", async () => {
    const address = freshSender();
    await askRepeatedly(
      Array.from({ length: SIGN_IN_CODE_SENDER_BUDGET.limit }, () => ({
        recipient: freshMailbox(),
        address,
      })),
    );
    const recipient = freshMailbox();

    const refused = await allowSignInCode({ recipient, address });
    const afterwards = await askRepeatedly(
      Array.from({ length: SIGN_IN_CODE_MAILBOX_BUDGET.limit }, () => ({
        recipient,
        address: freshSender(),
      })),
    );

    expect(refused).toBe(false);
    expect(
      afterwards.every(Boolean),
      'a sender past its limit must not drain the mailboxes it names',
    ).toBe(true);
  });
});
