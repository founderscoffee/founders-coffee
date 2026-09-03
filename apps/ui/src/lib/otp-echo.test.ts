import { describe, expect, it } from 'vitest';

import { shouldEchoSignInCode, TEST_ADDRESS_DOMAIN } from './otp-echo';

const staging = { APP_ENVIRONMENT: 'staging', OTP_ECHO: 'true' };
const testAddress = `e2e-host-en-abc123${TEST_ADDRESS_DOMAIN}`;

describe('shouldEchoSignInCode', () => {
  it('echoes for a reserved test address on an enabled non-production deployment', () => {
    expect(shouldEchoSignInCode(staging, testAddress)).toBe(true);
  });

  it('never echoes in production, whatever else is set', () => {
    expect(
      shouldEchoSignInCode(
        { APP_ENVIRONMENT: 'production', OTP_ECHO: 'true' },
        testAddress,
      ),
    ).toBe(false);
  });

  it('never echoes without the explicit flag', () => {
    expect(
      shouldEchoSignInCode({ APP_ENVIRONMENT: 'staging' }, testAddress),
    ).toBe(false);
    expect(
      shouldEchoSignInCode(
        { APP_ENVIRONMENT: 'staging', OTP_ECHO: 'false' },
        testAddress,
      ),
    ).toBe(false);
    expect(shouldEchoSignInCode({}, testAddress)).toBe(false);
  });

  it('never echoes a real member, which is the fence that bounds the damage', () => {
    for (const address of [
      'member@founders.coffee',
      'someone@gmail.com',
      'attacker@e2e.invalid.example.com',
      'e2e.invalid@gmail.com',
      '',
    ]) {
      expect(shouldEchoSignInCode(staging, address), address).toBe(false);
    }
  });

  it('ignores address casing and surrounding whitespace', () => {
    expect(shouldEchoSignInCode(staging, `  HOST@E2E.INVALID  `)).toBe(true);
  });
});
