import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  setLogger,
  type LogContext,
  type Logger,
} from '@founders-coffee/observability';

import { createOtpEmailProvider } from './auth-email';

const lines: string[] = [];

const capture: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: (msg: string, context?: LogContext) =>
    lines.push(`${msg} ${JSON.stringify(context ?? {})}`),
  error: () => undefined,
  fatal: () => undefined,
  child: () => capture,
};

setLogger(capture);

const binding = { send: vi.fn(async () => undefined) } as never;

const send = async (email: string, env: Record<string, string>) => {
  const provider = createOtpEmailProvider(
    binding,
    'no-reply@founders.coffee',
    env,
  );
  await Promise.resolve(
    provider.sendOtp({ email, otp: '473812', type: 'sign-in' }),
  ).catch(() => undefined);
};

/** The reader the release gate uses, kept in step with what the echo writes. */
const readCode = (email: string): string | null => {
  const marker = `email-OTP for ${email} `;
  const hit = lines.filter((line) => line.includes(marker)).at(-1);
  return hit?.slice(hit.indexOf(marker)).match(/(\d{6})/)?.[1] ?? null;
};

describe('sign-in code echo', () => {
  afterEach(() => {
    lines.length = 0;
  });

  it('writes a line the release gate can read back', async () => {
    const email = 'e2e-host-en-abc@e2e.invalid';
    await send(email, { APP_ENVIRONMENT: 'staging', OTP_ECHO: 'true' });

    expect(readCode(email)).toBe('473812');
  });

  it('writes nothing for a real member on the same deployment', async () => {
    const email = 'member@founders.coffee';
    await send(email, { APP_ENVIRONMENT: 'staging', OTP_ECHO: 'true' });

    expect(readCode(email)).toBeNull();
    expect(lines.join('\n')).not.toContain('473812');
  });

  it('writes nothing in production, and nothing without the flag', async () => {
    const email = 'e2e-host-en-abc@e2e.invalid';
    await send(email, { APP_ENVIRONMENT: 'production', OTP_ECHO: 'true' });
    await send(email, { APP_ENVIRONMENT: 'staging' });

    expect(lines.join('\n')).not.toContain('473812');
  });
});
