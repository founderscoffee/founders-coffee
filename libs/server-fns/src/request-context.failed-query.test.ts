import '@founders-coffee/observability/server-init';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { user } from '@founders-coffee/db';

import { getDb } from './db.js';
import { withRequestContext } from './request-context.js';

const EMAIL = 'amina.founder@example.com';
const FREE_TEXT = 'Roasting coffee in Oran, looking for a co-founder who codes';
const PHONE_DIGITS = 21355512345678901234n;

const CONSOLE_METHODS = ['debug', 'log', 'info', 'warn', 'error'] as const;

/** Run `fn` inside the server-function boundary and collect every console line it writes. */
const failInsideBoundary = async (
  fn: () => Promise<unknown>,
): Promise<{ lines: string[]; thrown: Error }> => {
  const lines: string[] = [];
  const spies = CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    }),
  );
  try {
    await withRequestContext(fn);
  } catch (error) {
    return { lines, thrown: error as Error };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  throw new Error('the query was expected to fail');
};

/** Assert that none of the values bound to the failed query survive in `text`. */
const expectNoBoundValue = (text: string | undefined): void => {
  expect(text).toBeDefined();
  expect(text).not.toContain(EMAIL);
  expect(text).not.toContain('amina.founder');
  expect(text).not.toContain('Roasting coffee');
  expect(text).not.toContain(String(PHONE_DIGITS));
};

describe('a failed D1 query inside the server-function boundary', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(user).where(eq(user.email, EMAIL));
    await db
      .insert(user)
      .values({ id: 'usr_first', name: 'Amina', email: EMAIL });
  });

  it('logs its SQL and D1 error, never the email or the text bound to it', async () => {
    const { lines } = await failInsideBoundary(() =>
      getDb()
        .insert(user)
        .values({ id: 'usr_second', name: FREE_TEXT, email: EMAIL }),
    );

    expect(lines).toHaveLength(1);
    expectNoBoundValue(lines[0]);
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.level).toBe('error');
    expect(entry.msg).toMatch(/^Failed query: insert into "user" /u);
    expect(entry.msg).toContain('values (?, ?, ?');
    expect(entry.msg).toContain(
      '\ncause: D1_ERROR: UNIQUE constraint failed: user.email',
    );
    expect(entry.stack).toContain(entry.msg);
    expect(entry.stack).toMatch(/\n\s+at /u);
  });

  it('throws on without the values, as Start will serialize it', async () => {
    const { thrown } = await failInsideBoundary(() =>
      getDb()
        .insert(user)
        .values({ id: 'usr_second', name: FREE_TEXT, email: EMAIL }),
    );

    expectNoBoundValue(thrown.message);
    expectNoBoundValue(thrown.stack);
    expectNoBoundValue((thrown.cause as Error).message);
    expect((thrown as Error & { params: unknown[] }).params).toEqual([]);
  });

  it('redacts the value D1 quotes when it refuses to bind one', async () => {
    const { lines, thrown } = await failInsideBoundary(() =>
      getDb().run(
        sql`update "user" set "name" = ${FREE_TEXT}, "phone_number" = ${PHONE_DIGITS} where "email" = ${EMAIL}`,
      ),
    );

    expect(lines).toHaveLength(1);
    expectNoBoundValue(lines[0]);
    expectNoBoundValue(thrown.message);
    expectNoBoundValue(thrown.stack);
    expect((JSON.parse(lines[0]) as { msg: string }).msg).toContain(
      "\ncause: D1_TYPE_ERROR: Type 'bigint' not supported for value [redacted]",
    );
  });
});
