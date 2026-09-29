import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setLogger, type LogEntry } from '@founders-coffee/observability';
import { createServerLogger } from '@founders-coffee/observability/server';

import { TwilioVerifySmsProvider } from './sms.js';

const PHONE_NUMBER = '+213555123456';
const entries: LogEntry[] = [];

const twilioRefusal = (status: number, code: number) =>
  new Response(
    JSON.stringify({
      code,
      message: `Invalid parameter \`To\`: ${PHONE_NUMBER}`,
      more_info: `https://www.twilio.com/docs/errors/${code}`,
      status,
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );

const provider = () =>
  new TwilioVerifySmsProvider({
    TWILIO_SID: 'VA0000',
    TWILIO_AID: 'AC0000',
    TWILIO_SEC: 'secret',
  });

beforeEach(() => {
  entries.length = 0;
  setLogger(
    createServerLogger({
      level: 'debug',
      transport: (entry) => {
        entries.push(entry);
      },
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TwilioVerifySmsProvider — a refused request', () => {
  it('logs why a send failed, but not the number it was for', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(twilioRefusal(400, 60200)),
    );

    await expect(
      provider().sendOtp({ phoneNumber: PHONE_NUMBER, code: '123456' }),
    ).rejects.toMatchObject({ code: 'sms_failed' });

    expect(entries).toEqual([
      expect.objectContaining({
        msg: 'sms.twilio_verify_http_error',
        status: 400,
        twilioCode: 60200,
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain(PHONE_NUMBER.slice(4));
  });

  it('logs why a check failed, but not the number it was for', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(twilioRefusal(404, 20404)),
    );

    expect(
      await provider().verifyOtp({ phoneNumber: PHONE_NUMBER, code: '123456' }),
    ).toBe(false);

    expect(entries).toEqual([
      expect.objectContaining({
        msg: 'sms.twilio_verify_check_http_error',
        status: 404,
        twilioCode: 20404,
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain(PHONE_NUMBER.slice(4));
  });
});
