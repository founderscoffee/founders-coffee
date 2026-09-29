import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { DevSmsProvider } from '@founders-coffee/auth';

import { confirmPhoneNumber, sendPhoneCode } from './contact.js';
import { currentContact, signedInMember } from './contact.fixtures.js';

describe('PF-07c — SMS that cannot be delivered', () => {
  it('refuses rather than pretending, where no Twilio credentials exist', async () => {
    const member = await signedInMember();
    const original = (env as Record<string, unknown>).APP_ENVIRONMENT;
    (env as Record<string, unknown>).APP_ENVIRONMENT = 'production';

    try {
      const result = await sendPhoneCode(
        member.userId,
        '+213600000123',
        member.headers,
        { smsProvider: new DevSmsProvider() },
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'sms_unavailable' },
      });
    } finally {
      (env as Record<string, unknown>).APP_ENVIRONMENT = original;
    }
  });
});

describe('PF-07c — adding a verified phone', () => {
  it('attaches the number once its code is proven', async () => {
    const member = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2136${String(Date.now()).slice(-8)}`;

    expect(
      await sendPhoneCode(member.userId, phoneNumber, member.headers, deps),
    ).toMatchObject({ ok: true });
    const code = smsProvider.sent.at(-1)?.code ?? '';

    expect(
      await confirmPhoneNumber(
        member.userId,
        { phoneNumber, otp: code },
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    expect((await currentContact(member.db, member.userId)).phone).toBe(
      phoneNumber,
    );
  });

  it('never returns the session token the auth endpoint answers with', async () => {
    const member = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2137${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(member.userId, phoneNumber, member.headers, deps);
    const result = await confirmPhoneNumber(
      member.userId,
      { phoneNumber, otp: smsProvider.sent.at(-1)?.code ?? '' },
      member.headers,
      deps,
    );

    expect(result).toEqual({ ok: true, data: { accepted: true } });
    expect(JSON.stringify(result)).not.toContain(member.cookie.split('=')[1]);
  });

  it('refuses a number that already belongs to another member', async () => {
    const first = await signedInMember();
    const second = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2138${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(first.userId, phoneNumber, first.headers, deps);
    await confirmPhoneNumber(
      first.userId,
      { phoneNumber, otp: smsProvider.sent.at(-1)?.code ?? '' },
      first.headers,
      deps,
    );

    await sendPhoneCode(second.userId, phoneNumber, second.headers, deps);
    const result = await confirmPhoneNumber(
      second.userId,
      { phoneNumber, otp: smsProvider.sent.at(-1)?.code ?? '' },
      second.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentContact(second.db, second.userId)).phone).toBeNull();
    expect((await currentContact(first.db, first.userId)).phone).toBe(
      phoneNumber,
    );
  });

  it('refuses a code that does not match, leaving no number attached', async () => {
    const member = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2139${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(member.userId, phoneNumber, member.headers, deps);
    const result = await confirmPhoneNumber(
      member.userId,
      { phoneNumber, otp: '111111' },
      member.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentContact(member.db, member.userId)).phone).toBeNull();
  });
});
