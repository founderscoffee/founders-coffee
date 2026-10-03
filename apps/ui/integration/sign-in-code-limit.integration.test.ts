import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { SIGN_IN_CODE_MAILBOX_BUDGET } from '@founders-coffee/server-fns/sign-in-code-limit';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const DELIVERABLE = 'ok@example.com';

const askForCode = async (
  email: string,
  address: string,
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        'cf-connecting-ip': address,
      },
      body: JSON.stringify({ email, type: 'sign-in' }),
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('POST /api/auth/email-otp/send-verification-otp', () => {
  it('mails a mailbox its hourly sign-in codes, from any sender, then answers 429', async () => {
    const { limit } = SIGN_IN_CODE_MAILBOX_BUDGET;
    const statuses: number[] = [];

    for (let sent = 0; sent <= limit; sent += 1) {
      const response = await askForCode(DELIVERABLE, `198.51.100.${sent + 1}`);
      statuses.push(response.status);
      if (response.status === 429)
        expect(await response.json()).toMatchObject({ code: 'TOO_MANY_CODES' });
    }

    expect(statuses).toEqual([...Array(limit).fill(200), 429]);
  });
});
