import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { AppError } from '@founders-coffee/core';

import {
  describeError,
  describeStack,
  rethrowWithoutQueryValues,
  stripQueryValues,
  withoutQueryValues,
} from './query-values.js';

const EMAIL = 'amina.founder@example.com';
const INTRODUCTION =
  'Roasting coffee in Oran,\nlooking for a co-founder who codes';
const SQL =
  'insert into "user" ("id", "name", "email") values (?, ?, ?) returning "id"';
const UNIQUE_EMAIL =
  'D1_ERROR: UNIQUE constraint failed: user.email: SQLITE_CONSTRAINT';

const d1Error = (message: string): Error =>
  new Error(message, {
    cause: new Error(message.replace(/^D1_\w+: /u, '')),
  });

const failedInsert = (cause: unknown = d1Error(UNIQUE_EMAIL)) =>
  new DrizzleQueryError(SQL, ['usr_1', INTRODUCTION, EMAIL], cause as Error);

const expectNoValues = (text: string | undefined): void => {
  expect(text).toBeDefined();
  expect(text).not.toContain(EMAIL);
  expect(text).not.toContain('Roasting coffee');
  expect(text).not.toContain('co-founder who codes');
};

describe('withoutQueryValues', () => {
  it("cuts a failed query's params line, however many lines the values span", () => {
    const text = withoutQueryValues(failedInsert().message);
    expect(text).toBe(`Failed query: ${SQL}`);
  });

  it('cuts the values of a failed query copied into other text', () => {
    expect(
      withoutQueryValues(`dispatch_threw: ${failedInsert().message}`),
    ).toBe(`dispatch_threw: Failed query: ${SQL}`);
  });

  it('redacts the value D1 quotes when it refuses to bind it', () => {
    expect(
      withoutQueryValues(
        "D1_TYPE_ERROR: Type 'object' not supported for value 'it's amina@example.com'",
      ),
    ).toBe("D1_TYPE_ERROR: Type 'object' not supported for value [redacted]");
  });

  it('leaves text with no failed query in it alone, and is idempotent', () => {
    expect(withoutQueryValues('claim_expired: the sweep died')).toBe(
      'claim_expired: the sweep died',
    );
    const once = withoutQueryValues(failedInsert().message);
    expect(withoutQueryValues(once)).toBe(once);
  });
});

describe('describeError', () => {
  it("reduces a failed query to its SQL and its D1 error's message", () => {
    expect(describeError(failedInsert())).toBe(
      `Failed query: ${SQL}\ncause: ${UNIQUE_EMAIL}`,
    );
  });

  it('keeps only the kind of a D1 error that quotes a bound value', () => {
    const cause = d1Error(`D1_ERROR: malformed value near ${EMAIL}`);
    expect(describeError(failedInsert(cause))).toBe(
      `Failed query: ${SQL}\ncause: D1_ERROR: [redacted]`,
    );
  });

  it("redacts the value of D1's bind refusal", () => {
    const cause = d1Error(
      "D1_TYPE_ERROR: Type 'bigint' not supported for value '12345678901'",
    );
    expect(describeError(failedInsert(cause))).toBe(
      `Failed query: ${SQL}\ncause: D1_TYPE_ERROR: Type 'bigint' not supported for value [redacted]`,
    );
  });

  it('gives a failed query without a cause its SQL alone', () => {
    expect(describeError(new DrizzleQueryError(SQL, [EMAIL], undefined))).toBe(
      `Failed query: ${SQL}`,
    );
  });

  it('keeps any other error message, less a failed query copied into it', () => {
    expect(describeError(new TypeError('bad input'))).toBe('bad input');
    expect(
      describeError(
        new AppError('waitlist_launch_failed', failedInsert().message),
      ),
    ).toBe(`Failed query: ${SQL}`);
    expect(describeError('a string was thrown')).toBe('a string was thrown');
  });

  it('describes a failed query found in the cause chain of another error', () => {
    const wrapped = new Error('save failed', { cause: failedInsert() });
    expect(describeError(wrapped)).toBe('save failed');
  });
});

describe('describeStack', () => {
  it("keeps a failed query's frames under a header without its values", () => {
    const error = failedInsert();
    expect(error.stack).toContain(EMAIL);
    const stack = describeStack(error);
    expectNoValues(stack);
    expect(stack).toContain(`Failed query: ${SQL}\ncause: ${UNIQUE_EMAIL}`);
    expect(stack).toMatch(/\n\s+at /u);
  });

  it('returns the stack of an error with no values as it was', () => {
    const error = new Error('boom');
    expect(describeStack(error)).toBe(error.stack);
  });
});

describe('stripQueryValues', () => {
  it('strips a failed query and its D1 errors in place, keeping its SQL', () => {
    const cause = d1Error(
      "D1_TYPE_ERROR: Type 'bigint' not supported for value '12345678901'",
    );
    const error = failedInsert(cause);
    expect(stripQueryValues(error)).toBe(error);
    expect(error).toBeInstanceOf(DrizzleQueryError);
    expect(error.message).toBe(
      `Failed query: ${SQL}\ncause: D1_TYPE_ERROR: Type 'bigint' not supported for value [redacted]`,
    );
    expectNoValues(error.stack);
    expect(error.stack).toMatch(/\n\s+at /u);
    expect(error.params).toEqual([]);
    expect(error.query).toBe(SQL);
    for (const inner of [cause, cause.cause as Error]) {
      expect(inner.message).not.toContain('12345678901');
      expect(inner.stack).not.toContain('12345678901');
    }
  });

  it('withholds a D1 error quoting a bound value at every depth of the chain', () => {
    const cause = d1Error(`D1_ERROR: malformed value near ${EMAIL}`);
    const error = stripQueryValues(failedInsert(cause));
    expectNoValues(error.message);
    expectNoValues(cause.message);
    expectNoValues((cause.cause as Error).message);
    expectNoValues((cause.cause as Error).stack);
  });

  it('describes a stripped error just as it did before', () => {
    const described = describeError(failedInsert());
    const error = stripQueryValues(failedInsert());
    expect(describeError(error)).toBe(described);
    expect(describeError(stripQueryValues(error))).toBe(described);
  });

  it('strips a failed query beneath an AppError and keeps the code', () => {
    const query = failedInsert();
    const error = new AppError('profile_save_failed', 'Could not save');
    Object.assign(error, { cause: query });
    stripQueryValues(error);
    expect(error.code).toBe('profile_save_failed');
    expect(error.message).toBe('Could not save');
    expectNoValues(query.message);
    expectNoValues(query.stack);
  });

  it('leaves an error without values, and anything that is not an error, as they were', () => {
    const error = new Error('boom');
    const stack = error.stack;
    stripQueryValues(error);
    expect(error.message).toBe('boom');
    expect(error.stack).toBe(stack);
    expect(stripQueryValues('text')).toBe('text');
    expect(stripQueryValues(null)).toBe(null);
  });
});

describe('rethrowWithoutQueryValues', () => {
  it('throws the same error, stripped', () => {
    const error = failedInsert();
    expect(() => rethrowWithoutQueryValues(error)).toThrow(error);
    expectNoValues(error.message);
    expectNoValues(error.stack);
  });
});
