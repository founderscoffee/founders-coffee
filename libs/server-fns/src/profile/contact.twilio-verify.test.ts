import { describe, expect, it } from 'vitest';

import type { SmsProvider } from '@founders-coffee/auth';

import { confirmPhoneNumber, sendPhoneCode } from './contact.js';
import { currentContact, signedInMember } from './contact.fixtures.js';

const otherCode = (code: string, offset = 1) =>
  String((Number(code) + offset) % 1_000_000).padStart(6, '0');

/**
 * Twilio Verify as the provider interface sees it. It texts a code of its own, never the one Better
 * Auth generated, sends that same code again while it is pending, and approves it once: after that
 * the verification is gone and the code is refused like any other.
 */
const twilioVerifyModel = () => {
  const pending = new Map<string, string>();
  const untexted: string[] = [];
  const checked: string[] = [];
  const provider: SmsProvider = {
    sendOtp: async ({ phoneNumber, code }) => {
      untexted.push(code);
      pending.set(phoneNumber, pending.get(phoneNumber) ?? otherCode(code));
    },
    verifyOtp: async ({ phoneNumber, code }) => {
      checked.push(code);
      if (pending.get(phoneNumber) !== code) return false;
      pending.delete(phoneNumber);
      return true;
    },
  };
  return {
    deps: { smsProvider: provider },
    untexted,
    checked,
    textedTo: (phoneNumber: string) => pending.get(phoneNumber) ?? '',
  };
};

describe('PF-07c — adding a phone through Twilio Verify', () => {
  it('attaches the number with the code Twilio texted, asking Twilio once', async () => {
    const member = await signedInMember();
    const twilio = twilioVerifyModel();
    const phoneNumber = `+2135${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(
      member.userId,
      phoneNumber,
      member.headers,
      twilio.deps,
    );
    const result = await confirmPhoneNumber(
      member.userId,
      { phoneNumber, otp: twilio.textedTo(phoneNumber) },
      member.headers,
      twilio.deps,
    );

    expect(result).toEqual({ ok: true, data: { accepted: true } });
    expect((await currentContact(member.db, member.userId)).phone).toBe(
      phoneNumber,
    );
    expect(twilio.checked).toHaveLength(1);
  });

  it('spends an attempt on each wrong code, the untexted stored one too, then refuses the right one', async () => {
    const member = await signedInMember();
    const twilio = twilioVerifyModel();
    const phoneNumber = `+2134${String(Date.now()).slice(-8)}`;
    const confirm = (otp: string) =>
      confirmPhoneNumber(
        member.userId,
        { phoneNumber, otp },
        member.headers,
        twilio.deps,
      );

    await sendPhoneCode(
      member.userId,
      phoneNumber,
      member.headers,
      twilio.deps,
    );
    const texted = twilio.textedTo(phoneNumber);
    const wrongCodes = [
      twilio.untexted.at(-1) ?? '',
      otherCode(texted, 1),
      otherCode(texted, 2),
    ];
    for (const otp of wrongCodes) {
      expect(await confirm(otp)).toMatchObject({
        ok: false,
        error: { code: 'contact_code_invalid' },
      });
    }

    expect(await confirm(texted)).toMatchObject({
      ok: false,
      error: { code: 'rate_limited' },
    });
    expect(twilio.checked).toEqual(wrongCodes);
    expect((await currentContact(member.db, member.userId)).phone).toBeNull();
  });

  it('refuses a code Twilio already approved when it comes back', async () => {
    const member = await signedInMember();
    const twilio = twilioVerifyModel();
    const phoneNumber = `+2133${String(Date.now()).slice(-8)}`;
    const confirm = (otp: string) =>
      confirmPhoneNumber(
        member.userId,
        { phoneNumber, otp },
        member.headers,
        twilio.deps,
      );

    await sendPhoneCode(
      member.userId,
      phoneNumber,
      member.headers,
      twilio.deps,
    );
    const approved = twilio.textedTo(phoneNumber);
    expect(await confirm(approved)).toMatchObject({ ok: true });
    await sendPhoneCode(
      member.userId,
      phoneNumber,
      member.headers,
      twilio.deps,
    );

    expect(await confirm(approved)).toMatchObject({
      ok: false,
      error: { code: 'contact_code_invalid' },
    });
  });
});
