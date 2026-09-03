import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_LOG = new URL('../../.e2e/dev-server.log', import.meta.url)
  .pathname;

const logPath = (): string => process.env.E2E_SERVER_LOG ?? DEFAULT_LOG;

const SIX_DIGITS = /(\d{6})/;

/**
 * The most recent sign-in code issued to `email`, read from the development server's own output.
 *
 * Better Auth stores one-time codes hashed, so the database cannot give the code back, and the
 * development email provider prints it instead of sending mail. Reading that line keeps the login
 * step a genuine round trip through the real endpoints rather than a stubbed session, and adds no
 * test-only surface to the application: nothing here exists that a developer watching the terminal
 * does not already see.
 *
 * The same reader serves the deployed environment, where `OTP_ECHO` writes the identical line for
 * a reserved test address only, so the release gate reads one file shape whether it is pointed at a
 * dev server's output or at a `wrangler tail` stream.
 *
 * Matched by literal substring rather than an interpolated pattern, because an address is not a
 * safe regular expression.
 */
export const latestSignInOtp = (email: string): string | null => {
  const path = logPath();
  if (!existsSync(path)) return null;
  const marker = `email-OTP for ${email} `;
  const codes = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.includes(marker))
    .map((line) => line.slice(line.indexOf(marker)).match(SIX_DIGITS)?.[1])
    .filter((code): code is string => code !== undefined);
  return codes.at(-1) ?? null;
};
