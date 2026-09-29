import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { DevEmailProvider } from '@founders-coffee/auth';

import {
  confirmEmailChange,
  requestEmailChange,
  sendCurrentEmailCode,
} from './contact.js';
import {
  currentContact,
  nextEmail,
  signedInMember,
} from './contact.fixtures.js';

const codeFor = (provider: DevEmailProvider, type: string) =>
  provider.sent.filter((sent) => sent.type === type).at(-1)?.otp ?? '';

describe('PF-07c — changing a verified email', () => {
  it('does not require Turnstile for an authenticated contact operation', async () => {
    const member = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const runtime = env as Record<string, unknown>;
    const previous = runtime.TURNSTILE_DISABLED;
    runtime.TURNSTILE_DISABLED = undefined;

    try {
      const result = await sendCurrentEmailCode(
        member.userId,
        member.email,
        member.headers,
        { emailProvider },
      );
      expect(result).toMatchObject({ ok: true });
      expect(emailProvider.sent).toHaveLength(1);
    } finally {
      runtime.TURNSTILE_DISABLED = previous;
    }
  });

  it('moves the address only after both sides are proven', async () => {
    const member = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const deps = { emailProvider };
    const newEmail = nextEmail();

    expect(
      await sendCurrentEmailCode(
        member.userId,
        member.email,
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    const proof = codeFor(emailProvider, 'email-verification');
    expect(proof).toHaveLength(6);

    expect(
      await requestEmailChange(
        member.userId,
        { newEmail, otp: proof },
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    expect((await currentContact(member.db, member.userId)).email).toBe(
      member.email,
    );

    const confirmation = codeFor(emailProvider, 'change-email');
    expect(
      await confirmEmailChange(
        member.userId,
        { newEmail, otp: confirmation },
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    expect((await currentContact(member.db, member.userId)).email).toBe(
      newEmail,
    );
  });

  it('refuses the request when the current address is not proven', async () => {
    const member = await signedInMember();
    const deps = { emailProvider: new DevEmailProvider() };

    const result = await requestEmailChange(
      member.userId,
      { newEmail: nextEmail(), otp: '000000' },
      member.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentContact(member.db, member.userId)).email).toBe(
      member.email,
    );
  });

  it('says nothing about an address that already belongs to someone, and moves nothing', async () => {
    const mine = await signedInMember();
    const theirs = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const deps = { emailProvider };

    await sendCurrentEmailCode(mine.userId, mine.email, mine.headers, deps);
    const requested = await requestEmailChange(
      mine.userId,
      {
        newEmail: theirs.email,
        otp: codeFor(emailProvider, 'email-verification'),
      },
      mine.headers,
      deps,
    );

    expect(requested).toMatchObject({ ok: true });
    expect(codeFor(emailProvider, 'change-email')).toBe('');
    expect(emailProvider.sent.some((sent) => sent.email === theirs.email)).toBe(
      false,
    );

    const confirmed = await confirmEmailChange(
      mine.userId,
      { newEmail: theirs.email, otp: '123456' },
      mine.headers,
      deps,
    );

    expect(confirmed).toMatchObject({ ok: false });
    expect((await currentContact(mine.db, mine.userId)).email).toBe(mine.email);
    expect((await currentContact(theirs.db, theirs.userId)).email).toBe(
      theirs.email,
    );
  });

  it('refuses a confirmation code that does not match', async () => {
    const member = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const deps = { emailProvider };
    const newEmail = nextEmail();

    await sendCurrentEmailCode(
      member.userId,
      member.email,
      member.headers,
      deps,
    );
    await requestEmailChange(
      member.userId,
      { newEmail, otp: codeFor(emailProvider, 'email-verification') },
      member.headers,
      deps,
    );

    const result = await confirmEmailChange(
      member.userId,
      { newEmail, otp: '999999' },
      member.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentContact(member.db, member.userId)).email).toBe(
      member.email,
    );
  });
});
