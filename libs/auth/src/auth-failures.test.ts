import '@founders-coffee/observability/server-init';
import { APIError } from 'better-auth/api';
import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import { createDb, verification } from '@founders-coffee/db';

import { createAuth } from './auth.js';
import { authEnv } from './auth.fixtures.js';

const EMAIL = 'vegetable.table@example.com';
const CODE_HASH = 'hashed-sign-in-code-4f1c9a';
const CODE_ROW = {
  id: 'ver_stored_twice',
  identifier: `sign-in-otp-${EMAIL}`,
  value: CODE_HASH,
  expiresAt: new Date('2099-01-01T00:00:00Z'),
};

const CONSOLE_METHODS = ['debug', 'log', 'info', 'warn', 'error'] as const;

/** Collect every console line written while `run` runs. */
const consoleLines = async (
  run: () => Promise<unknown> | unknown,
): Promise<string[]> => {
  const lines: string[] = [];
  const spies = CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    }),
  );
  try {
    await run();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  return lines;
};

/**
 * Store a sign-in code the way Better Auth does, twice, so D1 really refuses the second insert,
 * and return what Drizzle threw for it: its params hold the address and the code's hash.
 */
const failedCodeInsert = async (): Promise<Error> => {
  const db = createDb(env.DB);
  await db.insert(verification).values(CODE_ROW).onConflictDoNothing();
  const thrown: unknown = await db
    .insert(verification)
    .values(CODE_ROW)
    .then(
      () => undefined,
      (error: unknown) => error,
    );
  if (!(thrown instanceof Error)) {
    return expect.unreachable('D1 stored the same sign-in code twice');
  }
  return thrown;
};

/** Assert that neither the address nor the code's hash survives in `text`. */
const expectNoBoundValue = (text: string | undefined): void => {
  expect(text).toBeDefined();
  expect(text).not.toContain(EMAIL);
  expect(text).not.toContain('vegetable');
  expect(text).not.toContain(CODE_HASH);
};

describe('a Better Auth endpoint failure', () => {
  it('is reported without the values bound to a failed query, and stripped before better-call prints it', async () => {
    const { auth } = createAuth(authEnv);
    const error = await failedCodeInsert();

    const lines = await consoleLines(() =>
      auth.options.onAPIError.onError(error),
    );

    expect(lines).toHaveLength(1);
    expectNoBoundValue(lines[0]);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      level: 'error',
      source: 'better-auth',
      msg: expect.stringMatching(/^Failed query: insert into "verification" /u),
    });
    expectNoBoundValue(error.message);
    expectNoBoundValue(error.stack);
    expect(error.message).toContain(
      '\ncause: D1_ERROR: UNIQUE constraint failed: verification.id',
    );
    expect(Reflect.get(error, 'params')).toEqual([]);
  });

  it('logs nothing for a refusal the endpoint meant', async () => {
    const { auth } = createAuth(authEnv);

    const lines = await consoleLines(() =>
      auth.options.onAPIError.onError(
        new APIError('BAD_REQUEST', { message: 'Invalid OTP' }),
      ),
    );

    expect(lines).toEqual([]);
  });

  it("sends Better Auth's own log lines through the structured logger, without the values", async () => {
    const { auth } = createAuth(authEnv);
    const context = await auth.$context;
    const error = await failedCodeInsert();

    const lines = await consoleLines(() =>
      context.logger.error('INTERNAL_SERVER_ERROR', error),
    );

    expect(lines).toHaveLength(1);
    expectNoBoundValue(lines[0]);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      level: 'error',
      source: 'better-auth',
      msg: 'INTERNAL_SERVER_ERROR',
    });
  });
});
