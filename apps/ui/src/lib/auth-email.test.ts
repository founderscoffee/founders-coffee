import { afterEach, describe, expect, it, vi } from 'vitest';

import { cookieName } from '@founders-coffee/i18n';
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

interface SentEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const sendEmail = vi.fn(async (message: SentEmail) => ({
  messageId: message.subject,
}));
const binding = { send: sendEmail } as never;

const send = async (
  email: string,
  env: Record<string, string>,
  localeCookie?: string,
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email' =
    'sign-in',
) => {
  const provider = createOtpEmailProvider(
    binding,
    'no-reply@founders.coffee',
    env,
  );
  const context = localeCookie
    ? { headers: new Headers({ cookie: `${cookieName}=${localeCookie}` }) }
    : undefined;
  await Promise.resolve(
    provider.sendOtp({ email, otp: '473812', type }, context),
  ).catch(() => undefined);
};

const latestEmail = (): SentEmail => {
  const message = sendEmail.mock.lastCall?.[0];
  if (!message) throw new Error('Expected an email to be sent');
  return message;
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
    sendEmail.mockClear();
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

  it.each([
    ['ar', 'Founders Coffee - رمز تسجيل الدخول', 'rtl', 'مرحبًا بك'],
    ['fr', 'Founders Coffee - votre code de connexion', 'ltr', 'Bienvenue'],
    ['en', 'Founders Coffee - your sign-in code', 'ltr', 'Welcome'],
  ] as const)('localizes the OTP email for %s', async (locale, subject, dir, greeting) => {
    await send('member@example.com', {}, locale);

    const message = latestEmail();
    expect(message.subject).toBe(subject);
    expect(message.html).toContain(`lang="${locale}"`);
    expect(message.html).toContain(`dir="${dir}"`);
    expect(message.html).toContain(greeting);
    expect(message.html).toContain('direction:ltr');
  });

  it('falls back to Arabic when the locale cookie is missing or unsupported', async () => {
    await send('member@example.com', {});
    expect(latestEmail().subject).toBe('Founders Coffee - رمز تسجيل الدخول');

    await send('member@example.com', {}, 'de');
    expect(latestEmail().subject).toBe('Founders Coffee - رمز تسجيل الدخول');
  });

  it.each([
    ['email-verification', 'Founders Coffee - verify your email'],
    ['forget-password', 'Founders Coffee - your password reset code'],
    ['change-email', 'Founders Coffee - confirm your new email'],
  ] as const)('localizes the %s subject', async (type, subject) => {
    await send('member@example.com', {}, 'en', type);

    expect(latestEmail().subject).toBe(subject);
  });
});
